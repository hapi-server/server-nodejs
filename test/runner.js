const clc = require('chalk');
const test = require('../lib/test.js');

exports.run = run;
function run(testArray, testName) {

  console.log('_'.repeat(process.stdout.columns) + "\n");
	console.log(testName);
	console.log('_'.repeat(process.stdout.columns) + "\n");

	let pass = true;
	for (let i = 0;i < testArray.length; i++) {

		if (process.platform.startsWith("win")) {
			testArray[i].command = testArray[i].command.replace(/&/g,"^&");
		}

		let fails = 0; // Number of failures on a given test object
		let prefix = "Test " + (i+1) + "/" + (testArray.length) + ": ";
		process.stdout.write(clc.blue(prefix) + testArray[i]["command"] + "\n");
		let results = test.commands([testArray[i]], testName);

		// https://stackoverflow.com/a/15397506
		// Flatten results array.
		// Newer Javascript has flat() - can instead use results = results.flat();
		results = Array.prototype.concat.apply([], results);

		for (let j = 0; j < results.length; j++) {
			if (results[j].err) {
				if (results[j].msg != undefined) {
					console.log(clc.red.bold("\nError: ") + clc.red.bold(results[j].msg + "\n"));
				}
				fails = fails + 1;
			}
		}

		if (fails === 0) {
			console.log(clc.blue(prefix) + clc.green.bold("PASS") + "\n");
		} else {
			pass = false;
			console.log(clc.blue(prefix) + clc.red.bold("FAIL") + "\n");
		}
	}

	console.log('_'.repeat(process.stdout.columns));

	if (pass) {
		process.exit(0);
	} else {
		process.exit(1);
	}
}