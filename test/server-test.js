const fs   = require('fs');
const path = require("path");
const clc  = require('chalk');
const spawnSync = require('child_process').spawnSync;

const nodeexe = "'" + process.execPath + "' server.js";
const metadir = __dirname + '/../metadata';

const excludes =
	[
		"INTERMAGNET",
		"SuperMAG",
		"AutoplotExample1",
		"AutoplotExample2",
		"TestData3.0",
		"TestDataBad"
	];

const args = require('minimist')(process.argv.slice(2));
var isHttps=args['https']; //This will be true if the --https flag is given

console.log("HTTPS enabled :  "+ isHttps);

files = filelist(metadir, excludes);

function execute(com,i) {
	let prefix = "Test " + (i+1) + "/" + (2*files.length) + ": ";
	process.stdout.write(clc.blue(prefix) + com + "\n");
	let child = spawnSync('sh', ['-c', com], {stdio: 'pipe'});
	let status = 0;
	if (child.status == 0) {
		status = 0;
		console.log(clc.blue(prefix) + clc.green.bold("PASS") + "\n");
	} else {
		status = 1;
		console.log(clc.blue(prefix) + clc.red.bold(" FAIL") + "\n");
		console.log("\n" + child.stdout.toString());
		console.log("\n" + child.stderr.toString());
	}
	return status;
}

function filelist(metadir, excludes) {
	let files = [];
	fs.readdirSync(metadir).forEach(file => {
		let ext = path.extname(file);
		let basename = path.basename(file,'.json');
		if (ext == ".json" && !excludes.includes(basename)) {
			files.push(file);
		}
	})
	return files;
}

console.log('URL tests');
console.log('_________');

let fails = 0;
for (var i = 0; i < files.length; i++) {
	// Run node server.js --test -f metadata/CATALOG.json
	if(isHttps){
         //The server shall be called --https flag with isHttps is true
		let comt = nodeexe + " --test --https -f " + metadir + "/" + files[i];
		fails = fails + execute(comt,2*i);

		// Run node server.js --verify -f metadata/CATALOG.json
		let comv = nodeexe + " --verify --https -f " + metadir + "/" + files[i];
		fails = fails + execute(comv,2*i+1);
	}
	else {
		let comt = nodeexe + " --test -f " + metadir + "/" + files[i];
		fails = fails + execute(comt,2*i);

		// Run node server.js --verify -f metadata/CATALOG.json
		let comv = nodeexe + " --verify -f " + metadir + "/" + files[i];
		fails = fails + execute(comv,2*i+1);
	}
}

if (fails == 0) {
	process.exit(0);
} else {
	process.exit(1);
}
