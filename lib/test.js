const http = require('http');
var clc = require('cli-color'); // Colorize command line output

// Date string for logging.
function ds() {return (new Date()).toISOString() + " [server] ";};

function commands(commandarr,catalog,force) {
	for (var i = 0;i < commandarr.length;i++) {
		command = commandarr[i].command;
		// TODO: Substitute paths.
		//console.log(teststr);
		console.log(ds() + "Running " + catalog + " test command " + i + ".");
		try {
			var out = require('child_process')
				.execSync(command,{'stdio':['pipe','pipe','pipe']});		
		} catch (ex) {
			console.log(ds() + "Could not execute command: " + command + ". Error: " + clc.red(ex.stderr.toString()));
			process.exit(1);
		}
		commandarr[i].testnumber = i;
		commandarr[i].catalog = catalog;
		//commandarr[i].command = command;
		//console.log(out.toString());
		testoutput(commandarr[i],out.toString());
	}
}
exports.commands = commands;

function urls(CATALOGS,PREFIXES,server,TEST) {
	var metadata = require('./metadata.js').metadata;

	function catalogfinished() {
		urls.running = urls.running - 1;
		if (TEST && urls.running == 0) {
			console.log("Exiting with status 0.");
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
		console.log("Exiting with status 0.");
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

function testoutput(testobj,body) {
	var tn = testobj.testnumber;
	if (testobj.command) {
		type = "command";
		teststr = "";
	}
	if (testobj.url) {
		type = "URL";
		teststr = " for test URL number " + tn;
	}
	if ("length" in testobj) {
		if (body.length != testobj["length"]) {
			msg = testobj.catalog + " test command " + tn + ": ";
			msg = body.length + " bytes found but expected " + testobj["length"] + teststr;
			console.log(ds() +  clc.red(msg + ". Output tested:"));
			process.stdout.write(body);
			console.log(clc.red("Exiting."));
			process.exit(1);
		} else {
			console.log(ds() + testobj.catalog + " length test on " + type + " " + tn + " passed.");					
		}
	}
	if ("Nlines" in testobj) {
		nnl = body.split("\n").length - 1; // Number of newlines
		if (nnl != testobj["Nlines"]) {
			msg = testobj.catalog + " test command " + tn + ": ";
			msg = nnl + " newlines found but expected " + testobj["Nlines"] + teststr;
			console.log(ds() +  clc.red(msg + ". Output tested:"));
			process.stdout.write(body);
			console.log(clc.red("Exiting."));
			process.exit(1);
		} else {
			console.log(ds() + testobj.catalog + " # lines test on " + type + " " + tn + " passed.");					
		}
	}
}
