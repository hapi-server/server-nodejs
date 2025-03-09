// Logging
const log = require('log')

exports.spawnSync = spawnSync
function spawnSync (command, opts) {
  if (opts === undefined) {
    opts = {}
  }
  if (opts.exitIfFail === undefined) {
    opts.exitIfFail = 0
  }
  if (opts.return === undefined) {
    opts.return = 'object'
  }
  if (opts.logError === undefined) {
    opts.logError = true
  }

  let child
  try {
    if (process.platform.startsWith('win')) {
      if (command.startsWith('"')) {
        command = '"' + command + '"'
      }
      const copts = {
        shell: true,
        stdio: 'pipe',
        encoding: 'buffer'
      }
      child = require('child_process').spawnSync('cmd.exe', ['/c', command], copts)
    } else {
      const copts = {
        stdio: 'pipe'
      }
      child = require('child_process').spawnSync('sh', ['-c', command], copts)
    }
  } catch (ex) {
    if (opts.logError) {
      log.error('Could not execute command: ' + command + '.')
    }
    if (ex.stderr && opts.logError) {
      log.error(ex.stderr.toString())
    }
    if (opts.exitIfFail) {
      process.exit(1)
    }
  }
  if (child.status !== 0 && opts.logError) {
    log.error('stdout:\n' + child.stdout.toString())
    log.error('stderr:\n' + child.stderr.toString())
  }
  if (opts.return === 'object') {
    return child
  } else {
    return child.status
  }
}
