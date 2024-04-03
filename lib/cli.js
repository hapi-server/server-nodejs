const fs = require('fs');

let usage = "node server.js";
if (/server$/.test(process.execPath)) {
  // Binary executable called.
  usage = "server";
}

checkNodeJSVersion();

module.exports.argv = readCommandLine();

function readCommandLine() {

  let argv = require('yargs')
    .strict()
    .help()
    .option('file', {
      'description': 'Catalog configuration file or file pattern',
      'type': 'string',
      'default': require("path").normalize(__dirname + '/../metadata/TestData2.0.json'),
      'alias': 'f'
    })
    .option('port', {
      'description': 'Server port',
      'default': 8999,
      'type': 'number',
      'alias': 'p'
    })
    .option('conf', {
      'description': 'Server configuration file',
      'default': require("path").normalize(__dirname + '/../conf/server.json'),
      'type': 'string',
      'alias': 'c'
    })
    .option('ignore', {
      'description': 'Start server even if metadata validation errors',
      'type': 'boolean',
      'alias': 'i'
    })
    .option('skipchecks', {
      'description': 'Skip startup metadata validation and command line tests',
      'default': false,
      'type': 'boolean',
      'alias': 's'
    })
    .option('logdir', {
      'description': 'Log directory',
      'default': require("path").normalize(__dirname + "/../log"),
      'type': 'string',
      'alias': 'l'
    })
    .option('open', {
      'description': 'Open web page on start',
      'default': false,
      'type': 'boolean',
      'alias': 'o'
    })
    .option('test', {
      'description': 'Run URL tests and exit',
      'default': false,
      'type': 'boolean',
      'alias': 't'
    })
    .option('verify', {
      'description': 'Run verification tests on command line and exit',
      'default': false,
      'type': 'boolean'
    })
    .option('loglevel', {
      'description': 'none, info, or debug',
      'default': 'info',
      'type': 'string'
    })
    .option('debug', {
      'description': "set loglevel to 'debug'",
      'default': false,
      'type': 'boolean'
    })
    .option('server-ui-include', {
      'description': 'Also include these servers in server-ui server drop-down. Use multiple times for more than one list.',
      'default': null,
      'type': 'string'
    })
    .option('proxy-whitelist', {
      'description': 'Allow proxying of servers in this file (so one can use server=http://... in address bar of server-ui).',
      'default': '',
      'type': 'string'
    })
    .option('verifier', {
      'description': 'Verifier server URL on landing page (__VERIFIER__ in html is replaced with this value)',
      'default': 'http://hapi-server.org/verify/',
      'type': 'string'
    })
    .option('plotserver', {
      'description': 'Plot server URL on landing page (__PLOTSERVER__ in html is replaced with this value)',
      'default': 'http://hapi-server.org/plot/',
      'type': 'string'
    })
    .option('hapiserverpath', {
      'description': 'Absolute path to use for $HAPISERVERPATH in server metadata files',
      'default': require("path").normalize(__dirname + "/.."),
      'type': 'string'
    })
    .option('nodejs', {
      'description': 'Location of NodeJS binary to use for $NODEJSEXE in server metadata files (if needed for command line calls).',
      'default': process.execPath,
      'type': 'string'
    })
    .option('python', {
      'description': 'Location of Python binary to use for $PYTHONEXE in server metadata files (if needed for command line calls).',
      'type': 'string'
    })
    .option('https', {
      'description': 'Start https server',
      'type': 'boolean'
    })
    .option('cert', {
      'description': 'https certificate file path',
      'type': 'string'
    })
    .option('key', {
      'description': 'https key file path',
      'type': 'string'
    })
    .epilog("For more details, see README at https://github.com/hapi-server/server-nodejs/")
    .usage('Usage: ' + usage + ' [options]')
    .argv;

  if (typeof(argv.file) == 'string') {
    argv.file = [argv.file];
  }

  // TODO: yargs does not allow specifying that no option can be repeated with
  // some exception. https://github.com/yargs/yargs/issues/1318
  // So a check should be made here.

  if (argv["debug"] === true) {
    argv["loglevel"] = "debug";
    delete argv["debug"];
  }

  if (argv["proxy-whitelist"] !== '') {
    if (!fs.existsSync(argv["proxy-whitelist"])) {
      console.error("Error: --proxy-whitelist file '" + argv["proxy-whitelist"] + "' does not exist.");
      process.exit(1);
    }
  }

  if (typeof argv["server-ui-include"] === 'string') {
    if (argv["server-ui-include"].trim() === '') {
      console.error("Error: --server-ui-include must be followed by a non-empty string.");
      process.exit(0);
    }
    argv["server-ui-include"] = [argv["server-ui-include"]];
  }

  return argv;
}

function checkNodeJSVersion() {
  const semver = require('semver');
  const versionConstraint = require("../package.json").engines.node;
  if (!semver.satisfies(process.version, versionConstraint)) {
    let msg = `Error: Node.js semantic version constraint ${versionConstraint} `
            + `not satisfied. node.js -v returns ${process.version}. `
            + "Consider installing https://github.com/creationix/nvm"
            + ` and then 'nvm install VERSION', where VERSION satisfies constraint.\n`;
    console.log(msg);
    process.exit(1);
  }
}
