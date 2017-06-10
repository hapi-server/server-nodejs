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
	var header = info(req,res);
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

	var format = req.query["format"] || "csv";

	var header = info(req,res);
	if (header == false) {return;}; // Error occured and was sent.

	header["_startDateRequested"] = req.query["time.min"];
	header["_stopDateRequested"]  = req.query["time.max"];

	var timeOK = timeCheck(req,res,header)
	if (timeOK == false) {return}; // Error occured and was sent.

	if (format === "csv")            {res.contentType("text/csv");
	} else if (format === "binary")  {res.contentType("application/octet-stream");
	} else if (format === "json")    {res.contentType("application/json");
	} else if (format === "fbinary") {res.contentType("application/octet-stream");
	} else if (format === "fcsv")    {res.contentType("text/csv");
	} else {error(req,res,1409); return; // Unsupported output format.
	}

	header["format"] = format; // Header must contain format if data requested.
	if (req.query["include"] === "header") {
		res.write("#" + JSON.stringify(header) + "\n");
	}

	data(res,header);

	return;
})

////////////////////////////////////////////////////////////////////////////////
// Start the server.
app.listen(argv.port);
console.log(ds()+"Listening on port "+argv.port+". See http://localhost:"+argv.port+"/hapi");
////////////////////////////////////////////////////////////////////////////////

function info(req,res) {

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

function timeCheck(req,res,header) {

	// TODO: Handle less than milliseconds resolution.

	var times = [header["_startDateRequested"],header["_stopDateRequested"],
				 header.startDate,header.stopDate];

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
	return true;
}

function data(res,header) {

	// TODO: Demo of piping output from command line program through.

	var format = header["format"];
	var start  = header["_startDateRequested"];
	var stop   = header["_stopDateRequested"];

	var startsec = moment(start).valueOf()/1000;
	var stopsec  = moment(stop).valueOf()/1000;

	startsec = Math.floor(startsec);
	stopsec  = Math.floor(stopsec);

	var wanted  = {};  // Wanted parameters object
	for (var i = 0;i < header.parameters.length; i++) {
		wanted[header.parameters[i]["name"]] = true;
	}

	var records = ""; // Number of records (line)
	var record  = ""; // A record with comma-separated columns
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
		if (wanted['vectoriso'] == true) {
			record = record 
						+ "," + (new Date((i+1)*1000).toISOString()).slice(0,-5)
						+ "," + (new Date((i+2)*1000).toISOString()).slice(0,-5)
						+ "," + (new Date((i+3)*1000).toISOString()).slice(0,-5);
		}
		if (wanted['vectorcats'] == true) {
			record = record 
						+ "," + scalarcats[(i-startsec)   % scalarcats.length]
						+ "," + scalarcats[(i-startsec+1) % scalarcats.length]
						+ "," + scalarcats[(i-startsec+2) % scalarcats.length];
		}
		if (wanted['spectra'] == true) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 100;j++) {
				record = record + "," + 1/j;
			}
		}

		if (records.length > 0) {
			records = records + "\n" + record;
		} else {
			records = record;
		}

		// Flush to output at end and every 100 records (lines)
		var flush = (i == stopsec - 1) || (i > startsec && (i-startsec) % 100 === 0);
		if (flush) {
			if (format === "csv"){
				res.write(records + "\n");
			} else {
				var xrecords = csvTo(records,Nwrote,(i == stopsec-1),(Nwrote == 0),header,format);
				res.write(xrecords);
			} 
			records = "";
			Nwrote  = (i-startsec);
		}
	}
	res.end();
}

function csvTo(records,Nwrote,first,last,header,format) {

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

	if (format === "binary")  return csv2bin(records,types);
	if (format === "json")    return csv2json(records,po,names,first,last);
	if (format === "fcsv")    return csv2fcsv(records,Nwrote);
	if (format === "fbinary") return csv2bin(records,types,Nwrote);

	function csv2json(records,po,names,first,last) {

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
		if (first == true) {open = '{"data":\n';}
		if (last == true) {close = "\n}\n";}
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