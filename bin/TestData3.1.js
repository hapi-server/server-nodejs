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

let array = ["A", "α", "☃", "👍"];

for (var i = startsec; i < stopsec; i++) {
    var record = "";

    record = (new Date(i*1000).toISOString());

    if (id === 'dataset2') {
        if (all || parameters.includes('vector')) {
            record = record 
                        + "," + Math.sin(Math.PI*(i-startsec)/600) 
                        + "," + Math.sin(Math.PI*(i-startsec-150)/600) 
                        + "," + Math.sin(Math.PI*(i-startsec-300)/600)
        }
    } else {
        if (all || parameters.includes('unicodescalar-1-byte (A)') 
                || parameters.includes('unicodescalar-1-byte')
                || parameters.includes('unicodescalar-1-byte-with-3-padding-nulls')) {
            record = record + ',A';
        }
        if (all || parameters.includes('unicodescalar-2-byte (α)')
                || parameters.includes('unicodescalar-2-byte')
                || parameters.includes('unicodescalar-2-byte-with-2-padding-nulls')) {
            record = record + ',α';
        }
        if (all || parameters.includes('unicodescalar-3-byte (☃)')
                || parameters.includes('unicodescalar-3-byte')
                || parameters.includes('unicodescalar-3-byte-with-1-padding-null')) {
            record = record + ',☃';
        }
        if (all || parameters.includes('unicodescalar-4-byte (👍)')
                || parameters.includes('unicodescalar-4-byte')) {
            record = record + ',👍';
        }
        if (all || parameters.includes('unicodescalar-1-4-byte')) {
            record = record + ',' + array[i % 4];
        }
        if (all || parameters.includes('unicodevector (A;α;☃;👍)')
                || parameters.includes('unicodevector')) {
            record = record + ',A,α,☃,👍';
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
            process.stdout.write(records + "\n");
        records = "";
        Nwrote  = (i-startsec);
    }
}
