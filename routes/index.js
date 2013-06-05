"use strict";

var fs = require('fs'),
    path = require('path'),
    mysql = require('mysql'),
    email = require('nodemailer'),
    crypto = require('crypto'),
    spawn = require('child_process').spawn,
    execFile = require('child_process').execFile,
    async = require('async'),
    Acl = require('acl'),
    uuid = require("node-uuid"),
    glob = require('glob'),
    underscore = require('underscore'),
    pdf417 = require('pdf417'),
    ipp = require('ipp'),
    handlebars = require('handlebars'),
    authnet = require('authnet'),
    request = require('request'),
    parser = require('xml2json'),
    NodePDF = require('nodepdf'),
    Swag = require('../vendors/swag'),
    receipt = fs.readFileSync("./public/templates/receipt.html", "utf8"),
    opts = {},
    printerUrl = {},
    connection = null,
    client = null,
    transport = null,
    acl = null,
    db = null,
    reconnectTries = 0;

/**
 * usages (handlebars)
 * {{short_string this}}
 * {{short_string this length=150}}
 * {{short_string this length=150 trailing="---"}}
**/
handlebars.registerHelper('short_string', function(context, options){
    //console.log(options);
    var maxLength = options.hash.length || 100;
    var trailingString = options.hash.trailing || '';
    if (typeof context != "undefined") {
        if(context.length > maxLength){
            return context.substring(0, maxLength) + trailingString;
        }
    }
    return context;
});

exports.setKey = function(key, value) {
    opts[key] = value;
};

exports.initialize = function() {
    //Initialize Mysql
    getConnection();
    //Initialize Email Client
    transport = email.createTransport("sendmail", {
        args: ["-f noreply@vpr.tamu.edu"]
    });

};

var getMember = function(submissionId, callback) {
    var sql = "SELECT * FROM vpppa.www_rsform_submission_values WHERE submissionid = ? ORDER BY FieldValue ASC; "+
              "SELECT * FROM memberPayments.transactions WHERE submissionid = ? ORDER BY submitTimeUTC";
    connection.query(sql, [submissionId, submissionId], function(err, results) {
        if (err) throw err;
        var member = {};
        results[0].forEach(function(row, index) {
            member[row.FieldName] = row.FieldValue;
        });
        member.creditCardTrans = results[1];
        callback(member);
    });
}


var saveTransaction = function(res, callback) {
    var sql = "INSERT INTO memberPayments.transactions SET ?",
        vars = underscore.clone(res.transaction);
    delete vars.batch;
    delete vars.payment;
    delete vars.order;
    delete vars.billTo
    delete vars.shipTo
    delete vars.recurringBilling;
    delete vars.customer;
    delete vars.customerIP;
    vars = underscore.extend(vars, res.transaction.batch);
    vars = underscore.extend(vars, res.transaction.order);
    vars = underscore.extend(vars, res.transaction.payment.creditCard);
    vars = underscore.extend(vars, res.transaction.customer);
    vars = underscore.extend(vars, {
        billToFirstName: res.transaction.billTo.firstName,
        billToLastName: res.transaction.billTo.lastName,
        billToAddress: res.transaction.billTo.address,
        billToCity: res.transaction.billTo.city,
        billToState: res.transaction.billTo.state,
        billToZip: res.transaction.billTo.zip,
        billToPhoneNumber: res.transaction.billTo.phoneNumber
    });
    if ("shipTo" in res.transaction) {
        vars = underscore.extend(vars, {
            shipToFirstName: res.transaction.shipTo.firstName,
            shipToLastName: res.transaction.shipTo.lastName,
            shipToAddress: res.transaction.shipTo.address,
            shipToCity: res.transaction.shipTo.city,
            shipToState: res.transaction.shipTo.state,
            shipToZip: res.transaction.shipTo.zip
        });
    }
    vars.transId = vars.transId.toString();
    console.log(vars);
    connection.query(sql, vars, function(err, result) {
        if (err) throw err;
        callback({dbResult:result, creditResult:res});
    })
}

