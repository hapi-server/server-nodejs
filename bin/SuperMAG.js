// Call the SuperMAG API and respond with HAPI CSV.
var fs      = require('fs');
var request = require('request');
var argv    = require('yargs')
				.default
				({
					'id': 'ABK',
					'parameters': '',
					'start': '2001-01-01',
					'stop': '2001-01-02'
				})
				.argv;

let id = argv['id'];

let start  = argv['start']
let stop   = argv['stop']
let stopms = new Date(stop).valueOf();

let allparameters = false;
if (argv.parameters === true || argv.parameters === '') {
	allparameters = true;
} else {

	// Get columns associated with requested parameters if not all parameters requested.
	var PARAMETERS = argv.parameters.split(",");

	var timeonly = false;
	if (PARAMETERS.length == 1 && PARAMETERS[0] === 'Time') {
		var timeonly = true;
	}

	var json = JSON.parse(fs.readFileSync('metadata/SuperMAG/SuperMAG-catalog.json', 'utf8'));
	var parameters = json[0].info.parameters;
	if (PARAMETERS[0] !== "Time") {
		PARAMETERS.push("Time");
	}
	var pn = [];
	for (var i=0;i < parameters.length;i++) {
		if (PARAMETERS.includes(parameters[i].name)) {
			pn.push(i);
		}
	}
}

get(start.slice(0,10));

function get(date) {

	let url = "";
	url = "http://supermag.jhuapl.edu/mag/lib/services/?start=";
	url = url + date + "&interval=24%3A00&service=mag&stations=";
	url = url + id + "&delta=none&baseline=all&options=+mlt+sza+decl&fmt=csv&user=tsds2&";

	//console.log("Requesting " + url);
	request(url, function (error, response, body) {
		if (error) {
			console.log(error);
			process.exit(1);  	
		}
		if (response && response.statusCode != 200) {
			process.exit(1);
		}
		console.log(extractData(body, date));

		datems = new Date(date).valueOf();
		nextms = datems + 86400000;
		nextdate = new Date(978393600000).toISOString().slice(0,10);
		if (nextms < stopms) {
			get(nextdate);
		}
	})
}

function extractData(data, date) {
	var clean = start.slice(11,-1) == "00:00:00.000000000Z"
	var clean = start.slice(11,-1) == "00:00:00.000000000Z"

	if (date == start.slice(0,10) || date == stop.slice(0,10)) {


	} else {
		// Remove first line
		// Replace station id column
		// Replace space between date and time with "T"
		var re = new RegExp("," + id, 'g');
		return data.toString()
				.replace(/^.*?\n(.*)/,'$1')
				.replace(re, "")
				.replace(/([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2}:[0-9]{2})/g,'$1T$2');
	}
};