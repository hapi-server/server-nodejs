// R.S. Weigel <rweigel@gmu.edu>
// License: Public Domain

// Global variable
var HAPIVERSION = "2.0"; // Spec version implemented

// Date string for logging.
function ds() {return (new Date()).toISOString() + " [server] ";};

var clc  = require('cli-color'); // Colorize command line output
var sver = require('semver');
if (!sver.gte(process.version,'6.0.0')) {
	console.log(clc.red("node.js version >= 6 required. node.js -v returns " + process.version + ". Consider installing https://github.com/creationix/nvm."));
	process.exit(1);
}

var fs       = require('fs');

var express  = require('express'); // Client/server library
var app      = express();
var server   = require("http").createServer(app);
var compress = require('compression'); // Express compression module
var moment   = require('moment'); // Time library http://moment.js

var metadata = require('./metadata.js').metadata;
 
// Test library
var is = require(__dirname + '/node_modules/hapi-server-verifier/is.js');

var timeregexes = require('./metadata.js').timeregexes(HAPIVERSION);

var argv     = require('yargs')
				.default
				({
					'port': 8999,
					'catalogs': "TestDataSimple",
					'prefixes': '',
					'force': "false"
				})
				.usage('Usage: $0 --port [num] --catalog [str] --prefix [str] --force [bool]')
				.help('h')
				.help('help')
				.argv;


// TODO: Reject if unknown command line switch is given.
// Ideally use yargs, but using .strict() in yargs does not work as expected.

var FORCE   = argv.force === "true"; // Start server if metadata invalid
var CATALOG = argv.catalog || argv.catalogs;
var PREFIX  = argv.prefix || argv.prefixes;

var CATALOGS = CATALOG.split(",");
var PREFIXES = PREFIX.split(",");

if (PREFIX !== '' && CATALOGS.length != PREFIXES.length) {
	console.log(ds() + clc.red("If multiple catalogs given, same number of prefixes must be given."));
	process.exit(1);
} else {
	PREFIXES = CATALOGS.slice(0); // Clone array
}

for (var i = 0;i < PREFIXES.length;i++) {
	if (PREFIXES[i]) {
		// Remove one or more leading or trailing / in PREFIX.
		PREFIXES[i] = PREFIXES[i].replace(/^\/+/, '').replace(/\/+$/, '');
		PREFIXES[i] = "/" + PREFIXES[i];
	} else {
		PREFIXES[i] = "";
	}
	// If PREFIX = '', serves from http://localhost:PORT/hapi
	// Otherwise, serve from http://localhost:PORT/PREFIX/hapi
}

exceptions(); // Catch common start-up exceptions

app.use(compress()); // Compress responses using gzip

// Serve static files in ./public
app.use(express.static('public'));

// Log all requests, then call next route handler
app.get('*', function (req,res,next) {
	logreq(req);
	next();
})

if (CATALOGS.length > 1) {
	// TODO: Move file read to metadata.
	html = fs
			.readFileSync(__dirname + "/public/multiple.htm","utf8")
			.toString()
			.replace(/__CATALOG_LIST__/, JSON.stringify(CATALOGS));

	app.get('/', function (req,res) {res.send(html)})	
}

for (var i = 0;i < CATALOGS.length;i++) {
	console.log(ds() + clc.green("Initializing http://localhost:" + argv.port + PREFIXES[i] + "/hapi"));
	console.log(ds() + "Server can be tested using");
	console.log(ds() + "   git clone https://github.com/hapi-server/verifier-nodejs.git");
	console.log(ds() + "   cd verifier-nodejs; npm install; node verify.js --url 'http://localhost:" + argv.port + PREFIXES[i] + "/hapi'");

	// Initialize the API
	apiInit(CATALOGS[i],PREFIXES[i],i == CATALOGS.length-1);
	// Read static JSON files
	metadata(CATALOGS[i],HAPIVERSION,FORCE);
}

