// Logging
const log = require('./log.js');

exports.spawnSync = spawnSync;
function spawnSync(command,opts) {

  if (opts === undefined) {
    opts = {};
  }
  if (opts.exit_if_fail === undefined) {
    opts.exit_if_fail = 0;
  }
  if (opts.return === undefined) {
    opts.return = "object";
  }
  if (opts.logerror === undefined) {
    opts.logerror = true;
  }

  let child;
  try {
    if (process.platform.startsWith("win")) {
      if (command.startsWith('"')) {
        command = '"' + command + '"';
      }
      let copts = {
                    "shell": true,
                    "stdio": "pipe",
                    "encoding": "buffer"
                  };
      child = require('child_process').spawnSync('cmd.exe', ['/c', command], copts);
    } else {
      let copts = {
                    "stdio": "pipe"
                  };
      child = require('child_process').spawnSync('sh', ['-c', command],copts);
    }
  } catch (ex) {
    if (opts.logerror) {
      log.error("Could not execute command: " + command + ".");
    }
    if (ex.stderr && opts.logerror) {
      log.error(ex.stderr.toString());
    }
    if (opts.exit_if_fail) {
      process.exit(1);
    }
  }
  if (child.status !== 0 && opts.logerror) {
    log.error("stdout:\n" + child.stdout.toString());
    log.error("stderr:\n" + child.stderr.toString());
  }
  if (opts.return === "object") {
    return child;
  } else {
    return child.status;
  }
}
