// R.S. Weigel <rweigel@gmu.edu>
// License: Public Domain

// Global variables
var __HAPIVERSION = "1.1"; // Spec version implemeted
var __CATALOGID     = "TestData";
var __DATASETID     = "TestData";

var fs      = require('fs');
var os      = require("os");

var express = require('express');
var app     = express();
var compression = require('compression');
var server  = require("http").createServer(app);
var moment  = require('moment');

var clc     = require('cli-color');
var argv    = require('yargs')
				.default
				({
					'port': 8999,
					'debug': true
				})
				.argv;

// date string
function ds() {return (new Date()).toISOString() + " ";};

exceptions(); // Catch common exceptions

app.use(compression()); // Compress responses

app.get('/', function (req,res) {
	console.log(ds() + req.originalUrl);
	res.send("See <a href='./hapi'>HAPI Landing Page</a>");
})

// Info web page
app.get('/hapi', function (req, res) {
	cors(res);
	res.contentType('text/html');
	console.log(ds() + req.originalUrl);
	res.send(fs.
				readFileSync(__dirname+"/server.htm","utf8")
				.toString()
				.replace(/__VERSION__/g, __HAPIVERSION)
				.replace(/__CATALOG__/g, __CATALOGID)
			);
})

// /capabilities
app.get('/hapi/capabilities', function (req, res) {
	cors(res);
	res.contentType("application/json");
	var json = {"HAPI": __HAPIVERSION,"outputFormats": ["csv","fcsv","binary","fbinary"],"status": {"code": 1200,"message": "OK"}};
	console.log(ds() + req.originalUrl);
	res.send(JSON.stringify(json) + "\n");
})

// /catalog
app.get('/hapi/catalog', function (req, res) {
	cors(res);
	res.contentType("application/json");
	var json =
		{
			"HAPI" : __HAPIVERSION,
			"status": { "code": 1200, "message": "OK"},
			"catalog" : 
				[
					{"id": __DATASETID, title: "Test dataset"}
				]
		};
	console.log(ds() + req.originalUrl);
	res.send(JSON.stringify(json, null, 4));
})

// /info
app.get('/hapi/info', function (req, res) {
	cors(res);
	res.contentType("application/json");
	if (req.query.id !== __DATASETID) {
		error(req,res,1401);
		return;
	}
	var header = parameters(req,res);
	if (header != false) {
		console.log(ds() + req.originalUrl);
		res.send(JSON.stringify(header, null, 4) + "\n");
		return;
	}
})

// /data
app.get('/hapi/data', function (req, res) {

	cors(res);

	console.log(ds() + req.originalUrl);

	var header = parameters(req,res);
	if (header == false) {return;}; // Error occured and sent.

	var timeRange = timerange(req,res,header)
	if (timeRange == false) {return;}; // Error occured and sent.

	if (typeof(req.query["format"]) === "undefined") {
		req.query["format"] = "csv";
	}

	if (req.query["format"] === "csv") {
		res.contentType("text/csv"); 	 // Triggers d/l dialog in most browsers
		//res.contentType("text/plain"); // For testing; so displays in browser
	} else if (req.query["format"] === "binary") {
		res.contentType("application/octet-stream");
	} else if (req.query["format"] === "json") {
		res.contentType("application/json");
	} else if (req.query["format"] === "fbinary") {
		res.contentType("application/octet-stream");
	} else if (req.query["format"] === "fcsv") {
		res.contentType("text/csv");
	} else {
		error(req,res,1409); // Unsupported output format.
		return;
	}

	if (req.query["include"] === "header") {
		res.write("#" + JSON.stringify(header, null, 4) + "\n");
	}

	data(req,res,header,timeRange);

	return;
})

////////////////////////////////////////////////////////////////////////////////
// Start the server.
app.listen(argv.port);
console.log(ds()+"Listening on port "+argv.port+". See http://localhost:"+argv.port+"/hapi");
////////////////////////////////////////////////////////////////////////////////

