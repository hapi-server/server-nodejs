// Return content of static JSON files

var fs  = require('fs');
var os  = require("os");
var clc = require('cli-color'); // Colorize command line output

// Test library
var is = require(__dirname + '/node_modules/hapi-server-verifier/is.js');

function ds() {return (new Date()).toISOString() + " [server] ";};

function timeregexes(version) {
	// Get HAPI time regular expressions from schema
	var schema = fs.readFileSync(__dirname + '/node_modules/hapi-server-verifier/schemas/HAPI-data-access-schema-'+version+'.json');
	schema = JSON.parse(schema);
	var tmp = schema.HAPIDateTime.anyOf;
	var schemaregexes = [];
	for (var i = 0;i < tmp.length;i++) {
		schemaregexes[i] = tmp[i].pattern;
	}
	return schemaregexes;
}
exports.timeregexes = timeregexes;

function metadata(catalog,which,format,id) {

	// Call before server starts as metadata(cb) to read 
	// and memory cache content from metadata.
	if (metadata.cache && metadata.cache[catalog]) {
		// Content has been read from disk into object before server started.
		// Return it.
		if (id) {
			return metadata.cache[catalog][which][id][format || "string"];
		} else {
			return metadata.cache[catalog][which][format || "string"];
		}
	} else {
		var HAPIVERSION = which;
		var FORCE = format;
		if (!metadata.cache) {
			metadata.cache = {};
		}
		metadata.cache[catalog] = {};

		var schema = fs.readFileSync(__dirname + "/node_modules/hapi-server-verifier/schemas/HAPI-data-access-schema-"+HAPIVERSION+".json");
		metadata.cache["schema"] = JSON.parse(schema);
	}

	var schema = metadata.cache["schema"];

	// Landing page html
	var landing = __dirname+"/metadata/"+catalog+".htm";
	if (!fs.existsSync(landing)) {
		console.log(ds() + "Did not find " + landing.replace(__dirname,".") + ". Will use ./public/default.htm");
		landing = __dirname+"/public/default.htm";
	}
	if (!fs.existsSync(landing)) {
		console.log(ds() + "Did not find " + landing.replace(__dirname,".") + ". No landing page will be served.");
	} else {
		console.log(ds() + "Reading " + landing.replace(__dirname,"."));
		metadata.cache[catalog]['landing'] = {};
		metadata.cache[catalog]['landing']['string'] = 
			fs
				.readFileSync(landing,"utf8")
				.toString()
				.replace(/__CATALOG__/g, catalog.replace(/.*\//,""))
				.replace(/__VERSION__/g, HAPIVERSION);
	}

	// Capabilities 
	var capabilities = __dirname + "/conf/capabilities.json";
	var json = {};
	if (!fs.existsSync(capabilities)) {
		// Create response in case that capabilities.json file was removed.
		json["outputFormats"] = ["csv","binary","json"];
		console.log(ds() + "Did not find " + capabilities.replace(__dirname,"") + ". Using " + json["outputFormats"]);
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
	metadata.cache[catalog]['capabilities'] = {};
	metadata.cache[catalog]['capabilities']['string'] = str;
	metadata.cache[catalog]['capabilities']['json'] = json;

	var v = is.HAPIJSON(str,schema,'capabilities');
	if (v.error) {
		console.log(ds() + clc.red("Invalid HAPI: "+capabilities));
		console.log(v.got);
		if (!FORCE) { 
			process.exit(1);
		}
	}
	
	// Catalog
	var catalogfile = __dirname + "/metadata/" + catalog + ".json";
	if (!fs.existsSync(catalogfile)) {
		console.log(ds() + clc.red("Did not find " + catalogfile + ". Exiting."));
		process.exit(1);
	}

	console.log(ds() + "Reading " + catalogfile.replace(__dirname,"."));
	try {
		var str = fs.readFileSync(catalogfile);
	} catch (e) {
		console.log(ds() +  clc.red(catalogfile + " is not readable. Exiting."));
		process.exit(1);		
	}

	try {
		var json = JSON.parse(str);
	} catch (e) {
		console.log(ds() +  clc.red(catalogfile + " is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
		process.exit(1);
	}

	if (!json.data) {
		console.log(ds() +  clc.red(catalogfile + " Does not have a 'data' object. Exiting."));
		process.exit(1);		
	}

	if (typeof(json.catalog) === 'string') {
		console.log(ds() + "Reading " + json.catalog);
		var str = fs.readFileSync(json.catalog);
		try {
			var info = JSON.parse(str);
		} catch (e) {
			console.log(ds() +  clc.red(json.catalog + " is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
			process.exit(1);
		}
		json.catalog = info.catalog;
	} else {
		var info;
		for (var i = 0;i < json.catalog.length; i++) {
			if (typeof(json.catalog[i].info) === 'string') {

				if (json.catalog[i].info.substring(0,4) === 'http') {
					// TODO: Fetch /info response from web server.
				} else {
					// TODO: Try to read as JSON first!
					var commandExistsSync = require('command-exists').sync;
					// Attempt to execute; if failure, assume it is a file.
					console.log(ds() + "Trying " + json.catalog[i].info + " as command line command.");
					if (commandExistsSync(json.catalog[i].info.split(" ")[0])) {
						console.log(ds() + "Executing " + json.catalog[i].info);
						try {
							var info = require('child_process').execSync(json.catalog[i].info,{'stdio':['pipe','pipe','ignore']});
						} catch (e) {
							console.log(ds() +  clc.red("Command failed: " + json.catalog[i].info + ". Exiting."));
							process.exit(1);
						}
						try {
							info = JSON.parse(info);						
						} catch (e) {
							console.log(ds() +  clc.red(json.catalog[i].info + " output is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
							process.exit(1);
						}					
						json.catalog[i].info = info;
					} else {
						console.log(ds() + "It is not. Will attempt to read as JSON.");
						// Read info files
						try {
							console.log(ds() + "Reading " + json.catalog[i].info);
							info = fs.readFileSync(json.catalog[i].info,"utf8");
							try {
								info = JSON.parse(info);
							} catch (e) {
								console.log(ds() +  clc.red(json.catalog[i].info + " is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
								process.exit(1);
							}					
							json.catalog[i].info = info;
						} catch (err) {
							console.log(ds() +  clc.red("Could not read " + json.catalog[i].info + ". Exiting."));
							process.exit(1);
						}
					}
				}
			}
		}
	}

	// Command line program information
	metadata.cache[catalog]['data'] = {};
	metadata.cache[catalog]['data']['json'] = json.data;
	metadata.cache[catalog]['data']['string'] = JSON.stringify(json.data,null,4);
	var formats = json.data.formats || "csv";
	var test = json.data.test || "";


	function testError() {
	}

	if (test !== "") {
		console.log(ds() + "Testing command line program.");
		test = test.replace("${SERVER_ROOT}",__dirname);
		try {
			coms = test.split(/\s+/);
			coms0 = coms.shift();
			var out = require('child_process')
						.spawnSync(coms0,coms,{"encoding":"buffer"});
			if (out.status != 0) {
				console.log(ds() + "Test of command line program failed. Exiting.");
				console.log(ds() + "  Command:");
				console.log(ds() + "  " + test);
				process.exit(1);
			} else {
				console.log(ds() + "Test of command was successful.");
			}
			if (out.stderr.toString() !== "") {
				console.log(ds() + "Test program emitted to stderr: \n" + out.stderr.toString());
			}
		} catch (err) {
			console.log(ds() + "Test of command line program failed. Exiting.");
			console.log(ds() + "  Command:");
			console.log(ds() + "  " + test);
			console.log(err.stack);
			process.exit(1);
		}
	}

	metadata.cache[catalog]['landing']['string'] = metadata.cache[catalog]['landing']['string'].replace("__CONTACT__",json.data.contact || "")
	
	delete json.data;

	json["status"] = {"code": 1200, "message": "OK"};
	json["HAPI"] = HAPIVERSION;

	metadata.cache[catalog]['info'] = {};
	var id;
	for (var i = 0;i < json.catalog.length; i++) {

		json.catalog[i].info.status = {"code": 1200, "message": "OK"};
		json.catalog[i].info.HAPI = HAPIVERSION;
		var v = is.HAPIJSON(json.catalog[i].info,schema,'info');
		if (v.error) {
			console.log(ds() + "Invalid HAPI " + HAPIVERSION + " info node.");
			console.log(v.got)
			if (!FORCE) {
				console.log(ds() + "Exiting. To ignore error and continue, start using option --force=true");
				process.exit(1);
			}
		}

		id = json.catalog[i].id
		metadata.cache[catalog]['info'][id] = {};
		metadata.cache[catalog]['info'][id]['string'] = JSON.stringify(json.catalog[i].info, null, 4);
		metadata.cache[catalog]['info'][id]['json'] = json.catalog[i].info;
		metadata.cache[catalog]['info'][id]['json']['HAPI'] = json.catalog[i].info.HAPI;
		metadata.cache[catalog]['info'][id]['json']['status'] = json.catalog[i].info.status;
		if (!formats.includes("json")) {
			// If data program does not produce JSON, see if
			// any multi-dimensional arrays and warn.
			for (var j = 0; j < json.catalog[i].info.parameters.length; j++) {
				if (json.catalog[i].info.parameters[j].size) {
					if (json.catalog[i].info.parameters[j].size.length > 1) {
						console.log(ds() + "Warning: " + id + "/" + json.catalog[i].info.parameters[j].name + " has size.length > 1 and data program does not produce JSON. Server cannot produce JSON from CSV for this parameter.")
					}
				}
			}
		}
		delete json.catalog[i].info;
	}

	// TODO: Validate json against schema
	str = JSON.stringify(json, null, 4);

	metadata.cache[catalog]['catalog'] = {};
	metadata.cache[catalog]['catalog']['string'] = str;
	metadata.cache[catalog]['catalog']['json'] = json;

	//which(); // Execute callback.
}
exports.metadata = metadata;