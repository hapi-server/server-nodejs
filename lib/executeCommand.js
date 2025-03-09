const log = require('log')
const csvTo = require('./csvTo')

module.exports = executeCommand
function executeCommand (com, req, res, timeout, formats, header, includeHeader, cb) {
  log.info('Executing: ' + com)

  let convert = true // true if conversion to requested output format is needed
  if (formats && formats.includes(req.query.format)) {
    // Command line program can create requested format.
    convert = false
  }

  if (header.format == 'csv') {
    // Command line program must support CSV output, so no conversion needed.
    convert = false
  }

  // Call the command line command and send output.
  let child
  if (process.platform.startsWith('win')) {
    const opts = { cwd: __dirname, encoding: 'buffer', shell: true, stdio: 'pipe' }
    child = require('child_process').spawn('cmd.exe', ['/s', '/c', com], opts)
  } else {
    // See https://azimi.me/2014/12/31/kill-child_process-node-js.html for
    // reason for detached: true
    const opts = { cwd: __dirname, encoding: 'buffer', detached: true }
    child = require('child_process').spawn('sh', ['-c', com], opts)
  }

  let gotData = false // First chunk of data received.
  let sentHeader = false // If header already sent.
  let childClosed = false

  // If converting to binary, send data as chunks arrive if incrementalBinary
  // is true. Otherwise, accumulate data and send it all at once.
  const incrementalJSON = false // true not implemented
  const incrementalBinary = true
  // The following are only used if incrementalBinary is true.
  let bufferConcat = Buffer.from('')
  let bufferConcatRemainder = Buffer.from('')

  req.connection.on('close', function () {
    log.debug('HTTP Connection closed.')
    if (childClosed === false) {
      log.info(`HTTP Connection closed before child finished. Killing pid = ${child.pid} for ${com}`)
      // https://azimi.me/2014/12/31/kill-child_process-node-js.html
      // previously used -child.pid, but this was killing the main process.
      try {
        process.kill(child.pid)
      } catch (err) {
        log.error(err.message)
      }
    } else {
      log.debug('HTTP Connection closed after child finished (normal condition).')
    }
  })

  let stdError = ''
  setTimeout(() => {
    if (gotData === false) {
      log.debug(`No data received after ${timeout} ms. Killing.`)
      stdError = '1501, Could not connect to server.'
      child.kill('SIGKILL')
    }
  }, timeout)

  child.stderr.on('data', function (err) {
    stdError += err.toString().trim()
    log.error(`Command ${com} gave stderr: '${stdError}'`)
  })

  child.on('close', function (code, signal) {
    childClosed = true
    log.info('Executed: ' + com)

    log.debug(`Child closed with status code = ${code} and signal = ${signal}`)
    if (code !== 0) {
      if (stdError !== '') {
        log.debug('Child returned stderr. Returning it to callback.')
        cb(stdError)
        return
      }
      log.debug('Child did not return stderr. Returning error object.')
      const msg = `Child exited with non-0 status ${code}: ${com}`
      cb(new Error(msg))
      return
    }

    if (gotData) { // Data returned and normal exit.
      if (convert === true) {
        let dump = req.query.format === 'binary' && incrementalBinary === false
        dump = dump || (req.query.format === 'json' && incrementalJSON === false)
        if (dump) {
          // Convert accumulated data and send it.
          log.debug(`Converting and sending data of length ${bufferConcat.length}`)
          res.write(csvTo(bufferConcat.toString(), true, true, header, includeHeader))
          res.end()
          bufferConcat = null // Technically not needed, but may help w/ gc.
        }
      }
      log.debug('Closing connection.')
      res.end()
    } else {
      // No data returned and normal exit.
      log.info('No data returned.')
      res.statusMessage = 'HAPI 1201: No data in interval'
      if (convert && header.format === 'json' && incrementalJSON === false) {
        // Send header only
        res.status(200).send(csvTo('', true, true, header, includeHeader))
        return
      }
      if (includeHeader) {
        // If this is changed to JSON.stringify(header, null, X), unit
        // tests will fail.
        res.status(200).send('#' + JSON.stringify(header) + '\n')
      } else {
        res.status(200).end()
      }
    }
  })

  child.stdout.on('data', function (buffer) {
    // log.debug(`stdout stream received ${buffer.length} bytes of data.`);
    gotData = true

    if (!sentHeader && includeHeader && header.format !== 'json') {
      // If header not written, header requested, and format requested
      // is not JSON, so send header.
      sentHeader = true
      log.debug('Sending header.')
      res.write('#' + JSON.stringify(header) + '\n')
    }

    if (header.format === 'csv') {
      // No conversion needed; dump buffer immediately.
      // log.debug(`Sending ${buffer.length} bytes of CSV.`);
      const ok = res.write(buffer.toString())
      if (!ok) {
        res.socket.once('drain', () => {
          log.debug('Drain event. Resuming stdout stream.')
          child.stdout.resume()
        })
        log.debug('Pausing stdout stream.')
        child.stdout.pause()
      }
    }
    if (header.format === 'json') {
      if (convert === false) {
        // No conversion needed; dump buffer immediately.
        log.debug('Sending {buffer.length} bytes of JSON.')
        res.write(buffer.toString())
        return
      } else {
        // JSON requested and command line program cannot produce it.
        // Accumulate output and send everything at once.
        // TODO: Write incrementally; use
        //    buffer.toString().lastIndexOf(/\n/)
        // along with saving part of string that was not written.
        if (incrementalJSON === false) {
          bufferConcat = Buffer.concat([bufferConcat, buffer])
        } else {
          // Not implemented
        }
      }
    }
    if (header.format === 'binary') {
      if (convert === false) {
        // No conversion needed; dump buffer immediately.
        log.debug(`Sending ${buffer.length} bytes of binary.`)
        res.write(buffer, 'binary')
      } else {
        // Conversion from CSV to binary needed.
        if (incrementalBinary === false) {
          // Accumulate output and send everything at once.
          bufferConcat = Buffer.concat([bufferConcat, buffer])
        } else {
          if (bufferConcatRemainder !== '') {
            bufferConcat = Buffer.concat([bufferConcatRemainder, buffer])
          }
          const lastnl = bufferConcat.lastIndexOf('\n')
          if (lastnl + 1 === bufferConcat.length) {
            bufferConcatRemainder = Buffer.from('')
          } else {
            bufferConcatRemainder = bufferConcat.slice(lastnl)
            bufferConcat = bufferConcat.slice(0, lastnl)
          }
          log.debug(`Converting ${bufferConcat.length} string bytes to binary and then sending.`)
          res.write(csvTo(bufferConcat.toString(), null, null, header, includeHeader))
        }
      }
    }
  })
}
