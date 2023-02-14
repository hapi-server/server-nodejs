// Call the SPDF/SSCWeb API and respond with HAPI CSV.
// Adds ability to parallelize requests.
const fs      = require('fs');
const request = require('request');
const moment  = require('moment');
const argv    = require('yargs')
                  .default
                    ({
                        'id': 'active',
                        'parameters': '',
                        'start': '1990-01-01T00:00:00.000000000Z',
                        'stop': '1990-01-10T00:00:00.000000000Z',
                        'ltfloats': false,
                        'maxdays': 5,
                        'maxsockets': 2,
                        'debug': false,
                    })
                  .option('ltfloats',{'type': 'boolean'})
                  .option('maxdays',{'type': 'integer'})
                  .option('maxsockets',{'type': 'integer'})
                  .option('debug',{'type': 'boolean'})
                  .argv;

// https://stackoverflow.com/questions/51226163/how-can-i-hide-moment-errors-in-nodejs
moment.suppressDeprecationWarnings = true;  
if (!moment(argv.start).isValid()) {
  console.error("Error: Invalid start: " + argv.start);
  process.exit(1);
}
if (!moment(argv.stop).isValid()) {
  console.error("Error: Invalid stop: " + argv.stop);
  process.exit(1);
}
if (!Number.isInteger(argv.maxdays)) {
  console.error("Error: maxdays must be integer");
  process.exit(1);
}
if (!Number.isInteger(argv.maxsockets)) {
  console.error("Error: maxsockets must be integer");
  process.exit(1);
}

let SPCR        = argv.id;
let START       = moment(argv.start);
let STOP        = moment(argv.stop);
let MAX_DAYS    = argv.maxdays;
let MAX_SOCKETS = argv.maxsockets;
let DEBUG       = argv.debug;
let PARAMETERS  = argv.parameters.split(",");
let LTFLOATS    = argv.ltfloats;

let allparameters = false;
let timeonly = false;

let PARAMETER_NUMBERS = [];
if (argv.parameters === '') {
  allparameters = true;
} else {
  if (PARAMETERS.length == 1 && PARAMETERS[0] === 'Time') {
    timeonly = true;
  }

  let cfile = __dirname + '/../metadata/SSCWeb/SSCWeb-catalog.json';
  if (LTFLOATS) {
    cfile = __dirname + '/../metadata/SSCWeb/SSCWeb-catalog-ltfloats.json';
  }

  let json = JSON.parse(fs.readFileSync(cfile, 'utf8'));
  let parameters = json[0].info.parameters;
  if (PARAMETERS[0] !== "Time") {
    PARAMETERS.push("Time");
  }

  for (let i=0;i < parameters.length;i++) {
    if (PARAMETERS.includes(parameters[i].name)) {
      PARAMETER_NUMBERS.push(i);
    }
  }
}

makeRequestParallel(START.clone(), STOP.clone());