// TODO: Can server start before apiInit() and metadata() finished?
// If so, prevent it.
app.listen(argv.port, function () {
	if (CATALOGS.length > 1) {
		console.log(ds() + "Dataset list at http://localhost:" + argv.port);
		for (var i = 0;i < CATALOGS.length;i++) {
			console.log(ds() + "  http://localhost:" + argv.port + PREFIXES[i] + "/hapi");
		}
	}
	console.log(ds() + clc.blue("Listening on port " + argv.port))
});

////////////////////////////////////////////////////////////

function apiInit(catalog,PREFIX,last) {

	// Redirect http://localhost:PORT/ to http://localhost:PORT/hapi
	app.get(PREFIX || '/', function (req,res) {
		res.send("See <a href='."+PREFIX+"/hapi'>."+PREFIX+"/hapi</a>");
	})

	// Serve landing web page
	app.get(PREFIX + '/hapi', function (req, res) {
		cors(res); // Set CORS headers
		res.contentType('text/html');
		res.send(metadata(catalog,"landing"));
	})

	// /capabilities
	app.get(PREFIX + '/hapi/capabilities', function (req, res) {

		cors(res);
		res.contentType("application/json");

		// Send error if query parameters given
		if (Object.keys(req.query).length > 0) {
			error(req,res,1401, "This endpoint takes no query string.");
			return;
		}

		res.send(metadata(catalog,"capabilities"));
	})

	// /catalog
	app.get(PREFIX + '/hapi/catalog', function (req, res) {

		cors(res);
		res.contentType("application/json");

		// Send error if query parameters given
		if (Object.keys(req.query).length > 0) {
			error(req,res,1401,"This endpoint takes no query string.");
			return;
		}

		res.send(metadata(catalog,"catalog"));
	})

	// /info
	app.get(PREFIX + '/hapi/info', function (req, res) {

		cors(res);
		res.contentType("application/json");

		// Check for required id parameter
		if (!req.query.id) {
			error(req,res,1400,"A dataset id must be given.");
			return;
		}

		// Check if extra parameters given
		for (var key in req.query) {
			if (!["id","parameters"].includes(key)) {
				error(req,res,1401,"'id' and 'parameters' are the only valid query parameters.");
				return;
			}
		}	

		// Check if id is valid
		if (!idCheck(catalog,req.query.id)) {error(req,res,1406);return;}

		// Get subsetted info response based on requested parameters.
		// info() returns integer error code if error.
		// TODO: Reconsider this interface to info() - 
		// infoCheck() is more consistent with other code.
		var header = info(catalog,req,res); 
		if (typeof(header) === "number") {
			error(req,res,header,"At least one parameter not found in dataset.");
			return;
		} else {
			res.send(header);
			return;
		}
	})

	// /data
	app.get(PREFIX + '/hapi/data', function (req, res) {

		cors(res);

		// TODO: Duplicate code from /info
		if (!req.query.id) {
			error(req,res,1400,"A dataset id must be given.");
			return;
		}

		// Check if id is valid
		// TODO: Duplicate code from /info
		if (!idCheck(catalog,req.query["id"])) {error(req,res,1406);return;}

		// Check if query parameters are all valid
		var allowed = ["id","parameters","time.min","time.max","format","include","attach"];
		for (var key in req.query) {
			if (!allowed.includes(key)) {
				error(req,res,1401,"The only allowed query parameters are " + allowed.join(", "));
				return;
			}
		}	

		if (!req.query["time.min"]) {
			error(req,res,1402,"time.min is required");
			return;
		}
		if (!req.query["time.max"]) {
			error(req,res,1403,"time.max is required");
			return;
		}

		// Get subsetted /info response based on requested parameters.
		var header = info(catalog,req,res);
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
		if (timeOK !== true) {error(req,res,timeOK);return;};

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

		var fname = "id-" + req.query["id"] + "_parameters-" + req.query["parameters"] + "_time.min-" + req.query["time.min"] + "_time.max-" + req.query["time.max"] + "." + header["format"];

		if (req.query["attach"] === "false") {
			// Allow non-standard "attach" query parameter for debugging.
			// This will cause browser to display data instead of triggering
			// a download dialog.
			res.contentType("text");
		} else {
			res.setHeader("Content-Disposition", "attachment;filename=" + fname);
		}

		// Send the data
		data(req,res,catalog,header,include);
	})

	// The following must always be after last app.get() statement.
	// Any requests not matching above patterns will trigger errorHandler() call.
	if (last) {
		// Fall through
		app.get('*', function(req, res) {
			res.send("See <a href='."+PREFIX+"/hapi'>."+PREFIX+"/hapi</a>");
		});

		app.use(errorHandler);
	}
}

