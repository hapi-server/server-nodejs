// R.S. Weigel <rweigel@gmu.edu>
// License: Public Domain

// Global variables
// TODO: Don't.
var __HAPIVERSION = "1.1"; // Spec version implemeted

var fs      = require('fs');
var os      = require("os");

var express  = require('express');
var app      = express();
var compress = require('compression');
var server   = require("http").createServer(app);
var moment   = require('moment');

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

exceptions(); // Catch common exceptions (See TODO in exceptions().)

app.use(compress()); // Compress responses

app.get('/', function (req,res) {
	logreq(req);
	res.send("See <a href='./hapi'>HAPI Landing Page</a>");
})

// Landing web page
app.get('/hapi', function (req, res) {
	logreq(req);
	cors(res);
	res.contentType('text/html');
	res.send(files("landing"));
})

// /capabilities
app.get('/hapi/capabilities', function (req, res) {
	logreq(req);
	cors(res);
	res.contentType("application/json");

	// Check for invalid query parameters
	var keys = Object.keys(req.query);
	if (keys.length > 0) {
		error(req,res,1401);
		return;
	}

	res.send(files("capabilities"));
})

// /catalog
app.get('/hapi/catalog', function (req, res) {
	logreq(req);
	cors(res);
	res.contentType("application/json");

	// Check for invalid query parameters
	var keys = Object.keys(req.query);
	if (keys.length > 0) {
		error(req,res,1401);
		return;
	}

	res.send(files("catalog"));
})

// /info
app.get('/hapi/info', function (req, res) {
	logreq(req);
	cors(res);
	res.contentType("application/json");

	// Check for invalid query parameters
	var keys = Object.keys(req.query);
	if (!req.query.id) {
		error(req,res,1400,"An id must be given."); // User input error
		return;
	}
	if (keys.length > 2) {
		// Unknown request parameter
		error(req,res,1401,"Only id and parameters are allowed inputs.");
	}
	if (keys.length == 2 && typeof(req.query.parameters) === "undefined") {
		 // Unknown request parameter
		error(req,res,1401,"Only id and parameters are allowed inputs.");
		return;		
	}

	// Get list of datasets.
	var catalog = files('catalog','json');
	var datasets = catalog.catalog;
	var found = false;
	// Determine if requested id is in list
	for (var i=0;i<datasets.length;i++) {
		if (datasets[i]['id'] === req.query.id) {found = true;break;}
	}
	if (!found) {error(req,res,1406);return;}

	var header = info(req,res); // info() returns integer error code if error
	if (typeof(header) === "number") {
		error(req,res,header,"Parameter not found in dataset");
		return;
	} else {
		res.send(header);
		return;
	}

})

