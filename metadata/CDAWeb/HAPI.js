// Create a HAPI all.json catalog using HAPI /catalog
// and /info responses from https://cdaweb.gsfc.nasa.gov/hapi.

const fs      = require('fs');
const request = require("request");
const xml2js  = require('xml2js').parseString;
const argv    = require('yargs')
                  .default
                    ({
                      'idregex': '^AC_'
                    })
                  .argv;

let DATSET_ID_RE = new RegExp(argv.idregex);

// pool should be set outside of loop. See
// https://www.npmjs.com/package/request#requestoptions-callback
// Set max sockets to a single host.
let pool = {maxSockets: 3};  

let hapiurl = "https://cdaweb.gsfc.nasa.gov/hapi";
//let hapiurl = "https://cdaweb.gsfc.nasa.gov/registry/hdp/hapi/catalog";

if (!fs.existsSync('hapi')) {fs.mkdirSync('hapi')}

let CATALOG = {};

catalog();

function catalog(cb) {

  let fname = "hapi/catalog.json";

  if (fs.existsSync(fname)) {
    console.log("Reading: " + fname);
    let body = fs.readFileSync(fname, 'utf-8');
    finished(fname, body, true);
    return;
  }

  let url = hapiurl + "/catalog"
  let reqOpts = {uri: url};
  console.log("Requesting: " + url);
  request(reqOpts, function (err,res,body) {
    if (err) console.log(err);
    console.log("Received: " + url);
    finished(fname, body, false);
  });

  function finished(fname, body, fromCache) {

    body = JSON.parse(body);

    if (fromCache == false) {
      // TODO: Don't write if error.
      console.log("Writing: " + fname);
      fs.writeFileSync(fname, JSON.stringify(body, null, 2), 'utf-8');
      //console.log("Wrote:   " + fname);
    }    
    let ids = [];
    for (dataset of body['catalog']) {
      ids.push(dataset['id']);
    }

    let fnameIds = "hapi/ids-hapi.txt";
    console.log("Writing: " + fnameIds);
    fs.writeFileSync(fnameIds, ids.join("\n"));

    info(body['catalog']);
  }
}

function info(CATALOG) {

  let N = 0;
  for (ididx in CATALOG) {

    // ididx = datset id index
    let id = CATALOG[ididx]['id'];
    if (DATSET_ID_RE.test(id) == false) {
      CATALOG[ididx] = null;
      continue;
    }
    N = N + 1;

    let fname = "hapi/" + id + ".json";
    if (fs.existsSync(fname)) {

      console.log("Reading: " + fname);
      let body = fs.readFileSync(fname, 'utf-8');
      finished(fname, body, ididx, true)

    } else {
      getInfo(fname, id, ididx);
    }
  }

  function getInfo(fname, id, ididx) {
    let url = hapiurl + "/info?id="+id;
    let reqOpts = {uri: url, pool: pool};
    console.log("Requesting: " + url);
    request(reqOpts, function (err,res,body) {
      if (err) console.log(err);
      console.log("Received: " + url);
      finished(fname, body, ididx, false);
    });
  }

  function finished(fname, body, dsidx, fromCache) {
    if (!finished.N) {finished.N = 0}
    finished.N = finished.N + 1;

    body = JSON.parse(body);

    CATALOG[dsidx]['info'] = body;

    if (fromCache == false) {
      // TODO: Don't write if error.
      console.log("Writing: " + fname);
      fs.writeFileSync(fname, JSON.stringify(body, null, 2), 'utf-8');
    }

    if (finished.N == N) {
      // Remove nulled elements.
      CATALOG_FILTERED = CATALOG.filter(function (el) {return el != null;});
      let fname = "all-hapi.json";
      // TODO: Don't write if error.
      console.log("Writing: " + fname);
      fs.writeFileSync(fname, JSON.stringify(CATALOG_FILTERED, null, 2), 'utf-8');
    }
  }
}

