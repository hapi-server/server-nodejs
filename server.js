#!/usr/bin/env node

const compress   = require('compression');  // Express compression module
const moment     = require('moment');       // Time library http://moment.js

const express    = require('express');      // Client/server library
const app        = express();

const semver = require('semver');

// Object that contains all metadata
const metadata = require('./lib/metadata.js').metadata;

// Prepare metadata and store in metadata object
const prepmetadata = require('./lib/metadata.js').prepmetadata;

const executeCommand = require('./lib/executeCommand.js');

// Command line interface
const argv = require('./lib/cli.js').argv;

// Logging
const log = require('log');
log.logDir = argv.logdir;
log.logLevel = argv.loglevel;
log.info(`Relative path in log messages base dir`);
log.info(`  ${__dirname}`);

exceptions(); // Catch uncaught exceptions

// Get default configuration variables stored in ./conf/server.json
const config = require("./lib/conf.js").configVars(argv);
for (let key in config) {
  log.info(key + " = " + config[key]);
}

// Handle file patterns.
let files = require("./lib/expandglob.js").expandglob(argv.file);

// Populate metadata.cache array, which has elements of catalog objects.
// main() is callback.
prepmetadata(files, argv.ignore, argv.skipchecks, main);

function main() {

  if (0) {
    setInterval(() => {
      log.memory();
    }, 1000);
  }

  // Compress responses using gzip
  app.use(compress());

  // Serve static files in ./public/data (no directory listing provided)
  app.use("/data", express.static(__dirname + '/public/data'));

  let catalogs = [];
  let prefixes = [];
  let localAll = [];
  for (let key in metadata.cache) {
    let catalog = metadata.cache[key]['server']['id'];
    let prefix = metadata.cache[key]['server']['prefix'];
    let server = metadata(catalog,'server');
    let data = metadata(catalog,'data');
    localAll.push(`${prefix}/hapi,${catalog},${catalog},${server.contact},${data.contact}\n`);

    catalogs.push(catalog); 
    prefixes.push(prefix);

    apiInit(catalog, prefix);
  }

  // Handle uncaught errors in API request code.
  // Must be called after apiInit: https://stackoverflow.com/a/72680240
  app.use(errorHandler);

  const initRoot = require("./lib/initRoot.js");
  initRoot(app, argv, localAll, setHeaders, (err) => {
    if (err) {
      log.error(err, true);
    }
    // Start server
    const initServer = require("./lib/initServer.js");
    initServer(catalogs, prefixes, app, argv);
  });
}