// /data
app.get('/hapi/data', function (req, res) {
	logreq(req);
	cors(res);

	for (var key in req.query) {
		if (-1 == ["id","parameters","time.min","time.max","format","include"].indexOf(key)) {
			error(req,res,1401); // Unknown request field
			return;
		}
	}	

	// Get list of datasets.
	// TODO: Code block below is duplicated from /catalog.
	var catalog = files('catalog','json');
	var datasets = catalog.catalog;
	var found = false;
	// See if requested dataset in list
	for (var i=0;i<datasets.length;i++) {
		if (datasets[i]['id'] === req.query.id) {found = true;break;}
	}
	if (!found) {error(req,res,1406);return;}

	var header = info(req,res); // Get header information for request.
	if (typeof(header) === "number") {
		error(req,res,header);
		return;
	};

 	// Non-standard element, but seems it should be in response
	header["_startDateRequested"] = req.query["time.min"];
	header["_stopDateRequested"]  = req.query["time.max"];
	header["_parentDataset"]      = req.query["id"];

	var timeOK = timeCheck(header)
	if (timeOK != true) {
		error(req,res,timeOK)
		return
	};

	header["format"] = "csv";
	if (req.query["format"]) {
		// If format given, see if server supports it.
		capabilities = fs.readFileSync(__dirname + "/metadata/capabilities.json");
		outputFormats = JSON.parse(capabilities).outputFormats;
		if (outputFormats.indexOf(req.query["format"]) == -1) {
			error(req,res,1409);
			return;
		}
		header["format"] = req.query["format"];
	}
	
	var proto = req.connection.encrypted ? 'https' : 'http'; // Has not been tested under https.
	if (header["status"]) { // If statement because dataset0 does not have status element.
 		// Non-standard element
		header["status"]["_request"] = proto + "://" + req.headers.host + req.originalUrl;
	}

	if (req.query["include"]) {
		if (req.query["include"] !== "header") {
			error(req,res,1410); // Unknown include value
			return;
		}
	}

	if (header["format"] === "csv")            {res.contentType("text/csv");
	} else if (header["format"] === "binary")  {res.contentType("application/octet-stream");
	} else if (header["format"] === "json")    {res.contentType("application/json");
	} else if (header["format"] === "fbinary") {res.contentType("application/octet-stream");
	} else if (header["format"] === "fcsv")    {res.contentType("text/csv");
	} else {error(req,res,1409); return; // Unsupported output format.
	}

	var include = req.query["include"] === "header"
	if (include && header["format"] !== "json") {
 		// Send header now unless format = json (will be sent later).
		res.write("#" + JSON.stringify(header) + "\n");
	}

	data(res,header,include); // Send data

	return;
})

// Read static JSON files by and then start the server.
files(function () {
	app.listen(argv.port); // Start server
	console.log(ds() + "Listening on port " + argv.port
					 + ". See http://localhost:" + argv.port + "/hapi");
})

// Return content of static JSON files
function files(which,format) {

	// Call before server starts as files(cb) to read and cache content from files.

	if (files.cache) {
		// Content has been read from disk into object before server started.  Return it.
		return files.cache[which][format || "string"];
	} else {
		// Read content from disk.
		// Landing page html
		files.cache = {};
		files.cache['landing'] = {};
		files.cache['landing']['string'] = 
			fs
				.readFileSync(__dirname+"/server.htm","utf8")
				.toString()
				.replace(/__VERSION__/g, __HAPIVERSION);

		// Capabilities 
		var str  = fs.readFileSync(__dirname + "/metadata/capabilities.json")
		var json = JSON.parse(str);
		json["HAPI"]   = __HAPIVERSION;
		json["status"] = {"code": 1200,"message": "OK"};
		str = JSON.stringify(json) + "\n";
		files.cache['capabilities'] = {};
		files.cache['capabilities']['string'] = str;
		files.cache['capabilities']['json'] = json;

		// Catalog
		var str = fs.readFileSync(__dirname + "/metadata/catalog.json");
		var json = JSON.parse(str);
		json["HAPI"] = __HAPIVERSION;
		json["status"] = { "code": 1200, "message": "OK"};
		str = JSON.stringify(json, null, 4);
		files.cache['catalog'] = {};
		files.cache['catalog']['string'] = str;
		files.cache['catalog']['json'] = json;

		which(); // Execute callback.
	}
}