function parameters(req,res) {

	jsonstr = fs.readFileSync(__dirname + "/parameters.json");
	json    = JSON.parse(jsonstr);

	json["HAPI"]   = __HAPIVERSION;
	json["status"] = { "code": 1200, "message": "OK"};

	maxDurations = {
		"Time": "P366D",
		"scalar": "P366D",
		"scalarint": "P366D",
		"scalariso": "P366D",
		"scalarstr": "P366D",
		"scalarcats": "P366D",
		"vector": "P366D",
		"vectorint": "P366D",
		"vectorstr": "P366D",
		"vectoriso": "P366D",
		"vectorcats": "P366D",
		"spectra": "P1D"
	};
	// Add content to parameters.json.
	// Add _maxDuration element.
	for (var i = 0;i < json.parameters.length;i++) {
		name = json.parameters[i]["name"];
		if (!maxDurations[name]) {
			console.log(ds() + "Warning: Parameter " + name + " does not have a maxDuration set in server.js.  Using P1D.")
			json.parameters[i]["x_maxDuration"] = "P1D";
		} else {
			json.parameters[i]["x_maxDuration"] = maxDurations[name];
		}
	}
	// Add bins to spectra parameter.  Assumes spectra is last parameter!
	var sl = json.parameters.length; // spectra location
	var i = 0;while(i < 100){json.parameters[sl-1].bins.centers.push(i++);};


	// Create list of known parameters from JSON
	var knownparams = [];
	for (var i = 0;i < json.parameters.length;i++) {
		knownparams[i] = json.parameters[i].name;
	}

	// Create arrray from comma-separated parameter list
	if (req.query.parameters) {
		wantedparams = req.query.parameters.split(",");
	} else {
		// If parameter key not in query string, defualt is all
		wantedparams = knownparams;
	}

	// Remove duplicates
	var wantedparams = Array.from(new Set(wantedparams));

	// No parameters specified means all.  This catches case where 
	// parameters= is given in URL.
	if (wantedparams.length == 0) {return json;}

	// Determine if any parameters requested are invalid.
	validparams = []; iv = 0;
	invalidparams = []; ii = 0;
	for (var i = 0;i < wantedparams.length;i++) {
		if (knownparams.indexOf(wantedparams[i]) > -1) {
			// TODO: For speed, consider using objects if parameters lists are very long.
			validparams[iv] = wantedparams[i];
			iv++;
		} else {
			invalidparams[ii] = wantedparams[i];
			ii++;
		}
	}

	// Invalid parameter found
	if (validparams.length != wantedparams.length) {
		error(req,res,1401);
		return false;
	}

	// Delete parameters not requested from JSON
	for (var i = 1;i < knownparams.length;i++) {
		if (!(wantedparams.indexOf(knownparams[i]) > -1)) {
			delete json.parameters[i];
		}
	}
	// Remove nulls placed when array element deleted.
	json.parameters = json.parameters.filter(function(n){ return n != undefined }); 

	return json;
}

function timerange(req,res,header) {

	// TODO: Handle less than milliseconds resolution.

	var times = [req.query["time.min"],req.query["time.max"],header.startDate,header.stopDate];

	if (!moment(times[0], moment.ISO_8601).isValid()) {
		error(req,res,1402);return false;
	}
	if (!moment(times[1], moment.ISO_8601).isValid()) {
		error(req,res,1403);return false;
	}
	if (!moment(times[2], moment.ISO_8601).isValid()) {
		error(req,res,1409);return false;
	}
	if (!moment(times[3], moment.ISO_8601).isValid()) {
		error(req,res,1409);return false;
	}

	for (var i = 0;i < times.length;i++) {
		if (times[i].match(/^[0-9]{4}-[0-9]{3}/) != null) {
			var year = times[i].split("-")[0];
			var doy  = times[i].split("-")[1];
			var yearms = moment(year + "-01-01T00:00:00.000Z").valueOf();
			var doyms  = (doy-1)*86400000;
			times[i] = (new Date(yearms + doyms)).toISOString();
		}
		// Date YYYY-MM-DD or YYY-DDD with no Z is ambiguous timezone.  
		if (times[i].length == 10 || times[i].length == 8) {
			times[i] = times[i] + "T00:00:00.000Z";
		}
		// Make times UTC
		if (times[i].match(/Z$/) == null) {
			times[i] = times[i] + "Z";
		}
	}

	var startms = moment(times[0]).valueOf();
	var startmsMin = moment(times[2]).valueOf();
	var stopms  = moment(times[1]).valueOf();
	var stopmsMax  = moment(times[3]).valueOf();

	if (stopms < startms) {
		error(req,res,1404);
		return false;
	}
	if (startms < startmsMin) {
		error(req,res,1405);
		return false;
	} 
	if (stopms > stopmsMax) {
		error(req,res,1405);
		return false;
	}
	return times[0] + "/" + times[1];
}

function datacl(req,res,header,timeRange) {
	// TODO: Demo of piping output from command line program through.
}

