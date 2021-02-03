var fs = require('fs');
var path = require('path');
var request = require('sync-request');
var fastXMLParser = require('fast-xml-parser');

var debug = false;			 // Log to stdout and file.
var logging = true;			 // Log to file.
var update = false;			 // Re-download metadata from CAIO.
var N = -1;					 // Number of IDs to process. -1 => all.
var skipFails = true;		 // Skip processing IDs found in failsFile.
var originalMetadata = true; // Store original metadata in x_original_metadata.

var logFile = path.join(__dirname, "CAIO2HAPI.log");
var failsFile = path.join(__dirname, 'CAIO2HAPI-fails.json');

var fields  = "SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE";
var options = "&RESOURCE_CLASS=DATASET&RETURN_TYPE=JSON&QUERY=(DATASET.IS_CEF='true')";
var baseurl = "https://csa.esac.esa.int/csa/aio/metadata-action?"

var url = baseurl + fields + options;

if (fs.existsSync(logFile)) {
	// TODO: Move to ./archive/logFile-YYYY-MM-DD.json.
	fs.unlinkSync(logFile);
}

datasets = catalog();
hapiCatalog = info(datasets);
console.log(JSON.stringify(hapiCatalog, null, 4));

var fname = path.join(__dirname, 'CAIO.json');
fs.writeFileSync(fname, JSON.stringify(hapiCatalog, null, 4));
log("Wrote " + fname);

function log(msg) {
	if (logging == false) return;

	msg = msg.replace(__dirname + "/", "");
	msg = (new Date()).toISOString() + " " + msg;
	if (debug) console.log(msg);
	fs.appendFileSync(logFile, msg + "\n", {'flags': 'a'});
}

function catalog() {

	var datasetsFile = path.join(__dirname, "datasets-CAIO.json");
	if (fs.existsSync(datasetsFile) && update == false) {

		log("Found " + datasetsFile + ". Not redownloading because update = false.");
		var json = fs.readFileSync(datasetsFile).toString();
		var datasetsCAIO = JSON.parse(json);
		return datasetsCAIO;
	}

	var response = request(url);
	var body = response.getBody();

	log("Writing " + datasetsFile);
	fs.writeFileSync(datasetsFile, body);
	log("Wrote " + datasetsFile);

	log("Converting URL response to HAPI catalog response JSON.")
	var datasetsCAIO = JSON.parse(body);

	var datasetsHAPI = [];
	for (ds in datasetsCAIO['data']) {
		dataset = {
			"id": datasetsCAIO['data'][ds]['DATASET.DATASET_ID'],
			"title": datasetsCAIO['data'][ds]['DATASET.TITLE'],
			"x_original_metadata": datasetsCAIO['data'][ds]
		}
		datasetsHAPI.push(dataset);
	}

	log("Writing datasets-HAPI.json");
	fs.writeFileSync(path.join(__dirname, "datasets-HAPI.json"),
					 JSON.stringify(datasetsHAPI, null, 4));
	log("Wrote datasets-HAPI.json");

	return datasetsCAIO;
}