function info(req,res) {

	// Read parameter metadata.
	jsonstr = fs.readFileSync(__dirname + "/metadata/" + req.query.id + ".json");
	json    = JSON.parse(jsonstr);

	if (req.query.id !== "dataset0") { // Make dataset0 have more invalid metadata than given in dataset0.json.
		json["HAPI"]   = __HAPIVERSION;
		json["status"] = { "code": 1200, "message": "OK"};
	}

	// Create array of parameter names
	var knownparams = [];
	for (var i = 0;i < json.parameters.length;i++) {
		knownparams[i] = json.parameters[i].name;
	}

	// Create arrray from comma-separated parameters in query
	if (req.query.parameters) {
		wantedparams = req.query.parameters.split(",");
	} else {
		// If parameters field not in query string, defualt is all.
		wantedparams = knownparams;
	}

	// Remove duplicate parameters from query
	var wantedparams = Array.from(new Set(wantedparams));

	// Catches case where parameters= is given in query string.
	// Assume it means same as if no parameters field was given (all parameters).
	if (wantedparams.length == 0) {return json;}

	// Determine if any parameters requested are invalid
	validparams = []; iv = 0;
	invalidparams = []; ii = 0;
	for (var i = 0;i < wantedparams.length;i++) {
		if (knownparams.indexOf(wantedparams[i]) > -1) {
			// TODO: Consider using objects if parameter lists are very long.
			validparams[iv] = wantedparams[i];
			iv++;
		} else {
			invalidparams[ii] = wantedparams[i];
			ii++;
		}
	}

	// Invalid parameter found
	if (validparams.length != wantedparams.length) {
		return 1401;
	}

	// Delete parameters from JSON response that were not requested
	for (var i = 1;i < knownparams.length;i++) {
		if (!(wantedparams.indexOf(knownparams[i]) > -1)) {
			delete json.parameters[i];
		}
	}
	// Remove nulls placed when array element is deleted
	json.parameters = json.parameters.filter(function(n){ return n != undefined }); 

	// Return JSON string
	return json;
}

function timeCheck(header) {

	// TODO: Handle less than milliseconds resolution.
	// TODO: If one of the times had Z and the other does not, should warn that all time
	// stamps are interpreted as Z.

	var times = [header["_startDateRequested"],header["_stopDateRequested"],
				 header.startDate,header.stopDate];

	if (!moment(times[0], moment.ISO_8601).isValid()) {
		return 1402;
	}
	if (!moment(times[1], moment.ISO_8601).isValid()) {
		return 1403;
	}
	if (!moment(times[2], moment.ISO_8601).isValid()) {
		return 1409;
	}
	if (!moment(times[3], moment.ISO_8601).isValid()) {
		return 1409;
	}

	for (var i = 0;i < times.length;i++) {
		if (times[i].match(/^[0-9]{4}-[0-9]{3}/) != null) {
			var year = times[i].split("-")[0];
			var doy  = times[i].split("-")[1];
			var yearms = moment(year + "-01-01T00:00:00.000Z").valueOf();
			var doyms  = (doy-1)*86400000;
			times[i] = (new Date(yearms + doyms)).toISOString();
		}
		// Date YYYY-MM-DD with no Z is ambiguous timezone.  
		if (times[i].length == 10) {
			times[i] = times[i] + "T00:00:00.000Z";
		}
		// Make times all times UTC
		if (times[i].match(/Z$/) == null) {
			times[i] = times[i] + "Z";
		}
	}

	var startms = moment(times[0]).valueOf();
	var startmsMin = moment(times[2]).valueOf();
	var stopms  = moment(times[1]).valueOf();
	var stopmsMax  = moment(times[3]).valueOf();

	if (stopms <= startms) {
		return 1404;
	}
	if (startms < startmsMin) {
		return 1405;
	} 
	if (stopms > stopmsMax) {
		return 1405;
	}

	return true;
}

