var fs = require('fs');
var path = require("path");
var clc  = require('cli-color');
var spawnSync = require('child_process').spawnSync;

const excludes = 
	[
		"INTERMAGNET",
		"SSCWeb",
		"AutoplotExample1",
		"AutoplotExample2",
		"TestDataBad"
	];

var env = process.env;
var exe = process.execPath + " server.js";
if (/server$/.test(process.execPath)) {
	//env['PKG_EXECPATH'] = 'PKG_INVOKE_NODEJS';
	//var exe = process.execPath;
}

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
	var child = spawnSync('bash', ['-c', com], {stdio: 'pipe', env: env});
	if (child.status == 0) {
		console.log(clc.green(" PASS"));
	} else {
		fails = fails + 1;
		console.log(child.stdout.toString());
		console.log(child.stderr.toString());
	}
}
if (fails == 0) {
	process.exit(0);
} else {
	process.exit(1);
}
