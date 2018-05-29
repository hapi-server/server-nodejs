//var fs      = require('fs');
var request = require("request");
var xml2js  = require('xml2js');

const fs = require('fs-extra');

var urlo = "https://sscweb.sci.gsfc.nasa.gov/WS/sscr/2/observatories";
var cfile = "SSCWeb-info.json";

SSCWeb2HAPI(
	function (err,catalog) {
		if (err) {
			console.log(err);
		}
		console.log(catalog);
	}
)

function SSCWeb2HAPI(cb) {

	// Returns HAPI catalog or throws error if it can't reach urlo
	// and no cached catalog is found. Only updates cached catalog
	// if it is older than 24 hours.

	var age = 0;
	// Look for cached catalog file
	if (fs.existsSync(cfile)) {
		age = new Date().getTime() - fs.statSync(cfile).mtime;
		age = age/(86400*1000);
		if (age < 1) { 
			// Cache file less than one day old
			console.log("Returning cache file because it is less than one day old.")
			return fs.readFileSync(cfile);
		} else {
			// Save current version
			ymd = new Date().toISOString().substring(0,10);
			cfilec = cfile.replace(/\.json/,"-"+ymd+".json");
			fs.copySync(__dirname+"/"+cfile,__dirname+"/old/"+cfilec);
			console.error("Moved " + cfile + " to ./old/" + cfilec); 
		}
	}

	console.error("Getting " + urlo)
	request(urlo, 
		function (error, response, body) {
			if (error) {
				if (fs.existsSync(cfile)) {
					console.log("Could not get "+urlo+". Returning cached metadata.")
					cb(null,fs.readFileSync(cfile));
				} else {
					cb(Error ("Could not get "+urlo+" and no cached metadata."));
				}
			}
			var parser = new xml2js.Parser();
			parser.parseString(body, function (err, jsonraw) {
				if (err) {
					cb(err);
				}
				makeHAPI(jsonraw,cb);
			})
	})
}
exports.SSCWeb2HAPI = SSCWeb2HAPI;

function makeHAPI(jsonraw,cb) {

	// If two requests to update at same time, only one will write
	// cache file.
	makeHAPI.writing = makeHAPI.writing || false;

	var params = fs.readFileSync("SSCWeb-parameters.txt").toString();
	params = params.split(/\n/);

	var catalog = {}
	catalog["catalog"] = [];
	var obs = jsonraw.ObservatoryResponse.Observatory;
	for (var i = 0; i < obs.length; i++) {
		catalog["catalog"][i] = {};
		catalog["catalog"][i]["id"] = obs[i]["Id"][0];
		catalog["catalog"][i]["title"] = obs[i]["Name"][0];
		catalog["catalog"][i]["info"] = {};
		catalog["catalog"][i]["info"]["startDate"] = obs[i]["StartTime"][0];
		catalog["catalog"][i]["info"]["stopDate"] = obs[i]["EndTime"][0];
		catalog["catalog"][i]["info"]["cadence"] = "PT" + obs[i]["Resolution"][0] + "S";
		catalog["catalog"][i]["info"]["description"] = "Ephemeris data";
		catalog["catalog"][i]["info"]["resourceURL"] = "https://sscweb.sci.gsfc.nasa.gov/";
		catalog["catalog"][i]["info"]["parameters"] = [];
		for (var j = 0;j < params.length;j++) {
			paraminfo = params[j].split("\",");
			if (params[j] === '') {continue} // Skip blank lines
			catalog["catalog"][i]["info"]["parameters"][j] = {};
			catalog["catalog"][i]["info"]["parameters"][j]["name"] = paraminfo[0].replace(/"/g,"");
			catalog["catalog"][i]["info"]["parameters"][j]["description"] = paraminfo[2].replace(/"/g,"");
			catalog["catalog"][i]["info"]["parameters"][j]["units"] = paraminfo[3].replace(/"/g,"");
			catalog["catalog"][i]["info"]["parameters"][j]["fill"] = paraminfo[4].replace(/"/g,"");
			catalog["catalog"][i]["info"]["parameters"][j]["type"] = paraminfo[5].replace(/"/g,"");
			var type = paraminfo[5].replace(/"/g,"");
			console.log(paraminfo[0].replace(/"/g,"") + " " + type);
			if (/f$/.test(type)) {
				catalog["catalog"][i]["info"]["parameters"][j]["type"] = "double";
			}
			if (/d$/.test(type)) {
				catalog["catalog"][i]["info"]["parameters"][j]["type"] = "integer";
			}
			if (/s$/.test(type)) {
				catalog["catalog"][i]["info"]["parameters"][j]["type"] = "string";
				catalog["catalog"][i]["info"]["parameters"][j]["length"] = catalog["catalog"][i]["info"]["parameters"][j]["fill"].length;
			}
		}

		var Time =  { 
                        "name": "Time",
                        "type": "isotime",
                        "units": "UTC",
                        "fill": null,
                        "length": 18
                    };

		catalog["catalog"][i]["info"]["parameters"].unshift(Time);

	}
	if (!makeHAPI.writing) {
		console.error("Writing " + cfile)
		makeHAPI.writing = true;
		fs.writeFile(cfile,JSON.stringify(catalog,null,4), 
			function () {
				makeHAPI.writing = false;
				console.error("Wrote " + cfile);
		})
	}
	cb(null,catalog);
}