const fs      = require('fs');
const process = require('process');
const request = require("request");
const xml2js  = require('xml2js');
const argv    = require('yargs')
                  .default
                    ({
                        'ltfloats': false,
                        'force': false
                    })
                  .option('ltfloats',{'type': 'boolean'})
                  .option('force',{'type': 'boolean'})
                  .argv;

let LTFLOATS = argv.ltfloats;
let FORCE    = argv.force; // Force update even if last update was < 60 minutes.

let max_age = 3600;     // max-age found in HTTP headers of urlo at one time.
// TODO: The header should be saved and the value in the header should
// be used. If max_age changes, this code will be up-to-date.

let cfile = "SSCWeb-catalog.json";
let pfile = "SSCWeb-parameters.txt";
if (LTFLOATS) {
  cfile = "SSCWeb-catalog-ltfloats.json";
  pfile = "SSCWeb-parameters-ltfloats.txt";
}

var urlo = "https://sscweb.gsfc.nasa.gov/WS/sscr/2/observatories";


SSCWeb2HAPI(function (err, catalog) {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(JSON.stringify(catalog,null,4));
});

function getUrlo(cb) {
	// Fetches urlo and writes it to cfile
	console.error("Getting " + urlo)
	request({uri: urlo, strictSSL: false, "timeout": 10000},
		function (error, response, body) {
			if (error || response.statusCode !== 200) {
				console.error(error);
				if (fs.existsSync(cfile)) {
					console.error("Could not get " + urlo + ". Returning cached metadata.")
					//cb(null, fs.readFileSync(cfile));
					console.log(fs.readFileSync(cfile, 'utf8'));
				} else {
					cb(Error("Could not get " + urlo + " and no cached metadata."));
				}
				return;
			}
			let parser = new xml2js.Parser();
			parser.parseString(body, function (err, jsonraw) {
				if (err) {cb(err);}
				fs.writeFileSync(cfile, JSON.stringify(jsonraw, null, 4));
				makeHAPI(jsonraw, cb);
			})
		});
}

function SSCWeb2HAPI (cb) {
	// Returns HAPI catalog or throws error if it can't reach urlo
	// and no cached catalog is found. Only updates cached catalog
	// if it is older than max_age.
	// Look for cached catalog file
	if (!fs.existsSync(cfile)) {
		// Get URL and write cfile file
		getUrlo(cb)
		return
	}
	let age = new Date().getTime() - fs.statSync(cfile).mtime
	age = age / (max_age * 1000)
	if (!FORCE && age < 1) {
		// Cache file less than max_age
		//console.error("Returning cache file " + cfile + " because it is less than " + max_age + " seconds.")
	  // Could pipe this.
		console.log(fs.readFileSync(cfile, 'utf8'));
		return
	}
	let ymd = new Date().toISOString().substring(0, 10)
	cfilec = cfile.replace(/\.json/, "-" + ymd + ".json")
	const oldDir = __dirname + "/old/"
	try {
		if (!fs.existsSync(oldDir)) {
   		fs.mkdirSync(oldDir)
			fs.copyFileSync(cfile, oldDir + "/" + cfilec)
		}
		const files = fs.readdirSync(oldDir)
		if (files.length) {
			files.sort()
			const last = files[files.length - 1]
			const lastSize = fs.statSync(oldDir + "/" + last).size
			const curSize = fs.statSync(cfile).size
			if (lastSize !== curSize) {
				// Change in size since last archived file. Write new archive file.
				fs.copyFileSync(cfile, oldDir + "/" + cfilec)
			}
		}
  	getUrlo(cb)
	} catch (e) {
  	getUrlo(cb)
	}
}
exports.SSCWeb2HAPI = SSCWeb2HAPI;

function makeHAPI(jsonraw, cb) {

	// If two requests to update at same time, only one will write
	// cache file.
	makeHAPI.writing = makeHAPI.writing || false;

	var params = fs.readFileSync(pfile).toString();
	params = params.replace(/\n\s*\n/g, '\n').replace(/\n$/, '').split(/\n/);
	var catalog = [];
	var obs = jsonraw.ObservatoryResponse.Observatory;
	for (var i = 0; i < obs.length; i++) {
		catalog[i] = {};
		catalog[i]["id"] = obs[i]["Id"][0];
		catalog[i]["title"] = obs[i]["Name"][0];
		catalog[i]["info"] = {};
		catalog[i]["info"]["startDate"] = obs[i]["StartTime"][0];
		catalog[i]["info"]["stopDate"] = obs[i]["EndTime"][0];
		catalog[i]["info"]["cadence"] = "PT" + obs[i]["Resolution"][0] + "S";
		catalog[i]["info"]["description"] = obs[i]["Name"][0] + " ephemeris";
		catalog[i]["info"]["resourceURL"] = "https://sscweb.gsfc.nasa.gov/";
		catalog[i]["info"]["parameters"] = [];
		for (var j = 0; j < params.length; j++) {
			paraminfo = params[j].split("\",");
			catalog[i]["info"]["parameters"][j] = {};
			catalog[i]["info"]["parameters"][j]["name"] = paraminfo[0].replace(/"/g, "");
			catalog[i]["info"]["parameters"][j]["description"] = paraminfo[2].replace(/"/g, "");
			catalog[i]["info"]["parameters"][j]["units"] = paraminfo[3].replace(/"/g, "") || "dimensionless";
			catalog[i]["info"]["parameters"][j]["fill"] = paraminfo[4].replace(/"/g, "") || null;

			var type = paraminfo[5].replace(/"/g, "");
			//console.log(catalog[i]["info"]["parameters"][j]["type"],type,parseInt(type.replace(/%|s/,"")));
		 
			//Trimming the leading white spaces before comparison
			type = type.trim();

			if (/f$/.test(type)) {
			  catalog[i]["info"]["parameters"][j]["type"] = "double";
		  }
		  if (/d$/.test(type)) {
			  catalog[i]["info"]["parameters"][j]["type"] = "integer";
		  }
		  if (/s$/.test(type)) {
			  let len = parseInt(type.replace(/%|s/,""));
			  catalog[i]["info"]["parameters"][j]["type"] = "string";
			  catalog[i]["info"]["parameters"][j]["length"] = len;
		  }

		}

		var Time = {
			"name": "Time",
			"type": "isotime",
			"units": "UTC",
			"fill": null,
			"length": 18
		};

		catalog[i]["info"]["parameters"].unshift(Time);

	}
	if (!makeHAPI.writing) {
		//console.error("Writing " + cfile)
		makeHAPI.writing = true;
		fs.writeFile(cfile, JSON.stringify(catalog, null, 4),
			function () {
				makeHAPI.writing = false;
				//console.error("Wrote " + cfile);
			})
	}
	cb(null, catalog);
}