function makeRequestParallel(start, stop) {

  if (stop.diff(start,'days') > MAX_DAYS) {
    stop = start.clone().add(MAX_DAYS, 'days');
  }

  let urls = [];
  let starts = [];
  let stops = [];
  let pool = {maxSockets: MAX_SOCKETS};  
  // pool must be set outside of loop. See
  // https://www.npmjs.com/package/request#requestoptions-callback
  while (1) {

    let START_TIME = moment(start).utc().format('YYYY+DDDD+HH:mm:ss');
    let STOP_TIME = moment(stop).utc().format('YYYY+DDDD+HH:mm:ss');

    let url = 'https://sscweb.gsfc.nasa.gov/cgi-bin/Locator.cgi?&SPCR='+SPCR+'&'+SPCR+'_res=&START_TIME='+START_TIME+'&STOP_TIME='+STOP_TIME+'&RESOLUTION=1&TOD=7&TOD=8&J2000=7&J2000=8&GEO=7&GEO=8&GEO=6&GM=7&GM=8&GM=6&GSE=7&GSE=8&GSE=6&GSM=7&GSM=8&SM=7&SM=8&SM=6&REG_OPT=7&REG_OPT=8&REG_OPT=9&REG_OPT=10&OPT=1&OPT=2&OPT=6&OPT=7&OPT=3&OPT=4&OPT=5&OPT=12&TRC_GEON=3&TRC_GEON=4&TRC_GEON=5&TRC_GEOS=3&TRC_GEOS=4&TRC_GEOS=5&TRC_GMN=3&TRC_GMN=4&TRC_GMN=5&TRC_GMS=3&TRC_GMS=4&TRC_GMS=5&FILTER_DIST_UNITS=1&TOD_APPLY_FILTER=&TODX_MNMX=&TOD_XGT=&TOD_XLT=&TODY_MNMX=&TOD_YGT=&TOD_YLT=&TODZ_MNMX=&TOD_ZGT=&TOD_ZLT=&TODLAT_MNMX=&TOD_LATGT=&TOD_LATLT=&TODLON_MNMX=&TOD_LONGT=&TOD_LONLT=&TODLT_MNMX=&TOD_LTGT=&TOD_LTLT=&J2000_APPLY_FILTER=&J2000X_MNMX=&J2000_XGT=&J2000_XLT=&J2000Y_MNMX=&J2000_YGT=&J2000_YLT=&J2000Z_MNMX=&J2000_ZGT=&J2000_ZLT=&J2000LAT_MNMX=&J2000_LATGT=&J2000_LATLT=&J2000LON_MNMX=&J2000_LONGT=&J2000_LONLT=&J2000LT_MNMX=&J2000_LTGT=&J2000_LTLT=&GEO_APPLY_FILTER=&GEOX_MNMX=&GEO_XGT=&GEO_XLT=&GEOY_MNMX=&GEO_YGT=&GEO_YLT=&GEOZ_MNMX=&GEO_ZGT=&GEO_ZLT=&GEOLAT_MNMX=&GEO_LATGT=&GEO_LATLT=&GEOLON_MNMX=&GEO_LONGT=&GEO_LONLT=&GEOLT_MNMX=&GEO_LTGT=&GEO_LTLT=&GM_APPLY_FILTER=&GMX_MNMX=&GM_XGT=&GM_XLT=&GMY_MNMX=&GM_YGT=&GM_YLT=&GMZ_MNMX=&GM_ZGT=&GM_ZLT=&GMLAT_MNMX=&GM_LATGT=&GM_LATLT=&GMLON_MNMX=&GM_LONGT=&GM_LONLT=&GMLT_MNMX=&GM_LTGT=&GM_LTLT=&GSE_APPLY_FILTER=&GSEX_MNMX=&GSE_XGT=&GSE_XLT=&GSEY_MNMX=&GSE_YGT=&GSE_YLT=&GSEZ_MNMX=&GSE_ZGT=&GSE_ZLT=&GSELAT_MNMX=&GSE_LATGT=&GSE_LATLT=&GSELON_MNMX=&GSE_LONGT=&GSE_LONLT=&GSELT_MNMX=&GSE_LTGT=&GSE_LTLT=&GSM_APPLY_FILTER=&GSMX_MNMX=&GSM_XGT=&GSM_XLT=&GSMY_MNMX=&GSM_YGT=&GSM_YLT=&GSMZ_MNMX=&GSM_ZGT=&GSM_ZLT=&GSMLAT_MNMX=&GSM_LATGT=&GSM_LATLT=&GSMLON_MNMX=&GSM_LONGT=&GSM_LONLT=&GSMLT_MNMX=&GSM_LTGT=&GSM_LTLT=&SM_APPLY_FILTER=&SMX_MNMX=&SM_XGT=&SM_XLT=&SMY_MNMX=&SM_YGT=&SM_YLT=&SMZ_MNMX=&SM_ZGT=&SM_ZLT=&SMLAT_MNMX=&SM_LATGT=&SM_LATLT=&SMLON_MNMX=&SM_LONGT=&SM_LONLT=&SMLT_MNMX=&SM_LTGT=&SM_LTLT=&OTHER_FILTER_DIST_UNITS=1&RD_APPLY=&FS_APPLY=&NS_APPLY=&BS_APPLY=&MG_APPLY=&LV_APPLY=&IL_APPLY=&REG_FLTR_SWITCH=&SCR_APPLY=&SCR=&RTR_APPLY=&RTR=&BTR_APPLY=&NBTR=&SBTR=&EXTERNAL=3&EXT_T1989c=1&KP_LONG_89=4&INTERNAL=1&ALTITUDE=100&DAY=1&TIME=2&DISTANCE=1&DIST_DEC=10&DEG=1&DEG_DEC=4&DEG_DIR=1&OUTPUT_CDF=1&LINES_PAGE=1&RNG_FLTR_METHOD=&PREV_SECTION=TOS&SSC=LOCATOR_GENERAL&SUBMIT=Submit+query+and+wait+for+output&.cgifields=TRC_GEON&.cgifields=REG_OPT&.cgifields=TOD&.cgifields=GEO&.cgifields=TRC_GMS&.cgifields=OPT&.cgifields=GM&.cgifields=J2000&.cgifields=GSE&.cgifields=TRC_GMN&.cgifields=GSM&.cgifields=SM&.cgifields=TRC_GEOS';
    if (DEBUG) {
      console.log("start: " + start.toISOString());
      console.log("stop:  " + stop.toISOString());
    }
    urls.push(url);
    starts.push(start.clone());
    stops.push(stop.clone());
    if (stop.isSame(STOP)) {
      break;
    }
    start.add(MAX_DAYS,'days')
    stop.add(MAX_DAYS, 'days')
    if (stop.isAfter(STOP)) {
      stop = STOP;
    }
  }

  let cidx = 0;
  let chunks = [];
  for (url of urls) {
    chunks[cidx] = undefined;
    doRequest(cidx, url, starts[cidx], stops[cidx]);
    cidx = cidx + 1;
  }

  function finished(cidx, chunk) {
    chunks[cidx] = chunk;
    for (cidx = 0; cidx < chunks.length; cidx++) {
      if (chunks[cidx] === undefined) {
        if (DEBUG) {
          console.log(`-Chunk ${cidx} not finished.`);
        }
        break;
      } else if (chunks[cidx] === null) {
        if (DEBUG) {
          console.log(`-Chunk ${cidx} already dumped.`);
        }
        continue;
      } else {
        if (DEBUG) {
          console.log(`+Dumping chunk ${cidx}`);
        }
        if (DEBUG) {
          chunkArray = chunk.split("\n");
          console.log(chunkArray[0]);
          console.log(chunkArray[chunkArray.length-1]);
        }
        console.log(chunks[cidx]);
        chunks[cidx] = null;
      }
    }
  }

  function doRequest(cidx, url, start, stop) {

    if (DEBUG) {
      console.log(`Starting request ${cidx} ${start.toISOString()} to ${stop.toISOString()}`);
    }
    let opts =
                {
                  url: url,
                  strictSSL: false,
                  gzip: true,
                  pool: pool
                };

    request(opts,
      function (error, response, body) {
        if (error) {
          console.log(error);
          process.exit(1);    
        }
        if (response && response.statusCode != 200) {
          console.error("Non-200 HTTP status code: " + response.statusCode);
          process.exit(1);
        }
        if (DEBUG) {       
          console.log("Finished request " + cidx);
        }
        finished(cidx, extractData(body, stop));
    })
  }

}