function cors(res) {
	// CORS headers
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeTime(timestr) {
	if (/^[0-9]{4}Z$/.test(timestr)) {
		timestr = timestr.slice(0,-1) + "-01-01T00:00:00.000Z";
	}
	if (/^[0-9]{4}-[0-9]{2}Z$/.test(timestr)) {
		timestr = timestr.slice(0,-1) + "-01T00:00:00.000Z";
	}
	if (/^[0-9]{4}-[0-9]{3}Z$/.test(timestr)) {
		timestr = timestr.slice(0,-1) + "T00:00:00.000Z";
	}
	if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}Z$/.test(timestr)) {
		timestr = timestr.slice(0,-1) + "T00:00:00.000Z";
	}
	timestr = moment(timestr).toISOString();
	return timestr;
}

function data(req,res,catalog,header,include) {

	//console.log(header.parameters)
	var start = normalizeTime(req.query["time.min"]);
	var stop = normalizeTime(req.query["time.max"]);
	// Extract command line (CL) command and replace placeholders.
	var d = metadata(catalog,'data','json');
	var com = d.command; 
	com = com.replace("${id}",req.query["id"]);
	com = com.replace("${start}",start);
	com = com.replace("${stop}",stop);
	if (req.query["parameters"]) {
		com = com.replace("${parameters}",req.query["parameters"]);
	} else {
		com = com.replace("${parameters}",'');
	}
	com = com.replace("${format}",header["format"]);
	com = com.replace("${SERVER_ROOT}",__dirname);

	// See if CL program supports requested format
	var formats = d.formats; // CL formats supported
	var convert = true; // true if conversion is needed here
	if (formats) {
		if (formats.includes(req.query["format"])) {
			// CL program can create requested format
			var convert = false;
		}
	}

	// If command does not contain ${parameters}, assume CL program
	// always outputs all variables. Subset the output using the
	// Unix "cut" command.
	if (req.query["parameters"] && !/\$\{parameters\}/.test(d.command)) {
		var params = req.query["parameters"].split(",");
		var headerfull = metadata(catalog,'info','json',req.query.id);

		if (params[0] !== headerfull.parameters[0].name) {
			// If time variable was not requested, add it so first column
			// is always output.
			params.unshift(headerfull.parameters[0].name);
		}

		var fields = {};
		var col = 1;
		var df = 0;

		// Generate comma separated list of columns to output, e.g.,
		// 1,2-4,7
		for (var i = 0;i < headerfull.parameters.length;i++) {
			df = prod(headerfull.parameters[i].size || [1]);
			if (df > 1) {
				fields[headerfull.parameters[i].name] = col + "-" + (col+df-1);
			} else {
				fields[headerfull.parameters[i].name] = col;
			}
			col = col+df;
		}
		var fieldstr = "";
		for (var i = 0;i < params.length;i++) {
			fieldstr = fieldstr + fields[params[i]] + ",";
		}
		com = com + " | cut -d , -f " + fieldstr.slice(0, -1);
	}

	function dataErrorMessage() {
		if (wroteheader) {
			// Set error header and exit if header not sent.
			res.end();
			return;
		}
		if (d.contact) {
			error(req,res,1500,"Problem with the data server. Please send URL to " + d.contact + ".");
		} else {
			error(req,res,1500,"Problem with the data server.");
		}
	}

	console.log(ds() + "Executing " + com);

	// Call the CL command and send output.	
	var coms  = com.split(/\s+/);
	var coms0 = coms.shift();
	//var child = require('child_process')
	//				.spawn(coms0,coms,{"encoding":"buffer"})
	var child = require('child_process')
					.spawn('sh',['-c',com],{"encoding":"buffer"})

	var wroteheader = false; // If header already sent.
	var gotdata = false; // First chunk of data received.
	var outstr = ""; // output string.

	req.connection.on('close',function () {
		if (child.exitCode == null) {
			console.log(ds() + 'HTTP Connection closed. Killing ' + com);
			child.kill('SIGINT');
		}
	});

	child.stdout.on('end', function() {})

	// TODO: Write this to log file
	child.stderr.on('data', function (err) {
		console.log("Error message:" + err.toString());
	})

	child.on('exit', function (code) {

		if (code != 0) {
			dataErrorMessage();
			return;
		}

		if (gotdata) { // Data returned and normal exit.
			if (convert && header["format"] === "json") {
				// Convert accumulated data and send it.
				res.send(csvTo(outstr,true,true,header,include));
			} else {
				res.end();
			}
		} else { // No data returned and normal exit.
			res.statusMessage = "HAPI 1201: No data in interval";
			if (convert && header["format"] === "json") {
				// Send header only
				res.write(csvTo("",true,true,header,include));
				return;
			}
			if (include) {
				res.status(200).send("#" + JSON.stringify(header) + "\n");
			} else {
				res.status(200).end();
			}
		}
	})

	child.stdout.on('data', function (buffer) {
		gotdata = true;
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
			if (!convert && header["format"] === "binary") {
				res.write(buffer,'binary');
			} else {
				if (convert && header["format"] === "binary") {
					res.write(csvTo(buffer.toString(),true,true,header,include),'binary');
				} else {
					res.write(buffer.toString());
				}
			}
		}
	})

}