/************
* Routes
*************/

exports.index = function(req, res){
    var sid = (typeof req.session != "undefined") ? req.session.id : null;
    //Regenerates the JS/template file
    //if (req.url.indexOf('/bundle') === 0) { bundle(); }

    //Don't process requests for API endpoints
    if (req.url.indexOf('/api') === 0 ) { return next(); }
    console.log("[index] session id:", sid);

    var init = "$(document).ready(function() { App.initialize(); });";
    //if (typeof req.session.user !== 'undefined') {
        init = "$(document).ready(function() { App.uid = '" + sid + "'; App.initialize(); });";
    //}
    fs.readFile(__dirname + '/../public/templates/index.html', 'utf8', function(error, content) {
        if (error) { console.log(error); }
        var prefix = ("prefix" in opts.configs) ? opts.configs.prefix : "";
        var pageBuilder = handlebars.compile(content),
            html = pageBuilder({'init':init, 'prefix':prefix});
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(html, 'utf-8');
        res.end('\n');
    });
};

//Return member
exports.member = function(req, res) {
    var submissionId = req.params.submissionId,
        callback = function(member) {
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(member), 'utf-8');
            res.end('\n');
        };

    getMember(submissionId, callback);

};

exports.genBadge = function(req, res) {

    var id = req.params.id,
        action = req.params.action,
        resource = res,
        downloadCallback = function(pdf) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, {
                'Content-Disposition': 'inline; filename="badge.'+id+'.pdf"',
                'Content-type': 'application/pdf'
            });
            res.end(pdf, 'binary');
        },
        printCallback = function(pdf) {
            console.log(printerUrl);
            var printer = ipp.Printer(printerUrl.badge.url);
            var msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "Station",
                    "job-name": "Badge Print Job",
                    "document-format": "application/pdf"
                },
                data: pdf
            };
            printer.execute("Print-Job", msg, function(err, res){
                if (err) console.log(err);
                resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                resource.writeHead(200, { 'Content-type': 'application/json' });
                resource.write(JSON.stringify(res), 'utf-8');
                resource.end('\n');
                console.log(res);
            });
        },
        registrantCallback = function(registrants) {
            var sql = "SELECT * FROM event_badge WHERE eventId = ?",
                vars = [registrants[1][0].event_id]

            connection.query(sql, vars, function(err, rows) {
                if (err) throw err;
                if (action == "print") {
                    createBadge(registrants[1][0], rows[0].template, printCallback);
                } else if (action == "download") {
                    createBadge(registrants[1][0], rows[0].template, downloadCallback);
                }
            });
        };

    /**
    if (typeof req.session.user_id === 'undefined') {
        res.writeHead(401, { 'Content-type': 'text/html' });
        res.end();
        return;
    }
    **/
    console.log("[genBadge] session id:", req.session.id);
    console.log("Badge action:", action);
    getEventGroupMembers(["registrantid"], id, 0, 20, registrantCallback, false);


};

