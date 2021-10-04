// Call the SSCWeb API and respond with HAPI CSV.
var fs      = require('fs');
var request = require('request');
var moment  = require('moment');
var argv    = require('yargs')
				.default
				({
					'id': '',
					'parameters': '',
					'start': '',
					'stop': ''
				})
				.argv;

var allparameters = false;
if (argv.parameters === true || argv.parameters === '') {
	allparameters = true;
} else {

	var PARAMETERS = argv.parameters.split(",");

	var timeonly = false;
	if (PARAMETERS.length == 1 && PARAMETERS[0] === 'Time') {
		var timeonly = true;
	}

	var json = JSON.parse(fs.readFileSync('metadata/SSCWeb/SSCWeb-catalog.json', 'utf8'));
	var parameters = json[0].info.parameters;
	if (PARAMETERS[0] !== "Time") {
		PARAMETERS.push("Time");
	}
	var pn = [];
	for (var i=0;i < parameters.length;i++) {
		if (PARAMETERS.includes(parameters[i].name)) {
			pn.push(i);
		}
	}
}

var SPCR = 'ace';
if (argv.id !== '') {
	SPCR = argv.id;
}
//console.log(SPCR);

var START_TIME = '2000+001+00:00:00';
if (argv.start !== '') {
	START_TIME = moment(argv.start).utc().format('YYYY+DDDD+HH:mm:ss');
}
var STOP_TIME = '2000+001+23:59:59';
if (argv.stop !== '') {
	var STOP_TIME = moment(argv.stop).utc().format('YYYY+DDDD+HH:mm:ss');
}

var url = 'https://sscweb.gsfc.nasa.gov/cgi-bin/Locator.cgi?&SPCR='+SPCR+'&'+SPCR+'_res=&START_TIME='+START_TIME+'&STOP_TIME='+STOP_TIME+'&RESOLUTION=1&TOD=7&TOD=8&J2000=7&J2000=8&GEO=7&GEO=8&GEO=6&GM=7&GM=8&GM=6&GSE=7&GSE=8&GSE=6&GSM=7&GSM=8&SM=7&SM=8&SM=6&REG_OPT=7&REG_OPT=8&REG_OPT=9&REG_OPT=10&OPT=1&OPT=2&OPT=6&OPT=7&OPT=3&OPT=4&OPT=5&OPT=12&TRC_GEON=3&TRC_GEON=4&TRC_GEON=5&TRC_GEOS=3&TRC_GEOS=4&TRC_GEOS=5&TRC_GMN=3&TRC_GMN=4&TRC_GMN=5&TRC_GMS=3&TRC_GMS=4&TRC_GMS=5&FILTER_DIST_UNITS=1&TOD_APPLY_FILTER=&TODX_MNMX=&TOD_XGT=&TOD_XLT=&TODY_MNMX=&TOD_YGT=&TOD_YLT=&TODZ_MNMX=&TOD_ZGT=&TOD_ZLT=&TODLAT_MNMX=&TOD_LATGT=&TOD_LATLT=&TODLON_MNMX=&TOD_LONGT=&TOD_LONLT=&TODLT_MNMX=&TOD_LTGT=&TOD_LTLT=&J2000_APPLY_FILTER=&J2000X_MNMX=&J2000_XGT=&J2000_XLT=&J2000Y_MNMX=&J2000_YGT=&J2000_YLT=&J2000Z_MNMX=&J2000_ZGT=&J2000_ZLT=&J2000LAT_MNMX=&J2000_LATGT=&J2000_LATLT=&J2000LON_MNMX=&J2000_LONGT=&J2000_LONLT=&J2000LT_MNMX=&J2000_LTGT=&J2000_LTLT=&GEO_APPLY_FILTER=&GEOX_MNMX=&GEO_XGT=&GEO_XLT=&GEOY_MNMX=&GEO_YGT=&GEO_YLT=&GEOZ_MNMX=&GEO_ZGT=&GEO_ZLT=&GEOLAT_MNMX=&GEO_LATGT=&GEO_LATLT=&GEOLON_MNMX=&GEO_LONGT=&GEO_LONLT=&GEOLT_MNMX=&GEO_LTGT=&GEO_LTLT=&GM_APPLY_FILTER=&GMX_MNMX=&GM_XGT=&GM_XLT=&GMY_MNMX=&GM_YGT=&GM_YLT=&GMZ_MNMX=&GM_ZGT=&GM_ZLT=&GMLAT_MNMX=&GM_LATGT=&GM_LATLT=&GMLON_MNMX=&GM_LONGT=&GM_LONLT=&GMLT_MNMX=&GM_LTGT=&GM_LTLT=&GSE_APPLY_FILTER=&GSEX_MNMX=&GSE_XGT=&GSE_XLT=&GSEY_MNMX=&GSE_YGT=&GSE_YLT=&GSEZ_MNMX=&GSE_ZGT=&GSE_ZLT=&GSELAT_MNMX=&GSE_LATGT=&GSE_LATLT=&GSELON_MNMX=&GSE_LONGT=&GSE_LONLT=&GSELT_MNMX=&GSE_LTGT=&GSE_LTLT=&GSM_APPLY_FILTER=&GSMX_MNMX=&GSM_XGT=&GSM_XLT=&GSMY_MNMX=&GSM_YGT=&GSM_YLT=&GSMZ_MNMX=&GSM_ZGT=&GSM_ZLT=&GSMLAT_MNMX=&GSM_LATGT=&GSM_LATLT=&GSMLON_MNMX=&GSM_LONGT=&GSM_LONLT=&GSMLT_MNMX=&GSM_LTGT=&GSM_LTLT=&SM_APPLY_FILTER=&SMX_MNMX=&SM_XGT=&SM_XLT=&SMY_MNMX=&SM_YGT=&SM_YLT=&SMZ_MNMX=&SM_ZGT=&SM_ZLT=&SMLAT_MNMX=&SM_LATGT=&SM_LATLT=&SMLON_MNMX=&SM_LONGT=&SM_LONLT=&SMLT_MNMX=&SM_LTGT=&SM_LTLT=&OTHER_FILTER_DIST_UNITS=1&RD_APPLY=&FS_APPLY=&NS_APPLY=&BS_APPLY=&MG_APPLY=&LV_APPLY=&IL_APPLY=&REG_FLTR_SWITCH=&SCR_APPLY=&SCR=&RTR_APPLY=&RTR=&BTR_APPLY=&NBTR=&SBTR=&EXTERNAL=3&EXT_T1989c=1&KP_LONG_89=4&INTERNAL=1&ALTITUDE=100&DAY=1&TIME=2&DISTANCE=1&DIST_DEC=10&DEG=1&DEG_DEC=4&DEG_DIR=1&OUTPUT_CDF=1&LINES_PAGE=1&RNG_FLTR_METHOD=&PREV_SECTION=TOS&SSC=LOCATOR_GENERAL&SUBMIT=Submit+query+and+wait+for+output&.cgifields=TRC_GEON&.cgifields=REG_OPT&.cgifields=TOD&.cgifields=GEO&.cgifields=TRC_GMS&.cgifields=OPT&.cgifields=GM&.cgifields=J2000&.cgifields=GSE&.cgifields=TRC_GMN&.cgifields=GSM&.cgifields=SM&.cgifields=TRC_GEOS';
//console.log(url)

