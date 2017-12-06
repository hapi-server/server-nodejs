// R.S. Weigel <rweigel@gmu.edu>
// License: Public Domain

// Global variable
var HAPIVERSION = "2.0"; // Spec version implemented

var fs      = require('fs');
var os      = require("os");

var express  = require('express'); // Client/server library.
var app      = express();
var server   = require("http").createServer(app);
var compress = require('compression'); // Express module
var moment   = require('moment'); // Time library

var clc     = require('cli-color'); // Colorize command line output
var argv    = require('yargs')
				.default
				({
					'port': 8999,
					'catalog': "TestDataSimple",
					'PREFIX': ''
				})
				.argv;

var CATALOG = argv.catalog;
if (argv.prefix) {
	var PREFIX = "/" + argv.prefix;
} else {
	var PREFIX = "";
}
// If PREFIX = '', serve from http://localhost:8999/hapi
// Otherwise, serve from http://localhost:8999/${PREFIX}/hapi

exceptions(); // Catch common start-up exceptions

app.use(compress()); // Compress responses

// Log all requests, then call next route handler
app.get('*', function (req,res,next) {
	logreq(req);
	next();
})

// Redirect / to /hapi page.
app.get('/', function (req,res) {
	res.send("See <a href='."+PREFIX+"/hapi'>."+PREFIX+"/hapi</a>");
})

// Redirect /PREFIX to /PREFIX/hapi page.
app.get(PREFIX, function (req,res) {
	res.send("See <a href='."+PREFIX+"/hapi'>."+PREFIX+"/hapi</a>");
})

// Landing web page
app.get(PREFIX+'/hapi', function (req, res) {
	cors(res);
	res.contentType('text/html');
	res.send(files("landing"));
})

// /capabilities
app.get(PREFIX+'/hapi/capabilities', function (req, res) {

	cors(res);
	res.contentType("application/json");

	// Send error if query parameters given
	if (Object.keys(req.query).length > 0) {
		error(req,res,1401,"This endpoint takes no query string.");
		return;
	}

	res.send(files("capabilities"));
})

// /catalog
app.get(PREFIX+'/hapi/catalog', function (req, res) {

	cors(res);
	res.contentType("application/json");

	// Send error if query parameters given
	if (Object.keys(req.query).length > 0) {
		error(req,res,1401,"This endpoint takes no query string.");
		return;
	}

	res.send(files("catalog"));
})

// /info
app.get(PREFIX+'/hapi/info', function (req, res) {

	cors(res);
	res.contentType("application/json");

	// Check for required id parameter
	if (!req.query.id) {
		error(req,res,1400,"A dataset id must be given.");
		return;
	}

	for (var key in req.query) {
		if (!["id","parameters"].includes(key)) {
			error(req,res,1401,"'id' and 'parameters' are the only valid query parameters.");
			return;
		}
	}	

	// Check if id is valid
	if (!idCheck(req.query.id)) {error(req,res,1406);return;}

	// Get subsetted info response based on requested parameters.
	// info() returns integer error code if error.
	// TODO: Reconsider this interface to info() - 
	// infoCheck() is more consistent with other code.
	var header = info(req,res); 
	if (typeof(header) === "number") {
		error(req,res,header,"At least one parameter not found in dataset.");
		return;
	} else {
		res.send(header);
		return;
	}
})

