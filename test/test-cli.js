const runner = require("./runner.js");

let nodeexe;
if (process.platform.startsWith("win")) {
	nodeexe =  '"' + process.execPath + '"';
} else {
	nodeexe = "'" + process.execPath + "'";
}

let pythonexe = require("../lib/conf.js").pythonexe();
testArray = [
	{
		"command": `cd ${__dirname}; ${nodeexe} ../server.js --test`,
		"status": 0
	},
	{
		"command": `${nodeexe} server.js --test --nodejs ${nodeexe}`,
		"status": 0
	},
	{
		"command": `${nodeexe} server.js --test -f metadata/Example2.json --python ${pythonexe}`,
		"status": 0
	}
];

runner.run(testArray,"Command line interface test");