function apiInit(CATALOG, PREFIX) {

  PREFIX = "/" + PREFIX;
  let PREFIXe = encodeURIComponent(PREFIX).replace("%2F","/");

  let capabilities = metadata(CATALOG,"capabilities");
  let hapiVersion = capabilities["HAPI"];

  log.info("Initializing endpoints for http://localhost:" + argv.port + PREFIX + "/hapi");

  // Serve static files in ./public/data (no directory listing provided)
  app.use(PREFIXe + "/data", express.static(__dirname + '/public/data'));

  app.get(PREFIXe + '/$', function (req, res) {
    res.header('Location', "hapi");
    res.status(302).send("");
  })

  app.get(PREFIXe + '$', function (req, res) {
    res.header('Location', PREFIXe + "/hapi");
    res.status(302).send("");
  })

  app.get(PREFIXe + '/hapi/$', function (req, res) {
    res.header('Location', "../hapi");
    // A 301 is more appropriate, but a relative URL is not allowed. 
    // Would need to obtain proxied URL in order to get the correct
    // absolute URL.
    res.status(302).send("");
  })

  // /hapi
  app.get(PREFIX + '/hapi', function (req, res) {

    res.on('finish', () => log.request(req));

    let landingHTML = metadata(CATALOG, "server", "landingHTML");
    let landingPath = metadata(CATALOG, "server", "landingPath");

    setHeaders(res, true);
    if (landingHTML !== "") {
      res.contentType('text/html');
      res.send(landingHTML);
      return;
    }
    if (landingPath !== "") {
      app.use(PREFIX + '/hapi', express.static(landingPath));
      return;
    }
    if (landingPath === "" && landingHTML === "") {
      // This will only occur if force=true; otherwise server will not start.
      res.status(404).send("Not found.");
    }
  });

  // /about
  app.get(PREFIXe + '/hapi/about', function (req, res) {

    res.on('finish', () => log.request(req));
    setHeaders(res, true);
    res.contentType("application/json");

    // Send error if query parameters given
    if (Object.keys(req.query).length > 0) {
      error(req, res, hapiVersion, 1401, "This endpoint takes no query string.");
      return;
    }
    const about = metadata(CATALOG,"about");
    if (about !== undefined) {
      res.send(metadata(CATALOG,"about"));
    } else {
      res.sendStatus(404);
    }
  })

  // /capabilities
  app.get(PREFIXe + '/hapi/capabilities', function (req, res) {

    res.on('finish', () => log.request(req));
    setHeaders(res, true);
    res.contentType("application/json");

    // Send error if query parameters given
    if (Object.keys(req.query).length > 0) {
      error(req, res, hapiVersion, 1401, "This endpoint takes no query string.");
      return;
    }

    res.send(metadata(CATALOG,"capabilities"));
  })

  // /catalog
  app.get(PREFIXe + '/hapi/catalog', function (req, res) {

    res.on('finish', () => log.request(req));
    setHeaders(res, true);
    res.contentType("application/json");

    if (semver.satisfies(hapiVersion + ".0", ">=3.2.0")) {
      if (Object.keys(req.query).length === 1) {
        if (req.query.depth) {
          if (!["all","dataset"].includes(req.query.depth)) {
            error(req, res, hapiVersion, 1412, "depth must be 'dataset' or 'all'");
            return;
          }
          if (req.query.depth === "all") {
            let json = metadata(CATALOG,"info");
            let firstDataset = Object.keys(json)[0];
            let all = {
              "HAPI": json[firstDataset]["HAPI"],
              "status": json[firstDataset]["status"],
              "catalog": []
            };
            for (let dataset in json) {
              let infoObj = JSON.parse(JSON.stringify(json[dataset]));
              delete infoObj["HAPI"];
              delete infoObj["status"];
              all["catalog"].push({"id": dataset, "info": infoObj});
            }
            res.send(JSON.stringify(all,null,2));
          } else {
            res.send(JSON.stringify(metadata(CATALOG,"catalog"),null,2));
          }
        } else {
          error(req, res, hapiVersion, 1401, "catalog takes one query parameter: 'depth'");
          return;
        }
      } else {
        res.send(JSON.stringify(metadata(CATALOG,"catalog"),null,2));
      }
    } else {
      // Send error if query parameters given
      if (Object.keys(req.query).length > 0) {
        error(req, res, hapiVersion, 1401, "This endpoint takes no query string.");
        return;
      }
      res.send(JSON.stringify(metadata(CATALOG,"catalog"),null,2));
    }
  })

  // /info
  app.get(PREFIXe + '/hapi/info', function (req, res) {

    res.on('finish', () => log.request(req));
    setHeaders(res, true);
    res.contentType("application/json");

    // Check query string and set defaults as needed.
    if (!queryCheck(req,res,hapiVersion,CATALOG,'info')) {
      return; // Error already sent, so return;
    }

    // Get subsetted info response based on requested parameters.
    // info() returns integer error code if error.
    // TODO: Reconsider this interface to info() -
    // infoCheck() is more consistent with other code.
    var header = info(req,res,CATALOG);
    if (typeof(header) === "number") {
      error(req, res, hapiVersion, 1407);
      return;
    } else {
      res.send(JSON.stringify(header,null,2));
      return;
    }
  })

  // /data
  app.get(PREFIXe + '/hapi/data', function (req, res) {

    res.on('finish', () => log.request(req));
    setHeaders(res, true);

    // Check query string and set defaults as needed.
    if (!queryCheck(req,res,hapiVersion,CATALOG,'data')) {
      return; // Error already sent, so return;
    }

    // Get subsetted /info response based on requested parameters.
    var header = info(req,res,CATALOG);
    if (typeof(header) === "number") {
      // One or more of the requested parameters are invalid.
      error(req, res, hapiVersion, 1407);
      return;
    }

    // Add non-standard elements in header used later in code.
    // TODO: Not tested under https.
    var proto = req.connection.encrypted ? 'https' : 'http';
    header["status"]["x_request"] = proto + "://" + req.headers.host + req.originalUrl;
    header["status"]["x_startDateRequested"] = req.query["time.min"] || req.query["start"];
    header["status"]["x_stopDateRequested"]  = req.query["time.max"] || req.query["stop"];
    header["status"]["x_parentDataset"]      = req.query["id"] || req.query["dataset"];

    // timeCheck() returns integer error code if error or true if no error.
    var timeOK = timeCheck(header)
    if (timeOK !== true) {
      error(req,res,hapiVersion,timeOK);
      return;
    }

    header["format"] = "csv"; // Set default format
    if (req.query["format"]) {
      if (!["csv","json","binary"].includes(req.query["format"])) {
        error(req, res, hapiVersion, 1409,
          "Allowed values of 'format' are csv, json, and binary.");
        return;
      }
      // Use requested format.
      header["format"] = req.query["format"];
    }

    if (req.query["include"]) {
      if (req.query["include"] !== "header") {
        error(req, res, hapiVersion, 1410,
          "Allowed value of 'include' is 'header'.");
        return;
      }
    }
    // If include was given, set include = true
    let include = req.query["include"] === "header";

    if (header["format"] === "csv")    {res.contentType("text/csv")}
    if (header["format"] === "binary") {res.contentType("application/octet-stream")}
    if (header["format"] === "json")   {res.contentType("application/json")}

    let start = req.query["time.min"] || req.query["start"];
    let stop = req.query["time.max"] || req.query["stop"];
    let fname = "dataset-"
                 + (req.query["id"] || req.query["dataset"])
                 + "_parameters-"
                 + req.query["parameters"]
                 + "_start-"
                 + start
                 + "_stop-"
                 + stop
                 + "." + header["format"];

   if (req.query["attach"] === "false") {
      // Allow non-standard "attach" query parameter for debugging.
      // Content-Type of 'text' will cause browser to display data
      // instead of triggering a download dialog.
      res.contentType("text");
    } else {
      res.setHeader("Content-Disposition", "attachment;filename=" + encodeURIComponent(fname));
    }

    // Send the data
    data(req,res,CATALOG,header,include);
  })

  // Anything that does not match
  // PREFIX + {/hapi,/hapi/capabilities,/hapi/info,/hapi/data,/hapi/about}
  app.get(PREFIXe + '/*', function (req, res) {
    res.on('finish', () => log.request(req));
    if (req.path.startsWith(PREFIXe + '/hapi/')) {
      let base = req.headers['x-forwarded-for'] || req.connection.remoteAddress
      let msg = "Invalid URL. See " + base + PREFIXe + "/hapi";
      error(req, res, hapiVersion, 1400, msg, req.originalUrl);
    } else {
      res.status(404).send("Not found");
    }
  })

  log.info("Initialized endpoints for http://localhost:" + argv.port + PREFIX + "/hapi");
}


