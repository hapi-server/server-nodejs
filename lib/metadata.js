const fs    = require('fs');
const path  = require('path');
const os    = require("os");
const clc   = require('chalk');
const https = require('https');
const http  = require('http');
var commandExistsSync = require('command-exists').sync;

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
      if (obj.hasOwnProperty("$id")) {
        hashOfObjects[obj.$id] = obj;
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
  };

collectIds(obj);
return setReferences(obj);
}

function exit_conditionally(exit_if_fail, e, cb) {
	if (exit_if_fail) {
		process.exit(1);
	} else {
		cb(e);
	}
}

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

function getmetadata(str, exit_if_fail, cb) {

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
						console.log(ds() +  clc.red(str + " output is not JSON.parse-able. Try https://jsonlint.com/."));
						cb(e);
					}
					getone(++i);
				}
			});
		}
	}

	str = replaceConfigVars(str);
	if (str.substring(0, 4) === 'http') {
		request(str, (e, data) => {
			if (e) {
				console.log("Error getting " + str + ": " + e.message);
				exit_conditionally(exit_if_fail, e, cb);
			}
			jsonstr = data.toString();
			try {
				obj = JSON.parse(jsonstr);						
			} catch (e) {
				console.log(ds() +  clc.red(str + " output is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
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
		// Attempt to execute; if failure, assume it is a file.
		console.log(ds() + "Trying " + str + " as command line command.");
		if (commandExistsSync(str.split(" ")[0])) {
			console.log(ds() + "Executing " + str);
			require('child_process').exec(str, {'maxBuffer': 100000000}, (e, info, stderr) => {
				if (e) {
					console.log(ds() + clc.red("Error"))
					console.log("  " + clc.red(e.message.replace(/\n$/,"").replace("\n","\n  ")));
					exit_conditionally(exit_if_fail, e, cb);
				} else {
					try {
						info = JSON.parse(info);						
						cb(null, info);
					} catch (e) {
						console.log(ds() +  clc.red(str + " output is not JSON.parse-able. Try https://jsonlint.com/. Exiting."));
						exit_conditionally(exit_if_fail, e, cb);
					}
				}
			});
		} else {
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

	if (typeof(json.catalog) === 'string') {
		// Catalog node is a string, which is expected to be a file, command, or URL.
		// Get metadata puts their content into xcatalog.
		getmetadata(json.catalog, exit_if_fail, (e, xcatalog) => {
			if (e) {
				exit_conditionally(exit_if_fail, e, cb)
			} else {
				createcat(0, xcatalog);
			}
		});
	} else {
		// Catalog node is a JSON object.
		createcat(0, json.catalog);
	}

	function createcat(ds, xcatalog) {
		// Each element of xcatalog is a dataset

		// Resolve info nodes and checks catalog and info.

		let id = xcatalog[ds].id;

		metadata.cache[catalogid]['ids'].push(id);

		catalog.catalog[ds] = xcatalog[ds];
		if (typeof(xcatalog[ds].info) === 'string') {
			// Resolve info node.
			getmetadata(xcatalog[ds].info, exit_if_fail, (e, info) => {
				if (e) {
					conosole.log("Update failed for " + xcatalog[i].info + ".");
					exit_conditionally(exit_if_fail, e, cb)
				} else {
					checkinfo(info, checkcat);
				}
			});
		} else {
			checkinfo(xcatalog[ds].info, checkcat);
		}

		function checkcat() {
			if (FORCE_START) {
				console.log(ds() + "Checking /catalog response metadata for " + catalogid);
			}
			ishapi(catalog, json["HAPI"], 'catalog', FORCE_START);
			metadata.cache[catalogid]['catalog'] = catalog;
			cb();
		}

		function checkinfo(info, cb) {

			info = JSON.parse(JSON.stringify(info));
			delete catalog.catalog[ds].info;

			let ids = [];
			let tmp = {'info-raw': {}, 'info': {}};

			info.HAPI = json["HAPI"];
			info.status = json["status"];

			// Resolve JSON refs in info. 
			let info_resolved = resolve(info);

			ishapi(info_resolved, json["HAPI"], 'info', FORCE_START);		

			metadata.cache[catalogid]['info'][id] = info;
			metadata.cache[catalogid]['info-raw'][id] = info_resolved;

			if (i < xcatalog.length - 1) {
				createcat(++i, xcatalog);
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
	metadata.cache[catalogid]['landing'] = {};
	if (!json["server"]["landing"]) {
		var landingfile = ROOT + "/public/" + catalogid + ".htm";
	} else {
		var landingfile = json["server"]["landing"];
	}

	if (!fs.existsSync(landingfile)) {
		console.log(ds() + "Did not find " + landingfile.replace(ROOT,".") 
					+ ". Will use ./node_modules/hapi-server-ui/single.htm");
		landingfile = ROOT + "/node_modules/hapi-server-ui/single.htm";
	}
	if (!fs.existsSync(landingfile)) {
		console.log(ds() + "Did not find " + landingfile.replace(ROOT,".") 
					+ ". No landing page will be served.");
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
		if (json.data.testcommands) {
			json.data.testcommands = replaceConfigVars(json.data.testcommands);
			test.commands(json.data.testcommands,catalogid);
		}
	}

	metadata.cache[catalogid]['data'] = JSON.parse(JSON.stringify(json.data));
	metadata.cache[catalogid]['landing'] = 
							metadata.cache[catalogid]['landing']
								.replace("__CONTACT__",json.data.contact || "")
	
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

	if (!json.catalog) {
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
		console.log(ds() + "Finished reading, parsing, and resolving metdata.");

		FILES.shift();
		prepmetadata(FILES, FORCE_START, VERIFIER, PLOTSERVER, cb);
	})
}
exports.prepmetadata = prepmetadata;
