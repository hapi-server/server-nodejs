var test = require('../lib/test.js');
var testa = [
	{
		"command": "node lib/subset.js --url 'http://hapi-server.org/servers/TestData/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false' --stop 1970-01-01T00:00:07",
		"Nlines": "7",
		"Ncommas": "7"
	},
	{
		"command": "node lib/subset.js --columns 1 --url 'http://hapi-server.org/servers/TestData/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false' --stop 1970-01-01T00:00:07",
		"Nlines": "7",
		"Ncommas": "0"
	},
	{
		"command": "node lib/subset.js --columns 1-2 --url 'http://hapi-server.org/servers/TestData/hapi/data?id=dataset1&parameters=scalar&time.min=1970-01-01Z&time.max=1970-01-01T00:00:11Z&attach=false' --stop 1970-01-01T00:00:07",
		"Nlines": "7",
		"Ncommas": "7"
	}
]
test.commands(testa,"subset.js");