function info(datasets) {

	datasets = datasets['data'];

	var infoObject = {};
	var infoArray = [];
	var failIDs = [];
	if (skipFails == true && fs.existsSync(failsFile)) {
		var failIDs = JSON.parse(fs.readFileSync(failsFile).toString());
		// TODO: Convert to object for faster look-up?
	}

	function createObject(ds, infoFile) {
		obj = {};
		obj['id'] = ds['DATASET.DATASET_ID'];
		obj['title'] = ds['DATASET.TITLE'];
		obj['start'] = ds['DATASET.START_DATE'];
		obj['stop'] = ds['DATASET.END_DATE'];
		obj['x_original_metadata'] = ds;
		obj['file'] = infoFile;
		return obj;
	}

	if (N == -1) {
		N = datasets.length;
	}

	var cmd = "";

	for (var i in datasets) {
		if (i == N) {
			break;
		}

		var id = datasets[i]['DATASET.DATASET_ID'];

		if (failIDs.includes(id)) {
			log("Skipping " + id + " because in " + failsFile + " and skipFails = true.");
			continue;
		}

		log("-".repeat(80));
		log("id = " + id + "; " + (i) + "/" + (N));
		var tmpdir = path.join(__dirname, 'tmp');
		var infoFile = path.join(tmpdir, id, id + ".CEF.XML");

		if (fs.existsSync(infoFile) && update == false) {
			log("Found " + infoFile + ". Not redownloading because update = false.");
			var obj = createObject(datasets[i], infoFile);
			var infoObj = infoResolve(obj);
			if (infoObj != null) {
				infoArray.push(infoObj);
			}
			continue;
		}

		if (!fs.existsSync(tmpdir)){
			fs.mkdirSync(tmpdir);
		}

		// Response tar file extracts to a directory with a generic name and  time stamp. Re-name 
		// so directory is the named 'id'. See
		// https://unix.stackexchange.com/questions/11018/how-to-choose-directory-name-during-untarring
		var tgzfile = "'"+ __dirname + "/tmp/" + id + ".tar.gz'";
		var url = "https://csa.esac.esa.int/csa/aio/product-action?RETRIEVALTYPE=HEADER&DATASET_ID=";
		var cmd = "cd " + tmpdir
					+ "; curl '" + url + id + "'" + " > " + tgzfile;
					+ "; mkdir -p " + id 
					+ "; tar zxvf " + tgzfile + " --strip-components 1 -C " + id;

		log("Executing:\n\t" + cmd);
		try {
			var child = require('child_process').spawnSync('sh', ['-c', cmd], {stdio: 'pipe'});
			log("Done.");
			if (child.status == 0) {
				var obj = createObject(datasets[i], infoFile);
				var infoObj = infoResolve(obj);
				if (infoObj !== null) {
					infoArray.push(infoObj);
				}
			} else {
				log('!!! Command returned status != 0.');
				failIDs.push(id);
			}
		} catch (ex) {
			log("!!! Could not execute:\n\t" + cmd);
			if (ex.stderr) {
				log(child.stderr);
				failIDs.push(id);
			}
		}
	}

	if (skipFails == false || !fs.existsSync(failsFile)) {
		fs.writeFileSync(failsFile, JSON.stringify(failIDs, null, 4));
		log("Wrote CAIO2HAPI-fails.json. " + failIDs.length + " failure(s).");
	}

	return infoArray;
}

function infoResolve(infoObj) {

	var file = infoObj.file;

	if (!fs.existsSync(file)) {
		log("!!! File not found: " + file);
		return null;
	}

	var outDir = path.join(__dirname, "meta");
	if (!fs.existsSync(outDir)){
		fs.mkdirSync(outDir);
	}

	var data = fs.readFileSync(file);

	var tmp = fastXMLParser.parse(data.toString());
	var meta = tmp.DATASETS.DATASET_METADATA;

	if (!meta.PARAMETERS) {
		log("!!!" + file + " does not have parameters.");
		return null;
	}

	var parameters = [];
	meta.PARAMETERS.PARAMETER.forEach(val => {
		var type = val.VALUE_TYPE === undefined ? "" : val.VALUE_TYPE.toString();
		if (type.toLowerCase() === "float") type = "double";
		if (type.toLowerCase() === "double") type = "double";
		if (type.toLowerCase() === "int") type = "integer";
		if (type.toLowerCase() === "char") type = "string";
		if (type.toLowerCase() === "iso_time") type = "isotime";
		if (type.toLowerCase() === "iso_time_range") type = "isotime";
		var paramObj = {
			name: val.PARAMETER_ID === undefined ? "" : val.PARAMETER_ID.toString(),
			description: val.FIELDNAM ===  undefined ? "" : val.FIELDNAM.toString(),
			units: val.UNITS === undefined ? "" : val.UNITS.toString(),
			fill: val.FILLVAL === undefined ? "" : val.FILLVAL.toString(),
			type: val.VALUE_TYPE === undefined ? "" : type,
			size: val.SIZES === undefined ? [1] : val.SIZES
		};
		if (Number.isInteger(paramObj['size'])) {
			paramObj['size'] = [paramObj['size']];
		}
		parameters.push(paramObj);
	});
	
	var TIME_RESOLUTION = "";
	if (meta.TIME_RESOLUTION) {
		// TODO: Are units always seconds?
		TIME_RESOLUTION = meta.TIME_RESOLUTION.toString() + "S";
	}

	infoObjResolved = {
		id: infoObj['id'],
		title: infoObj['title'],
		info: {
			startDate: infoObj['start'],
			stopDate: infoObj['stop'],
			cadence: "PT" + TIME_RESOLUTION,
			description: meta.DATASET_DESCRIPTION.toString().replace("\n","\\n"),
			resourceURL: infoObj['x_original_metadata']['details'],
			contact: meta.CONTACT_COORDINATES.toString(),
			parameters: parameters
		}
	}
	if (originalMetadata) {
		infoObjResolved['x_original_metadata'] = infoObj['x_original_metadata']['details'];
		infoObjResolved['info']['x_original_metadata'] = meta;
	}

	var outFile = path.basename(file.replace('.CEF.XML','.json'));
	outFile = path.join(outDir, outFile);
	
	var json = JSON.stringify(infoObjResolved, null, 4);

	log("Writing " + outFile);
	fs.writeFileSync(outFile, json);

	return infoObjResolved;
}