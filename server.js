/*  ==============================================================
    Include required packages
=============================================================== */

var express = require('express.io'),
    fs = require('fs'),
    path = require('path'),
    routes = require('./routes'),
    ioEvents = require('./ioEvents'),
    opts = {};

/*  ==============================================================
    Configuration
=============================================================== */

//used for session and password hashes
var salt = '20sdkfjk23';

fs.exists(__dirname + '/tmp', function (exists) {
    if (!exists) {
        fs.mkdir(__dirname + '/tmp', function (d) {
            console.log("temp directory created");
        });
    }
});

if (process.argv[2]) {
    if (fs.lstatSync(process.argv[2])) {
        config = require(process.argv[2]);
    } else {
        config = require(process.cwd()+'/settings.json');
    }
} else {
    config = require(__dirname + '/settings.json');
}

if ("log" in config) {
    var access_logfile = fs.createWriteStream(config.log, {flags: 'a'})
}

var cookieParser = express.cookieParser(),
    redisSessionStore = new redisStore(redisConfig);

if ("ssl" in config) {

    if (config.ssl.key) {
        opts["key"] = fs.readFileSync(config.ssl.key);
    }

    if (config.ssl.cert) {
        opts["cert"] = fs.readFileSync(config.ssl.cert);
    }

    if (config.ssl.ca) {
        opts["ca"] = [];
        config.ssl.ca.forEach(function (ca, index, array) {
            opts.ca.push(fs.readFileSync(ca));
        });
    }

    console.log("Express will listen: https");

}

routes.setKey("configs", config);
routes.initialize();

var app = module.exports = express(opts);

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Range, Content-Disposition, Content-Description');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

// Configuration

app.configure(function(){
    if ("log" in config) {
        app.use(express.logger({stream: access_logfile }));
    }
    app
        .use(cookieParser)
        .use(express.bodyParser())
        .use(express.methodOverride())
        .use(allowCrossDomain)
        .use('/bootstrap', express.static(__dirname + '/vendors/bootstrap'))
        .use('/css', express.static(__dirname + '/public/css'))
        .use('/vendors', express.static(__dirname + '/vendors'))
        .use('/js', express.static(__dirname + '/public/js'))
        .use('/images', express.static(__dirname + '/public/images'))
        .use('/font', express.static(__dirname + '/public/font'))
        .use(app.router)
        .use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

//delete express.bodyParser.parse['multipart/form-data'];
//app.use(express.favicon(__dirname + '/public/favicon.ico'));


/*  ==============================================================
    Serve the site skeleton HTML to start the app
=============================================================== */

var port = ("port" in config) ? config.port : 3001;
if ("ssl" in config) {
    var server = app.https(opts).io();
} else {
    var server = app.http().io();
}
ioEvents.initialize({'app': app});
routes.setKey("io", app.io);

/*  ==============================================================
    Routes
=============================================================== */

// API:Registrants
//app.get('/check/:submissionId', routes.index);
//app.get('/credit/:submissionId', routes.index);
//app.get('/api/member/:submissionId', routes.member);
//app.put('/api/member/:submissionId', routes.makePayment);

app.get('*', routes.index);


/*  ==============================================================
    Launch the server
=============================================================== */

server.listen(port);
console.log("Express server listening on port %d", port);