function setHeaders(res, cors) {
  let packageJSON = require("./package.json");
  if (cors) {
    // CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  res.header("X-Powered-By",packageJSON.repository.url + " v" + packageJSON.version);
}


function info(req, res, catalog) {

  // Read parameter metadata.
  let infoType = 'info';
  if (req.query.resolve_references === "false") {
    infoType = 'info-raw';
  }
  let json = metadata(catalog,infoType,req.query.id || req.query.dataset);

  // Copy string metadata (b/c json will be modified).
  json = JSON.parse(JSON.stringify(json));

  // Create array of known parameter names
  let knownparams = [];
  for (let i = 0;i < json.parameters.length;i++) {
    knownparams[i] = json.parameters[i].name;
  }

  // Create array from comma-separated parameters in query
  let wantedparams = [];
  if (req.query.parameters) {
    wantedparams = req.query.parameters.split(",");
  } else {
    // If parameters field not in query string, default is all.
    wantedparams = knownparams;
  }

  // Remove repeated parameters from query
  wantedparams = Array.from(new Set(wantedparams));

  // Catches case where parameters= is given in query string.
  // Assume it means same as if no parameters field was given
  // (which means all parameters wanted).
  if (wantedparams.length == 0) {return json;}

  // Determine if any parameters requested are invalid
  let validparams   = []; let iv = 0;
  let invalidparams = []; let ii = 0;
  for (var i = 0;i < wantedparams.length;i++) {
    if (knownparams.includes(wantedparams[i])) {
      // TODO: Consider using objects if parameter lists are very long.
      validparams[iv] = wantedparams[i];
      iv++;
    } else {
      invalidparams[ii] = wantedparams[i];
      ii++;
    }
  }

  // Invalid parameter found
  if (validparams.length != wantedparams.length) {
    return 1401;
  }

  // Delete parameters from JSON response that were not requested
  for (let i = 1;i < knownparams.length;i++) {
    if (!wantedparams.includes(knownparams[i])) {
      delete json.parameters[i];
    }
  }

  // Remove nulls placed when array element is deleted
  json.parameters = json.parameters.filter(function (n) {return n != undefined});

  // Return JSON object
  return json;
}


function data(req, res, catalog, header, include) {

  // Extract command line command and replace placeholders.
  let dataConfig = metadata(catalog,'data');

  if (dataConfig.proxy) {
    // Not used
    let url = replacevars(dataConfig.proxy).replace(/\/$/,"") + req.originalUrl;
    log.info("Responding with proxy of " + url);
    let httpProxy = require('http-proxy');
    let proxy = httpProxy.createProxyServer({});
    proxy
      .on('end', function (res, socket, head) {
        log.info("Responded with proxy of " + url);
      })
      .on('error', function (err) {
        error(req, res, header["HAPI"], 1500, null,
              "Proxy " + url + " error: " + err);
      })
      .web(req, res, {target: dataConfig.proxy});
  } else {
    let com = buildcom(dataConfig, header, req);
    executeCommand(com, req, res, dataConfig.timeout, dataConfig.formats, header, include, (err) => {
      if (!err) {
        return;
      }
      let code = 1500;
      let msg = "Problem with the data server.";
      if (typeof(err) === "string") {
        code = parseInt(err.split(",")[0]);
        msg =  err.split(",")[1] || "";
      }
      if (dataConfig.contact) {
        msg += " Please send URL to " + dataConfig.contact + ".";
        error(req, res, header["HAPI"], code, msg.trim());
      } else {
        error(req, res, header["HAPI"], code, "Problem with the data server.");
      }
    });
  }

  function buildcom(d, header, req) {

    var start = normalizeTime(req.query["time.min"] || req.query["start"]);
    var stop = normalizeTime(req.query["time.max"] || req.query["stop"]);

    let com = "";

    if (d.file || d.url) {
      // Will always need to subset in this case
      // (unless request is for all variables over
      // full range of response, which is not addressed)
      //com = config.PYTHONEXE + " " + __dirname + "/lib/subset.py";
      com = '"' + config.NODEJSEXE + '" ' + __dirname + "/lib/subset.js";
      if (d.file) com = com + ' --file "' + replacevars(d.file) + '"';
      if (d.url)  com = com + ' --url "' + replacevars(d.url,false) + '"';
      com = com + " --start " + start;
      com = com + " --stop " + stop;
      let columns = columnsstr();
      if (columns !== "" && d.file && !/\$\{{1,2}parameters\}{1,2}/.test(d.file)) {
        com = com + " --columns " + columns;
      }
      if (columns !== "" && d.url && !/\$\{{1,2}parameters\}{1,2}/.test(d.url)) {
        com = com + " --columns " + columns;
      }
      //com = com + " --format " + header["format"];
    }

    if (d.command) {

      com = replacevars(d.command);

      let columns = columnsstr();

      var subsetcols = false;
      if (columns !== "") {
        subsetcols = true;
      }
      var subsettime = false;
      if (!/\$\{{1,2}start\}{1,2}/.test(d.command) && !/\$\{{1,2}stop\}{1,2}/.test(d.command)) {
        subsettime = true;
      }

      if (subsetcols || subsettime) {
        com = com
               + ' | "'
               + config.NODEJSEXE
               + '" "' + __dirname
               + '/lib/subset.js"';
        if (subsettime) {
          com = com + " --start " + start;
          com = com + " --stop " + stop;
        }
        if (subsetcols) {
          com = com + " --columns " + columns;
        }
      }
    }

    if (process.platform.startsWith("win")) {
      if (com.startsWith('"')) {
        com = '"' + com + '"';
      }
    } else {
      //com = "cpulimit -l 30 -q -- nice -n -20 " + com;
    }

    return com;
  }

  function columnsstr() {
    let fieldstr = "";

    if (req.query["parameters"] && !/\$\{{1,2}parameters\}{1,2}/.test(dataConfig.command)) {
      // If command does not contain ${parameters} or ${{parameters}}, assume CL program
      // always outputs all variables. Subset the output using subset.js.
      var params = req.query["parameters"].split(",");
      var headerfull = metadata(catalog,'info',req.query.id || req.query.dataset);
      if (params[0] !== headerfull.parameters[0].name) {
        // If time variable was not requested, add it
        // so first column is always output.
        params.unshift(headerfull.parameters[0].name);
      }

      var fields = {};
      var col = 1;
      var df = 0;

      // Generate comma separated list of columns to output, e.g.,
      // 1,2-4,7
      for (let i = 0;i < headerfull.parameters.length;i++) {
        df = prod(headerfull.parameters[i].size || [1]);
        if (df > 1) {
          fields[headerfull.parameters[i].name] = col + "-" + (col+df-1);
        } else {
          fields[headerfull.parameters[i].name] = col;
        }
        col = col + df;
      }
      for (let i = 0;i < params.length;i++) {
        fieldstr = fieldstr + fields[params[i]] + ",";
      }
      fieldstr = fieldstr.slice(0, -1); // Remove last comma.
    }
    return fieldstr;
  }

  function normalizeTime(timestr) {

    // Convert to YYYY-MM-DDTHH:MM:SS.FFFFFFFFFZ
    // (nanosecond precision). All command line programs
    // will be given this format.

    // Need to extract it here and then insert at end
    // because moment.utc(timestr).toISOString()
    // ignores sub-millisecond parts of time string.
    var re = new RegExp(/.*\.[0-9]{3}([0-9].*)Z/);
    var submilli = "000000";
    if (re.test(timestr)) {
      submilli = timestr.replace(/.*\.[0-9]{3}([0-9].*)Z$/,"$1");
      var pad = "0".repeat(6-submilli.length);
      submilli = submilli + pad;
    }

    if (/^[0-9]{4}Z$/.test(timestr)) {
      timestr = timestr.slice(0,-1) + "-01-01T00:00:00.000Z";
    }
    if (/^[0-9]{4}-[0-9]{2}Z$/.test(timestr)) {
      timestr = timestr.slice(0,-1) + "-01T00:00:00.000Z";
    }
    if (/^[0-9]{4}-[0-9]{3}Z$/.test(timestr)) {
      timestr = timestr.slice(0,-1) + "T00:00:00.000Z";
    }
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}Z$/.test(timestr)) {
      timestr = timestr.slice(0,-1) + "T00:00:00.000Z";
    }
    timestr = moment.utc(timestr).toISOString();
    timestr = timestr.slice(0,-1) + submilli + "Z";
    return timestr;
  }

  function replacevars(com, isURL) {

    let dataset = req.query["id"] || req.query["dataset"];

    // Double {{ }} means don't quote
    com = com.replace("${{id}}", dataset);
    com = com.replace("${{dataset}}", dataset);
    if (req.query["parameters"]) {
      com = com.replace("${{parameters}}",req.query["parameters"]);
    } else {
      com = com.replace("${{parameters}}",'');
    }

    let start = req.query["time.min"] || req.query["start"];
    let stop = req.query["time.max"] || req.query["stop"];
    // Times don't need to be quoted
    com = com.replace("${start}",normalizeTime(start));
    com = com.replace("${stop}",normalizeTime(stop));
    com = com.replace("${{start}}",normalizeTime(start));
    com = com.replace("${{stop}}",normalizeTime(stop));

    if (!isURL) {
      if (process.platform.startsWith("win")) {
        com = com.replace("${id}",'"' + dataset + '"');
        com = com.replace("${dataset}",'"' + dataset + '"');
      } else {
        com = com.replace("${id}","'" + dataset + "'");
        com = com.replace("${dataset}",'"' + dataset + '"');
      }
    }
    if (req.query["parameters"]) {
      if (process.platform.startsWith("win")) {
        if (isURL) {
          com = com.replace("${parameters}",'"' + req.query["parameters"] + '"');
        } else {
          com = com.replace("${parameters}",req.query["parameters"]);
        }
      } else {
        if (isURL === true) {
          com = com.replace("${parameters}",req.query["parameters"]);
        } else {
          com = com.replace("${parameters}","'" + req.query["parameters"] + "'");
        }
      }
    } else {
      com = com.replace("${parameters}",'""');
    }
    com = com.replace("${format}",header["format"]);
    return com;
  }
}


