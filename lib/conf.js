const path = require('path'); 
const log  = require('./log.js');

function configVars(argv) {

    let debug = true;

    if (configVars.config) {
        return configVars.config;
    }

    log.debug(log.ds() + "Setting configuration variables.");

    configd = {};

    // Set defaults
    configd["HAPISERVERPATH"] = path.normalize(__dirname + "/..");
    configd["HAPISERVERHOME"] = configd["HAPISERVERPATH"];

    for (key in configd) {
        log.debug(log.ds() + "Default " + key + " = " + configd[key]);
    }

    // Override defaults using configuration file variables
    var config = require(argv.conf);
    log.info("Reading " + argv.conf);
    for (key in config) { 
        if (config[key] !== "" && config[key].slice(0,2) !== "__") {
            log.debug(log.ds() + "Found " + key + " in " + argv.conf + ". Using it.");
            configd[key] = config[key]; // Update default
        } else {
            log.debug(log.ds() + key + " not given in " + argv.conf + ".");
        }
    }

    // Override defaults and config file values with shell environment variables
    if (process.env.HAPISERVERPATH) {
        log.debug(log.ds() + "Found HAPISERVERPATH environment variable. Using it.");
        configd["HAPISERVERPATH"] = process.env.HAPISERVERPATH;
    } else {
        log.debug("HAPISERVERPATH environment variable not found.");
    }
    if (process.env.HAPISERVERHOME) {
        log.debug("Found HAPISERVERHOME environment variable. Using it.");
        configd["HAPISERVERHOME"] = process.env.HAPISERVERHOME;
    } else {
        log.debug("HAPISERVERHOME environment variable not found.");        
    }

    configd["NODEEXE"]   = argv.nodejs;
    configd["PYTHONEXE"] = argv.python;

    configVars.config = configd;
    return configd;
}
exports.configVars = configVars;


function replaceConfigVars(com) {
    config = configVars();
    if (typeof(com) === "string") {
        let re = new RegExp("\\$HAPISERVERPATH", "g");
        com = com.replace(re, config["HAPISERVERPATH"]);
        re = new RegExp("\\$HAPISERVERHOME", "g");
        com = com.replace(re, config["HAPISERVERHOME"]);
        com = com.replace("$NODEEXE", config["NODEEXE"]);
        com = com.replace("$PYTHONEXE", config["PYTHONEXE"]);
        return com;
    } else {
        for (var i=0;i < com.length; i++) {
            com[i].command = replaceConfigVars(com[i].command);
        }
        return com;
    }
}
exports.replaceConfigVars = replaceConfigVars;
