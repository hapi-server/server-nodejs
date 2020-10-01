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

scalarstrs = ["P/P","P/F","F/P","F/F"];
scalarcats = [0,1,2];

// https://github.com/nodejs/node/issues/3524
// https://github.com/nodejs/node/issues/1741#issuecomment-190649817
process.stdout._handle.setBlocking(true);

for (var i = startsec; i < stopsec; i++) {
	var record = "";
	var offset = 0;

	record = (new Date(i*1000).toISOString());
	if (all || parameters.includes('scalar')) {
		record = record + "," + Math.sin(Math.PI*i/600);
	}

	if (all || parameters.includes('spectra') || parameters.includes('spectra_time_dependent_bins')) {
		record = record + "," + 0; // f = 0 bin.
		for (var j = 1;j < 10;j++) {
			record = record + "," + 1/j;
		}
	}

	var frequency_ranges = [[0,2],[2,4],[4,6],[6,8],[8,10],[10,12],[12,14],[14,16],[16,18],[18,20]];

	if (all || parameters.includes('frequency_centers')) {
		offset = 0;
		if (parseInt(record[15]) % 2 == 0) {
			// Records with even-numbered minute
			offset = 10;
		}
		for (var k = 0;k < frequency_ranges.length;k++) {
			if (k == 0 && record[17] == "0" && record[18] == "2") {
				// first bin when second = 02.
				record = record + ",-1e31";	
			} else if (k == 1 && j == 1 && record[17] == "0" && record[18] == "5") {
				record = record + ",-1e31";	
			} else {
				record = record + "," + ((frequency_ranges[k][0]+frequency_ranges[k][1])/2.0 + offset);
			}
		}
	}

	if (all || parameters.includes('frequency_ranges')) {
		offset = 0;
		if (parseInt(record[15]) % 2 == 0) {
			// Records with even-numbered minute
			offset = 10;
		}
		for (var k = 0;k < frequency_ranges.length;k++) {
			for (var j = 0;j < 2;j++) {
				if (k == 0 && record[17] == "0" && record[18] == "2") {
					// first bin when second = 02.
					record = record + ",-1e31";	
				} else if (k == 1 && j == 1 && record[17] == "0" && record[18] == "5") {
					record = record + ",-1e31";	
				} else {
					record = record + "," + (frequency_ranges[k][j] + offset);
				}
			}
		}
	}

	var pitch_angle_ranges = [[0,22.5],[22.5,67.5],[67.5,90]];

	if (all || parameters.includes('pitch_angle_centers')) {
		offset = 0;
		if (parseInt(record[15]) % 2 == 0) {
			// Records with even-numbered minute
			offset = 10;
		}
		for (var k = 0;k < pitch_angle_ranges.length;k++) {
			if (k == 0 && record[17] == "0" && record[18] == "2") {
				// first bin when second = 02.
				record = record + ",-1e31";	
			} else if (k == 1 && j == 1 && record[17] == "0" && record[18] == "5") {
				record = record + ",-1e31";	
			} else {
				record = record + "," + ((pitch_angle_ranges[k][0]+pitch_angle_ranges[k][1])/2.0 + offset);
			}
		}
	}

	if (all || parameters.includes('pitch_angle_ranges')) {
		offset = 0;
		if (parseInt(record[15]) % 2 == 0) {
			// Records with even-numbered minute
			offset = 10;
		}
		for (var k = 0;k < pitch_angle_ranges.length;k++) {
			for (var j = 0;j < 2;j++) {
				if (k == 0 && record[17] == "0" && record[18] == "2") {
					// first bin when second = 02.
					record = record + ",-1e31";	
				} else if (k == 1 && j == 1 && record[17] == "0" && record[18] == "5") {
					record = record + ",-1e31";	
				} else {
					record = record + "," + (pitch_angle_ranges[k][j] + offset);
				}
			}
		}
	}

	if (all || parameters.includes('spectramulti') || parameters.includes('spectramulti_time_dependent_bins')) {
		for (var k = 0;k < 3;k++) {
			for (var j = 0;j < 10;j++) {
				record = record + "," + (k+j);
			}
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