function prod(arr) {
  // Multiply all elements in array
  return arr.reduce(function(a,b){return a*b;})
}


function queryCheck(req, res, hapiVersion, catalog, type) {

  // Check query parameters for query of type='info' or 'data'
  // If invalid query parameter, send error and return false
  // If req.query.resolve_references === undefined, set to "true"

  let catalogObj = metadata(catalog,"catalog");

  // Check for required id or dataset parameter
  let dataset = req.query.id;
  let emsg = "A dataset id must be given.";
  if (parseInt(catalogObj.HAPI) >= 3) {
    dataset = dataset || req.query.dataset
    emsg = "A dataset must be given.";
  }
  if (!dataset) {
    error(req, res, hapiVersion, 1400, emsg);
    return false;
  }

  if (req.query.id && req.query.dataset) {
    error(req, res, hapiVersion, 1400, "Only one of 'id' and 'dataset' is allowed.");
    return false;
  }

  let ids = metadata(catalog,'ids');
  if (!ids.includes(dataset)) {
    error(req,res,hapiVersion,1406);
    return false;
  }

  if (type === 'info') {
    // Check if extra parameters given
    let allowed = ["id", "parameters", "resolve_references"];
    let emsg = "'id', 'parameters', and 'resolve_references' are the only valid query parameters."
    if (parseInt(catalogObj.HAPI) >= 3) {
      allowed.push('dataset');
      emsg = "'dataset' or 'id', 'parameters', and 'resolve_references' are the only valid query parameters."
    }
    for (var key in req.query) {
      if (!allowed.includes(key)) {
        error(req, res, hapiVersion, 1401, emsg);
        return false;
      }
    }
  } else {
    // Check if query parameters are all valid
    let allowed = [
      "id","parameters","time.min","time.max",
      "format","include","attach","resolve_references"
    ];
    if (parseInt(catalogObj.HAPI) >= 3) {
      allowed.push("dataset");
      allowed.push("start");
      allowed.push("stop");
    }

    for (let key in req.query) {
      if (!allowed.includes(key)) {
        error(req, res, hapiVersion, 1401,
              "The only allowed query parameters are " + allowed.join(", "));
        return false;
      }
    }

    if (!req.query["time.min"] && !req.query["start"]) {
      error(req,res,hapiVersion,1402);
      return;
    }
    if (!req.query["time.max"] && !req.query["start"]) {
      error(req,res,hapiVersion,1403);
      return;
    }
  }

  // Set default resolve_references to be true if not given
  if (req.query.resolve_references === undefined) {
    req.query.resolve_references = "true";
  }

  // If resolve_references given, check that it is "true" or "false".
  if (!["true","false"].includes(req.query.resolve_references)) {
    error(req, res, hapiVersion, 1411, "resolve_references must be 'true' or 'false'");
    return false;
  }

  return true;
}

