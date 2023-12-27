const runner = require("./runner.js");

let nodeexe;
if (process.platform.startsWith("win")) {
	nodeexe =  '"' + process.execPath + '"';
} else {
	nodeexe = "'" + process.execPath + "'";
}

const testArray = [
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
];

runner.run(testArray,"Subsetting test");