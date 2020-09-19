var request = require("request");
var xml2js = require('xml2js');
const fs = require('fs');
const process = require('process');

var urlo = "https://sscweb.gsfc.nasa.gov/WS/sscr/2/observatories";
var cfile = "SSCWeb-catalog.json";

const force = false; // Force update even if last update was < 60 minutes.

let max_age = 3600; // max-age found in HTTP headers of urlo.
// TODO: The header should be saved and the value in the header should
// be used. If max_age changes, this code will be up-to-date.



SSCWeb2HAPI(
	function (err, catalog) {
		if (err) {
			console.error(err);
			process.exit(1);
		}

		console.log(JSON.stringify(catalog,null,4));
		//console.log(fs.readFileSync(cfile, 'utf8'));
		//process.exit(0);
	}
)

function getUrlo(cb) {
	//Fetches the urlo writes it to the cfile
	console.error("Getting " + urlo)
	request(urlo,
		function (error, response, body) {
			if (error) {
				if (fs.existsSync(cfile)) {
					console.error("Could not get " + urlo + ". Returning cached metadata.")
					cb(null, fs.readFileSync(cfile));
				} else {
					cb(Error("Could not get " + urlo + " and no cached metadata."));
				}
			}
			var parser = new xml2js.Parser();
			parser.parseString(body, function (err, jsonraw) {
				if (err) {
					cb(err);
				}

				//loading the catalog file
				fs.writeFileSync(cfile, JSON.stringify(jsonraw, null, 4));

				//triggering the callback
				makeHAPI(jsonraw, cb);
			})
		});
}

function SSCWeb2HAPI(cb) {

	// Returns HAPI catalog or throws error if it can't reach urlo
	// and no cached catalog is found. Only updates cached catalog
	// if it is older than max_age.
	var age = 0;
	// Look for cached catalog file
	if (fs.existsSync(cfile)) {
		age = new Date().getTime() - fs.statSync(cfile).mtime;
		age = age / (max_age * 1000);
		if (!force && age < 1) {
			// Cache file less than max_age
			//console.error("Returning cache file " + cfile + " because it is less than " + max_age + " seconds.")
			console.log(fs.readFileSync(cfile, 'utf8'));
			// TODO: Could pipe this.
		} else {
			// Save current version. Only archived by day.
			ymd = new Date().toISOString().substring(0, 10);
			cfilec = cfile.replace(/\.json/, "-" + ymd + ".json");
			if (!fs.existsSync(__dirname + "/old/")) {
				fs.mkdirSync(__dirname + "/old/")
			}
			// Later versions of nodejs (8+) have copyFileSync.
			fs
				.createReadStream(__dirname + "/" + cfile)
				.pipe(fs.createWriteStream(__dirname + "/old/" + cfilec))
				.on('finish', function () {
					getUrlo(cb);

				});
		}
	} else {
		//if there is no cached file
		getUrlo(cb);

	}

}
exports.SSCWeb2HAPI = SSCWeb2HAPI;

function makeHAPI(jsonraw, cb) {

	// If two requests to update at same time, only one will write
	// cache file.
	makeHAPI.writing = makeHAPI.writing || false;

	var params = fs.readFileSync("SSCWeb-parameters.txt").toString();
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
		catalog[i]["info"]["description"] = "Ephemeris data";
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