function data(req,res,header,timeRange) {

	var start = timeRange.split("/")[0];
	var stop  = timeRange.split("/")[1];

	var startsec = moment(start).valueOf()/1000;
	var stopsec  = moment(stop).valueOf()/1000;

	startsec = Math.floor(startsec);
	stopsec  = Math.floor(stopsec);

	var wantedparameters = [];
	for (var i = 0;i < header.parameters.length; i++) {
		wantedparameters[i] = header.parameters[i]["name"];
	}

	var records = "";
	var record  = "";
	var wrote   = false;
	var Nwrote  = 0;
	var types   = ["isotime"]; // Time parameter
	var names   = ["Time"];

	scalarstrs = ["P/P","P/F","F/P","F/F"];
	scalarcats = [0,1,2];
	for (var i = startsec; i < stopsec;i++) {
		var record = "";
		if (wantedparameters.indexOf('Time') > -1) {
			// -1 to remove Z
			record = (new Date(i*1000).toISOString()).slice(0,-1);
		}
		if (wantedparameters.indexOf('scalar') > -1) {
			record = record + "," + Math.sin(Math.PI*i/600);
			if (i==startsec) {
				types.push('double');
				names.push('scalar');
			}
		}
		if (wantedparameters.indexOf('scalarint') > -1) {
			record = record + "," + Math.round(1000*Math.sin(Math.PI*i/600));
			if (i==startsec) {
				types.push('integer');
				names.push('scalarint');
			}
		}
		if (wantedparameters.indexOf('scalarstr') > -1) {
			record = record + "," + scalarstrs[(i-startsec) % scalarstrs.length];
			if (i==startsec) {
				types.push('string');
				names.push('scalarstr');
			}
		}
		if (wantedparameters.indexOf('scalarcats') > -1) {
			record = record + "," + scalarcats[(i-startsec) % scalarcats.length];
			if (i==startsec) {
				types.push('integer');
				names.push('scalarcats');
			}
		}
		if (wantedparameters.indexOf('scalariso') > -1) {
			record = record + "," + (new Date((i+1)*1000).toISOString()).slice(0,-5) + "Z";
			if (i==startsec) {
				types.push('isotime');
				names.push('scalariso');
			}
		}
		if (wantedparameters.indexOf('vector') > -1) {
			record = record 
						+ "," + Math.sin(Math.PI*(i-startsec)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
			if (i==startsec) {
				types = types.concat(['double','double','double']);
				names = names.concat(['vector','vector','vector']);
			}
		}
		if (wantedparameters.indexOf('vectorint') > -1) {
			record = record 
						+ "," + Math.round(1000*Math.sin(Math.PI*i/600))
						+ "," + Math.round(1000*Math.sin(Math.PI*i/600))
						+ "," + Math.round(1000*Math.sin(Math.PI*i/600));
			if (i==startsec) {
				types = types.concat(['integer','integer','integer']);
				names = names.concat(['vectorint','vectorint','vectorint']);
			}
		}
		if (wantedparameters.indexOf('vectorstr') > -1) {
			record = record 
							+ "," + scalarstrs[(i-startsec) % scalarstrs.length]
							+ "," + scalarstrs[(i-startsec+1) % scalarstrs.length]
							+ "," + scalarstrs[(i-startsec+2) % scalarstrs.length];
			if (i==startsec) {
				types = types.concat(['string','string','string']);
				names = names.concat(['vectorstr','vectorstr','vectorstr']);
			}
		}
		if (wantedparameters.indexOf('vectoriso') > -1) {
			record = record 
						+ "," + (new Date((i+1)*1000).toISOString()).slice(0,-5)
						+ "," + (new Date((i+2)*1000).toISOString()).slice(0,-5)
						+ "," + (new Date((i+3)*1000).toISOString()).slice(0,-5)
			if (i==startsec) {
				types = types.concat(['isotime','isotime','isotime']);
				names = names.concat(['vectoriso','vectoriso','vectoriso']);
			}
		}
		if (wantedparameters.indexOf('vectorcats') > -1) {
			record = record 
						+ "," + scalarcats[(i-startsec)   % scalarcats.length]
						+ "," + scalarcats[(i-startsec+1) % scalarcats.length]
						+ "," + scalarcats[(i-startsec+2) % scalarcats.length];
			if (i==startsec) {
				types = types.concat(['integer','integer','integer']);
				names = names.concat(['vectorcats','vectorcats','vectorcats']);
			}
		}
		if (wantedparameters.indexOf('spectra') > -1) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 100;j++) {
				record = record + "," + 1/j;
				if (i==startsec) {
					types = types.push('double');
					names = names.push('double');
				}
			}
		}

		if (records.length > 0) {
			records = records + "\n" + record;
		} else {
			records = record;
		}

		var flush = (i > startsec) && ((i-startsec) % 100 === 0);
		// Flush to output every 100 records (lines)
		if (flush && !(req.query["format"] === "json")) {
			if (req.query["format"] === "binary") {
				var xrecords = csv2bin(records,types);
				res.write(xrecords);
			} else if (req.query["format"] === "fbinary") {
				var xrecords = csv2fbin(records,types,Nwrote);
				Nwrote = (i-startsec);
				res.write(xrecords);
			} else if (req.query["format"] === "fcsv") {
				var xrecords = csv2fcsv(records,Nwrote);
				Nwrote = (i-startsec);
				res.write(xrecords + "\n");
			} else {
				res.write(records + "\n");
			}
			records = "";
		}
	}

	if (req.query["format"] === "csv") {
		if (records.length > 0) {
			res.write(records + "\n");
		}
	} else if (req.query["format"] === "binary") {
		if (records.length > 0) {
			var xrecords = csv2bin(records,types);
			res.write(xrecords);
		}
	} else if (req.query["format"] === "json") {
		var xrecords = csv2json(records,types,names,header);
		res.write('{"data":\n' + xrecords + "\n}\n");
	} else if (req.query["format"] === "fcsv") {
		if (records.length > 0) {
			var xrecords = csv2fcsv(records,Nwrote);
			res.write(xrecords + "\n");
		}
	} else if (req.query["format"] === "fbinary") {
		if (records.length > 0) {
			var xrecords = csv2fbin(records,types,Nwrote);
			res.write(xrecords);
		}
	} 
	res.end();
}

