const fs   = require('fs');
const path = require("path");
const clc  = require('chalk'); // Colorize command line output

log = {};
module.exports = log;

function prefix(showLineNumber) {
  if (!showLineNumber && process.env.HAPILOGLEVEL === 'info') {
    return (new Date()).toISOString();
  }
  // TODO: Consider using https://github.com/itadakimasu/console-plus
  let e = new Error();
  let frame = e.stack.split("\n")[3];
  let root = path.resolve(__dirname + "/../") + "/";
  let fileName = frame.split(root)[1].split(":")[0];
  let lineNumber = frame.split(":")[1];
  return (new Date()).toISOString() + " [" + fileName + "#L" + lineNumber + "] ";
}

log.ds = function() {
  // Date string for logging.
  return (new Date()).toISOString()
}

log.set = function(key, val) {
  if (key === 'loglevel') {
    if (!['debug', 'info'].includes(val)) {
      log.error("--loglevel must be either 'debug' or 'info'",true);
    }
  }
  if (key === 'logdir') {
    if (!fs.existsSync(val)) {
      fs.mkdirSync(val);
      log.info("Created " + val);
    } else {
      log.info("Log directory = " + val);
    }
  }
  process.env["HAPI" + key.toUpperCase()] = val;
}

log.warn = function(msg) {
  console.warn(prefix() + "[warn] " + clc.yellow(msg));
}

log.debug = function(msg) {
  if (process.env.HAPILOGLEVEL !== 'debug') return;
  console.log(prefix() + "[debug] " + msg);
}

log.info = function(msg) {
  console.log(prefix() + "[info] " + msg);
}

log.error = function(msg, exit_if_fail) {
  msg = prefix(true) + "\n" + msg;
  msg = exit_if_fail ? msg + "\nExiting with status 1." : msg;
  let filename = 'application-errors-' + prefix().split("T")[0] + ".log";
  let logfile = process.env.HAPILOGDIR + '/' + filename;
  console.error(prefix() + "[error]" + clc.red(" Error. Writing message to " + logfile + ":\n---\n" + msg + "\n---"));
  fs.appendFile(logfile, msg, (err) => {
    if (err) {
      console.error("Could not append to " + logfile);
    }
    if (exit_if_fail) {
      process.exit(1);
    }
  });
}

log.request = function(req) {

  if (req.originalUrl.startsWith("/js") || req.originalUrl.startsWith("/css")) {
    return;
  }

  let addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  let fileName = process.env.HAPILOGDIR + '/requests-' + log.ds().split("T")[0] + ".log";
  let timeStamp = apacheTimeStamp();
  let msg = addr
            + ' - - [' + timeStamp + '] "GET ' + req.originalUrl + '"';
            + " HTTP/" + req.httpVersion + " " + req.res.statusCode
            + " " + req.socket.bytesWritten + ' "-" "-"';
  fs.appendFile(fileName, msg + "\n",
    (err) => {if (err) log.error(err.message)});
}

function apacheTimeStamp() {
  let d = new Date();
  let isostr = d.toISOString();
  let date_s = isostr.split('T')[0].split("-");
  let time = isostr.split('T')[1].replace(/\.[0-9]{3}/,"").replace("Z"," +0000");
  let month = d.toDateString().split(" ")[1];
  return date_s[2] + "/" + month + "/" + date_s[0] + ":" + time
}

