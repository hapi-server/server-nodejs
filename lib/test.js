const http = require('http');
const clc = require('chalk');

// Date string for logging.
function ds() {return (new Date()).toISOString() + " [test]   ";};

function commands2(commandarr,catalog,exit_if_fail,i) {
	if (!i) {
		i = 0;
	}
	if (i == commandarr.length) {
		return;
	}

	commandarr[i]["catalog"] = catalog;
	commandarr[i]["testnumber"] = i;

	if (exit_if_fail) {
		console.log(ds() + "Running " + catalog + " test command " + i + ".");
	}
	let outstr = "";
	var child = require('child_process')
					.spawn('sh', ['-c', commandarr[i].command],
								 {"encoding": "buffer"});

	child.stderr.on('data', function (err) {
		console.log(ds()
					+ "Command line program error message: "
					+ clc.red(err.toString().trim()));
	});
	child.stdout.on('data', function (buffer) {
		outstr = outstr + buffer.toString();
	});
	child.on('close', function (code) {
		if (exit_if_fail) {
			console.log(ds() + "Finished " + catalog + " test command " + i + ".");
		}
		commands2(commandarr, catalog, exit_if_fail,++i);
	});
}
exports.commands2 = commands2;

var async = require('asyncawait/async');
var await = require('asyncawait/await');
const xspawn = require('cross-spawn');

var commands1 = async (function(commandarr,catalog,exit_if_fail) {
	for (var i = 0;i < commandarr.length;i++) {
		command = commandarr[i].command;
		if (exit_if_fail) {
			console.log(ds() + "Running " + catalog + " test command " + i + ".");
		}
		try {
         //Usage of execSync is avoided as it not supported in windows. Hence, made the exec command asynchronous.
		  var out = xspawn(command,{shell: true});;

		} catch (ex) {
			console.log(ds() + clc.red("Could not execute command: " + command + ". Error: " + clc.red(ex.stderr.toString())));
			if (exit_if_fail) {
				process.exit(1);
			} else {
				return false;
			}
		}

        out.on('close', (code) => {
       		console.log(out.toString());
        	var command_object = { testnumber:i, catalog: catalog };
          	return testoutput(command_object, out.toString());
		});
	}
})
exports.commands1 = commands1;

function commands0(commandarr,catalog,exit_if_fail) {
	for (var i = 0;i < commandarr.length;i++) {
		command = commandarr[i].command;
		if (exit_if_fail) {
			console.log(ds() + "Running " + catalog + " test command " + i + ".");
		}
		let child;
		try {
			child = require('child_process').spawnSync('sh', ['-c', command], {stdio: 'pipe'});
		} catch (ex) {
			console.log(ds() + clc.red("Could not execute command: " + command + "."));
			if (ex.stderr) {
				console.log(clc.red(ex.stderr.toString()));
			}
			if (exit_if_fail) {
				process.exit(1);
			} else {
				return false;
			}
		}
		if (child.status == 0) {
			commandarr[i].testnumber = i;
			commandarr[i].catalog = catalog;
			var status = testoutput(commandarr[i], child.stdout.toString(),exit_if_fail);
			return status;
		} else {
			console.log(ds() + clc.red("Command returned non-zero status: " + command + "."));
			console.log("\nstdout:\n" + child.stdout.toString());
			console.log("\nstderr:\n" + child.stderr.toString());
			console.log("Exiting.");
			process.exit(1);
		}

	}
}
exports.commands0 = commands0;

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
		testoutput(commandarr[i], out.toString(),exit_if_fail);
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