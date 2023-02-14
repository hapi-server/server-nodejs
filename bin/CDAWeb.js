// Call the SPDF/CDAWeb API and respond with HAPI CSV.
const fs      = require('fs');
const request = require('request');
const moment  = require('moment');
const argv    = require('yargs')
                  .default
                    ({
                        'id': 'AC_H2_MFI',
                        'parameters': 'Magnitude',
                        'start': '2009-06-01T00:00:00.000000000Z',
                        'stop': '2009-06-01T00:00:01.000000000Z',
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

let ID          = argv.id;
let START       = moment(argv.start);
let STOP        = moment(argv.stop);
let MAX_DAYS    = argv.maxdays;
let MAX_SOCKETS = argv.maxsockets;
let DEBUG       = argv.debug;
let PARAMETERS  = argv.parameters.split(",");
let LTFLOATS    = argv.ltfloats;

let START_STR = START.utc().format('YYYYMMDDTHHmmss') + "Z";
let STOP_STR  = STOP.utc().format('YYYYMMDDTHHmmss') + "Z";

let base = "https://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets";
let url  = `${base}/${ID}/data/${START_STR},${STOP_STR}/${PARAMETERS}?format=json`;

makeRequest(url, extractURL);

function extractData(body) {
  body = body
          .toString()
          .split("\n")
          .map(function(line){
              if (line.search(/^[0-9]{2}-[0-9]{2}-[0-9]{4}/) != -1) {
                return line
                        .replace(/^([0-9]{2})-([0-9]{2})-([0-9]{4}) /,"$3-$2-$1T")
                        .replace(/\s+/g,",")
              } else {
                return "";
              }
          })
          .filter(function(s){ return s !== '' });
  console.log(body.join("\n"));
}

function extractURL(body) {
  console.log(JSON.stringify(JSON.parse(body), null, 4));
  return;

  let m = body.match("<Name>(.*?)</Name>");
  if (m[1] || m1.startsWith("http")) {
    makeRequest(m[1], extractData);    
  } else {
    console.error("Returned XML does not have URL to temporary file.");
    process.exit(0);
  }
}

function makeRequest(url, cb) {

  if (DEBUG) {
    console.log("Requesting: \n  " + url);
  }

  let opts =
              {
                url: url,
                strictSSL: false,
                gzip: true
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
        console.log("Finished request:\n  " + url);
      }
      cb(body);
  })
}
