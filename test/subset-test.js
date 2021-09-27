var test = require('../lib/test.js');
let nodeexe;
if (process.platform.startsWith("win")) {
	nodeexe =  '"' + process.execPath + '"';
} else {
	nodeexe = "'" + process.execPath + "'";
}

var testa = [
	{
		"command": nodeexe + " lib/subset.js --url \"http://hapi-server.org/servers/TestData2.0/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false\" --stop 1970-01-01T00:00:07",
		"Nlines": 7,
		"Ncommas": 7
	},
	{
		"command": nodeexe + " lib/subset.js --columns 1 --url \"http://hapi-server.org/servers/TestData2.0/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false\" --stop 1970-01-01T00:00:07",
		"Nlines": 7,
		"Ncommas": 0
	},
	{
		"command": nodeexe + " lib/subset.js --columns 1-2 --url \"http://hapi-server.org/servers/TestData2.0/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false\" --stop 1970-01-01T00:00:07",
		"Nlines": 7,
		"Ncommas": 7
	}
]

console.log('Subsetting tests');
console.log('________________');
const clc = require('chalk');
let pass = true;
for (let i = 0;i < testa.length; i++) {
	if (process.platform.startsWith("win")) {
		testa[i].command = testa[i].command.replace(/&/g,"^&");
	}
	let fails = 0; // Number of failures on a given test object
	let prefix = "Test " + (i+1) + "/" + (testa.length) + ": ";
	process.stdout.write(clc.blue(prefix) + testa[i]["command"] + "\n");
	let results = test.commands0([testa[i]], "subset.js");
	
	// https://stackoverflow.com/a/15397506
	// Flatten results array.
	// Newer Javascript has flat() - can use results = results.flat();
	// TODO: Each element in testa is a test command for which there are test conditions.
	// If there are multiple test conditions, loop over them.
	results = Array.prototype.concat.apply([], results);

	for (var j=0; j<results.length; j++) {
		if (results[j].err) {
			if (results[j].msg != undefined) {
				console.log(clc.red.bold("Error Msg : ") + clc.red.bold(results[j].msg + "\n"));
			}
			if ((results[j].expected != undefined) && (results[j].got != undefined)) {
				console.log(clc.red.bold("Expected : ") + clc.red.bold(results[j].expected) + clc.red.bold(" Got : ") + clc.red.bold(results[j].got)  + "\n");
			}
			fails = fails + 1;
		}
	}
	if (fails == 0) {
		console.log(clc.blue(prefix) + clc.green.bold("PASS") + "\n");
	} else {
		pass = false;
		console.log(clc.blue(prefix) + clc.red.bold("FAIL") + "\n");
	}
}

if (pass) {
	process.exit(0);
} else {
	process.exit(1);
}