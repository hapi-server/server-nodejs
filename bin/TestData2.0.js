var argv = process.argv;
var id = "dataset2";
var parameters = "scalar";
var start = "1971-01-00T01:50:00Z";
var stop = "1972-08-03T06:50:00Z";

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

var startsec = Math.ceil(new Date(start).valueOf()/tf);
var stopsec  = Math.ceil(new Date(stop).valueOf()/tf);

var records = ""; // Number of records (lines)
var record  = ""; // A record with comma-separated fields (columns)
var Nwrote  = 0;  // Number of records flushed

scalarstrs = ["P/P","P/F","F/P","F/F"];
scalarcats = [0,1,2];

// https://github.com/nodejs/node/issues/3524
// https://github.com/nodejs/node/issues/1741#issuecomment-190649817
process.stdout._handle.setBlocking(true);

for (var i = startsec; i < stopsec; i++) {
	var record = "";

	record = (new Date(i*tf).toISOString());
	if (all || parameters.includes('scalar')) {
		record = record + "," + Math.sin(Math.PI*i/600);
	}
	if (all || parameters.includes('scalarint')) {
		record = record + "," + Math.round(tf*Math.sin(Math.PI*i/600));
	}
	if (all || parameters.includes('scalarstr')) {
		record = record + "," + scalarstrs[(i-startsec) % scalarstrs.length];
	}
	if (all || parameters.includes('scalarcats')) {
		record = record + "," + scalarcats[(i-startsec) % scalarcats.length];
	}
	if (all || parameters.includes('scalariso')) {
		record = record + "," + (new Date((i+1)*tf).toISOString()).slice(0,-5) + "Z";
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

	if (i > 9 && i < 20) {
		record = "";
	}

	if (records.length > 0) {
		if (record.length > 0)
			records = records + "\n" + record;
	} else {
		records = record;
	}

	// Flush to output at end and every 100 records (lines)
	var flush = (i == stopsec - 1) 
				|| (i > startsec && (i-startsec) % 100 === 0);

	if (flush) {
		if (id !== "dataset0") {
			if (records.length > 0)
				console.log(records); // Correct way.					
		} else {
			// Make time non-monotonic for dataset0.
			records = records.split("\n");
			var l = records.length-1;
			first = records[0];
			last = records[l];
			records[0] = last;
			records[l] = first;
			records = records.join("\n");
			if ((i == stopsec - 1) && parameters.includes('scalariso')) {
				// Omit newline at end of file for dataset0 if scalariso requested
				process.stdout.write(records);
			} else {
				// Add extra newline at end of file for dataset0 if scalariso not requested
				console.log(records + "\n");
			}
		}
		records = "";
		Nwrote  = (i-startsec);
	}
}
