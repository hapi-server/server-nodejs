// Return content of static JSON files

var fs  = require('fs');
var os  = require("os");
var clc = require('cli-color'); // Colorize command line output
var requestSync = require('sync-request');

var ROOT = __dirname + "/.."
var test = require('./test.js');

// Test library
var is = require(ROOT + '/node_modules/hapi-server-verifier/is.js');

function ds() {return (new Date()).toISOString() + " [server] ";};

function hapischema(version) {
	// TODO: Loop through sorted list of files matching
	// HAPI-data-access-schema-2.0.*
	// and select last one.
	schemaversion = "1";
	schemafile = "HAPI-data-access-schema-"+version+"-"+schemaversion+".json";
	var schema = fs.readFileSync(ROOT + "/node_modules/hapi-server-verifier/schemas/"+schemafile);
	return JSON.parse(schema);
}

function timeregexes(version) {
	// Get HAPI time regular expressions from schema
	var schema = hapischema(version);
	var tmp = schema.HAPIDateTime.anyOf;
	var schemaregexes = [];
	for (var i = 0;i < tmp.length;i++) {
		schemaregexes[i] = tmp[i].pattern;
	}
	return schemaregexes;
}
exports.timeregexes = timeregexes;

function getmetadata(str) {

	function getinfo(caturl,catalog) {
		for (i = 0;i < catalog.length;i++) {
			if (catalog[i].info) {
				continue;
			}
			if (!/hapi\/catalog$/.test(caturl)) {
				console.log(ds() +  clc.red(caturl + " must end with /hapi/catalog. Exiting."));
				process.exit(1);				
			}
			url = caturl.replace("hapi/catalog","hapi/info") + "?id=" + catalog[i].id;
			// TODO: Do this aync. But will need to limit # of active requests
			//console.log(ds() + "Getting " + url);
			console.log(ds() + "Getting " + url);
			res = requestSync('GET',url);
			try {
				catalog[i].info = JSON.parse(res.body.toString());						
			} catch (e) {
				console.log(ds() +  clc.red(str + " output is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
				process.exit(1);
			}
		}
		return catalog;
	}

	var obj;

	if (str.substring(0,4) === 'http') {
		console.log(ds() + "Getting " + str + ".");
		res = requestSync('GET',str);
		jsonstr = res.body.toString();
		try {
			obj = JSON.parse(jsonstr);						
		} catch (e) {
			console.log(ds() +  clc.red(str + " output is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
			process.exit(1);
		}
		//console.log(obj)
		if (obj.catalog) {
			// Creat info node if str is HAPI server.
			obj = getinfo(str,obj.catalog);
		}
		//console.log(obj)
	} else {
		// TODO: Try to read as JSON first!
		var commandExistsSync = require('command-exists').sync;
		// Attempt to execute; if failure, assume it is a file.
		console.log(ds() + "Trying " + str + " as command line command.");
		if (commandExistsSync(str.split(" ")[0])) {
			console.log(ds() + "Executing " + str);
			try {
				var info = require('child_process').execSync(str,{'stdio':['pipe','pipe','ignore']});
			} catch (e) {
				console.log(ds() +  clc.red("Command failed: " + str + ". Exiting."));
				process.exit(1);
			}
			try {
				obj = JSON.parse(info);						
			} catch (e) {
				console.log(ds() +  clc.red(str + " output is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
				process.exit(1);
			}
		} else {
			console.log(ds() + "It is not. Will attempt to read as JSON.");
			// Read info files
			try {
				console.log(ds() + "Reading " + str);
				info = fs.readFileSync(str,"utf8");
				try {
					obj = JSON.parse(info);
				} catch (e) {
					console.log(ds() +  clc.red(str + " is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
					process.exit(1);
				}
			} catch (err) {
				console.log(ds() +  clc.red("Could not read " + str + ". Exiting."));
				process.exit(1);
			}
		}
	}
	return obj;
}

function ishapi(str,schema,subschema,force) {
	var v = is.HAPIJSON(str,schema,subschema);

	if (v.error) {
		json = JSON.parse(str);
		console.log(ds() + clc.red("Invalid HAPI " + json.HAPI + " " + subschema + " node: " + str));
		console.log(v.got);
		if (!force) { 
			process.exit(1);
		}
	}
}

function metadata(catalog,which,format,id,PLOTSERVER) {

	// First time metadata() (before server starts) is called, 
	// no cache exists and call is 
	//   metadata(catalog,HAPIversion,force,verifierURL)
	// Second time called, cache exists and call is
	//   metadata(catalog, metadatatype, metadataformat, datasetid)

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
		var VERIFIER = id;
		if (!metadata.cache) {
			metadata.cache = {};
		}
		metadata.cache[catalog] = {};

		metadata.cache["schema"] = hapischema(HAPIVERSION);
	}

	var schema = metadata.cache["schema"];

	// Landing page html
	var landing = ROOT+"/public/"+catalog+".htm";
	if (!fs.existsSync(landing)) {
		console.log(ds() + "Did not find " + landing.replace(ROOT,".") + ". Will use ./public/default.htm");
		landing = ROOT+"/public/default.htm";
	}
	if (!fs.existsSync(landing)) {
		console.log(ds() + "Did not find " + landing.replace(ROOT,".") + ". No landing page will be served.");
	} else {
		console.log(ds() + "Reading " + landing.replace(ROOT,"."));
		metadata.cache[catalog]['landing'] = {};
		metadata.cache[catalog]['landing']['string'] = 
			fs
				.readFileSync(landing,"utf8")
				.toString()
				.replace(/__CATALOG__/g, catalog.replace(/.*\//,""))
				.replace(/__VERSION__/g, HAPIVERSION)
				.replace(/__VERIFIER__/g, VERIFIER)
				.replace(/__PLOTSERVER__/g, PLOTSERVER);
	}

	// Capabilities 
	var capabilities = ROOT + "/conf/capabilities.json";
	var json = {};
	if (!fs.existsSync(capabilities)) {
		// Create response in case that capabilities.json file was removed.
		json["outputFormats"] = ["csv","binary","json"];
		console.log(ds() + "Did not find " + capabilities.replace(ROOT,"") + ". Using " + json["outputFormats"]);
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

	// Sync function; will throw error or warning.
	ishapi(str,schema,'capabilities',FORCE);
	
	// Catalog
	var catalogfile = ROOT + "/metadata/" + catalog + ".json";
	if (!fs.existsSync(catalogfile)) {
		console.log(ds() + clc.red("Did not find " + catalogfile + ". Exiting."));
		process.exit(1);
	}

	console.log(ds() + "Reading " + catalogfile.replace(ROOT,"."));
	try {
		var str = fs.readFileSync(catalogfile);
	} catch (e) {
		console.log(ds() +  clc.red(catalogfile + " is not readable. Exiting."));
		process.exit(1);		
	}

	try {
		var json = JSON.parse(str);
	} catch (e) {
		console.log(ds() +  clc.red(catalogfile + " is not JSON parse-able. Try https://jsonlint.com/. Exiting."));
		process.exit(1);
	}

	if (!json.data) {
		console.log(ds() +  clc.red(catalogfile + " Does not have a 'data' object. Exiting."));
		process.exit(1);		
	}

	json["status"] = {"code": 1200, "message": "OK"};
	json["HAPI"] = HAPIVERSION;

	if (typeof(json.catalog) === 'string') {
		// Resolve catalog node.
		json.catalog = getmetadata(json.catalog);
	}
	
	//console.log(JSON.stringify(json,null,4));

	HAPIcatalog = {"catalog": []};
	HAPIcatalog.status = json["status"];
	HAPIcatalog.HAPI = json["HAPI"];
	for (var i = 0;i < json.catalog.length; i++) {
		// Copy info node
		HAPIcatalog.catalog[i] = JSON.parse(JSON.stringify(json.catalog[i]));
		// Delete non-catalog part
		delete HAPIcatalog.catalog[i].info;
		if (typeof(json.catalog[i].info) === 'string') {
			// Resolve info node.
			HAPIinfo = getmetadata(json.catalog[i].info);
		} else {
			// Copy info node.
			HAPIinfo = JSON.parse(JSON.stringify(json.catalog[i].info));
		}
		HAPIinfo.status = json["status"];
		HAPIinfo.HAPI = json["HAPI"];
		ishapi(JSON.stringify(HAPIinfo),schema,'info',FORCE);		
		json.catalog[i].info = HAPIinfo;
	}
	//console.log(HAPIcatalog);
	ishapi(JSON.stringify(HAPIcatalog),schema,'catalog',FORCE);

	// Command line program information
	metadata.cache[catalog]['data'] = {};
	metadata.cache[catalog]['data']['json'] = json.data;
	metadata.cache[catalog]['data']['string'] = JSON.stringify(json.data,null,4);
	var formats = json.data.formats || "csv";
	var teststr = json.data.test || "";

	if (json.data.testcommands) {
		test.commands(json.data.testcommands,catalog);
	}

	metadata.cache[catalog]['landing']['string'] = metadata.cache[catalog]['landing']['string'].replace("__CONTACT__",json.data.contact || "")
	
	delete json.data;

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
				console.log(ds() + "Exiting. To ignore error and continue, start using the option --force");
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
	//console.log(JSON.stringify(json,null,4));
}
exports.metadata = metadata;