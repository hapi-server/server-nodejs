const fs    = require('fs');
const path  = require('path');
const os    = require("os");
const clc   = require('chalk');
const https = require('https');
const http  = require('http');
var commandExistsSync = require('command-exists').sync;
var fileExistsSync = require('fs').existsSync;

const ROOT = __dirname + "/..";

// Date string
function ds() {return (new Date()).toISOString() + " [server] ";};

// Run tests on tests given in data node.
const test = require('./test.js');

function ishapi(json, schema, subschema, force) {
	// Test if JSON is schema-valid.
	const is = require('hapi-server-verifier').is;

	var v = is.HAPIJSON(json,schema,subschema);
	if (v.error) {
		console.log(ds() + clc.red("Invalid HAPI " + json.HAPI + " " 
					+ subschema + " node:\n") + JSON.stringify(json,null,4));
		console.log(clc.red("Error(s):"));
		console.log(clc.red(v.got));
		if (force) { 
			console.log("\nStarting server with invalid HAPI because --ignore command-line option used.");
		} else {
			console.log("\nUse the --ignore command-line option to force start the server when metadata is not schema-valid.");
			process.exit(1);
		}
	}
}

function resolve(obj) {

	// Slightly modified version of
	// https://willseitz-code.blogspot.com/2013/01/javascript-to-deserialize-json-that.html

	// This resolver does not handle external references.
	// Resolvers that handle external references on npm require
	// async/await, which was introduced in node 8. I want to continue
	// using node 6 so that binary packages can be updated without
	// the need update the node binaries.
	var hashOfObjects = {};

	var collectIds = function (obj) {
		if (!obj) {return;};
		if (typeof(obj) === "object") {
			if (obj.hasOwnProperty("$ref")) {
				hashOfObjects[obj.$ref] = obj;
			}
			for (var prop in obj) {
				collectIds(obj[prop]);
			}
		} else if (typeof(obj) === "array") {
			obj.forEach(function (element) {
				collectIds(element);
			});
		}
	};

	var setReferences = function (obj) {

		if (!obj) {return;};
		if (typeof(obj) === "object") {
			for (var prop in obj) {
				if (obj[prop] && typeof(obj[prop]) === "object" && 
					obj[prop].hasOwnProperty("$ref")) {
					obj[prop] = hashOfObjects[obj[prop]["$ref"]];
				} else {
					setReferences(obj[prop]);
				}
			}
		} else if (typeof(obj) === "array") {
			obj.forEach(function (element, index, array) {
				if (element && typeof(element) === "object" &&
					element.hasOwnProperty("$ref")) {
					array[index] = hashOfObjects[element["$ref"]];
				} else {
					setReferences(element);
				}
			});
		}
		return obj;
	}

	//collectIds(obj);
	//console.log(hashOfObjects);
	//console.log(JSON.stringify(setReferences(obj),null,4));
	return setReferences(obj);
}

function exit_conditionally(exit_if_fail, e, cb) {
	if (exit_if_fail) {
		process.exit(1);
	} else {
		cb(e);
	}
}

function pythonexe() {
	// commandExistsSync returns true on Windows if python is
	// not installed because it is aliased to a python.exe that
	// launches Microsoft Store.
	// https://stackoverflow.com/a/34953561
	// TODO: Check metadata to see if Python is ever used. If not, skip
	// this step.
	let debug = true;
	let PYTHONEXE = "";
	let isWin = process.platform.startsWith("win");
	if (isWin) {
		var child = require('child_process').spawnSync('where python',{"shell": true});
		if (child.stdout) {
			PYTHONEXE = child.stdout.toString().slice(0,-1);
			if (PYTHONEXE.includes("Microsoft\\WindowsApps")) {
				PYTHONEXE = "";
			}
		}
		if (child.status == 0 && PYTHONEXE !== "") {
			if (debug) console.log(ds() + "Found python in path: " + PYTHONEXE);
		}
	} else {
		if (commandExistsSync("python")) {
			if (debug) console.log(ds() + "Command 'python' exists. Using it as default for PYTHONEXE.");
			PYTHONEXE = "python";
		}
	}
	if (PYTHONEXE === "") {
		PYTHONEXE = path.normalize(__dirname + "/../bin/python");
		if (debug) console.log(ds() + "Python not found in path. Will use " + PYTHONEXE + ".");
		if (!commandExistsSync(PYTHONEXE)) {
			if (debug) console.log(ds() + PYTHONEXE + " command failed.");
			PYTHONEXE = "";
		}
	}
	return PYTHONEXE;
}

