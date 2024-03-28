const fs        = require("fs");
const request   = require("request");
const waterfall = require('async-waterfall');

const stationsURL = 'http://supermag.jhuapl.edu/mag/lib/services/?service=stations&fmt=json';
const stationsFile = "SuperMAG-stations.json";

const yearlyURL  = 'http://supermag.jhuapl.edu/mag/lib/services/inventory.php?service=yearly&stations=';
const yearlyFile = "SuperMAG-yearly.json";

var stationsJSON;
var yearlyJSON;

var update = false;
if (!update) {
	if (fs.existsSync(stationsFile)) {
		stationsJSON = JSON.parse(fs.readFileSync(stationsFile));
	} else {
		update = true;
	}
	if (fs.existsSync(yearlyFile)) {
		yearlyJSON = JSON.parse(fs.readFileSync(yearlyFile));
	} else {
		update = true;
	}
}

if (update) {
	updatefiles(createCatalog);
} else {
	createCatalog();
}

function createCatalog() {
	var catalog = [];
	var k = 0;
	for (var i = 0; i < stationsJSON.length; i++) {
		//console.log(yearlyJSON[stationsJSON[i]['id']])
		var yearlyInfo = yearlyJSON[stationsJSON[i]['id']];
		if (yearlyInfo) {
			var keys = Object.keys(yearlyInfo).sort();
			var firstKey = keys[0];
			var lastKey = keys.reverse()[0];
			catalog[k] = {
				"id": stationsJSON[i]['id'],
				"info": 
					{
						"startDate": firstKey + "-01-01Z",
						"stopDate": lastKey + "-12-31Z",
						"cadence": "PT1M",
						"description": stationsJSON[i]['name'] 
								+ "; Geographic latitude: " + stationsJSON[i]['geolat'] 
								+ "; Geographic longitude: " + stationsJSON[i]['geolon']
								+ "; Operator(s): " + stationsJSON[i]['operator'].join(", "),
 						"resourceURL": "http://http://supermag.jhuapl.edu/",
						"parameters":
							[
								{ 
									"name": "Time",
									"type": "isotime",
									"units": "UTC",
									"fill": null,
									"length": 20
								},
								{ 
									"name": "B_N",
									"type": "double",
									"units": "nT",
									"fill": "999999",
									"description": "B North GEO"
								},
								{ 
									"name": "B_E",
									"type": "double",
									"units": "nT",
									"fill": "999999",
									"description": "B East GEO"
								},
								{ 
									"name": "B_Z",
									"type": "double",
									"units": "nT",
									"fill": "999999",
									"description": "B Vertical GEO"
								},
								{
									"name": "MLT",
									"type": "double",
									"units": "nT",
									"fill": "999999",
									"description": "Magnetic Local Time (0-24)"
								},
								{
									"name": "MLAT",
									"type": "double",
									"units": "nT",
									"fill": "999999",
									"description": "Magnetic Latitude"
								},
								{
									"name": "IGRF_Declination",
									"type": "double",
									"units": "nT",
									"fill": "999999",
									"description": "IGRF_Declination"
								},
								{
									"name": "SZA",
									"type": "double",
									"units": "nT",
									"fill": "999999",
									"description": "Solar Zenith Angle"
								}
							]
					}
			} 
			k = k + 1;
		} else {
			console.log('Station ' + stationsJSON[i]['id'] + ' found in SuperMAG-stations.json not found in SuperMAG-yearly.json.');
		}
	}
	//console.log(JSON.stringify(catalog, null, 4));
	fs.writeFileSync('SuperMAG-catalog.json',JSON.stringify(catalog, null, 4));
	console.log('Wrote SuperMAG-catalog.json');
}

function updatefiles(cb) {
	waterfall(
	[
	  function(callback){
		request(stationsURL, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				console.log("Downloaded " + response.request.uri.href);
				stationsJSON = JSON.parse(body);
				fs.writeFileSync(stationsFile,body);
				console.log("Wrote " + stationsFile);
			} else {
				console.log("Problem downloading " + response.request.uri.href);
			}
			callback();
		})
	  },
	  function(callback){
		request(yearlyURL, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				console.log("Downloaded " + response.request.uri.href);
				yearlyJSON = JSON.parse(body);
				fs.writeFileSync("SuperMAG-yearly.json",body);
				console.log("Wrote " + yearlyFile);
			} else {
				console.log("Problem downloading " + response.request.uri.href);
			}
			callback();
		})
	  }
	], function (err, result) { 
		console.log('File update complete.');
		cb();
	});
}