let testAll = true; // If false, only run one test.
const exampleIncludes = ["^Example*", "^TestData2.0"];
const testIncludes = ["^Deprecated"];

const fs        = require('fs');
const path      = require("path");
const clc       = require('chalk');
const yargs     = require('yargs');
const spawnSync = require('child_process').spawnSync;

let argv = yargs
            .option('https',{'type': 'boolean'})
            .default({'https': false})
            .argv

let server_args = "";
if (argv.https) {
  server_args = "--https";
  if (process.platform.startsWith("win")) {
    console.log(clc.yellow(" Not running https tests on Windows\n"));
    process.exit(0);
  }
}

let metadir, testdir, nodeexe;
if (process.platform.startsWith("win")) {
  nodeexe =  '"' + process.execPath + '" server.js --port 7999';
  metadir =  __dirname + '\\..\\metadata';
  testdir =  __dirname + '\\metadata';
} else {
  nodeexe = "'" + process.execPath + "' server.js --port 7999";
  metadir = __dirname + '/../metadata';
  testdir =  __dirname + '/metadata';
}

metadir = path.normalize(metadir);
testdir = path.normalize(testdir);

let filesExample = filelist(metadir, exampleIncludes);
let filesTest = filelist(testdir, testIncludes);
let files = [...filesExample, ...filesTest];

function execute(com,i) {
  let prefix = "Test " + (i+1) + "/" + (2*files.length) + ": ";
  process.stdout.write(clc.blue(prefix) + com + "\n");
  let child;
  if (process.platform.startsWith("win")) {
    if (com.startsWith('"')) {com = '"' + com + '"';}
    child = require('child_process')
             .spawnSync('cmd.exe', ['/s', '/c', com],
             {stdio: "pipe", "shell": true, "encoding": "buffer"});
  } else {
    child = spawnSync('sh', ['-c', com], {stdio: 'pipe'});
  }
  let status = 0;
  if (child.status == 0) {
    status = 0;
    console.log(clc.blue(prefix) + clc.green.bold("PASS") + "\n");
  } else {
    status = 1;
    console.log(clc.blue(prefix) + clc.red.bold("FAIL") + "\n");
    console.log("\n" + child.stdout.toString());
    console.log("\n" + child.stderr.toString());
  }
  return status;
}

function filelist(metadir, includes) {

  let files = [];
  fs.readdirSync(metadir).forEach(file => {
    let slash = "/";
    if (process.platform.startsWith("win")) {
      slash = "\\";
    }
    let ext = path.extname(file);
    let basename = path.basename(file,'.json');
    if (ext !== ".json") return;
    for (let include of includes) {
      if ((new RegExp(include)).test(basename))
        files.push(metadir + slash + file);
    }
  })
  return files;
}

console.log('URL tests');
console.log('_________');

let fails = 0;
for (var i = 0; i < files.length; i++) {
  // Run node server.js --test -f FILENAME
  let comt = nodeexe + " --test " + server_args + " -f " + '"' + files[i] + '"';
  fails = fails + execute(comt,2*i);

  // Run node server.js --verify -f FILENAME
  let comv = nodeexe + " --verify " + server_args + " -f " + '"' + files[i] + '"';
  fails = fails + execute(comv,2*i+1);

  if (argv.https || !testAll) {
    // Only run one test.
    if (fails == 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

if (fails == 0) {
  process.exit(0);
} else {
  process.exit(1);
}
