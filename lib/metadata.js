// Return content of static JSON files

var fs   = require('fs');
var path = require('path');
var os   = require("os");
var clc  = require('chalk');
var requestSync = require('sync-request');

var ROOT = __dirname + "/.."
var test = require('./test.js');

// Test library
var is = require('hapi-server-verifier').is;

function ds() {return (new Date()).toISOString() + " [server] ";};

function replaceConfigVars(com) {
	config = {};
	config["HAPISERVER_BIN_DIR"] = __dirname + "/../bin";
	config["HAPISERVER_META_DIR"] = __dirname + "/../metadata";
	config["NODE_EXE"] = __dirname + "/../bin/node";
	//config["PYTHON_EXE"] = __dirname + "/../bin/python";
	config["PYTHON_EXE"] = "python";

	if (typeof(com) === "string") {
		com = com.replace("${cwd}", process.cwd());
		com = com.replace("$(HAPISERVER_BIN_DIR)", config["HAPISERVER_BIN_DIR"]);
		com = com.replace("$(HAPISERVER_META_DIR)", config["HAPISERVER_META_DIR"]);
		com = com.replace("$(NODE_EXE)", config["NODE_EXE"]);
		com = com.replace("$(PYTHON_EXE)", config["PYTHON_EXE"]);
		return com;
	} else {
		for (var i=0;i < com.length; i++) {
			com[i].command = replaceConfigVars(com[i].command);
		}
		return com;
	}
}
exports.replaceConfigVars = replaceConfigVars;

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
			// Create info node if str is HAPI server.
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

function ishapi(json,schema,subschema,force) {
	var v = is.HAPIJSON(json,schema,subschema);
	if (v.error) {
		console.log(ds() + clc.red("Invalid HAPI " + json.HAPI + " " + subschema + " node:\n" + JSON.stringify(json,null,4)));
		console.log(v.got);
		if (!force) { 
			process.exit(1);
		}
	}
}

function metadata(catalog,part,id) {
	if (id) {
		return metadata.cache[catalog][part][id];
	} else {
		return metadata.cache[catalog][part];
	}
}
exports.metadata = metadata;