function csv2json(records,types,names,header) {

	// TODO: Flush JSON every 100 lines or so or send error if lines is too large.

	var po = {}; // Parameter object
	for (var i = 0;i < header.parameters.length;i++) {
		po[header.parameters[i].name] = {};
		po[header.parameters[i].name]["type"] = header.parameters[i].type;
		po[header.parameters[i].name]["size"] = header.parameters[i].size || [1];
	}
	//console.log(po)
	//console.log(types)
	//console.log(names)
	recordsarr = records.split("\n");
	var cols = [];
	var json = [];
	var records = "";
	var open = "";
	var nw = 0;
	for (var i = 0;i < recordsarr.length;i++) {
		cols    = recordsarr[i].split(",");
		record = "";
		nw = 0;

		for (var j = 0;j < cols.length;j++) {
			if (j == 0) {
				record = "[";
			}
			open = "";
			close = "";
			if (po[names[j]].size[0] > 1 && open.length == 0 && nw == 0) {
				open = "[";
			}
			nw = nw + 1;
			if (nw == po[names[j]].size[0]) {
				close = "]";
				open = "";
				nw = 0;
			}
			if (types[j] === "integer") {
				record = record + open + parseInt(cols[j]) + close + ",";
			} else if (types[j] === "double") {
				record = record + open + parseFloat(cols[j]) + close + ",";
			} else {
				record = record + open + "'" + cols[j] + "'" + close + ",";
			}
		}
		if (i > 0) {
			records = records + "\n" + record.slice(0,-1) + "],";
		} else {
			records = record.slice(0,-1) + "],";
		}
	}
	return records.slice(0,-1);
	//return JSON.stringify(json).replace(/\],/g,"],\n").replace(/]$/,"\n]\n").replace(/^\[/,"[\n");
}

// TODO: Merge this with csv2fbin
function csv2bin(records,types) {
	// TODO: Get types from header and don't compute types in parameters().
	var recordsarr = records.split("\n");
	var Nr = recordsarr.length; // Number of rows

	var record1 = recordsarr[0].split(",");
	var Nt    = record1[0].length + 1; // Number of time characters (+1 for null)
	var Nd    = record1.length - 1;	 // Number of data columns

	Nb = 0;
	for (var i = 1;i < types.length;i++) {
		if (types[i] === 'double') {
			Nb = Nb + 8;
		}
		if (types[i] === 'integer') {
			Nb = Nb + 4;
		}		
	}

	//console.log(types)
	//console.log(Nr*(Nt+Nb))
	var recordbuff = new Buffer.alloc(Nr*(Nt + Nb));
	var pos = 0;
	for (var i = 0; i < Nr; i++) {
		var record = recordsarr[i].split(",");
		recordbuff.write(record[0],pos);
		pos = pos + Nt - 1;
		recordbuff.write("\0",pos);
		pos = pos + 1;
		for (var j = 1;j < Nd+1;j++) {
			if (types[j] === 'double') {
				recordbuff.writeDoubleLE(record[j],pos);
				pos = pos + 8;
			}
			if (types[j] === 'integer') {
				recordbuff.writeInt32LE(records[j],pos);	
				pos = pos + 4;
			}
		}
	}
	return recordbuff;
}

