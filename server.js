// R.S. Weigel <rweigel@gmu.edu>
// License: Public Domain

var hapiversion = "1.1"; // Spec version implemeted
var catalogID   = "TestData";
var datasetID   = "TestData";
var startDate   = "1970-01-01";
var stopDate    = "2016-12-31";

var fs      = require('fs');
var os      = require("os");

var request = require("request");
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
				.replace(/__VERSION__/g, hapiversion)
				.replace(/__CATALOG__/g, catalogID)
			);
})

// /capabilities
app.get('/hapi/capabilities', function (req, res) {
	cors(res);
	res.contentType("application/json");
	var json = {"HAPI": hapiversion,"outputFormats": ["csv","binary","fbinary"],"status": {"code": 1200,"message": "OK"}};
	console.log(ds() + req.originalUrl);
	res.send(JSON.stringify(json));
})

// /catalog
app.get('/hapi/catalog', function (req, res) {
	cors(res);
	res.contentType("application/json");
	var json =
		{
			"HAPI" : "1.1",
			"status": { "code": 1200, "message": "OK"},
			"catalog" : 
				[
					{"id": datasetID, title: "Test dataset"}
				]
		};
	console.log(ds() + req.originalUrl);
	res.send(JSON.stringify(json, null, 4));
})

// /info
app.get('/hapi/info', function (req, res) {
	cors(res);
	res.contentType("application/json");
	if (req.query.id !== datasetID) {
		error(res,1401);
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
	if (header == false) {return;};

	var timeRange = startstop(req,res,header)
	if (timeRange == false) {return;};

	if (req.query["format"] === "binary") {
		res.contentType("application/octet-stream");
	} else if (req.query["format"] === "fbinary") {
		res.contentType("application/octet-stream");
	} else {
		res.contentType("text/csv"); 	 // Triggers d/l dialog in most browsers
		//res.contentType("text/plain"); // For testing; so displays in browser
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

	var json = 
		{
			"HAPI": hapiversion,
			"status": { "code": 1200, "message": "OK"},
			"startDate": startDate,
			"stopDate" : stopDate,
			"cadence": "PT1S",
			"parameters":
				[
					{ 
						"name": "Time",
						"type": "isotime",
						"units": "UTC",
						"fill": null,
						"length": 24
					},
					{ 
						"name": "scalar",
						"type": "double",
						"units": "m",
						"fill": "-1e31",
						"size": [1],
						"description": "Sine wave with 600 s period"
					},
					{ 
						"name": "scalarint",
						"type": "int",
						"units": "m",
						"fill": "-1e31",
						"size": [1],
						"description": "Sine wave with 600 s period"
					},
					{ 
						"name": "vector",
						"type": "double",
						"units": "m",
						"fill": "-1e31",
						"size": [3],
						"description ": "Each component is a sine wave with a 600 s period with differing phases."
					},
					{ 
						"name": "spectra",
						"type": "double",
						"units": "m",
						"fill": "-1e31",
						"size" : [100],
						"bins": {"name": "frequency", "units": "Hz","centers":[]},
						"description": "A time indepentent 1/f spectra."
					}
				]
		};
	var i = 0;while(i < 100){json.parameters[4].bins.centers.push(i++);};

	// Create arrray from comma-separated parameter list
	if (req.query.parameters) {
		wantedparams = req.query.parameters.split(",");
	}

	// Remove duplicates
	var wantedparams = Array.from(new Set(wantedparams));

	// No parameters specified means all.
	if (wantedparams.length == 0) {return json;}

	// Create list of known parameters from JSON
	var knownparams = [];
	for (var i = 0;i < json.parameters.length;i++) {
		knownparams[i] = json.parameters[i].name;
	}

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
		error(res,1401);//"Bad request - unknown request parameter(s)" + "'" + invalidparams.join(",") + "'.");
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

function startstop(req,res,header) {

	// TODO: Handle less than milliseconds resolution.

	var times = [req.query["time.min"],req.query["time.max"],header.startDate,header.stopDate];

	if (!moment(times[0], moment.ISO_8601).isValid()) {
		error(res,1402);return false;
	}
	if (!moment(times[1], moment.ISO_8601).isValid()) {
		error(res,1403);return false;
	}
	if (!moment(times[2], moment.ISO_8601).isValid()) {
		error(res,1409);return false;
	}
	if (!moment(times[3], moment.ISO_8601).isValid()) {
		error(res,1409);return false;
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
		error(res,1404);
		return false;
	}
	if (startms < startmsMin) {
		error(res,1405);
		return false;
	} 
	if (stopms > stopmsMax) {
		error(res,1405);
		return false;
	}
	return times[0] + "/" + times[1];
}

function datacl(req,res,header,timeRange) {
	// TODO: Demo of piping output from command line program through.
}

function data(req,res,header,timeRange) {

	var start = timeRange.split("/")[0];
	var stop = timeRange.split("/")[1];

	var startsec = moment(start).valueOf()/1000;
	var stopsec  = moment(stop).valueOf()/1000;

	startsec = Math.floor(startsec);
	stopsec = Math.floor(stopsec);

	if (req.query["format"] === "fbinary") {
		res.write(fbinhead(startsec));
	}

	var scalar = false, scalarint = false, vector = false, spectra = false;
	for (var i = 1;i < header.parameters.length; i++) {
		if (header.parameters[i].name == "scalar")  {scalar  = true};
		if (header.parameters[i].name == "scalarint")  {scalarint  = true};
		if (header.parameters[i].name == "vector")  {vector  = true};
		if (header.parameters[i].name == "spectra") {spectra = true};
	}
	var all = !scalar && !scalarint && !vector && !spectra;
	if (all) {scalar = true;scalarint = true;vector = true;spectra = true;}	

	if (scalar) {var sepi = ","} else {var sepi= ""};
	if (scalar || scalarint) {var sepv = ","} else {var sepv = ""};
	if (scalar || vector) {var seps = ","} else {var seps = ""};

	var line = "";
	var types = ["double"];
	for (var i = startsec; i < stopsec;i++) {
		var data = "";
		var time = new Date(i*1000).toISOString();
		if (scalar) {
			data = Math.sin(Math.PI*i/600);
			if (i==startsec) {types.push('double');}
		}

		if (scalarint) {
			data = data + sepi + Math.sin(Math.PI*i/600);
			if (i==startsec) {types.push('integer');}
		}
		if (vector) {
			data = data + sepv + Math.sin(Math.PI*(i-startsec)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
						+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
			if (i==startsec) {types.push('double');}
		}
		if (spectra) {
			data = data + seps + 0;
			for (var j = 1;j < 10;j++) {data = data + "," + 1/j;}
			if (i==startsec) {types.push('double');}
		}

		var str = time.slice(0,-1) + "," + data;

		if (line.length > 0) {
			line = line + "\n" + str;
		} else {
			line = str;
		}

		// Flush to output ~80,000 Bytes (more does not speed up; less slows down)
		if (req.query["format"] === "binary") {
			if (line.length > 1e4) {
				var linebuff = csv2bin(line);
				res.write(linebuff);
				line = "";
			}
		} else if (req.query["format"] === "fbinary") {
			if (line.length > 1e4) {
				var linebuff = csv2fbin(line,startsec,types);
				res.write(linebuff);
				line = "";
			}
		} else if (req.query["format"] === "fcsv") {
			if (line.length > 1e4) {
				var linebuff = csv2fcsv(line,startsec);
				res.write(linebuff + "\n");
				line = "";
			}
		} else {
			if (line.length > 1e4) {
				res.write(line + "\n");
				line = "";
			}			
		}

	}

	if (req.query["format"] === "binary") {
		if (line.length > 0) {
			var linebuff = csv2bin(line);
			res.write(linebuff);
		}
		res.end();
	} else if (req.query["format"] === "fbinary") {
		if (line.length > 0) {
			var linebuff = csv2fbin(line,startsec,types);
			res.write(linebuff);
		}
		res.end();
	} else if (req.query["format"] === "fcsv") {
		if (line.length > 0) {
			var linebuff = csv2fcsv(line,startsec);
			res.write(linebuff + "\n");
		}
		res.end();
	} else {
		if (line.length > 0) {
			res.write(line + "\n");
		}
		res.end();
	}
}

function csv2fcsv(lines,startsec) {

	var linesarr = lines.split("\n");
	var Nr = linesarr.length; // Number of rows
	for (var i = 0; i < Nr; i++) {
		var line = linesarr[i].split(",");
		line[0] = i;
		linesarr[i] = line.join(",");
	}
	return linesarr.join("\n");
}

function csv2bin(lines) {
	var linesarr = lines.split("\n");
	var Nr = linesarr.length; // Number of rows

	var line1 = linesarr[0].split(",");
	var Nt    = line1[0].length + 1; // Number of time characters (+1 for null)
	var Nd    = line1.length - 1;	 // Number of data columns

	var linebuff = new Buffer.alloc(Nr*(Nt + 8*Nd));
	var pos = 0;
	for (var i = 0; i < Nr; i++) {
		var line = linesarr[i].split(",");
		linebuff.write(line[0],pos);
		pos = pos + Nt - 1;
		linebuff.write("\0",pos);
		pos = pos + 1;
		for (var j = 1;j < Nd + 1;j++) {
			linebuff.writeDoubleLE(line[j],pos);
			pos = pos + 8;
		}
	}
	return linebuff;
}

function fbinhead(startsec) {
	var start = (new Date(startsec*1000)).toISOString().replace(/\..*/,'');
	//console.log(start.length)
	var headbuff = new Buffer.alloc(21);
	//console.log("0" + start + "\0");
	headbuff.write("0" + start + "\0");
	return headbuff;
}

function csv2fbin(lines,startsec,types) {

	var linesarr = lines.split("\n");
	var Nr = linesarr.length; // Number of rows

	var line1 = linesarr[0].split(",");
	var Nd    = line1.length - 1; // Number of data columns
	var firstsec = moment(line1[0]+"Z").valueOf()/1000 - startsec;

	Nb = 8; // Time
	for (var i = 1;i < types.length;i++) {
		if (types[i] === 'double') {
			Nb = Nb + 8;
		}
		if (types[i] === 'integer') {
			Nb = Nb + 4;
		}		
	}
	//console.log(Nr)
	//console.log(Nb)
	//console.log(types)
	var linebuff = new Buffer.alloc(Nr*Nb);
	//console.log(linesarr)
	var pos = 0;
	for (var i = 0; i < Nr; i++) {
		var line = linesarr[i].split(",");
		line[0] = firstsec+i; // Overwrite ISO time with seconds
		//console.log(line.join(","))
		
		for (var j = 0;j < Nd+1;j++) {
			if (types[j] === 'double') {
				linebuff.writeDoubleLE(line[j],pos);
				pos = pos + 8;
			}
			if (types[j] === 'integer') {
				linebuff.writeInt32LE(line[j]*1000,pos);	
				pos = pos + 4;
			}
		}
	}
	return linebuff;
}

function cors(res) {
	// CORS
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
}

function error(res,code,msg) {
	
	var errs = {
		"1400": {status: 400, "msg": "Bad request - user input error"},
		"1401": {status: 400, "msg": "Bad request - unknown request parameter"},
		"1402": {status: 400, "msg": "Bad request - error in start time"},
		"1403": {status: 400, "msg": "Bad request - error in stop time"},
		"1404": {status: 400, "msg": "Bad request - start time after stop time"},
		"1405": {status: 400, "msg": "Bad request - time outside valid range"},
		"1406": {status: 404, "msg": "Bad request - unknown dataset id"},
		"1407": {status: 404, "msg": "Bad request - unknown dataset parameter"},
		"1408": {status: 400, "msg": "Bad request - too much time or data requested"},
		"1409": {status: 400, "msg": "Internal server error"},
		"1500": {status: 500, "msg": "Internal server error - upstream request error"}
	};

	var json =
			{
				"HAPI" : "1.1",
				"status": { "code": code || errs[code+""], "message": msg || errs[code+""]}
			};
	var status = 500;
	if (errs[code+""]) {status = errs[code+""].status;}
	res.status(status).send(JSON.stringify(json, null, 4) + "\n");
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