var argv = process.argv;
var id = "dataset1";
var parameters = "scalar";
var start = "1970-01-01T00:00:09Z";
var stop =  "1971-01-01T00:00:21Z";

// Number of records per write
// If this is too large, garbage collector does not get a chance
// to run and memory usage monotonically increases. See
// https://github.com/nodejs/node/issues/3524#issuecomment-151088049
// https://github.com/nodejs/node/issues/3524
// https://github.com/nodejs/node/issues/1741#issuecomment-190649817
let Npw = 1000; 

for (var i = 0; i < argv.length-1; i++) {
	if (argv[i] == "--id") {
		id = argv[i+1];
	}
	if (argv[i] === "--parameters") {
		parameters = argv[i+1];
		if (/--/.test(parameters)) {
			// Catch case of --parameters --start START ...
			parameters = "";
		}
	}
	if (argv[i] === "--start") {
		start = argv[i+1];
	}
	if (argv[i] === "--stop") {
		stop = argv[i+1];
	}
}

if (parameters.trim() === '') {
	// If --parameters with string following.
	var all = true;
	var parameters = [""];
} else {
	var all = false;
	var parameters = parameters.split(",");
}

var tf = 1000;
if (id === "dataset2") {
	tf = 1000*3600;
}
if (id === "dataset3") {
	tf = 1000*3600*24;
}

let startsec = Math.ceil(new Date(start).valueOf()/tf);
let stopsec  = Math.ceil(new Date(stop).valueOf()/tf);

scalarstrs = ["P/P","P/F","F/P","F/F"];
scalarcats = [0,1,2];

//process.stderr.write(startsec + " " + stopsec + "\n")
let _stopsec = startsec;

if (startsec > 9 && stopsec <= 20) {
	// No data, so done.
} else {
	nextwrite();	
}

function nextwrite() {
	if (startsec > stopsec) {
		return;
	}
	_stopsec = Math.min(stopsec, _stopsec + Npw);
	//process.stderr.write("Calling " + startsec + " " + _stopsec + "\n")
	process.stdout.write(loop(startsec, _stopsec), nextwrite);
	startsec = startsec + Npw;
}

function loop(startsec, stopsec) {

	var records = "";
	for (var i = startsec; i < stopsec; i++) {
		var record = "";

		if (i > 9 && i < 20) {
			continue;
		}

		record = (new Date(i*tf).toISOString());
		if (all || parameters.includes('scalar')) {
			record = record + "," + Math.sin(Math.PI*i/600);
		}

		if (all || parameters.includes('scalarint')) {
			record = record + "," + Math.round(tf*Math.sin(Math.PI*i/600));
		}
		if (all || parameters.includes('scalarstr')) {
			if (i === 5) {
				record = record + ","
			} else {
				record = record + "," + scalarstrs[(i-startsec) % scalarstrs.length];
			}
		}
		if (all || parameters.includes('scalarcats')) {
			record = record + "," + scalarcats[(i-startsec) % scalarcats.length];
		}
		if (all || parameters.includes('scalariso')) {
			if (i === 5) {
				record = record + ",0001-01-01T00:00:00Z"
			} else {
				record = record + "," + (new Date((i+1)*tf).toISOString()).slice(0,-5) + "Z";
			}
		}
		if (id === "dataset0") {
			if (all || parameters.includes('scalarmulti')) {
				record = record + "," + Math.sin(Math.PI*i/600);
			}
		}
		if (all || parameters.includes('vector')) {
			record = record 
						+ "," + Math.sin(Math.PI*(i)/600) 
						+ "," + Math.sin(Math.PI*(i-150)/600) 
						+ "," + Math.sin(Math.PI*(i-300)/600)
		}
		if (all || parameters.includes('vectorint')) {
			record = record 
						+ "," + Math.round(tf*Math.sin(Math.PI*i/600))
						+ "," + Math.round(tf*Math.sin(Math.PI*i/600))
						+ "," + Math.round(tf*Math.sin(Math.PI*i/600));
		}
		if (all || parameters.includes('vectorstr')) {
			record = record 
							+ "," + scalarstrs[(i) % scalarstrs.length]
							+ "," + scalarstrs[(i+1) % scalarstrs.length]
							+ "," + scalarstrs[(i+2) % scalarstrs.length];
		}
		if (all || parameters.includes('vectorcats')) {
			record = record 
						+ "," + scalarcats[(i)   % scalarcats.length]
						+ "," + scalarcats[(i+1) % scalarcats.length]
						+ "," + scalarcats[(i+2) % scalarcats.length];
		}
		if (all || parameters.includes('vectoriso')) {
			record = record 
						+ "," + (new Date((i+1)*tf).toISOString()).slice(0,-5) + "Z"
						+ "," + (new Date((i+2)*tf).toISOString()).slice(0,-5) + "Z"
						+ "," + (new Date((i+3)*tf).toISOString()).slice(0,-5) + "Z";
		}
		if (all || parameters.includes('vectormulti')) {
			record = record 
						+ "," + Math.sin(Math.PI*(i/600))
						+ "," + Math.sin(Math.PI*(i-150)/600)
						+ "," + Math.sin(Math.PI*(i-300)/600)
						+ "," + Math.sin(Math.PI*(i/600))
						+ "," + Math.sin(Math.PI*(i-150)/600) 
						+ "," + Math.sin(Math.PI*(i-300)/600)
		}
		if (all || parameters.includes('transform')) {
			for (var j = 0;j < 9;j++) {
				record = record + "," + (j);
			}
		}
		if (all || parameters.includes('transformmulti')) {
			for (var j = 0;j < 9;j++) {
				record = record + "," + (j);
			}
		}
		if (all || parameters.includes('spectra')) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 10;j++) {
				record = record + "," + 1/j;
			}
		}
		if (all || parameters.includes('spectranobins')) {
			for (var j = 0;j < 10;j++) {
				record = record + "," + j;
			}
		}
		if (all || parameters.includes('spectralarge')) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 100;j++) {
				record = record + "," + 1/j;
			}
		}
		if (all || parameters.includes('spectramulti')) {
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 10;j++) {
				record = record + "," + 1/j;
			}
			record = record + "," + 0; // f = 0 bin.
			for (var j = 1;j < 10;j++) {
				record = record + "," + 2/j;
			}
		}

		if (id === "dataset0") {
			record = record.replace(/,/g,", ");  // Make dataset0 use space after comma.
		}

		if (records) {
			records = records + "\n" + record;
		} else {
			records = record;
		}

	}
	if (records) {
		return records + "\n";
	} else {
		return "";
	}
}
