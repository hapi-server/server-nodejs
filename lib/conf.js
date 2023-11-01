const path = require('path');
const log  = require('./log.js');

function configVars(argv) {

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

    configd["NODEJSEXE"] = argv.nodejs || configd["NODEEXE"] || configd["NODEJSEXE"] || process.env.NODEEXE || process.env.NODEJSEXE;
    configd["PYTHONEXE"] = argv.python || configd["PYTHONEXE"] || process.env.PYTHONEXE || pythonexe();

    configVars.config = configd;
    return configd;
}
exports.configVars = configVars;


function replaceConfigVars(com) {
    let config = configVars();
    if (typeof(com) === "string") {
        let re = new RegExp("\\$HAPISERVERPATH", "g");
        com = com.replace(re, config["HAPISERVERPATH"]);
        re = new RegExp("\\$HAPISERVERHOME", "g");
        com = com.replace(re, config["HAPISERVERHOME"]);
        com = com.replace("$NODEEXE", config["NODEEXE"] || config["NODEJSEXE"]);
        com = com.replace("$NODEJSEXE", config["NODEEXE"] || config["NODEJSEXE"]);
        com = com.replace("$PYTHONEXE", config["PYTHONEXE"]);
        return com;
    } else {
        for (let i=0;i < com.length; i++) {
            com[i].command = replaceConfigVars(com[i].command);
        }
        return com;
    }
}
exports.replaceConfigVars = replaceConfigVars;

function pythonexe() {

    const commandExistsSync = require('command-exists').sync;

    // commandExistsSync returns true on Windows if python is
    // not installed because it is aliased to a python.exe that
    // launches Microsoft Store.
    // https://stackoverflow.com/a/34953561
    // TODO: Check metadata to see if Python is ever used. If not, skip
    // this step.
    let debug = true;
    let PYTHONEXE = "";
    let isWin = process.platform.startsWith("win");
    if (isWin) {
      var child = require('child_process').spawnSync('where python',{"shell": true});
      if (child.stdout) {
        PYTHONEXE = child.stdout.toString().slice(0,-1);
        if (PYTHONEXE.includes("Microsoft\\WindowsApps")) {
          PYTHONEXE = "";
        }
      }
      if (child.status == 0 && PYTHONEXE !== "") {
        log.debug("Found python in path: " + PYTHONEXE);
      }
    } else {
      if (commandExistsSync("python")) {
        log.debug("Command 'python' exists. Using it as default for PYTHONEXE.");
        PYTHONEXE = "python";
      } else {
        if (commandExistsSync("python3")) {
          log.debug("Command 'python3' exists. Using it as default for PYTHONEXE.");
          PYTHONEXE = "python3";
        }
      }
    }
    if (PYTHONEXE === "") {
      PYTHONEXE = path.normalize(__dirname + "/../bin/python");
      log.debug("Python not found in path. Will use " + PYTHONEXE + " if available/needed.");
      if (!commandExistsSync(PYTHONEXE)) {
        log.debug(PYTHONEXE + " command failed.");
        PYTHONEXE = "";
      }
    }
    return PYTHONEXE;
}
exports.pythonexe = pythonexe;