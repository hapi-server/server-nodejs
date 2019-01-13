var fs = require('fs');
var path = require("path");
var clc  = require('chalk');
var spawnSync = require('child_process').spawnSync;

const excludes = 
	[
		"INTERMAGNET",
		"SSCWeb",
		"AutoplotExample1",
		"AutoplotExample2",
		"TestDataBad"
	];

var exe = process.execPath + " server.js";

const metadir = __dirname + '/../metadata';
files = [];
fs.readdirSync(metadir).forEach(file => {
  var ext = path.extname(file);
  var basename = path.basename(file,'.json');
  if (ext == ".json" && !excludes.includes(basename)) {
  	files.push(file);
  }
})

var fails = 0;
for (var i = 0; i < files.length; i++) {
	var com = exe + " --test --ignore -f " + metadir + "/" + files[i];
	process.stdout.write(clc.blue("Testing: ") + com);
	var child = spawnSync('bash', ['-c', com], {stdio: 'pipe'});
	if (child.status == 0) {
		console.log(clc.green(" PASS"));
	} else {
		fails = fails + 1;
		console.log(clc.red(" FAIL"));
		console.log("\n" + child.stdout.toString());
		console.log("\n" + child.stderr.toString());
	}
}
if (fails == 0) {
	process.exit(0);
} else {
	process.exit(1);
}
