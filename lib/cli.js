let usage = "node server.js";
if (/server$/.test(process.execPath)) {
  // Binary executable caled.
  usage = "server";
}

function checkNodeJSVersion() {
  const minVersion = 6;
  const clc  = require('chalk');
  const nodever = parseInt(process.version.slice(1).split('.')[0]);
  if (parseInt(nodever) < minVersion) {
    let msg = `Error: Node.js version >=${minVersion} required. ` 
            + `node.js -v returns ${process.version}.\n`
            + "Consider installing https://github.com/creationix/nvm"
            + ` and then 'nvm install ${minVersion}'.\n`
    console.log(clc.red(msg));
    process.exit(1);
  }
}

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

let argv = require('yargs')
  .strict()
  .help()
  .describe('https','Start https server')
  .describe('cert','https certificate file path')
  .describe('key','https key file path')
  .describe('file','Catalog configuration file or file pattern')
  .alias('file','f')
  .describe('port','Server port')
  .alias('port','p')
  .describe('conf','Server configuration file')
  .alias('conf','c')
  .describe('ignore','Start server even if metadata validation errors')
  .alias('ignore','i')
  .describe('ignore','Start server even if metadata validation errors')
  .alias('skipchecks','s')
  .describe('skipchecks','Skip startup metadata validation and command line tests')
  .describe('logdir','Log directory')
  .alias('logdir','l')
  .describe('open','Open web page on start')
  .alias('open','o')
  .describe('test','Run URL tests and exit')
  .alias('test','t')
  .describe('verify','Run verification tests on command line and exit')
  .alias('verify','v')
  .describe('loglevel','info or debug')
  .alias('l','l')
  .option('file',{'type': 'string'})
  .option('ignore',{'type': 'boolean'})
  .option('skipchecks',{'type': 'boolean'})
  .option('https',{'type': 'boolean'})
  .option('open',{'type': 'boolean'})
  .option('test',{'type': 'boolean'})
  .option('verify',{'type': 'boolean'})
  .option('verifier',{'description': 'Verifier server URL on landing page'})
  .option('plotserver',{'description': 'Plot server URL on landing page'})
  .option('python',{'description': 'Location of Python binary to use (if needed for command line calls).'})
  .option('nodejs',{'description': 'Location of Python binary to use (if needed for command line calls).'})
  .option('help', {alias: 'h'})
  .describe('server-ui-include','Also include these servers in server-ui server drop-down. Use multiple times for more than one list.')
  .describe('proxy-whitelist','Allow proxying of these servers (so one can use server=http://... in addressbar of server-ui).')
  .epilog("For more details, see README at https://github.com/hapi-server/server-nodejs/")
  .usage('Usage: ' + usage + ' [options]')
  .default({
    'ignore': false,
    'skipchecks': false,
    'loglevel': 'info',
    'https': false,
    'open': false,
    'test': false,
    'verify': false,
    'logdir': __dirname + "/../log",
    'file': __dirname + '/../metadata/TestData2.0.json',
    'port': 8999,
    'proxy-whitelist': '',
    'server-ui-include': '',
    'conf': __dirname + '/../conf/server.json',
    'verifier': '',
    'plotserver': '',
    'python': pythonexe(),
    'nodejs': process.execPath
  })
  .argv
module.exports.argv = argv;