function timeCheck(header) {

  const validHAPITime = require('hapi-server-verifier').is.HAPITime;

  // TODO: Handle less than milliseconds resolution.
  // TODO: If one of the times had Z and the other does not,
  // should warn that all time stamps are interpreted as Z.

  var times = [
    header["status"]["x_startDateRequested"],
    header["status"]["x_stopDateRequested"],
    header.startDate,header.stopDate
  ];

 for (let i = 0;i < times.length;i++) {
    // moment.js says YYYY-MM-DD and YYYY-DOY with no Z is
    // "... not in a recognized RFC2822 or ISO format. moment
    // construction falls back to js Date(), which is not reliable
    // across all browsers and versions."
    // But HAPI says it is valid.
    times[i] = times[i].replace(/Z$/,"");
    if (times[i].length == 8 || times[i].length == 10) {
      times[i] = times[i] + "T00:00:00.000";
    }
    // YYYY or YYYYZ is not valid ISO according to moment.js
    if (times[i].length == 4) {
      times[i] = times[i] + "-01-01T00:00:00.000";
    }
    // Make all times UTC
    times[i] = times[i] + "Z";
    times[i] = times[i].replace(/\.Z/,".0Z"); // moment.js says .Z is invalid.
  }

  var r = validHAPITime(times[0],header["HAPI"]);
  if (r.error) {
    return 1402;
  }
  r = validHAPITime(times[1],header["HAPI"]);
  if (r.error) {
    return 1403;
  }

  function leapshift(time) {
    var shift = 0;
    if (time.match(/^[0-9]{4}-[0-9]{3}/)) {
      if (time.match(/23:59:60/)) {
        time = time.replace(/:60/,":59");
        shift = 1000;
      }
    }
    if (time.match(/^[0-9]{4}-[0-9]{2}-/)) {
      if (time.match(/23:59:60/)) {
        time = time.replace(/:60/,":59");
        shift = 1000;
      }
    }
    return {'time':time,'shift':shift};
  }

  var timesms = [];
  for (let i = 0;i < 4;i++) {
    var shift = 0;
    if (!moment(times[0], moment.ISO_8601).isValid()) {
      // Change 60th second to 59.
      var obj = leapshift(times[0]);
      if (obj.shift > 0) { // Error was due to leap second.
        times[0] = obj.time;
        shift = obj.shift;
      } else {
        return 1500; // Unexpected error.
      }
    }
    timesms[i] = moment(times[i]).valueOf() + shift;
  }

  if (timesms[1] <= timesms[0]) { // Stop requested <= start requested
    return 1404;
  }
  if (timesms[0] < timesms[2]) { // Start requested < start available
    return 1405;
  }
  if (timesms[1] > timesms[3]) { // Stop requested > stop available
    return 1405;
  }

  return true;
}