function prepmetadata(catalogfile,HAPIVERSION,FORCE,VERIFIER,PLOTSERVER) {

	var SCHEMAVERSION = "2.0-1";

	if (!metadata.cache) {
		metadata.cache = {};
	}

	function readandparse(file) {
		if (!fs.existsSync(file)) {
			console.log(ds() + clc.red("Did not find " + file + ". Exiting."));
			process.exit(1);
		}
		console.log(ds() + "Reading " + file);
		try {
			var str = fs.readFileSync(file);
		} catch (ex) {
			console.log(ds() + clc.red(file + " is not readable. Exiting."));
			console.log(ds() + clc.red(ex.message));
			process.exit(1);		
		}
		try {
			var json = JSON.parse(str);
		} catch (ex) {
			console.log(ds() + clc.red(file + " is not JSON parse-able. Try https://jsonlint.com/. Exiting."));
			console.log(ds() + clc.red(ex.message));
			process.exit(1);
		}
		return json;
	}

	// Catalog
	json = readandparse(catalogfile);
	json["HAPI"]   = HAPIVERSION;
	json["status"] = {"code": 1200, "message": "OK"};
	if (!json["server"]) {
		json["server"] = {};
	}
	if (!json["server"]["id"]) {
		json["server"]["id"] = path.parse(catalogfile).name;
	}
	catalogid = json["server"]["id"];
	if (!json["server"]["prefix"]) {
		json["server"]["prefix"] = "/" + catalogid;
	}
	metadata.cache[catalogid] = {};
	metadata.cache[catalogid]["server"] = json["server"];

	// Landing page html
	metadata.cache[catalogid]['landing'] = {};
	if (!json["server"]["landing"]) {
		var landingfile = ROOT + "/public/" + catalogid + ".htm";
	} else {
		var landingfile = json["server"]["landing"];
	}

	if (!fs.existsSync(landingfile)) {
		console.log(ds() + "Did not find " + landingfile.replace(ROOT,".") + ". Will use ./public/default.htm");
		landingfile = ROOT + "/public/default.htm";
	}
	if (!fs.existsSync(landingfile)) {
		console.log(ds() + "Did not find " + landingfile.replace(ROOT,".") + ". No landing page will be served.");
		metadata.cache[catalogid]['landing'] = '';
	} else {
		console.log(ds() + "Reading " + landingfile.replace(ROOT,"."));
		metadata.cache[catalogid]['landing'] = 
			fs
				.readFileSync(landingfile,"utf8")
				.toString()
				.replace(/__CATALOG__/g, catalogid.replace(/.*\//,""))
				.replace(/__VERSION__/g, HAPIVERSION)
				.replace(/__VERIFIER__/g, VERIFIER)
				.replace(/__PLOTSERVER__/g, PLOTSERVER);
	}

	// Capabilities
	var capabilitiesfile = ROOT + "/conf/capabilities.json";
	var capabilities = {};
	if (!fs.existsSync(capabilitiesfile)) {
		// Create response in case that capabilities.json file was removed.
		capabilities["outputFormats"] = ["csv","binary","json"];
		console.log(ds() + "Did not find " + capabilitiesfile.replace(ROOT,"") + ". Using " + capabilities["outputFormats"]);
	} else {
		capabilities = readandparse(capabilitiesfile);
	}
	capabilities["HAPI"]   = json["HAPI"];
	capabilities["status"] = json["status"];

	metadata.cache[catalogid]['capabilities'] = capabilities;

	// Sync function; will throw error or warning.
	ishapi(capabilities,SCHEMAVERSION,'capabilities',FORCE);
	
	if (!json.data) {
		console.log(ds() +  clc.red(catalogfile + " Does not have a 'data' object. Exiting."));
		process.exit(1);		
	}

	if (typeof(json.catalog) === 'string') {
		// Resolve catalog node files, commands, and URLs.
		json.catalog = getmetadata(json.catalog);
	}

	catalog = {"catalog": []};
	catalog.HAPI = json["HAPI"];
	catalog.status = json["status"];
	metadata.cache[catalogid]['info'] = {};
	for (var i = 0;i < json.catalog.length; i++) {
		// Copy info node
		catalog.catalog[i] = JSON.parse(JSON.stringify(json.catalog[i]));
		// Delete non-catalog part
		delete catalog.catalog[i].info;
		if (typeof(json.catalog[i].info) === 'string') {
			// Resolve info node.
			info = getmetadata(json.catalog[i].info);
		} else {
			// Copy info node.
			info = JSON.parse(JSON.stringify(json.catalog[i].info));
		}
		info.HAPI = json["HAPI"];
		info.status = json["status"];
		ishapi(info,SCHEMAVERSION,'info',FORCE);		
		json.catalog[i].info = info;
		id = json.catalog[i].id;
		metadata.cache[catalogid]['info'][id] = info;
	}
	ishapi(catalog,SCHEMAVERSION,'catalog',FORCE);
	metadata.cache[catalogid]['catalog'] = catalog;

	// Command line program information
	var formats = json.data.formats || "csv";
	var teststr = json.data.test || "";

	if (!json.data.file && !json.data.command && !json.data.url) {
		console.log(ds() +  clc.red("A 'command', 'file', or 'url' must be specified in the 'data' node."));
		process.exit(1);
	}
	// TODO: Write schema for data node. As written,
	// if a command is specified, it will be used and file and url
	// will be ignored. Need to catch this error.

	if (json.data.file) {
		if (!fs.existsSync(json.data.file)) {
			console.log(ds() +  clc.red(json.data.file + " referenced in " + catalogid + " not found."));
			process.exit(1);
		}
	}

	if (json.data.command) {
		json.data.command = replaceConfigVars(json.data.command);
		if (json.data.testcommands) {
			json.data.testcommands = replaceConfigVars(json.data.testcommands);
			test.commands(json.data.testcommands,catalogid);
		}
	}

	metadata.cache[catalogid]['data'] = JSON.parse(JSON.stringify(json.data));
	metadata.cache[catalogid]['landing'] = metadata.cache[catalogid]['landing'].replace("__CONTACT__",json.data.contact || "")
	
	if (!formats.includes("json")) {
		// If data program does not produce JSON, see if
		// any multi-dimensional arrays and warn.
		for  (i in metadata.cache[catalogid]['info']) {
			for (var j = 0; j < metadata.cache[catalogid]['info'][i].parameters.length; j++) {
				if (metadata.cache[catalogid]['info'][i].parameters[j].size) {
					if (metadata.cache[catalogid]['info'][i].parameters[j].size.length > 1) {
						console.log(ds() + "Warning: " + id + "/" + metadata.cache[catalogid]['info'][i].parameters[j].name + " has size.length > 1 and data program does not produce JSON. Server cannot produce JSON from CSV for this parameter.")
					}
				}
			}
		}
	}

	return json;
}
exports.prepmetadata = prepmetadata;