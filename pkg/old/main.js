var spawn = require('child_process').spawn;

const env = process.env;
env['PKG_EXECPATH'] = 'PKG_INVOKE_NODEJS';

if (0) {
	console.log("Execpath: " + process.execPath);
	console.log("__dirname: " + __dirname);
	console.log("args: " + process.argv);
}

// Get directory of executable. TODO: Address Windows.
var path = process.execPath.replace(/(.*)\/.*/,'$1');
path = path.replace(/(.*)\\.*/,'$1');
//console.log(path);

// args will be /path/to/serverbinary, main.js
args = process.argv;
if (args[2] === "test") {
	MAX = 0;
	// "./server test" was command
	var file = path + "/test/test.js";
	//console.log(file);
	args = args.slice(3);
	args.unshift(file);
	//console.log("targs: " + args);
} else {
	var MAX = 10;
	var file = path + "/server.js";
	args = args.slice(2);
	args.unshift(file);	
	//console.log("args: " + args);
}

var N = 0;

start();

function start() {
	//console.log(args);
	var child = spawn(process.execPath, args, {env: env});
	child.stdout.on('data', (data) => {
		console.log(data.toString().trim());
	});
	child.stderr.on('data', (data) => {
		console.log(data.toString().trim());
	});
	child.on('close', (code) => {
		if (code != 0) {
			N = N + 1;
			if (N <= MAX) {
				console.log(N + ' App crashed. Restarting.');
				start();
			} else {
				console.log(N + " App crashed more than " + MAX + " times. Aborting.");
				process.exit(1);
			}
		} else {
			process.exit(0);
		}
	});
}