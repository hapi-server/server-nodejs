// Global variables
var HAPIVERSION = "2.0"; // Spec version implemented
var SCHEMAVERSION = "2.0-1";

var clc  = require('chalk'); // Colorize command line output

var ver  = parseInt(process.version.slice(1).split('.')[0]);
if (ver < 8) {
	console.log(clc.red("!!! node.js version >= 8 required.!!! node.js -v returns " + process.version + ".\nConsider installing https://github.com/creationix/nvm and then 'nvm install 8'.\n"));
	process.exit(1);
}

process.on('SIGINT', function() {
	process.exit(1);
});

var fs       = require('fs');
var express  = require('express'); // Client/server library
var app      = express();
var server   = require("http").createServer(app);
var compress = require('compression'); // Express compression module
var moment   = require('moment'); // Time library http://moment.js
var yargs    = require('yargs');

var metadata = require('./lib/metadata.js').metadata;
var prepmetadata = require('./lib/metadata.js').prepmetadata;

// Test commands and urls
var test = require('./lib/test.js');

// HAPI schema tests
var is = require('hapi-server-verifier').is;

var verify = require('hapi-server-verifier').tests.run;

// Date string for logging.
function ds() {return (new Date()).toISOString() + " [server] ";};

var usage = "node server.js";
if (/server$/.test(process.execPath)) {
	var usage = "server";
}

var argv = yargs
			.strict()
			.help()
			.describe('file','Catalog configuration file')
			.alias('file','f')
			.describe('port','Server port')
			.alias('port','p')
			.describe('conf','Server configuration file')
			.alias('conf','c')
			.describe('ignore','Start server even if metadata errors')
			.alias('ignore','i')
			.describe('open','Open web page on start')
			.alias('open','o')
			.describe('test','Run URL tests and exit')
			.alias('test','t')
			.describe('verify','Run verification tests and exit')
			.alias('verify','v')
			.option('ignore')
			.option('open')
			.option('test')
			.option('verify')
			.option('help', {alias: 'h'})
			.epilog("For more details, see README at https://github.com/hapi-server/server-nodejs/")
			.usage('Usage: ' + usage + ' [options]')
			.default({
				'file': __dirname + '/metadata/TestData.json',
				'port': 8999,
				'conf': __dirname + '/conf/server.json'
			})
			.argv

var config = require("./lib/metadata.js").configVars(argv.conf);
for (key in config) {
	console.log(ds() + key + " = " + configd[key]);
}

var FILE       = argv.file;
var PORT       = argv.port;
var FORCE      = argv.ignore || false;
var OPEN       = argv.open || false;
var TEST       = argv.test || false;
var VERIFY     = argv.verify || false;

var VERIFIER   = "http://hapi-server.org/verify";
var PLOTSERVER = "http://hapi-server.org/plot";

if (typeof(FILE) == 'string') {
	FILES = [FILE];	
} else {
	FILES = FILE;
}

exceptions(); // Catch common start-up exceptions

// Populate metadata.cache array, which has elements of catalog objects
prepmetadata(FILES,HAPIVERSION,FORCE,VERIFIER,PLOTSERVER,main);

function main() {

	let CATALOGS = [];
	let PREFIXES = [];

	let i = 0;
	for (let key in metadata.cache) {
		CATALOGS[i] = metadata.cache[key]['server']['id'];
		PREFIXES[i] = metadata.cache[key]['server']['prefix'];
		i = i + 1;
	}

	app.use(compress()); // Compress responses using gzip

	// Log all requests, then call next route handler
	app.get('*', function (req,res,next) {
		logreq(req);
		next();
	})

	if (CATALOGS.length > 1) {
		// TODO: Move file read to metadata?
		html = fs
				.readFileSync(__dirname + "/public/multiple.htm","utf8")
				.toString()
				.replace(/__CATALOG_LIST__/, JSON.stringify(CATALOGS));

		app.get('/', function (req,res) {res.send(html);});
	}

	apiInit(CATALOGS,PREFIXES);

	// TODO: This should be a callback to apiInit.
	app.listen(argv.port, function () {

		// Show messages after server started
		if (CATALOGS.length == 1) {
			var url = 'http://localhost:' + argv.port + PREFIXES[0] + "/hapi";
		} else {
			var url = 'http://localhost:' + argv.port;
			console.log(ds() + "HAPI server list at http://localhost:" + argv.port);
			for (var i = 0;i < CATALOGS.length;i++) {
				console.log(ds() + "  http://localhost:" + argv.port + PREFIXES[i] + "/hapi");
			}
		}

		if (OPEN) {
			// Open browser window
			var start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
			require('child_process').exec(start + ' ' + url);
		}

		console.log(ds() + clc.blue("Listening on port " + argv.port));

		if (TEST) {
			// Exits with signal 0 or 1
			test.urls(CATALOGS,PREFIXES,url,TEST);
		}
		if (VERIFY) {
			// Exits with signal 0 or 1
			verify(url);
		}
	});
}