// /data
app.get(PREFIX+'/hapi/data', function (req, res) {

	cors(res);

	// Check if query parameters are all valid
	var allowed = ["id","parameters","time.min","time.max","format","include"];
	for (var key in req.query) {
		if (!allowed.includes(key)) {
			error(req,res,1401,"The only allowed query parameters are " + allowed.join(", "));
			return;
		}
	}	

	if (!req.query.id) {
		error(req,res,1400,"A dataset id must be given.");
		return;
	}
	if (!req.query["time.min"]) {
		error(req,res,1402,"time.min is required");
		return;
	}
	if (!req.query["time.max"]) {
		error(req,res,1403,"time.max is required");
		return;
	}

	// Check if id is valid
	if (!idCheck(req.query.id)) {error(req,res,1406);return;}

	// Get subsetted /info response based on requested parameters.
	var header = info(req,res);
	if (typeof(header) === "number") {
		// One or more of the requested parameters are invalid.
		error(req,res,header,"At least one parameter not found in dataset.");
		return;
	};

	// Add non-standard elements to header used later in code.
	var proto = req.connection.encrypted ? 'https' : 'http'; // TODO: Not tested under https.	
	header["status"]["x_request"] = proto + "://" + req.headers.host + req.originalUrl;
	header["status"]["x_startDateRequested"] = req.query["time.min"];
	header["status"]["x_stopDateRequested"]  = req.query["time.max"];
	header["status"]["x_parentDataset"]      = req.query["id"];

	// timeCheck() returns integer error code if error or true if no error.
	var timeOK = timeCheck(header)
	if (!timeOK) {error(req,res,timeOK);return;};

	header["format"] = "csv"; // Set default format
	if (req.query["format"]) {
		if (!["csv","json","binary"].includes(req.query["format"])) {
			error(req,res,1409,"Allowed values of 'format' are csv, json, and binary.");
			return;
		}
		// Use requested format.
		header["format"] = req.query["format"];
	}
	
	if (req.query["include"]) {
		if (req.query["include"] !== "header") {
			error(req,res,1410,"Allowed value of 'include' is 'header'."); // Unknown include value
			return;
		}
	}
	// If include was given, set include = true
	var include = req.query["include"] === "header";

	if (header["format"] === "csv")    {res.contentType("text/csv")};
	if (header["format"] === "binary") {res.contentType("application/octet-stream")};
	if (header["format"] === "json")   {res.contentType("application/json")};

	// Extract command line (CL) command and replace placeholders.
	var d = files('data','json');
	var com = d.command; 
	com = com.replace("${id}",req.query["id"]);
	com = com.replace("${start}",req.query["time.min"]);
	com = com.replace("${stop}",req.query["time.max"]);
	com = com.replace("${parameters}",req.query["parameters"]);
	com = com.replace("${format}",header["format"]);

	// See if CL program supports requested format
	var formats = d.formats;
	var convert = true; // CL program can produce requested format
	if (formats) {
		if (formats.includes(req.query["format"])) {
			var convert = false;
		}
	}

	// Call the CL command and send output.
	var child = require('child_process').exec(com, {"encoding":"buffer"});
	console.log(ds() + "Executing " + com);
	console.log(com)
	coms = com.split(/\s+/);
	coms0 = coms.shift();
	var child = require('child_process').spawn(coms0,coms,{"encoding":"buffer"})

	var wroteerror = false;  // If 1500 message already sent.
	var wroteheader = false; // If header already sent.
	var outstr = "";

	child.stderr.on('data', function (err) {
		if (!wroteerror && !wroteheader) {
			// If !wroteheader because if header sent, 
			// then command line sent data before it gave
			// an error signal.
			wroteerror = true;
			if (d.contact) {
				error(req,res,1500,"Problem with the data server. Please send URL to " + d.contact + ".");
			} else {
				error(req,res,1500,"Problem with the data server.");
			}
		}
		console.log(err);
	})
	child.stdout.on('data', function (buffer) {
		if (!wroteheader && include && header["format"] !== "json") {
			// If header not written, header requested, and format requested
			// is not JSON, send header.
			wroteheader = true;
			res.write("#" + JSON.stringify(header) + "\n");
		}
		if (convert && header["format"] === "json") {
			// JSON requested and CL program cannot produce it.
			// Accumulate output and send everything at once for now.
			// TODO: Write incrementally; use buffer.toString().lastIndexOf(/\n/)
			outstr = outstr + buffer.toString();
		} else {
			if (header["format"] === "binary") {
				res.write(buffer,'binary');
			} else {
				res.write(buffer.toString());
			}

		}
	})
	child.stdout.on('end', function() { 
		if (convert && header["format"] === "json") {
			// Convert accumulated data and send it.
			res.write(csvTo(outstr,true,true,header,include));
		}
		res.end();
	})
})

app.use(errorHandler); // Must always be after last app.get() statement.

// Read static JSON files and then start the server.
files(function () {
	app.listen(argv.port, function () {
		console.log(ds() + "Listening on port " + argv.port
						 + ". See http://localhost:" + argv.port + "/" + CATALOG + "/hapi");
	});
})

