const fs   = require('fs');
const path = require("path");
const clc  = require('chalk'); // Colorize command line output

log = {};

function prefix() {
  if (log.set['level'] === 'info') {
    return (new Date()).toISOString();
  }
  // TODO: Consider using https://github.com/itadakimasu/console-plus
  let e = new Error();
  let frame = e.stack.split("\n")[3];
  // Root directory. TODO: This assumes ds.js is one directory below root directory.
  let root = path.resolve(__dirname + "/../");
  let fileName = frame.split(/\(|\:/)[1].slice(root.length + 1);
  let lineNumber = frame.split(":")[1];
  let functionName = frame.split(" ")[5];
  // Date string for logging.
  //return (new Date()).toISOString().slice(11) + " [" + fileName + "#L" + lineNumber + "] ";
  return (new Date()).toISOString() + " [" + fileName + "#L" + lineNumber + "] ";
}

log.ds = function() {
  // Date string for logging.
  return (new Date()).toISOString()
}

log.set = function(key, val) {
  if (key === 'level') {
    if (!['debug', 'info'].includes(val)) {
      console.log(clc.red("loglevel must be either 'debug' or 'info'"));
      process.exit(1);
    }
  }
  log.set[key] = val;
}

log.warn = function(msg) {
  console.warn(prefix() + "[warn] " + clc.yellow(msg));
}

log.debug = function(msg) {
  if (log.set['level'] !== 'debug') return;
  console.log(prefix() + "[debug] " + msg);
}

log.info = function(msg) {
  console.log(prefix() + "[info] " + msg);
}

log.error = function(msg) {
  let filename = 'application-errors-' + prefix().split("T")[0] + ".log";
  let logfile = log.LOGDIR + '/' + filename;
  console.log(prefix() + clc.red(" Error. Writing message to " + filename + ":\n" + msg));
  fs.appendFile(logfile, prefix() + " " + msg, () => {});
}

log.request = function(req) {

  if (req.originalUrl.startsWith("/js") || req.originalUrl.startsWith("/css")) {
    return;
  }

  var extra = extra || "";
  var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  let prefix = " " + addr + ": " + "http://";
  let logfile = log.LOGDIR + '/requests-' + log.ds().split("T")[0] + ".log";
  //let timeStamp = log.ds();
  let timeStamp = apacheTimeStamp();
  msg = addr
            + ' - - [' + timeStamp + '] "GET ' + req.originalUrl + '"'
            + " HTTP/" + req.httpVersion + " " + req.res.statusCode + " " + req.socket.bytesWritten + ' "-" "-"';
  fs.appendFile(logfile, msg + "\n", () => {});
}

function apacheTimeStamp() {
  let d = new Date();
  let isostr = d.toISOString();
  let date_s = isostr.split('T')[0].split("-");
  let time = isostr.split('T')[1].replace(/\.[0-9]{3}/,"").replace("Z"," +0000");
  let month = d.toDateString().split(" ")[1];
  return date_s[2] + "/" + month + "/" + date_s[0] + ":" + time
}

module.exports = log;