exports.genReceipt = function(req, res) {

    var id = req.params.id,
        action = req.params.action,
        resource = res,
        receiptFileNameHtml = "",
        receiptFileNamePdf = "",
        downloadCallback = function(html) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            resource.writeHead(200, { 'Content-type': 'text/html' });
            resource.write(html, 'utf-8');
            resource.end('\n');
        },
        printCallback = function(pdf) {
            console.log(printerUrl);
            var printer = ipp.Printer(printerUrl.receipt.url);
            var msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "Station",
                    "job-name": "Badge Print Job",
                    "document-format": "application/pdf"
                },
                data: pdf
            };
            printer.execute("Print-Job", msg, function(err, res){
                resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                resource.writeHead(200, { 'Content-type': 'application/json' });
                resource.write(JSON.stringify(res), 'utf-8');
                resource.end('\n');
                console.log(res);
            });
        },
        registrantCallback = function(registrants) {
            var sql = "SELECT * FROM event_badge WHERE eventId = ?",
                vars = [registrants[1][0].event_id]

            connection.query(sql, vars, function(err, rows) {
                if (err) throw err;
                /*
                if (action == "print") {
                    createBadge(registrants[1][0], rows[0].template, printCallback);
                } else if (action == "download") {
                    createBadge(registrants[1][0], rows[0].template, downloadCallback);
                }
                */
                var pageBuilder = handlebars.compile(receipt),
                    html = pageBuilder(registrants[1][0]);
                if (action == "view") {
                    downloadCallback(html);
                } else {
                    var random = crypto.randomBytes(4).readUInt32LE(0);
                    receiptFileNameHtml = path.normalize(__dirname + '/../tmp/receipt.'+random+'.html');
                    receiptFileNamePdf = path.normalize('receipt.'+random+'.pdf');
                    fs.writeFile(receiptFileNameHtml, html, function(err) {
                        if (err) console.log(err);
                        var pdf = new NodePDF(receiptFileNameHtml, receiptFileNamePdf, {width:670, height:1160});

                        pdf.on('error', function(msg){
                            console.log(msg);
                        });

                        pdf.on('done', function(pathToFile){
                            console.log(pathToFile);
                            fs.readFile(pathToFile, function (err, data) {
                                if (err) console.log(err);
                                fs.unlink(pathToFile, function(err) {
                                    if (err) console.log(err);
                                });
                                fs.unlink(receiptFileNameHtml, function(err) {
                                    if (err) console.log(err);
                                });
                                printCallback(data);
                            });
                        });
                    });
                }
            });
        };

    /**
    if (typeof req.session.user_id === 'undefined') {
        res.writeHead(401, { 'Content-type': 'text/html' });
        res.end();
        return;
    }
    **/
    console.log("[genBadge] session id:", req.session.id);
    console.log("Badge action:", action);
    getEventGroupMembers(["registrantid"], id, 0, 20, registrantCallback, true);


};

exports.getRegistrant = function(req, res) {
    var id = req.params.id,
        callback = function(registrants) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(registrants[1][0]), 'utf-8');
            res.end('\n');
        };

    console.log("[getRegistrant] session id:", req.session.id);
    getEventGroupMembers(["registrantid"], id, 0, 20, callback);
};

exports.updateRegistrantValues = function(req, res) {

    var sid = req.session.id,
        id = req.params.id,
        values = req.body,
        sql = "DELETE FROM member_field_values WHERE event_id = ? AND member_id = ?; ",
        vars = [values.event_id, values.local_id],
        updateSelf = ['confirmnum'];

    connection.query(sql, vars, function(err, rows) {
        sql = "SELECT * FROM event_fields WHERE event_id = ?;",
        vars = [values.event_id];

        console.log("[updateRegistrantValues] session id:", req.session.id);
        console.log("id", id);
        //console.log(values);
        connection.query(sql, vars, function(err, rows) {
            var vars = [],
                sql = "";
            if (err) throw err;
            rows.forEach(function(field, index) {

                if (typeof values.fields[field.name] != "undefined") {
                    sql += "INSERT INTO member_field_values SET value = ?, event_id = ?, field_id = ?, member_id = ?; ";
                    if (field.values && (field.type == 4 || field.type == 1)) {
                        var fValues = field.values.split("|");
                        values.fields[field.name] = fValues.indexOf(values.fields[field.name]);
                    }
                    vars.push(values.fields[field.name], values.event_id, field.local_id, values.local_id);
                    //console.log(values.fields[field.name], values.event_id, field.local_id, values.local_id);
                    /*
                    sql += "INSERT INTO biller_field_values SET value = ?, event_id = ?, field_id = ?, user_id = ?; ";
                    if (field.values) {
                        var fValues = field.values.split("|");
                        values.fields[field.name] = fValues.indexOf(values.fields[field.name]);
                    }

                    vars.push(values.fields[field.name], values.event_id, field.local_id, values.biller_id);
                    */
                }
            });

            updateSelf.forEach(function(field, index) {
                if (typeof values.fields[field] != "undefined") {
                    sql += "UPDATE group_members SET "+field+" = ? WHERE event_id = ? AND groupMemberId = ?;";
                    vars.push(values.fields[field], values.event_id, values.local_id);
                }

            });

            //console.log(sql, vars);
            connection.query(sql, vars, function(err, results) {
                if (err) throw err;
                //console.log(results);
                res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                res.writeHead(200, { 'Content-type': 'application/json' });
                res.write(JSON.stringify(values), 'utf-8');
                res.end('\n');
                logAction(sid, "registrant", id, "updated", "Registrant updated");
            });
        });
    });
};

