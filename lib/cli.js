let usage = "node server.js";
if (/server$/.test(process.execPath)) {
  // Binary executable called.
  usage = "server";
}

checkNodeJSVersion();

module.exports.argv = 
  require('yargs')
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
    .option('verifier',{'description': 'Verifier server URL on landing page (__VERIFIER__ in html is replaced with this value)'})
    .option('plotserver',{'description': 'Plot server URL on landing page (__PLOTSERVER__ in html is replaced with this value)'})
    .option('hapiserverpath',{'description': 'Absolute path to use for $HAPISERVERPATH in server metadata files'})
    .option('nodejs',{'description': 'Location of NodeJS binary to use for $NODEJSEXE in server metadata files (if needed for command line calls).'})
    .option('python',{'description': 'Location of Python binary to use for $PYTHONEXE in server metadata files (if needed for command line calls).'})
    .option('help', {alias: 'h'})
    .describe('server-ui-include','Also include these servers in server-ui server drop-down. Use multiple times for more than one list.')
    .describe('proxy-whitelist','Allow proxying of these servers (so one can use server=http://... in address bar of server-ui).')
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
      'logdir': require("path").normalize(__dirname + "/../log"),
      'file': require("path").normalize(__dirname + '/../metadata/TestData2.0.json'),
      'port': 8999,
      'proxy-whitelist': '',
      'server-ui-include': '',
      'conf': require("path").normalize(__dirname + '/../conf/server.json'),
      'verifier': 'http://hapi-server.org/verify/',
      'plotserver': 'http://hapi-server.org/plot/',
      'hapiserverpath': require("path").normalize(__dirname + "/.."),
      'python': '',
      'nodejs': process.execPath
    })
    .argv;

function checkNodeJSVersion() {
  const clc  = require('chalk');
  const semver = require('semver');
  const versionConstraint = require("../package.json").engines.node;
  if (!semver.satisfies(process.version, versionConstraint)) {
    let msg = `Error: Node.js semantic version constraint ${versionConstraint} `
            + `not satisfied. node.js -v returns ${process.version}. `
            + "Consider installing https://github.com/creationix/nvm"
            + ` and then 'nvm install VERSION', where VERSION satisfies constraint.\n`;
    console.log(clc.red(msg));
    process.exit(1);
  }
}
