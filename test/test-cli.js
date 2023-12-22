const runner = require("./runner.js");

let nodeexe;
if (process.platform.startsWith("win")) {
	nodeexe =  '"' + process.execPath + '"';
} else {
	nodeexe = "'" + process.execPath + "'";
}

testArray = [
	{
		"command": `cd ${__dirname}; ${nodeexe} ../server.js --p 8999 --test`,
		"status": 0
	}
];

runner.run(testArray,"Command line interface test");