request({url: url, strictSSL: false}, function (error, response, body) {
  if (error) {
  	console.log(error);
  	process.exit(1);  	
  }
  if (response && response.statusCode != 200) {
  	process.exit(1);
  }
  console.log(extractData(body));
});

function extractData(data) {
	
	// Input `data` string is output of web call (HTML page with data embedded)

	// Replace space or tab with comma
	// Create array (using split)
	// Iterate through lines
	// Keep lines that start with four digits
	// Make DOY zero padded and convert YYYY,DOY,HH:MM:SS to YYYY-DOYTHH:MM:SS
	// Convert array back to string and remove extra newlines that appear when line was not kept
	return data.toString()
			.replace(/N\/A/g,"1e31")
			.replace(/NA/g,"1e31")
			.replace(/-nan/g,"1e31")
			.replace(/nan/g,"1e31")
			.replace(/[ \t]+/g,',')
			.replace(/\0/g,'') // ASCII NULL is inserted before data lines starting with the second
			.split("\n")
			.map(function(line){
				if (line.search(/^[0-9]{4},[0-9]+,/) != -1) {
					line = line
							.replace(/^([0-9]{4}),([0-9]),/,"$1-00$2T")
							.replace(/^([0-9]{4}),([0-9][0-9]),/,"$1-0$2T")
							.replace(/^([0-9]{4}),([0-9][0-9][0-9]),/,"$1-$2T");
					if (allparameters) {return line;};
					linearr = line.split(",");
					var linenew = linearr[0] + "Z"; // Always return time
					if (timeonly) {return linenew;}
					for (var i = 1;i < pn.length;i++) {
						linenew = linenew + "," + linearr[pn[i]];
					}
					return linenew;
				}
				return "";
			})
			.filter(function(s){ return s !== '' })
			.slice(0,-1)
			.join("\n")
};
