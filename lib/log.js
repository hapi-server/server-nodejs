const clc  = require('chalk'); // Colorize command line output
const fs = require('fs');

log = {};

function ds() {return (new Date()).toISOString();};

log.logerr = function(msg, messageFull) {
    let stack = "";
    messageFull = messageFull || msg + "\n" + stack;
    let filename = 'application-errors-' + ds().split("T")[0] + ".log";
    let logfile = log.LOGDIR + '/' + filename;
    console.log(ds() + clc.red(" Error"));
    console.log(ds() + clc.red(" Writing message to " + filename + ":\n" + messageFull));
    fs.appendFile(logfile, ds() + " " + messageFull + "\n", () => {});
  }

log.logreq = function(req) {

  if (req.originalUrl.startsWith("/js") || req.originalUrl.startsWith("/css")) {
    return;
  }

  var extra = extra || "";
  var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  let prefix = " " + addr + ": " + "http://";
  let logfile = log.LOGDIR + '/requests-' + ds().split("T")[0] + ".log";
  //let timeStamp = ds();
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