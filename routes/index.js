"use strict";

var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    uuid = require("node-uuid"),
    glob = require('glob'),
    underscore = require('underscore'),
    handlebars = require('handlebars'),
    request = require('request'),
    Swag = require('../vendors/swag'),
    csv = require('csv'),
    opts = {},
    connection = null,
    client = null,
    transport = null,
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

};


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

//process csv
exports.processCsv = function(req, res) {
    console.log(req.files.files[0].path);
    var stations = {},
        csvFile = [],
        fileName = path.basename(req.files.files[0].path);
    csv()
    .from(req.files.files[0].path)
    .on('record', function(row, index){
        //console.log(row, stations);
        if (row[1] in stations == false) {
            stations[row[1]] = [[row[2], row[3]]];
        } else {
            stations[row[1]].push([row[2], row[3]]);
        }
    })
    .on('end', function(count){

        Object.keys(stations).forEach(function(key, index) {
            var row = [key];
            stations[key].forEach(function(points, index) {
                row.push(points[0], points[1]);
            });
            csvFile.push(row);
        });
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(req.files), 'utf-8');
        res.end('\n');

        csv()
        .from.array(csvFile)
        .to.string(function(text){
            fileName = path.normalize(__dirname + '/../out/'+fileName);
            console.log(fileName);
            fs.writeFile(fileName, text, 'utf8', function (err) {
                if (err) throw err;
                console.log('CSV saved!');
            });
        });
    });


};

exports.downloadCsv = function(req, res) {
    var fileId = req.params.fileId,
        filePath = path.normalize(__dirname + '/../out/'+fileId+".csv");
    res.download(filePath, fileId+".csv");

}
