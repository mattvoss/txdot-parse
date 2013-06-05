var fs = require('fs'),
    path = require('path'),
    parser = require('uglify-js'),
    glob = require("glob");
/*  ==============================================================
    Bundle + minify scripts & templates before starting server
=============================================================== */

if (process.argv[2]) {
    if (fs.lstatSync(process.argv[2])) {
        config = require(process.argv[2]);
    } else {
        config = require(process.cwd()+'/settings.json');
    }
} else {
    config = require(__dirname + '/settings.json');
}

var models = [

];
var views = [
    'js/views/UploadView',
    'js/views/AppView'
];
var routers = [
    'js/router/Router'
];
var app = [
    'js/App'
];
var data = [

];
var templates = [
    'header',
    'uploadFile'
];

var vendors = [
    'jquery.min',
    'jquery-ui.min',
    'jquery.ui.widget',
    'json2',
    'underscore/underscore',
    'handlebars',
    'backbone/backbone',
    'backbone-schema',
    'backbone.nestCollection',
    'backbone-dotattr',
    'backbone-forms/distribution/backbone-forms',
    'backbone-forms/distribution/editors/list',
    'backbone-forms/distribution/templates/bootstrap',
    'backbone-form-typeahead',
    'backbone-form-custom-editors',
    'backbone.bootstrap-modal/src/backbone.bootstrap-modal',
    'moment',
    'bootstrap/bootstrap/js/bootstrap',
    'jQuery-File-Upload/js/jquery.iframe-transport',
    'jQuery-File-Upload/js/jquery.fileupload',
    'swag/lib/swag'
];

var bundle = '';
var prefix = ("prefix" in config) ? config.prefix : "";
bundle += "Config = {};\n";
bundle += "Config.prefix = '" + prefix + "';\n";
models.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("model file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});
views.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("view file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});
routers.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("router file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});
app.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("app file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});

try {
    var ast = parser.parse(bundle);
} catch(e) {
    console.warn("Got exception: " + e);
}


//ast = uglifyer.ast_mangle(ast);
//ast = uglifyer.ast_squeeze(ast);
//bundle = uglifyer.gen_code(ast);
console.log('Writing bundle.js');
fs.writeFileSync(__dirname + '/public/js/bundle.js', bundle, 'utf8');

var bundle = '';
vendors.forEach(function(file) {
    if (fs.existsSync(__dirname + '/vendors/' + file + '.js')) {
        console.log("vendor file: ", __dirname + '/vendors/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/vendors/' + file + '.js') + "\n\n";
    }
});
var ast = parser.parse(bundle);
//ast = uglifyer.ast_mangle(ast);
//ast = uglifyer.ast_squeeze(ast);
//bundle = uglifyer.gen_code(ast);
console.log('Writing vendor.js');
fs.writeFileSync(__dirname + '/public/js/vendor.js', bundle, 'utf8');

var bundle = '';
data.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.json')) {
        console.log("data file: ", __dirname + '/public/' + file + '.json');
        bundle += "\n/**\n* " + file + ".json\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.json') + "\n\n";
    }
});
var ast = parser.parse(bundle);
//ast = uglifyer.ast_mangle(ast);
//ast = uglifyer.ast_squeeze(ast);
//bundle = uglifyer.gen_code(ast);
console.log('Writing data.js');
fs.writeFileSync(__dirname + '/public/js/data.js', bundle, 'utf8');

bundle = "Templates = {};\n";
templates.forEach(function(file) {

        if (fs.existsSync(__dirname + '/public/templates/' + file + '.html')) {
            console.log("template file: ",__dirname + '/public/templates/' + file + '.html');
            var html = fs.readFileSync(__dirname + '/public/templates/' + file + '.html', 'utf8');
            html = html.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/gm, ' ').replace(/'/gm, "\\'");
            bundle += "Templates." + file + " = '" + html + "';\n";
        }
});

console.log('Writing template.js');
fs.writeFileSync(__dirname + '/public/js/templates.js', bundle, 'utf8');


delete bundle;
delete ast;

