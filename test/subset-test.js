var test = require('../lib/test.js');
var testa = [
	{
		"command": "node lib/subset.js --url 'http://hapi-server.org/servers/TestData2.0/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false' --stop 1970-01-01T00:00:07",
		"Nlines": "7",
		"Ncommas": "7"
	},
	{
		"command": "node lib/subset.js --columns 1 --url 'http://hapi-server.org/servers/TestData2.0/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false' --stop 1970-01-01T00:00:07",
		"Nlines": "7",
		"Ncommas": "0"
	},
	{
		"command": "node lib/subset.js --columns 1-2 --url 'http://hapi-server.org/servers/TestData2.0/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false' --stop 1970-01-01T00:00:07",
		"Nlines": "7",
		"Ncommas": "7"
	}
]

console.log('Subsetting tests');
console.log('________________');
const clc = require('chalk');
let fails = 0;
for (let i = 0;i < testa.length; i++) {
	let prefix = "Test " + (i+1) + "/" + (testa.length) + ": ";
	process.stdout.write(clc.blue(prefix) + testa[i]["command"] + "\n");
	ok = test.commands([testa[i]], "subset.js");
	if (ok) {
		console.log(clc.blue(prefix) + clc.green.bold("PASS") + "\n");
	} else {
		fails = fails + 1;
		console.log(clc.blue(prefix) + clc.red.bold(" FAIL") + "\n");
	}
}

if (fails == 0) {
	process.exit(0);
} else {
	process.exit(1);
}