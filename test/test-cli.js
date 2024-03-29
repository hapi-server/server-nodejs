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
		"command": `cd ${__dirname}; ${nodeexe} ../server.js --port 7999 --test`,
		"exitStatus": 0
	},
	{
		"command": `${nodeexe} server.js  --port 7999 --test --nodejs ${nodeexe}`,
		"exitStatus": 0
	},
	{
		"command": `${nodeexe} server.js  --port 7999 --test -f metadata/Example2.json --python ${pythonexe}`,
		"exitStatus": 0
	}
];

runner.run(testArray,"Command line interface test");
