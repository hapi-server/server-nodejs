let path = require("path");
function ds() {
	// TODO:
	// consider using https://github.com/itadakimasu/console-plus/blob/master/console-plus.js
	let e = new Error();
	let frame = e.stack.split("\n")[2];
	// Root directory. TODO: This assumes ds.js is one directory below root directory.
	let root = path.resolve(__dirname + "/../");
	let fileName = frame.split(/\(|\:/)[1].slice(root.length + 1);
	let lineNumber = frame.split(":")[1];
	let functionName = frame.split(" ")[5];
	// Date string for logging.
	return (new Date()).toISOString().slice(11) + " [" + fileName + "#L" + lineNumber + "] ";
}
exports.ds = ds;