function data(res,header,include) {
	// Generate and send data.

	// TODO: Demo of piping output from command line program through.

	var format = header["format"];
	var start  = header["_startDateRequested"].replace("Z","");
	var stop   = header["_stopDateRequested"].replace("Z","");
	var id     = header["_parentDataset"];

	// Date YYYY-MM-DD with no Z is ambiguous timezone.  
	if (start.length == 10) { // YYYY-MM-DD
		start = start + "T00:00:00.000";
	}
	if (stop.length == 10) { // YYYY-MM-DD
		stop = stop + "T00:00:00.000";
	}

	var startsec = moment(start+"Z").valueOf()/1000;
	var stopsec  = moment(stop+"Z").valueOf()/1000;

	startsec = Math.floor(startsec);
	stopsec  = Math.floor(stopsec);

	var wanted  = {};  // Wanted parameters object
	for (var i = 0;i < header.parameters.length; i++) {
		wanted[header.parameters[i]["name"]] = true;
	}

	var records = ""; // Number of records (lines)
	var record  = ""; // A record with comma-separated fields (columns)
	var Nwrote  = 0;  // Number of records flushed

	scalarstrs = ["P/P","P/F","F/P","F/F"];
	scalarcats = [0,1,2];

	for (var i = startsec; i < stopsec;i++) {
		var record = "";
		if (wanted['Time'] == true) {
			record = (new Date(i*1000).toISOString()).slice(0,-1);
		}
		if (wanted['scalar'] == true) {
			record = record + "," + Math.sin(Math.PI*i/600);
		}
		if (wanted['scalarint'] == true) {
			record = record + "," + Math.round(1000*Math.sin(Math.PI*i/600));
		}
		if (wanted['scalarstr'] == true) {
			record = record + "," + scalarstrs[(i-startsec) % scalarstrs.length];
		}
		if (wanted['scalarcats'] == true) {
			record = record + "," + scalarcats[(i-startsec) % scalarcats.length];
		}
		if (wanted['scalariso'] == true) {
			record = record + "," + (new Date((i+1)*1000).toISOString()).slice(0,-5) + "Z";
		}
		if (wanted['scalarmulti'] == true) {
			record = record + "," + Math.sin(Math.PI*i/600);
		}
		if (wanted['vector'] == true) {
			record = record 
						+ "," + Math.sin(Math.PI*(i-startsec)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
		}
		if (wanted['vectorint'] == true) {
			record = record 
						+ "," + Math.round(1000*Math.sin(Math.PI*i/600))
						+ "," + Math.round(1000*Math.sin(Math.PI*i/600))
						+ "," + Math.round(1000*Math.sin(Math.PI*i/600));
		}
		if (wanted['vectorstr'] == true) {
			record = record 
							+ "," + scalarstrs[(i-startsec) % scalarstrs.length]
							+ "," + scalarstrs[(i-startsec+1) % scalarstrs.length]
							+ "," + scalarstrs[(i-startsec+2) % scalarstrs.length];
		}
		if (wanted['vectorcats'] == true) {
			record = record 
						+ "," + scalarcats[(i-startsec)   % scalarcats.length]
						+ "," + scalarcats[(i-startsec+1) % scalarcats.length]
						+ "," + scalarcats[(i-startsec+2) % scalarcats.length];
		}
		if (wanted['vectoriso'] == true) {
			record = record 
						+ "," + (new Date((i+1)*1000).toISOString()).slice(0,-5)
						+ "," + (new Date((i+2)*1000).toISOString()).slice(0,-5)
						+ "," + (new Date((i+3)*1000).toISOString()).slice(0,-5);
		}
		if (wanted['vectormulti'] == true) {
			record = record 
						+ "," + Math.sin(Math.PI*(i-startsec)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
						+ "," + Math.sin(Math.PI*(i-startsec)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
		}
		if (wanted['transform'] == true) {
			for (var j = 0;j < 9;j++) {
				record = record + "," + Math.sin((Math.PI/300)*(i-startsec)/(j+1));
			}
		}
		if (wanted['transformmulti'] == true) {
			for (var j = 0;j < 9;j++) {
				record = record + "," + Math.sin((Math.PI/300)*(i-startsec)/(j+1));
			}
		}
		if (wanted['spectra'] == true) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 10;j++) {
				record = record + "," + 1/j;
			}
		}
		if (wanted['spectranobins'] == true) {
			for (var j = 0;j < 10;j++) {
				record = record + "," + j;
			}
		}
		if (wanted['spectralarge'] == true) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 100;j++) {
				record = record + "," + 1/j;
			}
		}
		if (wanted['spectramulti'] == true) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 10;j++) {
				record = record + "," + 1/j;
			}
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 10;j++) {
				record = record + "," + 2/j;
			}
		}

		if (id === "dataset0") {
			record = record.replace(/,/g,", ");  // Make dataset0 use space after comma.
		}

		if (records.length > 0) {
			records = records + "\n" + record;
		} else {
			records = record;
		}

		// Flush to output at end and every 100 records (lines)
		var flush = (i == stopsec - 1) || (i > startsec && (i-startsec) % 100 === 0);
		if (flush) {
			if (format === "csv") {
				if (id !== "dataset0") {
					res.write(records + "\n"); // Correct way.					
				} else {
					// Make time non-monotonic.
					records = records.split("\n");
					l = records.length-1;
					first = records[0];
					last = records[l];
					records[0] = last;
					records[l] = first;
					records = records.join("\n");
					if ((i == stopsec - 1) && wanted['scalariso']) {
	 					// Omit newline at end of file for dataset0 if scalariso requested
						res.write(records);
					} else {
	 					// Add extra newline at end of file for dataset0 if scalariso not requested
						res.write(records + "\n\n");
					}
				}
			} else {
				var xrecords = csvTo(records,Nwrote,(i == stopsec-1),(Nwrote == 0),header,include);
				res.write(xrecords);
			} 
			records = "";
			Nwrote  = (i-startsec);
		}
	}
	res.end();
}