// Return content of static JSON files
function files(which,format,id) {

	// Call before server starts as files(cb) to read 
	// and cache content from files.

	if (files.cache) {
		// Content has been read from disk into object before server started.
		// Return it.
		if (id) {
			return files.cache[which][id][format || "string"];
		} else {
			return files.cache[which][format || "string"];
		}
	} 

	// Read and cache content from disk.
	files.cache = {};

	// Landing page html
	var landing = __dirname+"/metadata/"+CATALOG+".htm";
	if (!fs.existsSync(landing)) {
		console.log(ds() + "Did not find " + landing + ". Will use default.htm");
		landing = __dirname+"/metadata/default.htm";
	}
	console.log(ds() + "Reading " + landing);
	files.cache['landing'] = {};
	files.cache['landing']['string'] = 
		fs
			.readFileSync(landing,"utf8")
			.toString()
			.replace(/__CATALOG__/g, CATALOG)
			.replace(/__VERSION__/g, HAPIVERSION);

	// Capabilities 
	var capabilities = __dirname + "/metadata/capabilities.json";
	if (!fs.existsSync(capabilities)) {
		json = {};
		json["outputFormats"] = ["csv","binary","json"];
		console.log(ds() + "Did not find " + capabilites + ". Using " + json["outputFormats"]);
		json["HAPI"]   = HAPIVERSION;
		json["status"] = {"code": 1200,"message": "OK"};
		str = JSON.stringify(json) + "\n";
	} else {
		var str  = fs.readFileSync(capabilities);
		var json = JSON.parse(str);
		json["HAPI"]   = HAPIVERSION;
		json["status"] = {"code": 1200,"message": "OK"};
		str = JSON.stringify(json) + "\n";
	}
	files.cache['capabilities'] = {};
	files.cache['capabilities']['string'] = str;
	files.cache['capabilities']['json'] = json;

	// Catalog
	var catalog = __dirname + "/metadata/" + CATALOG + ".json";
	if (!fs.existsSync(catalog)) {
		console.log(ds() + "Did not find " + catalog + ". Exiting.");
		process.exit(1);
	}

	console.log(ds() + "Reading " + catalog);
	try {
		var str = fs.readFileSync(catalog);
	} catch (e) {
		console.log(ds() + catalog + " is not readable. Exiting.");
		process.exit(1);		
	}

	try {
		var json = JSON.parse(str);
	} catch (e) {
		console.log(ds() + catalog + " is not JSON.parse-able. Try https://jsonlint.com/. Exiting.");
		process.exit(1);
	}

	if (!json.data) {
		console.log(ds() + catalog + " Does not have a 'data' object. Exiting.");
		process.exit(1);		
	}

	// Command line program information
	files.cache['data'] = {};
	files.cache['data']['json'] = json.data;
	files.cache['data']['string'] = JSON.stringify(json.data,null,4);
	var formats = json.data.formats || "csv";
	var test = json.data.test || "";

	if (test !== "") {
		try {
			var child = require('child_process').execSync(test);
			console.log(ds() + "Test of command line program passed.");

		} catch (err) {
			console.log(ds() + "Test of command line program failed. Exiting.");
			console.log(err.stack);
			process.exit(1);
		}
	}

	files.cache['landing']['string'] = files.cache['landing']['string'].replace("__CONTACT__",json.data.contact || "")
	
	delete json.data;

	json["HAPI"] = HAPIVERSION;
	json["status"] = {"code": 1200, "message": "OK"};

	files.cache['info'] = {};
	var id;
	for (var i = 0;i < json.catalog.length; i++) {
		// TODO: Validate json.catalog[i].info against catalog schema
		id = json.catalog[i].id
		files.cache['info'][id] = {};
		files.cache['info'][id]['string'] = JSON.stringify(json.catalog[i].info, null, 4);
		files.cache['info'][id]['json'] = json.catalog[i].info;
		files.cache['info'][id]['json']['HAPI'] = HAPIVERSION;
		files.cache['info'][id]['json']['status'] = { "code": 1200, "message": "OK"};
		if (!formats.includes("json")) {
			// If data program does not produce JSON, see if
			// any multi-dimensional arrays and warn.
			for (var j = 0; j < json.catalog[i].info.parameters.length; j++) {
				if (json.catalog[i].info.parameters[j].size) {
					if (json.catalog[i].info.parameters[j].size.length > 1) {
						console.log(ds() + "Warning: Parameter in catalog has size.length > 1 and data program does not produce JSON. Server cannot produce JSON from CSV for this parameter.")
					}
				}
			}
		}
		delete json.catalog[i].info;
	}

	// TODO: Validate json against schema
	str = JSON.stringify(json, null, 4);

	files.cache['catalog'] = {};
	files.cache['catalog']['string'] = str;
	files.cache['catalog']['json'] = json;

	which(); // Execute callback.
}

// Date string for logging.
function ds() {return (new Date()).toISOString() + " ";};

function csvTo(records,first,last,header,include) {

	// Helper functions
	function prod(arr) {return arr.reduce(function(a,b){return a*b;})}
	function append(str,arr,N) {for (var i=0;i<N;i++) {arr.push(str);};return arr;}

	// TODO: Do this on first call only.
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
		if (po[header.parameters[i].name]["size"].length > 1) {
			console.log(ds() + "Warning. JSON for parameter " + name + " will be 1-D array instead of " + po[header.parameters[i].name]["size"].length + "-D")
			po[header.parameters[i].name]["size"] = prod(po[header.parameters[i].name]["size"]);
		}
	}
	
	return csv2json(records,po,names,first,last,header,include);

	function csv2json(records,po,names,first,last,header,include) {

		// Only handles 1-D arrays, e.g., size = [N], N integer.

		recordsarr  = records.split("\n");
		if (recordsarr[recordsarr.length-1] === '') {
			// Empty element due to trailing newline.
			recordsarr.pop();
		}
		
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
					record = record + open + '"' + cols[j] + '"' + close + ",";
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
				open = JSON.stringify(header,null,4).replace(/}\s*$/,"") + ',\n"data":\n[\n';
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
}