function configVars(configfile) {

	let debug = true;

	if (configVars.config) {
		return configVars.config;
	}

	if (debug) console.log(ds() + "Setting configuration variables.")

	var env = process.env;

	configd = {}; 
	// Set defaults
	configd["HAPISERVERPATH"] = path.normalize(__dirname + "/..");
	configd["HAPISERVERHOME"] = configd["HAPISERVERPATH"];
	configd["NODEEXE"] = process.execPath;

	configd["PYTHONEXE"] = pythonexe();

	if (debug) {
		for (key in configd) {
			console.log(ds() + "Default " + key + " = " + configd[key]);
		}
	}

	// Override defaults using configuration file variables
	var config = require(configfile);
	console.log(ds() + "Reading " + configfile);
	for (key in config) { 
		if (config[key] !== "" && config[key].slice(0,2) !== "__") {
			if (debug) console.log(ds() + "Found " + key + " in " + configfile + ". Using it.");
			configd[key] = config[key]; // Update default
		} else {
			if (debug) console.log(ds() + key + " not given in " + configfile + ".");
		}
	}

	// Override defaults and config file with shell environment variables
	if (env.HAPISERVERPATH) {
		if (debug) console.log(ds() + "Found HAPISERVERPATH environment variable. Using it.");
		configd["HAPISERVERPATH"] = env.HAPISERVERPATH;
	} else {
		if (debug) console.log(ds() + "HAPISERVERPATH environment variable not found.");
	}
	if (env.HAPISERVERHOME) {
		if (debug) console.log(ds() + "Found HAPISERVERHOME environment variable. Using it.");
		configd["HAPISERVERHOME"] = env.HAPISERVERHOME;
	} else {
		if (debug) console.log(ds() + "HAPISERVERHOME environment variable not found.");		
	}
	if (env.NODEEXE) {
		if (debug) console.log(ds() + "Found NODEEXE environment variable. Using it.");
		configd["NODEEXE"] = env.NODEEXE;
	} else {
		if (debug) console.log(ds() + "NODEEXE environment variable not found.");			
	}
	if (env.PYTHONEXE) {
		if (debug) console.log(ds() + "Found PYTHONEXE environment variable. Using it.");
		configd["PYTHONEXE"] = env.PYTHONEXE;
	} else {
		if (debug) console.log(ds() + "PYTHONEXE environment variable not found.");			
	}

	if (configd["PYTHONEXE"] === "") {
		console.log(ds() + "Working python executable not found.");
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

function request(url, cb) {

	console.log(ds() + "Getting " + url);

	function process_(resp) {
		let data = '';

		// A chunk of data has been recieved.
		resp.on('data', (chunk) => {
			data += chunk;
		});
		resp.on('end', () => {
			console.log(ds() + "Got " + url);
			cb(null, data);		
		});
	}

	if (url.substring(0,5) === 'https') {
		https.get(url, process_).on("error", (err) => cb(err));
	} else {
		http.get(url, process_).on("error", (err) => cb(err));		
	}
}

//Type specifies the type of catalog (either "url", "command" or "file")
function getmetadata(str, type, exit_if_fail, cb) {

	function getinfo(caturl, catalog, cb) {

		getone(0);
		function getone(i) {
			if (i == catalog.length) {
				cb(null, catalog);
				return;
			}
			url = caturl.replace("hapi/catalog","hapi/info") + "?id=" + catalog[i].id;
			request(url, (e, data) => {
				if (e) {
					cb(e);
				} else {
					try {
						catalog[i].info = JSON.parse(data.toString());
					} catch (e) {
						console.log(ds() +  clc.red(str + " output is not JSON parse-able. Try https://jsonlint.com/."));
						cb(e);
					}
					getone(++i);
				}
			});
		}
	}

	str = replaceConfigVars(str);
	//Based on the type parameter, catalog shall be executed accordingly
	//Either type must be a "url" OR should be a catalog with substring matching 'http' inorder to be treated as a URL
	if ( (type === "url") || (type === "catalog" && str.substring(0, 4) === 'http') ) {
		request(str, (e, data) => {
			if (e) {
				console.log("Error getting " + str + ": " + e.message);
				exit_conditionally(exit_if_fail, e, cb);
			}
			jsonstr = data.toString();
			try {
				obj = JSON.parse(jsonstr);						
			} catch (e) {
				console.log(ds() +  clc.red(str + " output is not JSON parse-able. Try https://jsonlint.com/. Exiting."));
				exit_conditionally(exit_if_fail, e, cb);
			}
			if (/hapi\/catalog\/?$/.test(str)) {
				console.log(ds() +  "Catalog node in server configuration is a HAPI server. Getting info metadata for all server datasets.");
				getinfo(str, obj.catalog, (e, obj) => {
					if (e) {
						exit_conditionally(exit_if_fail, e, cb);
					} else {
						cb(e, obj);
					}
				});
			} else {
				cb(null, obj);
			}
		});
	} else {
		// Check if it is a valid file; if failure, assume it is a command. Reference Issue : https://github.com/hapi-server/server-nodejs/issues/24
		if( (type === "file") || (type === "catalog" && fileExistsSync(str.split(" ")[0])) ) {
			console.log(ds() + "It is not a command line command. Will treat as a file and attempt to read as JSON.");
			// Read info files
			console.log(ds() + "Reading " + str);
			fs.readFile(str, "utf8", (e, info) => {
				if (e) {
					console.log(ds() +  clc.red("Could not read " + str + ". Error message: " + e.message));
					exit_conditionally(exit_if_fail, e, cb);
				}	
				try {
					info = JSON.parse(info);
				} catch (e) {
					console.log(ds() +  clc.red(str + " is not JSON.parse-able. Try https://jsonlint.com/."));
					exit_conditionally(exit_if_fail, e, cb);
				}
				cb(null, info);
			});
		} else {
			//Finally assuming the string as command if the type is of command OR type is catalog.
			if( type === "command" || type === "catalog" ){
				str = str.trim();
				if (type === "catalog") {
					console.log(ds() + "command is not a file; executing " + str);
				}
				require('child_process').exec(str, {'maxBuffer': 100000000}, (e, info, stderr) => {
					if (e) {
						console.log(ds() + clc.red("Error"))
						console.log("  " + clc.red(e.message.replace(/\n$/,"").replace("\n","\n  ")));
						exit_conditionally(exit_if_fail, e, cb);
					} else {
						try {
							info = JSON.parse(info);
						} catch (e) {
							console.log(ds() +  clc.red(str + " output is not JSON parse-able. Try https://jsonlint.com/. Exiting."));
							exit_conditionally(exit_if_fail, e, cb);
						}
						cb(null, info);
					}
				});
			}
		}
	}
}

function updatemetadata(exit_if_fail, FORCE_START, json, cb) {


	let catalog = {"catalog": []};
	let catalogid = json["server"]["id"];

	metadata.cache[catalogid]['ids'] = [];
	metadata.cache[catalogid]['info'] = {};
	metadata.cache[catalogid]['info-raw'] = {};

	catalog.HAPI = json["HAPI"];
	catalog.status = json["status"];

	if ( json.catalog_file || json.catalog_url || json.catalog_command ) {
		var type = "";
		var catalogData = "";
		if ( (typeof(json.catalog_file) === 'string') || (typeof(json.catalog_url) === 'string') || (typeof(json.catalog_command) === 'string') ) {
		// Catalog node is a string, which is expected to be a file, command, or URL.
		// Get metadata puts their content into xcatalog.

			if( json.catalog_file ){
				type = "file";
				catalogData = json.catalog_file;
			} else if( json.catalog_url ){
				type = "url";
				catalogData = json.catalog_url;
			} else {
				type = "command";
				catalogData = json.catalog_command;
			}
			// Respective catalogData and type are passed as arguments to getmetadata
			getmetadata(catalogData, type, exit_if_fail, (e, xcatalog) => {
					if (e) {
						exit_conditionally(exit_if_fail, e, cb)
					} else {
						createcat(0, xcatalog);
					}
			});
	  	} 
	} else {
		// Catalog node is a JSON object.
		if ( json.catalog || json.catalog_inline ){
			if (json.catalog) {
				console.log(ds() + clc.yellow("Warning: catalog is deprecated. Use 'catalog_file', 'catalog_command' or 'catalog_url'."));

				if (typeof(json.catalog) === 'string') {
					// Catalog node is a string, which is expected to be a file, command, or URL.
					// Get metadata puts their content into xcatalog.
					getmetadata(json.catalog, "catalog", exit_if_fail, (e, xcatalog) => {
						if (e) {
							exit_conditionally(exit_if_fail, e, cb)
						} else {
							createcat(0, xcatalog);
						}
					});
				} else {
					console.log(ds() + clc.blue("Catalog is not a string."))
					createcat(0, json.catalog);
				}				
			} else {
				createcat(0, json.catalog_inline);
			}	
		}
	}

	function createcat(ds_num, xcatalog) {
		// Each element of xcatalog is a dataset

		// Resolve info nodes and checks catalog and info.

		let id = xcatalog[ds_num].id;

		metadata.cache[catalogid]['ids'].push(id);

		catalog.catalog[ds_num] = xcatalog[ds_num];

		if (typeof(xcatalog[ds_num].info) === 'string') {
			// Resolve info node.
			getmetadata(xcatalog[ds_num].info, "catalog", exit_if_fail, (e, info) => {
				if (e) {
					conosole.log("Update failed for " + xcatalog[i].info + ".");
					exit_conditionally(exit_if_fail, e, cb)
				} else {
					checkinfo(info, checkcat);
				}
			});
		} else {
			checkinfo(xcatalog[ds_num].info, checkcat);
		}

		function checkcat() {
			if (FORCE_START) {
				console.log(ds() + "Checking /catalog response metadata for " + catalogid);
			}
			//console.log(catalog)
			ishapi(catalog, json["HAPI"], 'catalog', FORCE_START);
			//console.log(catalog)
			metadata.cache[catalogid]['catalog'] = catalog;
			//console.log(catalog)
			cb();
		}

		function checkinfo(info, cb) {

			info = JSON.parse(JSON.stringify(info));
			delete catalog.catalog[ds_num].info;

			let ids = [];
			let tmp = {'info-raw': {}, 'info': {}};

			info.HAPI = json["HAPI"];
			info.status = json["status"];

			// Resolve JSON refs in info. 
			let info_resolved = resolve(info);

			ishapi(info_resolved, json["HAPI"], 'info', FORCE_START);		

			metadata.cache[catalogid]['info'][id] = info;
			metadata.cache[catalogid]['info-raw'][id] = info_resolved;

			if (ds_num < xcatalog.length - 1) {
				createcat(++ds_num, xcatalog);
			} else {
				cb();
			}
		}
	}
}

function metadata(catalog, part, id) {
	if (id) {
		return metadata.cache[catalog][part][id];
	} else {
		return metadata.cache[catalog][part];
	}
}
exports.metadata = metadata;

function prepmetadata(FILES, FORCE_START, VERIFIER, PLOTSERVER, cb) {	

	if (FILES.length == 0) {
		console.log(ds() + clc.green('Metadata preparation complete.'));
		cb();
		return;
	} 

	console.log(ds() + clc.green('Preparing metadata.'));

	let serverfile = FILES[0];

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
			let msg = file + " is not JSON parse-able. Try https://jsonlint.com/. Exiting.";
			console.log(ds() + clc.red(msg));
			console.log(ds() + clc.red(ex.message));
			process.exit(1);
		}
		return json;
	}

	// Catalog
	let json = readandparse(serverfile);

	if (!json.server) {
		console.log(ds() + clc.red(serverfile + " does not have a server node."));
		process.exit(1);		
	}
	if (!json.server.contact) {
			console.log(ds() + clc.red(serverfile + " must have a non-empty contact string in the server object."));
			process.exit(1);
	}
	if (!json.data.contact) {
			console.log(ds() + clc.red(serverfile + " must have a non-empty contact string in the data object."));
			process.exit(1);
	}

	if (!json["HAPI"]) {
		// TODO: Make this required and throw error if not given?
		json["HAPI"] = "2.0";
	}
	json["status"] = {"code": 1200, "message": "OK"};
	if (!json["server"]) {
		json["server"] = {};
	}
	if (!json["server"]["id"]) {
		json["server"]["id"] = path.parse(serverfile).name;
	}
	catalogid = json["server"]["id"];
	if (!json["server"]["prefix"]) {
		json["server"]["prefix"] = catalogid;
	}

	metadata.cache[catalogid] = {};
	metadata.cache[catalogid]["server"] = json["server"];

	// Landing page html
	let landingFile = "";
	let landingPath = "";
	if (json["server"]["landingFile"] && "string" === typeof(json["server"]["landingFile"])) {
		landingFile = replaceConfigVars(json["server"]["landingFile"]);
	}
	if (json["server"]["landingPath"] && "string" === typeof(json["server"]["landingPath"])) {
		landingPath = replaceConfigVars(json["server"]["landingPath"]);
	}
	if (landingFile === "" && landingPath === "") {
		console.log(ds() + "No landingFile or landingPath in " + serverfile.replace(ROOT, "") 
					+ ". Will use ./node_modules/hapi-server-ui/single.htm");
		landingFile = ROOT + "/node_modules/hapi-server-ui/single.htm";
		landingPath = ROOT + "/node_modules/hapi-server-ui/";
	}

	metadata.cache[catalogid]['landingFile'] = landingFile;
	metadata.cache[catalogid]['landingPath'] = landingPath;

	if (landingFile !== "") {
		if (!fs.existsSync(landingFile)) {
			let msg = ds() + clc.red("Did not find landing file: " + landingFile) + ". ";
			if (FORCE_START) {
				metadata.cache[catalogid]['landingFile'] = '';
				console.log(msg + "Will start server with no landing page b/c ignore=true.");
			} else {
				console.log(msg + "Exiting b/c ignore=false.");
				process.exit(1)
			}
		} 
	}

	// Capabilities
	var capabilitiesfile = ROOT + "/conf/capabilities.json";
	var capabilities = {};
	if (!fs.existsSync(capabilitiesfile)) {
		// Create response in case that capabilities.json file was removed.
		capabilities["outputFormats"] = ["csv","binary","json"];
		console.log(ds() + "Did not find " + capabilitiesfile.replace(ROOT,"") 
					+ ". Using " + capabilities["outputFormats"]);
	} else {
		capabilities = readandparse(capabilitiesfile);
	}
	capabilities["HAPI"]   = json["HAPI"];
	capabilities["status"] = json["status"];

	metadata.cache[catalogid]['capabilities'] = capabilities;

	// Sync function; will throw error or warning.
	ishapi(capabilities,json["HAPI"],'capabilities',FORCE_START);
	
	if (!json.data) {
		console.log(ds() +  clc.red(serverfile 
					+ " Does not have a 'data' node. Exiting."));
		process.exit(1);		
	}

	// Command line program information
	var formats = json.data.formats || "csv";
	var teststr = json.data.test || "";

	if (!json.data.file && !json.data.command && !json.data.url) {
		let msg = "A 'command', 'file', or 'url' must be specified in the 'data' node.";
		console.log(ds() + clc.red(msg));
		process.exit(1);
	}

	// TODO: Write schema for data node. As written,
	// if a command is specified, it will be used and file and url
	// will be ignored. Need to catch this error.

	if (json.data.file) {
		json.data.file = replaceConfigVars(json.data.file);
		if (!fs.existsSync(json.data.file)) {
			let msg = json.data.file + " referenced in " + catalogid + " not found.";
			console.log(ds() +  clc.red(msg));
			process.exit(1);
		}
	}

	if (json.data.command) {
		json.data.command = replaceConfigVars(json.data.command);
		if (json.data.testcommands !== undefined) {
			json.data.testcommands = replaceConfigVars(json.data.testcommands);
		}
	}

	metadata.cache[catalogid]['data'] = JSON.parse(JSON.stringify(json.data));
	if (metadata.cache[catalogid]['landingFile']) {
		metadata.cache[catalogid]['landingFile'] = 
								metadata.cache[catalogid]['landingFile']
									.replace("__CONTACT__",json.data.contact || "");
	}
	
	if (!formats.includes("json")) {
		// If data program does not produce JSON, see if
		// any multi-dimensional arrays and warn.
		for  (i in metadata.cache[catalogid]['info']) {
			for (var j = 0; j < metadata.cache[catalogid]['info'][i].parameters.length; j++) {
				if (metadata.cache[catalogid]['info'][i].parameters[j].size) {
					if (metadata.cache[catalogid]['info'][i].parameters[j].size.length > 1) {
						console.log(ds() + "Warning: " + i + "/" 
							+ metadata.cache[catalogid]['info'][i].parameters[j].name 
							+ " has size.length > 1 and data program does not produce JSON."
							+ " Server cannot produce JSON from CSV for this parameter.")
					}
				}
			}
		}
	}

	//If catalog is missing
	if ( !json.catalog && !json.catalog_file && !json.catalog_url && !json.catalog_command && !json.catalog_inline ) {
		console.log(ds() +  clc.red(serverfile 
					+ " does not have a 'catalog' object. Exiting."));
		process.exit(1);		
	}

	let update_seconds = json['server']['catalog-update'];
	if (update_seconds) {
		if (!Number.isInteger(update_seconds)) {
			console.log(ds() +  clc.red(serverfile 
						+ " has a non-integer value for server.catalog-update."));
			process.exit(1);			
		}
		if (update_seconds < 0) {
			console.log(ds() +  clc.red(serverfile 
						+ " has a negative value for server.catalog-update."));
			process.exit(1);			
		}
		console.log(ds() + "Updating " + catalogid + " every " 
					+ update_seconds + " seconds.")
		setInterval( () => {
				console.log(ds() + "Updating " + catalogid);
				updatemetadata(false, FORCE_START, json, (e) => {
					if (e) {
						console.log(ds() + "Failure in updating " 
									+ catalogid + ". Will use last version.");
						// TODO: Send email?
					} else {
						console.log(ds() + "Updated " + catalogid);
					}
				});
		}, update_seconds*1000);
	}

	console.log(ds() + "Start reading, parsing, and resolving metdata.");
	updatemetadata(true, FORCE_START, json, (err) => {
		if (json.data.testcommands !== undefined) {
			test.commands0(json.data.testcommands,catalogid,true);
		}
		console.log(ds() + "Finished reading, parsing, and resolving metadata in " + FILES[0]);
		FILES.shift();
		prepmetadata(FILES, FORCE_START, VERIFIER, PLOTSERVER, cb);
	})
}
exports.prepmetadata = prepmetadata;