exports.updateRegistrant = function(req, res) {

    var id = req.params.id,
        sid = req.session.id,
        values = req.body,
        sql = "UPDATE group_members SET ? WHERE id = "+id;

    console.log("[updateRegistrant] session id:", req.session.id);
    //console.log(values);
    connection.query(sql, values, function(err, results) {
        if (err) throw err;
        //console.log(results);
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(values), 'utf-8');
        res.end('\n');
    });

    if ("attend" in values) {
        if (values.attend) {
            logAction(sid, "registrant", id, "attend", "Registrant checked in");
            updateCheckedIn();
        } else {
            logAction(sid, "registrant", id, "attend", "Registrant checked out");
            updateCheckedIn();
        }
    }

};

exports.addRegistrant = function(req, res) {

    var sid = req.session.id,
        values = req.body,
        sql =   "SELECT *  "+
                "FROM biller  "+
                "WHERE eventId = ? "+
                "ORDER BY userId DESC LIMIT 1; "+
                "SELECT * "+
                "FROM group_members  "+
                "WHERE event_id = ?  "+
                "ORDER BY groupMemberId DESC LIMIT 1; "+
                "SELECT * FROM event WHERE eventId = ?; "+
                "SELECT * FROM event_fields WHERE event_id = ?;",
        vars = [values.eventId, values.eventId, values.eventId, values.eventId],
        retCallback = function(registrants) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(registrants[1][0]), 'utf-8');
            res.end('\n');
        };
    //console.log(values);
    connection.query(sql, vars, function(err, results) {
        if (err) throw err;
        //console.log(results);
        var userId = results[0][0].userId + 1,
            memberId = results[1][0].groupMemberId + 1,
            confirmNum = results[2][0].confirm_number_prefix+(parseInt(results[1][0].confirmnum.split("-")[1])+1);

        async.waterfall([
            function(callback){
                var vars = {
                        "userId": userId,
                        "eventId": values.eventId,
                        "local_eventId": values.slabId,
                        "type": "G",
                        "register_date": "0000-00-00 00:00:00",
                        "due_amount": 0.00,
                        "confirmNum": confirmNum,
                        "status": 1,
                        "memtot": 1
                    },
                    sql = "INSERT INTO biller SET ?";
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, vars, memberId);

                });
            },
            function(vars, memberId, callback){
                var oldVars = vars,
                    vars = {
                        "groupMemberId": memberId,
                        "event_id": oldVars.eventId,
                        "groupUserId": oldVars.userId,
                        "confirmnum": oldVars.confirmNum,
                    },
                    sql = "INSERT INTO group_members SET ?";
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, vars, insertResults.insertId);

                });
            },
            function(vars, memberId, callback){
                var oldVars = vars,
                    sql = "",
                    vars = [];

                results[3].forEach(function(field, index) {
                    if (typeof values[field.name] != "undefined") {
                        sql += "INSERT INTO member_field_values SET value = ?, event_id = ?, field_id = ?, member_id = ?; ";
                        if (field.values) {
                            var fValues = field.values.split("|");
                            values[field.name] = fValues.indexOf(values[field.name]);
                        }
                        vars.push(values[field.name], values.eventId, field.local_id, oldVars.groupMemberId);
                        sql += "INSERT INTO biller_field_values SET value = ?, event_id = ?, field_id = ?, user_id = ?; ";
                        if (field.values) {
                            var fValues = field.values.split("|");
                            values[field.name] = fValues.indexOf(values[field.name]);
                        }
                        vars.push(values[field.name], values.eventId, field.local_id, oldVars.groupUserId);
                        //console.log(values.fields[field.name], values.event_id, field.local_id, values.local_id);
                    }
                });
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, memberId);
                });
            }
        ], function (err, result) {
            //console.log(result);

            getEventGroupMembers(["registrantid"], result, 0, 20, retCallback);
        });
    });
};

