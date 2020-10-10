const http = require('http');
const https = require('https'); //To get the https requests
const clc = require('chalk');

//async-await is not supported by node v6. Hence explicitly imported.
var async = require('asyncawait/async');
var await = require('asyncawait/await');
const spawn = require('cross-spawn');


// Date string for logging.
function ds() {return (new Date()).toISOString() + " [test]   ";};


var commands = async (function(commandarr,catalog,exit_if_fail) {
	for (var i = 0;i < commandarr.length;i++) {
		command = commandarr[i].command;
		if (exit_if_fail) {
			console.log(ds() + "Running " + catalog + " test command " + i + ".");
		}
		try {
         //Usage of execSync is avoided as it not supported in windows. Hence, made the exec command asynchronous.
		  var out = spawn(command,{shell: true});;

		} catch (ex) {
			console.log(ds() + clc.red("Could not execute command: " + command + ". Error: " + clc.red(ex.stderr.toString())));
			if (exit_if_fail) {
				process.exit(1);
			} else {
				return false;
			}
		}

        out.on('close', (code) => {
        var command_object = { testnumber:i, catalog: catalog };
          return testoutput(command_object, out.toString());
})
	}
})


exports.commands = commands;

//Added a new parameter isHTTPS inorder to fetch the corresponding HTTP/HTTPS test url
function urls(CATALOGS, PREFIXES, server, TEST, isHTTPS) {
	var metadata = require('./metadata.js').metadata;

	function catalogfinished() {
		urls.running = urls.running - 1;
		if (TEST && urls.running == 0) {
			console.log(ds() + "Exiting with status 0.");
			process.exit(0);
		}
	}

	if (!urls.running) {
		urls.running = 0;
	}

	notests = true;
	for (var i=0; i < CATALOGS.length; i++) {
		var d = metadata(CATALOGS[i],'data');
		if (d.testurls) {
			notests = false;
			urls.running = urls.running + 1;
			runtests(d.testurls, CATALOGS[i], PREFIXES[i], catalogfinished);
		}
	}
	if (TEST && notests == true) {
		console.log(ds() + "Exiting with status 0.");
		process.exit(0);
	}

	function runtests(testarr, catalog, prefix, cb) {

		function testfinished() {
			runtests.running = runtests.running - 1;
			if (runtests.running == 0) {
				cb();
			}
		}

		if (!runtests.running) {
			runtests.running = 0;
		}

		for (j = 0; j < testarr.length; j++) {
			runtests.running = runtests.running + 1;
			testarr[j].testnumber = j;
			test(testarr[j], CATALOGS[i]);
		}

		function test(testobj, catalog) {
			var tn = testobj.testnumber;
			testurl = server + "/" + prefix + "/hapi/" + testobj["url"];
			testobj.testurl = testurl;
			testobj.catalog = catalog;
			console.log(ds() + "Running " + catalog + " test URL " + tn + " on " + testurl);

			if(isHTTPS!= undefined){  
//HTTPS server is triggered

//This will resolve the error/warning for using the Self Signed Certificates. This can be neglected when using CA certified SSL certificates.
				process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0  
		   https.get(testurl, (resp) => {
			   let data = '';

			   resp.on('data', (chunk) => {data += chunk;});

			   resp.on('end', () => {
				   testoutput(testobj,data);
				   testfinished();
			   });

		   })

		   } else {

		   http.get(testurl, (resp) => {
			   let data = '';

			   resp.on('data', (chunk) => {data += chunk;});

			   resp.on('end', () => {
				   testoutput(testobj,data);
				   testfinished();
			   });

		   })

		   }
		   
		}
	}
}
exports.urls = urls;

function testoutput(testobj, body, exit_if_fail) {

	var tn = testobj.testnumber;
	if (testobj.command) {
		type = "command";
		teststr = "";
	}
	if (testobj.url) {
		type = "URL";
		teststr = " for test URL number " + tn;
	}

	function compare(n1,n2,s) {
		if (n1 != n2) {
			msg = testobj.catalog + " test command " + tn + ": ";
			msg = n1 + " " + s + " found but expected " + n2 + teststr;
			msg = msg + ".\nTest: " + (testobj.command || testobj.url);
			console.log(ds() +  clc.red(msg + "\nTest output:"));
			process.stdout.write(body);
			if (exit_if_fail) {
				console.log(clc.red("Exiting."));
				process.exit(1);
			} else {
				return false;
			}
		} else {
			if (exit_if_fail) {
				console.log(ds() + testobj.catalog + " " + s + " test on " + type + " " + tn + " passed.");
			} else {
				return true;
			}
		}
	}

	let t = true;
	if ("Nbytes" in testobj) {
		t = t && compare(body.length,testobj.Nbytes,'bytes');
	}
	if ("Nlines" in testobj) {
		t = t && compare(body.split("\n").length - 1,testobj.Nlines,'lines');
	}
	if ("Ncommas" in testobj) {
		t = t && compare((body.match(/,/g) || []).length,testobj.Ncommas,'commas');
	}
	return t;
}
