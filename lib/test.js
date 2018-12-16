var clc = require('cli-color'); // Colorize command line output

// Date string for logging.
function ds() {return (new Date()).toISOString() + " [server] ";};

function commands(commandarr,catalog,force) {
	for (var i = 0;i < commandarr.length;i++) {
		teststr = commandarr[i].command;
		//console.log(teststr);
		console.log(ds() + "Running " + catalog + " test command " + i + ".");
		var out = require('child_process').execSync(teststr,{'stdio':['pipe','pipe','ignore']});		
		commandarr[i].testnumber = i;
		commandarr[i].catalog = catalog;
		testoutput(commandarr[i],out.toString());
	}
}
exports.commands = commands;

function urls(CATALOGS,PREFIXES,server,TEST) {

	var metadata = require('./metadata.js').metadata;
	var request  = require('request');

	function catalogfinished() {
		urls.running = urls.running - 1;
		if (TEST && urls.running == 0) {
			process.exit(0);
		}
	}

	if (!urls.running) {
		urls.running = 0;
	}

	notests = true;
	for (var i=0; i < CATALOGS.length; i++) {
		var d = metadata(CATALOGS[i],'data','json');
		if (d.testurls) {
			notests = false;
			urls.running = urls.running + 1;
			runtests(d.testurls, CATALOGS[i], PREFIXES[i], catalogfinished);
		}
	}
	if (TEST && notests == true) {
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
			testurl = testobj["url"].replace("${server}",server);
			testobj.catalog = catalog;
			console.log(ds() + "Running " + catalog + " test URL " + tn + " on " + testurl);
			request(testurl, function (error, response, body) {
				testoutput(testobj,body);
				testfinished();
			});		
		}
	}
}
exports.urls = urls;

function testoutput(testobj,body) {
	if (testobj.command) {
		type = "command";
	}
	if (testobj.url) {
		type = "URL";
	}	
	var tn = testobj.testnumber;
	if ("length" in testobj) {
		if (body.length != testobj["length"]) {
			msg = "body.length = " + body.length + " != " + testobj["length"];
			console.log(ds() +  clc.red(msg + " test in " + testobj.catalog + " failed on URL " + testurl + ". Output tested:"));
			console.log(body);
			console.log("Exiting.")
			process.exit(1);
		} else {
			console.log(ds() + testobj.catalog + " length test on " + type + " " + tn + " passed.");					
		}
	}
	if ("Nlines" in testobj) {
		nnl = body.split("\n").length - 1; // Number of newlines
		if (nnl != testobj["Nlines"]) {
			msg = "# of newlines (" + nnl + ") != " + testobj["Nlines"];
			console.log(ds() +  clc.red(msg + " test in " + testobj.catalog + " failed on URL " + testurl + ". Output tested:"));
			console.log(body);
			console.log("Exiting.")
			process.exit(1);
		} else {
			console.log(ds() + testobj.catalog + " # lines test on " + type + " " + tn + " passed.");					
		}
	}
}