function prod(arr) {return arr.reduce(function(a,b){return a*b;})}

function csvTo(records,first,last,header,include) {

	// Helper functions
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
	
	if (header["format"] === "json") {
		return csv2json(records,po,names,first,last,header,include);
	}

	if (header["format"] === "binary") {
		return csv2bin(records,types);
	}


	function csv2bin(records,types) {

		// TODO: Only handles integer and double.
		// Does not use length info for Time variable - it is inferred
		// from input (so no padding).

		var recordsarr = records.split("\n");
		var Nr = recordsarr.length; // Number of rows
		if (/\n$/.test(records)) {
			Nr = Nr-1; // Last array element is empty if trailing newline.
			// Does not check for multiple trailing newlines.
		}

		var record1 = recordsarr[0].split(",");
		var Nt = record1[0].length ; // Number of time characters
		var Nd = record1.length - 1; // Number of data columns

		Nb = 0;
		for (var i = 1;i < types.length;i++) {
			if (types[i] === 'double') {
				Nb = Nb + 8;
			}
			if (types[i] === 'integer') {
				Nb = Nb + 4;
			}		
		}

		console.log(records,types,Nr,Nt,Nb);

		var recordbuff = new Buffer.alloc(Nr*(Nt + Nb));
		var pos = 0;
		for (var i = 0; i < Nr; i++) {
			var record = recordsarr[i].split(",");
			recordbuff.write(record[0],pos); // Time
			pos = pos + Nt;
			for (var j = 1;j < Nd+1;j++) {
				console.log(record[j])
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

function info(catalog,req,res) {

	// Read parameter metadata.
	// Parse string metadata because (json will be modified).
	var json = JSON.parse(metadata(catalog,'info','string',req.query.id));

	// Create array of known parameter names
	var knownparams = [];
	for (var i = 0;i < json.parameters.length;i++) {
		knownparams[i] = json.parameters[i].name;
	}

	// Create arrray from comma-separated parameters in query
	var wantedparams = [];
	if (req.query.parameters) {
		wantedparams = req.query.parameters.split(",");
	} else {
		// If parameters field not in query string, default is all.
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
		//console.log(validparams);
		//console.log(wantedparams);
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

function idCheck(catalog,id) {
	// Get list of datasets.
	var catalog = metadata(catalog,'catalog','json');
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
	// TODO: If one of the times had Z and the other does not, 
	// should warn that all time stamps are interpreted as Z.

	var times = [header["status"]["x_startDateRequested"],header["status"]["x_stopDateRequested"],
				 header.startDate,header.stopDate];

	for (var i = 0;i < times.length;i++) {
		// moment.js says YYYY-MM-DD and YYYY-DOY with no Z is
		// "... not in a recognized RFC2822 or ISO format. moment 
		// construction falls back to js Date(), which is not reliable
		// across all browsers and versions."		
		// But HAPI says it is valid.
		times[i] = times[i].replace(/Z$/,"");
		if (times[i].length == 8 || times[i].length == 10) {
			times[i] = times[i] + "T00:00:00.000";
		}
		// YYYY or YYYYZ is not valid ISO according to moment.js
		if (times[i].length == 4) {
			times[i] = times[i] + "-01-01T00:00:00.000";
		}
		// Make all times UTC
		times[i] = times[i] + "Z";
		times[i] = times[i].replace(/\.Z/,".0Z"); // moment.js says .Z is invalid.
	}

	var r = is.HAPITime(times[0],timeregexes);
	if (r.error) {
		return 1402;
	}
	var r = is.HAPITime(times[1],timeregexes);
	if (r.error) {
		return 1403;
	}

	function leapshift(time) {
		var shift = 0;
		if (time.match(/^[0-9]{4}-[0-9]{3}/)) {
			if (time.match(/23:59:60/)) {
				time = time.replace(/:60/,":59");
				shift = 1000;
			}
		}
		if (time.match(/^[0-9]{4}-[0-9]{2}-/)) {
			if (time.match(/23:59:60/)) {
				time = time.replace(/:60/,":59");
				shift = 1000;
			}
		}
		return {'time':time,'shift':shift};
	}

	var timesms = [];
	for (var i = 0;i < 4;i++) {
		var shift = 0;
		if (!moment(times[0], moment.ISO_8601).isValid()) {
			// Change 60th second to 59.
			var obj = leapshift(times[0]);
			if (obj.shift > 0) { // Error was due to leap second.
				times[0] = obj.time;
				shift = obj.shift;
			} else {
				return 1500; // Unexpected error.
			}
		}
		timesms[i] = moment(times[i]).valueOf() + shift;
	}

	if (timesms[1] <= timesms[0]) { // Stop requested <= start requested
		return 1404;
	}
	if (timesms[0] < timesms[2]) { // Start requested < start available
		return 1405;
	} 
	if (timesms[1] > timesms[3]) { // Stop requested > stop available
		return 1405;
	}

	return true;
}

// HAPI errors
function error(req,res,code,message) {

	// TODO: Need to determine if headers and/or data were already sent.
	var errs = {
		"1400": {status: 400, "message": "HAPI 1400: user input error"},
		"1401": {status: 400, "message": "HAPI 1401: unknown request field"},
		"1402": {status: 400, "message": "HAPI 1402: error in start time"},
		"1403": {status: 400, "message": "HAPI 1403: error in stop time"},
		"1404": {status: 400, "message": "HAPI 1404: start time equal to or after stop time"},
		"1405": {status: 400, "message": "HAPI 1405: time outside valid range"},
		"1406": {status: 404, "message": "HAPI 1406: unknown dataset id"},
		"1407": {status: 404, "message": "HAPI 1407: unknown dataset parameter"},
		"1408": {status: 400, "message": "HAPI 1408: too much time or data requested"},
		"1409": {status: 400, "message": "HAPI 1409: unsupported output format"},
		"1410": {status: 400, "message": "HAPI 1410: unsupported include value"},
		"1500": {status: 500, "message": "HAPI 1500: internal server error"},
		"1501": {status: 500, "message": "HAPI 1501: upstream request error"}
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

	if (res.headersSent) {
		return;
	}

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
			console.log(ds() + clc.red("Port " + argv.port + " already in use."));
			process.exit(1);
		} else {
			console.log(err.stack);
			var tmps = ds().split("T")[0];
			fs.appendFileSync('server-error-' + tmps + ".log", "\n" + ds() + " Uncaught Exception\n" + err.stack)
			// TODO: This is not necessarily needed
			process.exit(1);
		}
	});
}

function logreq(req,extra) {
	var extra = extra || "";
	var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	console.log(ds() + "Request from " + addr + ": " + req.originalUrl + " " + extra);
}