const http = require('http');
const clc = require('chalk');

// Date string for logging.
function ds() {return (new Date()).toISOString() + " [test]   ";};

function commands(commandarr,catalog,exit_if_fail) {
	for (var i = 0;i < commandarr.length;i++) {
		command = commandarr[i].command;
		if (exit_if_fail) {
			console.log(ds() + "Running " + catalog + " test command " + i + ".");
		}
		try {
			var out = require('child_process')
				.execSync(command,{'stdio':['pipe','pipe','pipe']});		
		} catch (ex) {
			console.log(ds() + clc.red("Could not execute command: " + command + ". Error: " + clc.red(ex.stderr.toString())));			
			if (exit_if_fail) {
				process.exit(1);
			} else {
				return false;
			}
		}
		commandarr[i].testnumber = i;
		commandarr[i].catalog = catalog;
		return testoutput(commandarr[i], out.toString());
	}
}
exports.commands = commands;

function urls(CATALOGS, PREFIXES, server, TEST) {
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