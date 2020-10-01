var argv = process.argv;
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

var startsec = Math.ceil(new Date(start).valueOf()/1000);
var stopsec  = Math.ceil(new Date(stop).valueOf()/1000);

var records = ""; // Number of records (lines)
var record  = ""; // A record with comma-separated fields (columns)
var Nwrote  = 0;  // Number of records flushed

// https://github.com/nodejs/node/issues/3524
// https://github.com/nodejs/node/issues/1741#issuecomment-190649817
process.stdout._handle.setBlocking(true);

for (var i = startsec; i < stopsec; i++) {
	var record = "";

	record = (new Date(i*1000).toISOString());
	if (all || parameters.includes('vector')) {
		record = record 
					+ "," + Math.sin(Math.PI*(i-startsec)/600) 
					+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
					+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
	}
	if (all || parameters.includes('vectorstring')) {
		record = record 
					+ ',"a,b,c","d,e,f","g,h,i"';
	}
	if (all || parameters.includes('vectormulti')) {
		record = record 
					+ "," + Math.sin(Math.PI*(i-startsec)/600) 
					+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
					+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
					+ "," + Math.sin(Math.PI*(i-startsec)/600) 
					+ "," + Math.sin(Math.PI*(i-startsec-150)/600) 
					+ "," + Math.sin(Math.PI*(i-startsec-300)/600)
	}
	if (all || parameters.includes('matrix')) {
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
		if (records.length > 0)
			console.log(records);
		records = "";
		Nwrote  = (i-startsec);
	}
}
