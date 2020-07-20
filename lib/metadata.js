// Return content of static JSON files

var fs   = require('fs');
var path = require('path');
var os   = require("os");
var clc  = require('chalk');
var requestSync = require('sync-request');
var commandExistsSync = require('command-exists').sync;

var ROOT = __dirname + "/.."
var test = require('./test.js');

// Test library
var is = require('hapi-server-verifier').is;

function ds() {return (new Date()).toISOString() + " [server] ";};

function configVars(configfile) {

		if (configVars.config) {
			return configVars.config;
		}

		var env = process.env;

		configd = {}; 
		// Set defaults
		configd["HAPISERVERPATH"] = path.normalize(__dirname + "/..");
		configd["HAPISERVERHOME"] = configd["HAPISERVERPATH"];
		configd["NODEEXE"] = process.execPath;
		if (commandExistsSync("python")) {
			configd["PYTHONEXE"] = "python";			
		} else {
			configd["PYTHONEXE"] = path.normalize(__dirname + "/../bin/python");
		}

		// Override defaults using configuration file variables
		var config = require(configfile);
		console.log(ds() + "Reading " + configfile);
		for (key in config) { 
			if (config[key] !== "" && config[key].slice(0,2) !== "__") {
				configd[key] = config[key]; // Update default
			}
		}

		// Override defaults and config file with shell environment variables
		if (env.HAPISERVERPATH) {
			configd["HAPISERVERPATH"] = env.HAPISERVERPATH;
		}
		if (env.HAPISERVERHOME) {
			configd["HAPISERVERHOME"] = env.HAPISERVERHOME;
		}
		if (env.NODEEXE) {
			configd["NODEEXE"] = env.NODEEXE;
		}
		if (env.PYTHONEXE) {
			configd["PYTHONEXE"] = env.PYTHONEXE;
		}

		configVars.config = configd;
		return configd;

}
exports.configVars = configVars;

function replaceConfigVars(com) {
	config = configVars();
	if (typeof(com) === "string") {
		com = com.replace("$HAPISERVERPATH", config["HAPISERVERPATH"]);
		com = com.replace("$HAPISERVERHOME", config["HAPISERVERHOME"]);
		com = com.replace("$NODEEXE", config["NODEEXE"]);
		com = com.replace("$PYTHONEXE", config["PYTHONEXE"]);
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
	str = replaceConfigVars(str);
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
		// TODO: Try to read as JSON first.
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
		console.log("Errors:");
		console.log(v.got);
		console.log("\nStarting server with invalid HAPI because --ignore command-line option used.");
		if (!force) { 
			console.log("\nUse the --ignore command-line option to start server even if HAPI metadata is not valid.");
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

async function prepmetadata(FILES,FORCE,VERIFIER,PLOTSERVER,cb) {	

	if (FILES.length == 0) {
		console.log('');
		cb();
		return;
	} 

	let catalogfile = FILES[0];

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
	if (!json["HAPI"]) {
		// TODO: Make this required and throw error if not given?
		json["HAPI"] = "2.0";
	}
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
		console.log(ds() + "Did not find " + landingfile.replace(ROOT,".") + ". Will use ./node_modules/hapi-server-ui/single.htm");
		landingfile = ROOT + "/node_modules/hapi-server-ui/single.htm";
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
				.replace(/__VERSION__/g, json["HAPI"])
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
	ishapi(capabilities,json["HAPI"],'capabilities',FORCE);
	
	if (!json.data) {
		console.log(ds() +  clc.red(catalogfile + " Does not have a 'data' object. Exiting."));
		process.exit(1);		
	}

	if (typeof(json.catalog) === 'string') {
		// Resolve catalog node files, commands, and URLs.
		json.catalog = getmetadata(json.catalog);
	}

	const Resolver = require("json-ref-resolver").Resolver;
	const resolver = new Resolver();

	catalog = {"catalog": []};
	catalog.HAPI = json["HAPI"];
	catalog.status = json["status"];
	metadata.cache[catalogid]['info'] = {};
	metadata.cache[catalogid]['info-raw'] = {};

	for (var i = 0;i < json.catalog.length; i++) {
		console.log(ds() + "Checking info metadata for dataset " +  json.catalog[i]["id"]);

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

		// Resolve JSON refs
		let resolved = await resolver.resolve(info);
		let info_resolved = JSON.parse(JSON.stringify(resolved.result));

		if (info_resolved.definitions) {
			delete info_resolved.definitions;
		}

		// TODO: Check unresolved refs.
		//ishapi(info_resolved,json["HAPI"],'info',FORCE);		

		json.catalog[i]['info-raw'] = info;
		json.catalog[i]['info'] = info_resolved;
		id = json.catalog[i].id;
		metadata.cache[catalogid]['info-raw'][id] = info;
		metadata.cache[catalogid]['info'][id] = info_resolved;
	}
	ishapi(catalog,json["HAPI"],'catalog',FORCE);
	metadata.cache[catalogid]['catalog'] = catalog;

	// Create array of dataset ids in catalog
	let ids = [];
	for (var i = 0;i < json.catalog.length;i++) {
		ids.push(json.catalog[i]['id']);
	}
	metadata.cache[catalogid]['ids'] = ids;

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
		json.data.file = replaceConfigVars(json.data.file);
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

	FILES.shift();
	prepmetadata(FILES,FORCE,VERIFIER,PLOTSERVER,cb)
}
exports.prepmetadata = prepmetadata;