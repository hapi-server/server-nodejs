const fs   = require('fs');
const path = require("path");
const clc  = require('chalk');
const spawnSync = require('child_process').spawnSync;

const nodeexe = process.execPath + " server.js";
const metadir = __dirname + '/../metadata';

const excludes = 
	[
		"INTERMAGNET",
		"SSCWeb",
		"AutoplotExample1",
		"AutoplotExample2",
		"TestDataBad"
	];

function execute(com) {
	process.stdout.write(clc.blue("Testing: ") + com);
	let child = spawnSync('bash', ['-c', com], {stdio: 'pipe'});
	let status = 0;
	if (child.status == 0) {
		status = 0;
		console.log(clc.green.bold(" PASS"));
	} else {
		status = 1;
		console.log(clc.red.bold(" FAIL"));
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


files = filelist(metadir, excludes);

let fails = 0;
for (var i = 0; i < files.length; i++) {
	// Run node server.js --test -f metadata/CATALOG.json
	let comt = nodeexe + " --test -f " + metadir + "/" + files[i];
	fails = fails + execute(comt);

	// Run node server.js --verify -f metadata/CATALOG.json
	let comv = nodeexe + " --verify -f " + metadir + "/" + files[i];
	fails = fails + execute(comv);
}

if (fails == 0) {
	process.exit(0);
} else {
	process.exit(1);
}
