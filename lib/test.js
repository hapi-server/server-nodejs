const http = require('http');
const https = require('https');
const clc = require('chalk');

// Date string for logging.
function ds() {return (new Date()).toISOString() + " [test]   ";};

process.on('uncaughtException', function(err) {
	console.log(err.stack);
	process.exit(1);
});

function commands0(commandarr,catalog,exit_if_fail) {

	let results = [];
	var status = true;
	for (var i = 0;i < commandarr.length;i++) {
		command = commandarr[i].command;
		if (exit_if_fail) {
			console.log(ds() + "Running " + catalog + " test command " + i + ".");
			console.log(command)
		}
		let child;
		try {
			if (process.platform.startsWith("win")) {
				if (command.startsWith('"')) {
					command = '"' + command + '"';
				}
				child = require('child_process')
							.spawnSync('cmd.exe', 
								['/c', command],
								{"shell": true, stdio: 'pipe', encoding: "buffer"});
			} else {
				child = require('child_process').
							spawnSync('sh', ['-c', command], {stdio: 'pipe'});
			}
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
			results.push(testoutput(commandarr[i], child.stdout.toString(),exit_if_fail));
		} else {
			msg0 = "Command returned non-zero status: " + command + "."
			msg1 = "\nstdout:\n" + child.stdout.toString()
			msg2 = "\nstderr:\n" + child.stderr.toString()
			if (exit_if_fail) {
				console.log(ds() + clc.red(msg0));
				console.log(msg1);
				console.log(msg2);
				console.log("Exiting.");
				process.exit(1);
			} else {
				results.push({'err': true, 'msg': msg0 + "\n" + msg1 + "\n" + msg2});
			}
		}

	}
	return results;
}
exports.commands0 = commands0;

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
			
			if( testurl.indexOf("https") == 0 ) {
				//If HTTP server is started
				//This is needed to supress errors associated with self-signed SSL certificates. Can be removed if we are using CA certified SSL certificates.
				process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0
				https.get(testurl, (resp) => {
                processResponse(resp);

				})
			} else {
				//If HTTP server is started
				http.get(testurl, (resp) => {
				processResponse(resp);
				})

			}

            function processResponse(resp) {
	            let data = '';
	            resp.on('data', (chunk) => {data += chunk;});
	            resp.on('end', () => {
		           testoutput(testobj,data);
		           testfinished();
	            });
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
		let err = false;
		let msg = "";
		if (n1 != n2) {
			err = true;
			msg = testobj.catalog + " test command " + tn + ": ";
			msg = n1 + " " + s + " found but expected " + n2 + teststr;
			msg = msg + ".\nTest: " + (testobj.command || testobj.url);
			if (exit_if_fail) {
				console.log(ds() +  clc.red(msg + "\nTest output:"));
				process.stdout.write(body);
				console.log(clc.red("Exiting."));
				process.exit(1);
			}
		} else {
			if (exit_if_fail) {
				console.log(ds() + testobj.catalog + " " + s + " test on " + type + " " + tn + " passed.");					
			}
		}
		return {'test': s, 'expected': n1, 'got': n2, 'err': err, 'msg': msg};
	}

	let results = [];
	if ("Nbytes" in testobj) {
		retobj = compare(body.length,testobj.Nbytes,'bytes');
		results.push(retobj);
	}
	if ("Nlines" in testobj) {
		retobj = compare(body.split("\n").length - 1,testobj.Nlines,'lines');
		results.push(retobj);
	}
	if ("Ncommas" in testobj) {
		retobj = compare((body.match(/,/g) || []).length,testobj.Ncommas,'commas');
		results.push(retobj);
	}

	return results;
}