exports.getEvents = function(req, res) {

    var sid = req.session.id,
        id = req.params.id,
        sql = "SELECT * FROM event ORDER BY slabId ASC;";

    console.log("[getEvents] session id:", req.session.id);
    connection.query(sql, function(err, rows) {
        if (err) throw err;
        var getFields = function(event, callback) {
            var sql = "SELECT * FROM event_fields WHERE event_id = ? AND showed = 3 ORDER BY ordering ASC;",
                vars = [event.eventId];

            connection.query(sql, vars, function(err, rows) {
                var types = ['Text','Select','TextArea','Checkbox','Select','Text','Text','Text','Text'],
                    fields = {},
                    fieldset = [];

                rows.forEach(function(row, index) {
                    var schemaRow = {
                        "title": row.label,
                        "type": types[row.type]
                    };
                    if (row.values) {
                        var values = row.values.split("|");
                        schemaRow.options = values;
                    }
                    fields[row.name] = schemaRow;
                    fieldset.push(row.name);
                });
                //console.log(fields);
                event.fields = fields;
                event.fieldset = fieldset;
                callback(null, event);
            });
        };

        async.map(rows, getFields, function(err, results){
            //console.log(results);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(results), 'utf-8');
            res.end('\n');
        });

    });

}

exports.getEventFields = function(req, res) {

    var sid = req.session.id,
        id = req.params.id,
        sql = "SELECT * FROM event_fields WHERE event_id = ?;",
        vars = [id];

    console.log("[getEventField] session id:", req.session.id);
    connection.query(sql, vars, function(err, rows) {
        if (err) throw err;
        //console.log(rows);
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(rows), 'utf-8');
        res.end('\n');
    });

};

exports.makePayment = function(req, res) {

    var submissionId = req.params.submissionId,
        values = req.body,
        sql = "",
        transAction = values.transaction,
        payments = authnet.aim({
            id: opts.configs.authorizenet.id,
            key: opts.configs.authorizenet.key,
            env: opts.configs.authorizenet.env
        }),
        transactions = authnet.td(opts.configs.authorizenet),
        successCallback = function(result) {
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(result), 'utf-8');
            res.end('\n');
        };
    console.log("Submission Id:", req.params);

    if (values.type == "check") {
        sql = "UPDATE biller SET transaction_id = ? WHERE eventId = ? AND userId = ?";
        var vars = [values.transaction.payment.checkNumber, values.registrant.event_id, values.registrant.biller_id];
        connection.query(sql, vars, function(err, results) {
            if (err) console.log(err);
            sql = "SELECT * FROM event_fees WHERE event_id = ? AND user_id = ?";
            var vars = [values.registrant.event_id, values.registrant.biller_id];
            connection.query(sql, vars, function(err, rows) {
                if (err) console.log(err);
                var vars = [transAction.amount, transAction.amount, transAction.amount, 1, "2", values.registrant.event_id, values.registrant.biller_id];
                if (rows.length > 0) {
                    sql = "UPDATE";
                } else {
                    sql = "INSERT INTO"
                }
                sql += " event_fees SET basefee = ?, fee = ?, paid_amount = ?, status = ?, payment_method = ? WHERE event_id = ? AND user_id = ?";

                connection.query(sql, vars, function(err, result) {
                    if (err) console.log(err);
                    successCallback({dbResult:result});
                });
            });
        });
      } else if (values.type != "check") {

        payments.createTransaction(transAction, function (err, results){
            console.log(results);
            if (results.code == "I00001") {
                var trans = {
                        transId: results.transactionResponse.transId
                    };
                transactions.getTransactionDetails(trans, function (err, result){
                    var transactionDetails = result;
                    transactionDetails.transaction.submissionId = submissionId
                    console.log(transactionDetails);
                    saveTransaction(transactionDetails, successCallback);
                });
            } else {
                res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                res.writeHead(200, { 'Content-type': 'application/json' });
                res.write(JSON.stringify(results), 'utf-8');
                res.end('\n');
            }
        });
    }

}