function info(req,res) {

	// Read parameter metadata.
	jsonstr = files('info','string',req.query.id);
	json    = files('info','json',req.query.id);;

	// Create array of known parameter names
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

	// Remove repeated parameters from query
	var wantedparams = Array.from(new Set(wantedparams));

	// Catches case where parameters= is given in query string.
	// Assume it means same as if no parameters field was given
	// (which means all parameters wanted).
	if (wantedparams.length == 0) {return json;}

	// Determine if any parameters requested are invalid
	validparams = []; iv = 0;
	invalidparams = []; ii = 0;
	for (var i = 0;i < wantedparams.length;i++) {
		if (knownparams.includes(wantedparams[i])) {
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
		if (!wantedparams.includes(knownparams[i])) {
			delete json.parameters[i];
		}
	}
	// Remove nulls placed when array element is deleted
	json.parameters = json.parameters.filter(function(n){return n != undefined}); 

	// Return JSON string
	return json;
}

function idCheck(id) {
	// Get list of datasets.
	var catalog = files('catalog','json');
	var datasets = catalog.catalog;
	var found = false;
	// Determine if requested id is in list
	for (var i=0;i<datasets.length;i++) {
		if (datasets[i]['id'] === id) {
			return true;
			break;
		}
	}
	return false;
}

function timeCheck(header) {

	// TODO: Handle less than milliseconds resolution.
	// TODO: If one of the times had Z and the other does not, should warn that all time
	// stamps are interpreted as Z.

	var times = [header["status"]["x_startDateRequested"],header["status"]["x_stopDateRequested"],
				 header.startDate,header.stopDate];

	for (var i = 0;i < times.length;i++) {
		// moment.js says YYYY-MM-DD and YYYY-DOY with no Z is
		// "... not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), which is not reliable across all browsers and versions."		
		// But HAPI says it is valid.
		if (times[i].length == 8 || times[i].length == 10) {
			times[i] = times[i] + "T00:00:00.000Z";
		}
		// Make times all times UTC
		if (times[i].match(/Z$/) == null) {
			times[i] = times[i] + "Z";
		}
	}

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

function cors(res) {
	// CORS headers
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
}

// HAPI Errors
function error(req,res,code,message) {

	var errs = {
		"1400": {status: 400, "message": "HAPI error 1400: user input error"},
		"1401": {status: 400, "message": "HAPI error 1401: unknown request field"},
		"1402": {status: 400, "message": "HAPI error 1402: error in time.min"},
		"1403": {status: 400, "message": "HAPI error 1403: error in time.max"},
		"1404": {status: 400, "message": "HAPI error 1404: time.min equal to or after time.max"},
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
				"HAPI" : HAPIVERSION,
				"status": { "code": 1500, "message": "Internal server error"}
			};
	var httpcode = 500;
	var httpmesg = "Internal server error. Please report URL attempted to the <a href='https://github.com/hapi-server/server-nodejs/issues'>issue tracker</a>.";

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

// Uncaught errors in API request code.
function errorHandler(err, req, res, next) {
	var stack = err.stack.replace(new RegExp(__dirname + "/","g"),"").replace(/\n/g,"<br/>")
	console.log(err);
	error(req,res,"1500","Server error. Please post the following error message at https://github.com/hapi-server/server-nodejs/issues. <br/>" + req.originalUrl + "<br/> " + err + " " + stack);
	var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	var msg = ds() + "Request from " + addr + ": " + req.originalUrl;
	var tmps = ds().split("T")[0]
	fs.appendFileSync('server-error-' + tmps + ".log",msg + "\n" + err.stack)
}

// Errors in application
function exceptions() {
	process.on('uncaughtException', function(err) {
		if (err.errno === 'EADDRINUSE') {
			console.log(ds() + "Port " + argv.port + " already in use.");
		} else {
			console.log(err.stack);
		}
		var tmps = ds().split("T")[0]
		fs.appendFileSync('server-error-' + tmps + ".log", err)
		process.exit(1);
	});
}

function logreq(req,extra) {
	var extra = extra || "";
	var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	console.log(ds() + "Request from " + addr + ": " + req.originalUrl + " " + extra);
}