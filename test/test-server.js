const fs = require('fs')
const path = require('path')
const clc = require('chalk')
const yargs = require('yargs')

const shellcmd = require('../lib/shellcmd.js')

const opts = {
  https: {
    type: 'boolean',
    default: false
  },
  file: {
    description: 'Catalog configuration file pattern; If not specified, all tests are run.',
    type: 'string',
    default: '',
    alias: 'f'
  }
}
const argv = yargs.options(opts).argv

const exampleDir = path.normalize(path.join(__dirname, '..', 'metadata'))
let exampleIncludes = [
  '^Example',
  '^TestData2\\.0',
  '^TestData3\\.0',
  '^TestData3\\.1',
  '^TestData3\\.2',
  '^SSCWeb'
]

const testDir = path.join(__dirname, 'metadata')
let testIncludes = [
  '^Deprecated',
  '^ExampleErrors'
]

let noVerifies = ["^SSCWeb", "^ExampleErrors"]

if (argv.https === true) {
  exampleIncludes = ['^TestData2\\.0']
  testIncludes = []
}

let serverArgs = ''
if (argv.https) {
  serverArgs = '--https '
  if (process.platform.startsWith('win')) {
    console.log(clc.yellow(' Not running https tests on Windows\n'))
    process.exit(0)
  }
}

const nodeexe = '"' + process.execPath + '" server.js --port 7999'

const filesExample = fileList(exampleDir, exampleIncludes)
const filesTest = fileList(testDir, testIncludes)
let files = [...filesExample, ...filesTest]

let nTests = 0
for (let i = 0; i < files.length; i++) {
  const re = new RegExp(argv.file)
  if (argv.file !== '' && re.test(files[i]) === false) {
    delete files[i]
    continue
  }
  if (skipVerify(files[i], noVerifies)) {
    // Only --test executed.
    nTests = nTests + 1
  } else {
    // --test and --verify executed.
    nTests = nTests + 2
  }
}
files = files.filter(f => f)

console.log('Server tests')
console.log('_________')

let fails = 0
for (let i = 0; i < files.length; i++) {
  // Run node server.js --test -f FILENAME
  const testCmd = nodeexe + ' --test ' + serverArgs + '-f ' + '"' + files[i] + '"'
  fails = fails + execute(testCmd)

  if (skipVerify(files[i], noVerifies)) {
    // These fail validation by design or take too long to run.
    continue
  }

  // Run node server.js --verify -f FILENAME
  const verifyCmd = nodeexe + ' --verify ' + serverArgs + '-f ' + '"' + files[i] + '"'
  fails = fails + execute(verifyCmd)
}

if (fails === 0) {
  process.exit(0)
} else {
  process.exit(1)
}

function execute(cmd) {
  if (execute.i === undefined) {
    execute.i = 0
  }
  execute.i = execute.i + 1
  const prefix = `Test ${execute.i}/${nTests}: `
  process.stdout.write(clc.blue(prefix) + cmd + '\n')

  const child = shellcmd.spawnSync(cmd, { logerror: false })
  if (child.status === 0) {
    console.log(clc.blue(prefix) + clc.green.bold('PASS') + '\n')
  } else {
    console.log(clc.blue(prefix) + clc.red.bold('FAIL') + '\n')
    console.log('\n' + child.stdout.toString())
    console.log('\n' + child.stderr.toString())
  }
  return child.status
}

function skipVerify(file, noVerifies) {
  let fileBaseName = path.basename(file);
  for (const noVerify of noVerifies) {
    if ((new RegExp(noVerify)).test(fileBaseName)) {
      return true
    }
  }
  return false
}

function fileList(metadir, includes) {
  const files = []
  fs.readdirSync(metadir).forEach(file => {
    let slash = '/'
    if (process.platform.startsWith('win')) {
      slash = '\\'
    }
    const ext = path.extname(file)
    const basename = path.basename(file, '.json')
    if (ext !== '.json') return
    for (const include of includes) {
      if ((new RegExp(include)).test(basename)) {
        files.push(metadir + slash + file)
      }
    }
  })
  return files
}