function apiInit(CATALOGS,PREFIXES,i) {

	if (arguments.length == 2) {
		i = 0;
	}

	if (i == CATALOGS.length) {
		// Finalize API.
		// The following must occur after last app.get() call.
		// Any requests not matching set app.get() patterns will see error response.
		app.get('*', function(req, res) {
			if (PREFIXES.length == 1) {
				res.status(404).send("Invalid URL. See <a href='"+PREFIXES[0]+"/hapi'>"+PREFIXES[0].substr(1)+"/hapi</a>");
			} else {
				res.status(404).send("Invalid URL. See <a href='/'>start page</a>");
			}
		});

		// Handle uncaught errors in API request code.
		app.use(errorHandler);
		return;
	}

	let CATALOG = CATALOGS[i];
	let PREFIX = PREFIXES[i]

	console.log(ds() + clc.green("Initializing http://localhost:" + argv.port + PREFIX + "/hapi"));
	console.log(ds() + "To run test URLs, use the --test option");
	console.log(ds() + "To run verification tests, use the --verify option");

	// Serve static files in ./public
	app.use(PREFIX, express.static(__dirname + '/public'));

	// Serve landing web page
	app.get(PREFIX + '/hapi', function (req, res) {
		cors(res); // Set CORS headers
		res.contentType('text/html');
		res.send(metadata(CATALOG,"landing"));
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

		res.send(metadata(CATALOG,"capabilities"));
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

		res.send(metadata(CATALOG,"catalog"));
	})

	// /info
	app.get(PREFIX + '/hapi/info', function (req, res) {

		cors(res);
		res.contentType("application/json");

		// Check query string and set defaults as needed.
		if (!queryCheck(req,res,CATALOG,'info')) {
			return; // Error already sent, so return;
		}

		// Get subsetted info response based on requested parameters.
		// info() returns integer error code if error.
		// TODO: Reconsider this interface to info() - 
		// infoCheck() is more consistent with other code.
		var header = info(req,res,CATALOG); 
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

		// Check query string and set defaults as needed.
		if (!queryCheck(req,res,CATALOG,'data')) {
			return; // Error already sent, so return;
		}

		// Get subsetted /info response based on requested parameters.
		var header = info(req,res,CATALOG);
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
		if (timeOK !== true) {
			error(req,res,timeOK);
			return;
		}

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
				error(req,res,1410,"Allowed value of 'include' is 'header'.");
				return;
			}
		}
		// If include was given, set include = true
		var include = req.query["include"] === "header";

		if (header["format"] === "csv")    {res.contentType("text/csv")};
		if (header["format"] === "binary") {res.contentType("application/octet-stream")};
		if (header["format"] === "json")   {res.contentType("application/json")};

		var fname = "id-" 
					+ req.query["id"] 
					+ "_parameters-" 
					+ req.query["parameters"] 
					+ "_time.min-" 
					+ req.query["time.min"] 
					+ "_time.max-" 
					+ req.query["time.max"] 
					+ "." + header["format"];

		if (req.query["attach"] === "false") {
			// Allow non-standard "attach" query parameter for debugging.
			// Content-Type of 'text' will cause browser to display data 
			// instead of triggering a download dialog.
			res.contentType("text");
		} else {
			res.setHeader("Content-Disposition", "attachment;filename=" + fname);
		}

		// Send the data
		data(req,res,CATALOG,header,include);
	})

	// Anything that does not match PREFIX + {/hapi,/hapi/capabilities,/hapi/info,/hapi/data}
	app.get(PREFIX + '*', function (req, res) {
		res.status(404).send("Invalid URL. See <a href='"+PREFIX+"/hapi'>"+PREFIX.substr(1)+"/hapi</a>");
	})

	apiInit(CATALOGS,PREFIXES,++i);
}

