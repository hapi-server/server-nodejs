const fs        = require('fs');
const path      = require("path");
const clc       = require('chalk');
const yargs     = require('yargs');
const spawnSync = require('child_process').spawnSync;

const nodeexe = "'" + process.execPath + "' server.js";
const metadir = __dirname + '/../metadata';

const excludes =
	[
		"INTERMAGNET",
		"SuperMAG",
		"CAIO",
		"AutoplotExample1",
		"AutoplotExample2",
		"TestData3.0",
		"TestDataBad"
	];


let argv = yargs
			.option('https',{'type': 'boolean'})
			.default({
				'https': false,
			})
			.argv

let server_args = "";
if (argv.https) {
	server_args = "--https";
}

let files = filelist(metadir, excludes);

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
		console.log(clc.blue(prefix) + clc.red.bold("FAIL") + "\n");
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
	let comt = nodeexe + " --test " + server_args + " -f " + metadir + "/" + files[i];
	fails = fails + execute(comt,2*i);

	// Run node server.js --verify -f metadata/CATALOG.json
	let comv = nodeexe + " --verify " + server_args + " -f " + metadir + "/" + files[i];
	fails = fails + execute(comv,2*i+1);
}

if (fails == 0) {
	process.exit(0);
} else {
	process.exit(1);
}