function csvTo(records,Nwrote,first,last,header,include) {

	// Helper functions
	function prod(arr) {return arr.reduce(function(a,b){return a*b;})}
	function append(str,arr,N) {for (var i=0;i<N;i++) {arr.push(str);};return arr;}

	var size    = [];
	var type    = "";
	var types   = []; // Type associated with number in each column 
	var name    = "";
	var names   = []; // Name associated with number in each column
	var po      = {}; // Parameter object
	for (var i = 0;i < header.parameters.length; i++) {
		size  = header.parameters[i]["size"] || [1];
		name  = header.parameters[i]["name"];
		names = append(name,names,prod(size));
		type  = header.parameters[i]["type"];
		types = append(type,types,prod(size));
		po[header.parameters[i].name] = {};
		po[header.parameters[i].name]["type"] = header.parameters[i].type;
		po[header.parameters[i].name]["size"] = header.parameters[i].size || [1];
	}

	var format = header["format"];
	if (format === "binary")  return csv2bin(records,types);
	if (format === "json")    return csv2json(records,po,names,first,last,header,include);
	if (format === "fcsv")    return csv2fcsv(records,Nwrote);
	if (format === "fbinary") return csv2bin(records,types,Nwrote);

	function csv2json(records,po,names,first,last,header,include) {

		// Only handles 1-D arrays, e.g., size = [N], N integer.

		recordsarr  = records.split("\n");
		var cols    = [];
		var records = "";
		var open    = "";
		var close   = "";
		var nw      = 0;
		for (var i = 0;i < recordsarr.length;i++) {
			cols    = recordsarr[i].split(",");
			record  = "";
			nw      = 0;
			for (var j = 0;j < cols.length;j++) {
				if (j == 0) {
					record = "[";
				}
				open  = "";
				close = "";
				if (po[names[j]].size[0] > 1) {
					if (open.length == 0 && nw == 0) {open = "["};
					nw = nw + 1;
				}
				if (po[names[j]].size[0] > 1 && nw == po[names[j]].size[0]) {
					close = "]";
					open = "";
					nw = 0;
				}
				if (types[j] === "integer") {
					record = record + open + parseInt(cols[j])   + close + ",";
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
		open = "";close = "";
		if (first == true) {
			if (include) {
				// Remove closing } and replace with new element.
				open = JSON.stringify(header).replace(/}\s*$/,"") + ',"data":\n[\n';
			} else {
				open = '[\n';				
			}
		}
		if (last == true) {
			if (include) {
				close = "\n]\n}\n";
			} else {
				close = "\n]\n";
			}
		}
		return open + records.slice(0,-1) + close;
	}

	function csv2bin(records,types,Nwrote) {

		var fbin = false;
		if (typeof(Nwrote) !== "undefined") {fbin = true;};

		var recordsarr = records.split("\n");
		var Nr = recordsarr.length; // Number of rows

		var record1 = recordsarr[0].split(",");
		var Nd      = record1.length - 1;	 // Number of data columns
		
		if (fbin) {
			var Nt = 8; // Time is double
		} else {
			var Nt = record1[0].length + 1; // Number of time characters (+1 for null)			
		}

		Nb = 0;
		for (var i = 1;i < types.length;i++) {
			if (types[i] === 'double') {
				Nb = Nb + 8;
			}
			if (types[i] === 'integer') {
				Nb = Nb + 4;
			}		
		}

		var recordsbuff = new Buffer.alloc(Nr*(Nt + Nb));
		var pos = 0;
		for (var i = 0; i < Nr; i++) {
			var record = recordsarr[i].split(",");
			if (fbin) {
				record[0] = Nwrote + i; // Overwrite ISO time with seconds
				recordsbuff.writeDoubleLE(record[0],pos);
				pos = pos + Nt;
			} else {
				recordsbuff.write(record[0],pos);
				pos = pos + Nt - 1;
				recordsbuff.write("\0",pos);
				pos = pos + 1;
			}
			for (var j = 1;j < Nd+1;j++) {
				if (types[j] === 'double') {
					recordsbuff.writeDoubleLE(record[j],pos);
					pos = pos + 8;
				}
				if (types[j] === 'integer') {
					recordsbuff.writeInt32LE(records[j],pos);	
					pos = pos + 4;
				}
			}
		}
		return recordsbuff;
	}

	function csv2fcsv(records,Nwrote) {
		var recordsarr = records.split("\n");
		var Nr = recordsarr.length; // Number of rows
		for (var i = 0; i < Nr; i++) {
			var record = recordsarr[i].split(",");
			record[0]     = Nwrote+i;
			recordsarr[i] = record.join(",");
		}
		return recordsarr.join("\n") + "\n";
	}
}

function cors(res) {
	// CORS headers
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
}

function error(req,res,code,message) {

	var errs = {
		"1400": {status: 400, "message": "HAPI error 1400: user input error"},
		"1401": {status: 400, "message": "HAPI error 1401: unknown request field"},
		"1402": {status: 400, "message": "HAPI error 1402: error in start time"},
		"1403": {status: 400, "message": "HAPI error 1403: error in stop time"},
		"1404": {status: 400, "message": "HAPI error 1404: start time equal to or after stop time"},
		"1405": {status: 400, "message": "HAPI error 1405: time outside valid range"},
		"1406": {status: 404, "message": "HAPI error 1406: unknown dataset id"},
		"1407": {status: 404, "message": "HAPI error 1407: unknown dataset parameter"},
		"1408": {status: 400, "message": "HAPI error 1408: too much time or data requested"},
		"1409": {status: 400, "message": "HAPI error 1409: unsupported output format"},
		"1410": {status: 400, "message": "HAPI error 1410: unsupported include value"},
		"1500": {status: 500, "message": "HAPI error 1500: internal server error"},
		"1501": {status: 500, "message": "HAPI error 1501: upstream request error"}
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
		json["status"]["code"] = code;
		json["status"]["message"]  = errs[code+""]["message"];
		httpcode = errs[code+""]["status"];
		httpmesg = errs[code+""]["message"];
	}
	if (message) {
		json["status"]["message"] = json["status"]["message"].replace(/\:.*/,": " + message);
	}

	logreq(req,httpcode + "/" + json["status"]["code"]);

	res.contentType("application/json");
	res.statusMessage = httpmesg;
	res.status(httpcode).send(JSON.stringify(json, null, 4) + "\n");
}

function logreq(req,extra) {
	var extra = extra || "";
	var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	console.log(ds() + "Request from " + addr + ": " + req.originalUrl + " " + extra);
}

function exceptions() {
	// TODO: This should be passed res and then server should send 500 error.
	// See how verifier-nodejs/verifier.js does this.
	process.on('uncaughtException', function(err) {
		if (err.errno === 'EADDRINUSE') {
			console.log(ds() + clc.red("Port " + argv.port + " already in use."));
		} else {
			console.log(err.stack);
		}
		process.exit(1);
	});
}