function cors(res) {
	// CORS headers
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
}

function info(req,res,catalog) {

	// Read parameter metadata.
	if (req.query.resolve_references === "true") {
		json = metadata(catalog,'info',req.query.id);
	} else {
		json = metadata(catalog,'info-raw',req.query.id);
	}
	
	// Copy string metadata because (json will be modified).
	var json = JSON.parse(JSON.stringify(json));

	// Create array of known parameter names
	var knownparams = [];
	for (var i = 0;i < json.parameters.length;i++) {
		knownparams[i] = json.parameters[i].name;
	}

	// Create array from comma-separated parameters in query
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

function data(req,res,catalog,header,include) {

	function normalizeTime(timestr) {

		// Convert to YYYY-MM-DDTHH:MM:SS.FFFFFFFFFZ 
		// (nanosecond precision). All command line programs
		// will be given this format.

		// Need to extract it here and then insert at end
		// because moment.utc(timestr).toISOString()
		// ignores sub-millisecond parts of time string.
		var re = new RegExp(/.*\.[0-9]{3}([0-9].*)Z/);
		var submilli = "000000";
		if (re.test(timestr)) {
			var submilli = timestr.replace(/.*\.[0-9]{3}([0-9].*)Z$/,"$1");
			var pad = "0".repeat(6-submilli.length);
			submilli = submilli + pad; 
		}

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
		timestr = moment.utc(timestr).toISOString();
		timestr = timestr.slice(0,-1) + submilli + "Z";
		return timestr;
	}

	var start = normalizeTime(req.query["time.min"]);
	var stop = normalizeTime(req.query["time.max"]);

	// Extract command line command and replace placeholders.
	var d = metadata(catalog,'data');

	function replacevars(com) {
		com = com.replace("${id}",req.query["id"]);
		com = com.replace("${start}",start);
		com = com.replace("${stop}",stop);
		if (req.query["parameters"]) {
			com = com.replace("${parameters}",req.query["parameters"]);
		} else {
			com = com.replace("${parameters}",'');
		}
		com = com.replace("${format}",header["format"]);
		com = com.replace("${server}","http://localhost:" + argv.port);
		return com;	
	}

	function columnsstr() {
		// If command does not contain ${parameters}, assume CL program
		// always outputs all variables. Subset the output using subset.js.
		
		let fieldstr = "";
		if (req.query["parameters"] && !/\$\{parameters\}/.test(d.command)) {
			var params = req.query["parameters"].split(",");
			var headerfull = metadata(catalog,'info',req.query.id);
			if (params[0] !== headerfull.parameters[0].name) {
				// If time variable was not requested, add it 
				// so first column is always output.
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
				col = col + df;
			}
			for (var i = 0;i < params.length;i++) {
				fieldstr = fieldstr + fields[params[i]] + ",";
			}
			fieldstr = fieldstr.slice(0, -1); // Remove last comma.
		}
		return fieldstr;
	}

	// TODO: Check that d.file or d.url or d.command exists
	// when metadata loaded.
	let com = "";
	if (d.file || d.url) {
		// Will always need to subset in this case
		// (unless request is for all variables over
		// full range of response, which is not addressed)
		//com = config.PYTHONEXE + " " + __dirname + "/lib/subset.py";
		com = config.NODEEXE + " " + __dirname + "/lib/subset.js";
		if (d.file) com = com + " --file '" + replacevars(d.file) + "'";
		if (d.url)  com = com + " --url '" + replacevars(d.url) + "'";
		com = com + " --start " + start;
		com = com + " --stop " + stop;
		let columns = columnsstr();
		if (columns !== "" && d.file && !/\$\{parameters\}/.test(d.file)) {
			com = com + " --columns " + columns;
		}
		if (columns !== "" && d.url && !/\$\{parameters\}/.test(d.url)) {
			com = com + " --columns " + columns;
		}
		com = com + " --format " + header["format"];
	} else {

		com = replacevars(d.command); 

		// See if CL program supports requested format
		var formats = d.formats; // CL formats supported
		var convert = true; // true if conversion is needed
		if (formats) {
			if (formats.includes(req.query["format"])) {
				// CL program can create requested format
				var convert = false;
			}
		}
		let columns = columnsstr();

		var subsetcols = false;
		if (columns !== "") {
			subsetcols = true;
		}		
		var subsettime = false;
		if (!/\$\{start\}/.test(d.command) && !/\$\{stop\}/.test(d.command)) {
			subsettime = true;
		}

		if (subsetcols || subsettime) {
			//com = com + " | " + config.PYTHONEXE + " " + __dirname + "/lib/subset.py";
			com = com + " | " + config.NODEEXE + " " + __dirname + "/lib/subset.js";
			if (subsettime) {
				com = com + " --start " + start;
				com = com + " --stop " + stop;
			}
			if (subsetcols) {
				com = com + " --columns " + columns;	
			}
		}
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

	console.log(ds() + "Executing: " + com);

	// Call the CL command and send output.	
	var coms  = com.split(/\s+/);
	var coms0 = coms.shift();

	// This method, which avoids need to use sh,
	// leads to issues with escaping quotes.
	// var child = require('child_process').spawn(coms0,coms,{"encoding":"buffer"})
	// Instead use sh:
	var child = require('child_process')
					.spawn('sh',['-c',com],{"encoding":"buffer"})

	var wroteheader = false; // If header already sent.
	var gotdata = false; // First chunk of data received.
	var outstr = ""; // Output string.

	req.connection.on('close',function () {
		// If request closes and child has not exited, kill child.
		if (child.exitCode == null) {
			console.log(ds() + 'HTTP Connection closed. Killing ' + com);
			child.kill('SIGINT');
		}
	});

	// TODO: Write this to log file
	child.stderr.on('data', function (err) {
		console.log(ds() + "Command line program error message: " + clc.red(err.toString().trim()));
	})

	child.on('close', function (code) {

		if (code != 0) {
			dataErrorMessage();
			return;
		}

		if (gotdata) { // Data returned and normal exit.
			if (convert) {
				// Convert accumulated data and send it.
				res.send(csvTo(outstr,true,true,header,include));
			} else {
				res.end(); // Data was being sent incrementally.
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

	var remainder = "";

	child.stdout.on('data', function (buffer) {
		gotdata = true;
		if (!wroteheader && include && header["format"] !== "json") {
			// If header not written, header requested, and format requested
			// is not JSON, send header.
			wroteheader = true;
			res.write("#" + JSON.stringify(header) + "\n");
		}

		if (false) {
			// Un-finished code for allowing incremental writes.
			// See comments below.
			bufferstr = buffer.toString();
			if (remainder !== "") {
				bufferstr = remainder + bufferstr;
			}
			var lastnl = bufferstr.lastIndexOf("\n");
			//console.log("bufferstr = " + bufferstr);
			if (lastnl+1 == bufferstr.length) {
				//console.log("no remainder");
				remainder = "";
			} else {
				remainder = bufferstr.slice(lastnl);
				//console.log("remainder = " + remainder);
				bufferstr = bufferstr.slice(0,lastnl);
			}
		} 

		if (header["format"] === "csv") {
			res.write(buffer.toString());
		} else if (header["format"] === "json") {
			if (!convert) {
				res.write(buffer.toString());
				return;			
			} else {
				// JSON requested and CL program cannot produce it.
				// Accumulate output and send everything at once for now.
				// TODO: Write incrementally; use
				//    buffer.toString().lastIndexOf(/\n/)
				// along with saving part of string that was not written.
				outstr = outstr + buffer.toString();
			}
		} else {
			if (!convert) {
				res.write(buffer,'binary');
				return;
			} else {
				// TODO: Write incrementally. See above.
				outstr = outstr + buffer.toString();
			}
		}
	})
}

// Multiply all elements in array
function prod(arr) {return arr.reduce(function(a,b){return a*b;})}

function csvTo(records,first,last,header,include) {

	// Helper functions
	function append(str,arr,N) {for (var i=0;i<N;i++) {arr.push(str);};return arr;}

	// TODO: Do this on first call only.
	var size    = [];
	var sizes   = [];
	var name    = "";
	var names   = []; // Name associated with number in each column
	var type    = "";
	var types   = []; // Type associated with number in each column 
	var length  = -1;
	var lengths = [];
	var po      = {}; // Parameter object
	for (var i = 0;i < header.parameters.length; i++) {
		size  = header.parameters[i]["size"] || [1];
		sizes = append(size,sizes,prod(size));
		name  = header.parameters[i]["name"];
		names = append(name,names,prod(size));
		type  = header.parameters[i]["type"];
		types = append(type,types,prod(size));
		length  = header.parameters[i]["length"] || -1;
		lengths = append(length,lengths,prod(size));
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
		return csv2bin(records,types,lengths,sizes);
	}


	function csv2bin(records,types,lengths,sizes) {

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
		var Nd = record1.length - 1; // Number of data columns

		Nb = 0;
		for (var i = 0;i < types.length;i++) {
			if (types[i] === 'double') {
				Nb = Nb + 8;
			}
			if (types[i] === 'integer') {
				Nb = Nb + 4;
			}		
			if (types[i] === 'string' || types[i] === 'isotime') {
				Nb = Nb + lengths[i];
			}		
		}

		//console.log(types,lengths,sizes,Nr,Nb,recordsarr);

		var recordbuff = new Buffer.alloc(Nr*Nb);
		var pos = 0;
		for (var i = 0; i < Nr; i++) {
			var record = recordsarr[i].split(",");
			//console.log(record)
			for (var j = 0;j < Nd+1;j++) {
				if (types[j] === 'double') {
					recordbuff.writeDoubleLE(record[j],pos);
					pos = pos + 8;
				}
				if (types[j] === 'integer') {
					recordbuff.writeInt32LE(record[j],pos);	
					pos = pos + 4;
				}
				if (types[j] === 'string' || types[j] === 'isotime') {
					recordbuff.write(record[j],pos)
					pos = pos + lengths[j];
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

function queryCheck(req, res, catalog, type) {

	// Check query parameters for query of type='info' or 'data'
	// If invalid query parameter, send error and return false
	// If req.query.resolve_references === undefined, set to "true"

	// Check for required id parameter
	if (!req.query.id) {
		error(req,res,1400,"A dataset id must be given.");
		return false;
	}

	let ids = metadata(catalog,'ids');
	if (!ids.includes(req.query.id)) {
		error(req,res,1406);
		return false;
	}

	if (type === 'info') {
		// Check if extra parameters given
		for (var key in req.query) {
			if (!["id","parameters","resolve_references"].includes(key)) {
				error(req,res,1401,"'id', 'parameters', and 'resolve_references' are the only valid query parameters.");
				return false;
			}
		}
	} else {
		// Check if query parameters are all valid
		var allowed = ["id","parameters","time.min","time.max","format","include","attach","resolve_references"];
		for (var key in req.query) {
			if (!allowed.includes(key)) {
				error(req,res,1401,"The only allowed query parameters are " + allowed.join(", "));
				return false;
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
	}

	// Set default resolve_references to be true if not given
	if (req.query.resolve_references === undefined) {
		req.query.resolve_references = "true";
	}

	// If resolve_references given, check that it is "true" or "false".
	if (!["true","false"].includes(req.query.resolve_references)) {
		error(req,res,1411,"resolve_references must be 'true' or 'false'");
		return false;
	}

	return true;
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

	var r = is.HAPITime(times[0],SCHEMAVERSION);
	if (r.error) {
		return 1402;
	}
	var r = is.HAPITime(times[1],SCHEMAVERSION);
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
		"1402": {status: 400, "message": "HAPI 1402: error in time.min"},
		"1403": {status: 400, "message": "HAPI 1403: error in time.max"},
		"1404": {status: 400, "message": "HAPI 1404: time.min equal to or after time.max"},
		"1405": {status: 400, "message": "HAPI 1405: time outside valid range"},
		"1406": {status: 404, "message": "HAPI 1406: unknown dataset id"},
		"1407": {status: 404, "message": "HAPI 1407: unknown dataset parameter"},
		"1408": {status: 400, "message": "HAPI 1408: too much time or data requested"},
		"1409": {status: 400, "message": "HAPI 1409: unsupported output format"},
		"1410": {status: 400, "message": "HAPI 1410: unsupported include value"},
		"1411": {status: 400, "message": "HAPI 1411: unsupported resolve_references value"},
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
	//console.log(req);
	var extra = extra || "";
	var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	console.log(ds() + "Request from " + addr + ": " + "http://" + req.headers.host + req.originalUrl + " " + extra);
}