function csv2fcsv(records,Nwrote) {
	var recordsarr = records.split("\n");
	var Nr = recordsarr.length; // Number of rows
	//console.log("Converting " + Nr + " records.");

	for (var i = 0; i < Nr; i++) {
		var record = recordsarr[i].split(",");
		record[0]  = Nwrote+i;
		recordsarr[i] = record.join(",");
	}
	return recordsarr.join("\n");
}

function csv2fbin(records,types,Nwrote) {

	var recordsarr = records.split("\n");
	var Nr = recordsarr.length; // Number of rows
	//console.log(Nwrote)
	Nb = 8; // Time
	for (var i = 1;i < types.length;i++) {
		if (types[i] === 'double') {
			Nb = Nb + 8;
		}
		if (types[i] === 'integer') {
			Nb = Nb + 4;
		}
	}

	var recordsbuff = new Buffer.alloc(Nr*Nb);
	var pos = 0;
	for (var i = 0; i < Nr; i++) {
		var record = recordsarr[i].split(",");
		record[0] = Nwrote + i; // Overwrite ISO time with seconds
		//console.log("Writing " + record[0]);
		recordsbuff.writeDoubleLE(record[0],pos);
		pos = pos + 8;
		for (var j = 1;j < record.length;j++) {
			//console.log("Writing " + record[j]);
			if (types[j] === 'double') {
				recordsbuff.writeDoubleLE(record[j],pos);
				pos = pos + 8;
			}
			if (types[j] === 'integer') {
				recordsbuff.writeInt32LE(record[j],pos);	
				pos = pos + 4;
			}
		}
	}
	return recordsbuff;
}

function cors(res) {
	// CORS headers
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
}

function error(req,res,code) {

	var errs = {
		"1400": {status: 400, "msg": "HAPI error 1400: user input error"},
		"1401": {status: 400, "msg": "HAPI error 1401: unknown request parameter"},
		"1402": {status: 400, "msg": "HAPI error 1402: error in start time"},
		"1403": {status: 400, "msg": "HAPI error 1403: error in stop time"},
		"1404": {status: 400, "msg": "HAPI error 1404: start time after stop time"},
		"1405": {status: 400, "msg": "HAPI error 1405: time outside valid range"},
		"1406": {status: 404, "msg": "HAPI error 1406: unknown dataset id"},
		"1407": {status: 404, "msg": "HAPI error 1407: unknown dataset parameter"},
		"1408": {status: 400, "msg": "HAPI error 1408: too much time or data requested"},
		"1409": {status: 400, "msg": "HAPI error 1409: unsupported output format"},
		"1500": {status: 500, "msg": "HAPI error 1500: internal server error"},
		"1501": {status: 500, "msg": "HAPI error 1501: upstream request error"}
	}

	// Defaults
	var json =
			{
				"HAPI" : __HAPIVERSION,
				"status": { "code": 1500, "message": "Internal server error"}
			};
	var httpcode = 500;
	var httpmesg = "Internal server error";

	// Modify defaults
	if (errs[code+""]) {
		json["status"]["code"] = code+"";
		json["status"]["msg"]  = errs[code+""]["msg"];
		httpcode = errs[code+""]["status"];
		httpmesg = errs[code+""]["msg"];
	}

	console.log(ds() + req.originalUrl + " " + httpcode + "/" + json["status"]["code"]);

	res.contentType("application/json");
	res.statusMessage = httpmesg;
	res.status(httpcode).send(JSON.stringify(json, null, 4) + "\n");
}

function exceptions() {
	process.on('uncaughtException', function(err) {
		if (err.errno === 'EADDRINUSE') {
			console.log(ds() + clc.red("Port " + argv.port + " already in use."));
		} else {
			console.log(err.stack);
		}
		process.exit(1);
	});
}