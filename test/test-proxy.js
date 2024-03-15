const runner = require("./runner.js");

let nodeexe;
if (process.platform.startsWith("win")) {
	nodeexe =  '"' + process.execPath + '"';
} else {
	nodeexe = "'" + process.execPath + "'";
}

let pythonexe = require("../lib/conf.js").pythonexe();
let testArray = [
	{
		"command": `cd ${__dirname}; ${nodeexe} ../server.js -f ../metadata/TestData2.0.js ../metadata/Example11.js --test`,
		"exitStatus": 0
	}
];

runner.run(testArray,"Command line interface test");