// HAPI errors
function error(req, res, hapiVersion, code, message, messageFull) {

  let start = "time.min";
  let stop  = "time.max";
  let dataset = "id";

  if (parseInt(hapiVersion) >= 3) {
    start = req.query['start'] ? 'start' : start;
    stop = req.query['stop'] ? 'stop': stop;
    dataset = req.query['dataset'] ? 'dataset': dataset;
  }

  var errs = {
    "1400": {status: 400, "message": "HAPI error 1400: user input error"},
    "1401": {status: 400, "message": "HAPI error 1401: unknown request field"},
    "1402": {status: 400, "message": "HAPI error 1402: error in " + start},
    "1403": {status: 400, "message": "HAPI error 1403: error in " + stop},
    "1404": {status: 400, "message": "HAPI error 1404: " + start + " equal to or after " + stop},
    "1405": {status: 400, "message": "HAPI error 1405: time outside valid range"},
    "1406": {status: 404, "message": "HAPI error 1406: unknown " + dataset},
    "1407": {status: 404, "message": "HAPI error 1407: unknown dataset parameter"},
    "1408": {status: 400, "message": "HAPI error 1408: too much time or data requested"},
    "1409": {status: 400, "message": "HAPI error 1409: unsupported output format"},
    "1410": {status: 400, "message": "HAPI error 1410: unsupported include value"},
    "1411": {status: 400, "message": "HAPI error 1411: unsupported resolve_references value"},
    "1412": {status: 400, "message": "HAPI error 1412: unsupported depth value"},
    "1500": {status: 500, "message": "HAPI error 1500: internal server error"},
    "1501": {status: 500, "message": "HAPI error 1501: upstream request error"}
  }

  // Defaults
  var json = {
                "HAPI" : hapiVersion,
                "status": {"code": 1500, "message": "Internal server error"}
              };
  var httpcode = 500;
  var httpmesg = "Internal server error. Please report URL attempted to the "
                + " <a href='https://github.com/hapi-server/server-nodejs/issues'>issue tracker</a>.";

  // Modify defaults
  if (errs[code+""]) {
    json["status"]["code"] = code;
    json["status"]["message"]  = errs[code+""]["message"];
    httpcode = errs[code+""]["status"];
    httpmesg = errs[code+""]["message"];
  }
  if (message) {
    json["status"]["message"] = json["status"]["message"].replace(/\:.*/,": " + message);
  }

  let ecode = httpcode + "/" + json["status"]["code"];
  messageFull = messageFull || message;
  if ((code+"").startsWith("15")) {
    log.error("HTTP/HAPI error " + ecode + "; " + messageFull);
  }

  res.on('finish', () => log.request(req));

  if (res.headersSent) {
    log.error("HTTP headers were already sent. Not setting status code, but appending JSON error message.");
    res.write(JSON.stringify(json, null, 4) + "\n");
    res.end();
  } else {
    res.contentType("application/json");
    res.statusMessage = httpmesg;
    log.error("Sending JSON error message.");
    res.status(httpcode).send(JSON.stringify(json, null, 4) + "\n");
  }

  let addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  let msg = "Responded with " + ecode + " to " + addr + ": " + req.originalUrl;
  log.info(msg);
}

// Uncaught errors in API request code.
function errorHandler(err, req, res, next) {
  let addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  let msg = "Request from " + addr + ": " + req.originalUrl + "\n" + err.stack;
  error(req, res, "", "1500", null, msg);
}

// Errors in non-API part of application
function exceptions() {
  process.on('uncaughtException', function(err) {
    if (err.errno === 'EADDRINUSE') {
      log.error("Port " + argv.port + " already in use.",1);
    } else {
      console.log(err)
      console.log(argv['test'])
      log.error("Uncaught Exception\n" + err, argv['test'] === undefined ? 0 : 1);
    }
  });
}