exports.getNumberCheckedIn = function(req, res) {
    var sql = "SELECT COUNT(id) as count FROM group_members WHERE attend = 1";
    connection.query(sql, function(err, rows) {
        if (err) console.log(err);
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify({"checkedIn": rows[0].count}), 'utf-8');
        res.end('\n');
    });
}

var updateCheckedIn = function() {
    var sql = "SELECT COUNT(id) as count FROM group_members WHERE attend = 1";
    connection.query(sql, function(err, rows) {
        if (err) console.log(err);
        console.log(rows);
        logAction(0, "updates", rows[0].count, "checkedIn", "Number checked in");
    });
}

//Helpers
var getConnection = function() {
    // Test connection health before returning it to caller.
    if ((connection) && (connection._socket)
            && (connection._socket.readable)
            && (connection._socket.writable)) {
        return connection;
    }
    console.log(((connection) ?
            "UNHEALTHY SQL CONNECTION; RE" : "") + "CONNECTING TO SQL.");
    connection = mysql.createConnection(opts.configs.mysql);
    connection.connect(function(err) {
        if (err) {
            console.log("(Retry: "+reconnectTries+") SQL CONNECT ERROR: " + err);
            reconnectTries++;
            var timeOut = ((reconnectTries * 50) < 30000) ? reconnectTries * 50 : 30000;
            if (reconnectTries == 50) {
                /**
                var mailOptions = {
                    from: "VPPPA Site ID Lookup <noreply@vpppa.org>", // sender address
                    to: "problem@griffinandassocs.com", // list of receivers
                    subject: "VPPPA Site ID Lookup DB Issue", // Subject line
                    text: "The VPPPA Site ID Lookup is unable to connect to the mysql db server.", // plaintext body
                    html: "<b>The VPPPA Site ID Lookup is unable to connect to the mysql db server.</b>" // html body
                };

                transport.sendMail(mailOptions, function(error, response){
                    if(error){
                        console.log(error);
                    }else{
                        console.log("Message sent: " + response.message);
                    }

                    // if you don't want to use this transport object anymore, uncomment following line
                    //smtpTransport.close(); // shut down the connection pool, no more messages
                });
                **/
            }
            setTimeout(getConnection, timeOut);
        } else {
            console.log("SQL CONNECT SUCCESSFUL.");
            reconnectTries = 0;
            handleDisconnect(connection);
        }
    });
    connection.on("close", function (err) {
        console.log("SQL CONNECTION CLOSED.");
    });
    connection.on("error", function (err) {
        console.log("SQL CONNECTION ERROR: " + err);
    });
    connection = connection;
    return connection;
}


var handleDisconnect = function (connection) {
  connection.on('error', function(err) {
    if (!err.fatal) {
      return;
    }

    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
      throw err;
    }

    console.log('Re-connecting lost connection: ' + err.stack);

    getConnection();

  });
};

function logAction(uid, objType, objId, modType, desc) {
    var logData = {
            objectType: objType,
            objectId: objId,
            uid: uid,
            modType: modType,
            description: desc
        };

    opts.io.broadcast('talk', logData);
}

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}
