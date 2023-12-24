const fs = require('fs');
const path = require('path');

const log  = require('./log.js');
const trimPath = require('./log.js').trimPath;

exports.configVars = configVars;
function configVars(argv) {

    if (configVars.config) {
        return configVars.config;
    }

    log.debug("Setting configuration variables.");

    let configd = {};

    for (key in configd) {
        log.debug("Default " + key + " = " + configd[key]);
    }

    // Override defaults using configuration file variables
    let config;
    let fname = path.normalize(argv.conf);
    if (fs.existsSync(fname)) {
      log.info("Reading " + trimPath(fname));
      config = fs.readFileSync(fname);
    } else {
      log.error("Not found: " + fname1 + " and " + fname2);
      process.exit(1);
    }
    try {
      config = JSON.parse(config);
    } catch (e) {
      log.error("Could not parse " + argv.conf, true);
    }
    for (key in config) {
      if (config[key] !== "" && config[key].slice(0,2) !== "__") {
        log.debug("Found " + key + " in " + trimPath(argv.conf) + ". Using it.");
        configd[key] = config[key]; // Update default
      } else {
        log.debug(key + " not given in " + trimPath(argv.conf) + ".");
      }
    }

    // Override defaults and config file values with shell environment variables
    for (envVar of ["HAPISERVERPATH", "NODEEXE", "NODEJSEXE", "PYTHONEXE"]) {
      if (process.env[envVar]) {
        log.debug(`Found ${envVar} environment variable. Using it.`);
        configd[envVar] = process.env[envVar];
        log.warn(`Setting ${envVar} as an environment variable is deprecated and will be removed in v2.0. Set in config file or using command line option.`);
      }
    }

    configd["HAPISERVERPATH"] = process.env.HAPISERVERPATH || configd["HAPISERVERPATH"] || argv.hapiserverpath;
    configd["NODEJSEXE"] = process.env.NODEEXE || process.env.NODEJSEXE || configd["NODEEXE"] || configd["NODEJSEXE"] || argv.nodejs 
    configd["PYTHONEXE"] = process.env.PYTHONEXE || argv.python || configd["PYTHONEXE"] || pythonexe();

    configVars.config = configd;
    return configd;
}

exports.replaceConfigVars = replaceConfigVars;
function replaceConfigVars(com) {
    let config = configVars();
    if (typeof(com) === "string") {
        let re = new RegExp("\\$HAPISERVERPATH", "g");
        com = com.replace(re, config["HAPISERVERPATH"]);
        re = new RegExp("\\$HAPISERVERHOME", "g");
        com = com.replace(re, config["HAPISERVERHOME"]);
        com = com.replace("$NODEEXE", config["NODEJSEXE"]);
        com = com.replace("$NODEJSEXE", config["NODEJSEXE"]);
        com = com.replace("$PYTHONEXE", config["PYTHONEXE"]);
        return com;
    } else {
        for (let i=0;i < com.length; i++) {
            com[i].command = replaceConfigVars(com[i].command);
        }
        return com;
    }
}

exports.pythonexe = pythonexe;
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
