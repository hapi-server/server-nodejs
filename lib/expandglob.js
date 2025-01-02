const fs = require('fs')

const log = require('log')

function expandglob (FILES) {
  function nodir (file) {
    if (file.isDirectory()) {
      file.exclude = true
    }
    return file
  }

  const glob = require('glob-fs')({ gitignore: true }).use(nodir)

  for (const i in FILES) {
    const file = FILES[i]
    let files = []

    // file = '' will occur if -f switch used with no argument.
    if (file !== '' && !fs.existsSync(file)) {
      files = glob.readdirSync(file)
      if (files.length == 0) {
        log.error('File or files not found: ' + file, true)
      }
      if (files.length > 0) {
        FILES[i] = files
      }
    }
    if (fs.existsSync(file)) {
      FILES[i] = file
    }
  }

  // Flatten array. Equivalent to FILES = FILES.flat() in newer Javascript standard.
  FILES = [].concat(...FILES)
  return FILES
}
exports.expandglob = expandglob