function memorySummary(prefix) {
  let used = process.memoryUsage();
  let summary = ""
  for (let key in used) {
    summary += `${key} = ${(Math.round(used[key] / 1024 / 1024 * 100) / 100).toFixed(2)} MB `
  }
  console.log(prefix + summary);
}

function addParameters(recordArray) {

  if (!addParameters.ltIndices) {
    addParameters.ltIndices = []
    for (let i = 1; i < recordArray.length; i++) {
      if (recordArray[i].match(/[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/)) {
        addParameters.ltIndices.push(i);
      }
    }
    if (addParameters.ltIndices.length == 0) {
      console.error("Problem with computing local time variables as floats.");
      process.exit(1);
    }
    if (addParameters.ltIndices.length != 4) {
      console.error("Problem with computing local time variables as floats. New local time variable added to SPDF/SSCWeb API?");
      process.exit(1);
    }
  }

  if (DEBUG) {
    //console.log(recordArray[0]);
  }    

  for (i of addParameters.ltIndices) {
    let LTArray = recordArray[i].split(":");
    let LTFloat;
    if (LTArray[0] == '99' && LTArray[1] == '99' && LTArray[2] == '99') {
      LTFloat = '1e31';
    } else {
      LTFloat = parseFloat(LTArray[0])
              + parseFloat(LTArray[1])/60.0
              + parseFloat(LTArray[2]/3600.0);
      LTFloat = LTFloat.toFixed(15);
    }
    if (false && DEBUG) {
      LTArray.push(LTFloat);
      console.log(LTArray);
    }
    recordArray.push(LTFloat);
  }
  return recordArray;
}

function extractData(data,stop) {

  if (DEBUG) {
    memorySummary("Before extract: ");
    var parseStartTime = new Date();
  }

  // Input `data` string is output of web call (HTML page with data embedded)

  // Replace space or tab with comma
  // Create array (using split)
  // Iterate through lines
  // Keep lines that start with four digits
  // Make DOY zero padded and convert YYYY,DOY,HH:MM:SS to YYYY-DOYTHH:MM:SS
  // Convert array back to string and remove extra newlines that appear when line was not kept
  // Note: The N/A, NA, -nan, nan replacements could be moved into map callback function.
  data = data
          .toString()
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
                          .replace(/^([0-9]{4}),([0-9][0-9][0-9]),/,"$1-$2T")
                          .replace(/,\s*$/,"");
                  let lineArray = line.split(",");
                  let lineModified = lineArray[0] + "Z"; // Always return time
                  if (timeonly) {
                    return lineModified;
                  }
                  if (LTFLOATS) {
                    lineArray = addParameters(lineArray);
                  }
                  if (allparameters) {
                    lineArray[0] = lineArray[0] + "Z";
                    return lineArray.join(',');
                  }
                  for (var i = 1;i < PARAMETER_NUMBERS.length;i++) {
                    lineModified = lineModified + "," + lineArray[PARAMETER_NUMBERS[i]];
                  }
                  return lineModified;
              }
              return "";
          })
          .filter(function(s){ return s !== '' })

  if (data.length > 1) {
    // Moment throws warning for YYYY-DOY format
    // Convert last timestamp to ISO 8601
    let lastDateTime = data[data.length - 1].split(",")[0];
    let lastDate = lastDateTime.split("T")[0];
    let lastTime = lastDateTime.split("T")[1];
    lastDate = moment(lastDate,'YYYY-DDD').toISOString().split("T")[0];
    lastDateTime = moment(lastDate + "T" + lastTime);
    if (moment(lastDateTime).isSame(stop) || moment(lastDateTime).isAfter(stop)) {
      if (DEBUG) {
        console.log("Last stop: " + lastDateTime.toISOString());
        console.log("Requested: " + stop.toISOString());
        console.log("Removing last record.");
      }
      data = data.slice(0, -1);
    }
  }

  if (DEBUG) {
    data = data.join("\n");
    memorySummary("After extract:  ");
    let parseStopTime = new Date();
    // Parse time typically 1/100 request time.
    console.log("Parse time: " + (parseStopTime - parseStartTime) + " ms");
    return data;
  } else {
    return data.join("\n");
  }
}
