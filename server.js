#!/usr/bin/env node

const fs   = require('fs');

const compress   = require('compression');  // Express compression module
const moment     = require('moment');       // Time library http://moment.js

const express    = require('express');      // Client/server library
const app        = express();
const serveIndex = require('serve-index');

// Object that stores all metadata
const metadata = require('./lib/metadata.js').metadata;

// Prepare metadata and store in metadata object
const prepmetadata = require('./lib/metadata.js').prepmetadata;

const trimPath = require('./lib/log.js').trimPath;

// Command line interface
const argv = require('./lib/cli.js').argv;

// Logging
const log = require('./lib/log.js');
log.set('logdir', argv.logdir);      // Sets process.env.HAPILOGDIR and creates, if needed.
log.set('loglevel', argv.loglevel);  // Sets process.env.HAPILOGLEVEL

log.info(`Relative path in log messages base dir`);
log.info(`  ${__dirname}`);

exceptions(); // Catch uncaught exceptions

// Get default configuration variables stored in ./conf/server.json
const config = require("./lib/conf.js").configVars(argv);
for (key in config) {
  log.info(key + " = " + config[key]);
}

// Where to store *-all files
const METADIR = __dirname + "/public/meta";

if (typeof(argv.file) == 'string') {
  FILES = [argv.file];
} else {
  FILES = argv.file;
}

// Handle file patterns.
FILES = require("./lib/expandglob.js").expandglob(FILES);

// Populate metadata.cache array, which has elements of catalog objects
// main() is callback.
prepmetadata(FILES, argv.ignore, argv.skipchecks, main);

function main() {

  if (!fs.existsSync(METADIR)){
    fs.mkdirSync(METADIR);
    log.info("Created " + trimPath(METADIR));
  } else {
    log.info("*-all.json directory = " + trimPath(METADIR));
  }

  // Eventually HAPI spec may support request for all metadata associated
  // with server. This creates it.
  // TODO: This was added in HAPI 3.2.
  function writeall(file, all) {
    log.info("Starting creation of " + trimPath(file));
    try {
      fs.writeFileSync(file, all, "utf8");
      log.info("Finished creation of " + trimPath(file));
    } catch(e) {
      log.error("Error when writing " + trimPath(file) + ": " + e.message);
    }
  }

  let CATALOGS = [];
  let PREFIXES = [];
  var i = 0;
  for (let key in metadata.cache) {
    CATALOGS[i] = metadata.cache[key]['server']['id'];
    PREFIXES[i] = metadata.cache[key]['server']['prefix'];
    let all = JSON.stringify(metadata.cache[key]['info'],null,4);
    let file = METADIR + "/" + PREFIXES[i] + "-all.json";
    writeall(file, all);
    i = i + 1;
  }

  app.use(compress()); // Compress responses using gzip

  let serverlist = "";
  // TODO: Get contact and other info from catalog file.
  for (let i = 0; i < CATALOGS.length; i++) {
    let s = metadata(CATALOGS[i],'server');
    let d = metadata(CATALOGS[i],'data');
    serverlist = serverlist
                  + PREFIXES[i] + "/hapi,"
                  + CATALOGS[i] + ","
                  + CATALOGS[i] + ","
                  + s.contact + ","
                  + d.contact + "\n";
  }

  app.get('/all.txt', function (req, res) {res.send(serverlist);});

  if (argv["proxy-whitelist"] !== '' || argv["server-ui-include"].length > 0) {
    const proxy = require('./lib/proxy.js');
    proxy.proxyInit(argv["proxy-whitelist"], argv["server-ui-include"], serverlist, app, setHeaders, apiInit);
  } else {
    app.get('/proxy', function (req, res) {
      res.status(403).send("Server is not configured to proxy URLs.");
    });
    apiInit();
  }
}


function apiInit(CATALOGS, PREFIXES, i) {

  if (arguments.length == 0) {

    let CATALOGS = [];
    let PREFIXES = [];
    let j = 0;
    for (let key in metadata.cache) {
      CATALOGS[j] = metadata.cache[key]['server']['id'];
      PREFIXES[j] = metadata.cache[key]['server']['prefix'];
      j = j + 1;
    }

    let i = 0;

    let indexFile = __dirname + "/node_modules/hapi-server-ui/index.htm";
    app.get('/', function (req,res) {
      console.log('req')
      res.on('finish', () => log.request(req, req.socket.bytesWritten));
      // TODO: read file async
      let html = fs.readFileSync(indexFile, "utf8")
      if (argv.verifier) {
        html = html.replace(/__VERIFIER__/g, argv.verifier);
      }
      if (argv.plotserver) {
        html = html.replace(/__PLOTSERVER__/g, argv.plotserver);
      }
      if (argv["server-ui-include"].length > 0) {
        html = html.replace(/__SERVER_LIST__/g, "all-combined.txt");
      }
      if (SERVER_UI_INCLUDE) {
        html = html.replace(/__SERVER_LIST__/g, 'all-combined.txt');
      }
      res.send(html);
    });

    // Read at start-up only.
    if (false) {
      let html = fs.readFileSync(indexFile, "utf8").toString()
      app.get('/', function (req,res) {res.send(html);});
    }

    // Serve static files in ./public/data (no directory listing provided)
    app.use("/data", express.static(__dirname + '/public/data'));

    // Serve content needed in index.htm (no directory listing provided)
    let uidir = '/node_modules/hapi-server-ui';
    app.use("/", express.static(__dirname + uidir));

    apiInit(CATALOGS, PREFIXES, i);
    return;
  }

  if (i == CATALOGS.length) {
    // Handle uncaught errors in API request code.
    app.use(errorHandler);
    // Start server
    require("./lib/serverInit.js").serverInit(CATALOGS, PREFIXES, app, argv);
    return;
  }

  let CATALOG = CATALOGS[i];
  let PREFIX = "/" + PREFIXES[i]
  let PREFIXe = encodeURIComponent(PREFIX).replace("%2F","/");

  let capabilities = metadata(CATALOG,"capabilities");
  let hapiversion = capabilities["HAPI"];

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

  // Serve all.json file
  app.get(PREFIXe + '/hapi/all.json', function (req, res) {
    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    setHeaders(res, true);
    res.contentType("application/json");
    var file = __dirname + "/public/meta" + PREFIX + "-all.json";
    fs.createReadStream(file).pipe(res);
  })

  // /hapi
  app.get(PREFIX + '/hapi', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));

    let landingHTML = metadata(CATALOG, "server", "landingHTML");
    let landingPath = metadata(CATALOG, "server", "landingPath");

    setHeaders(res, true);
    if (landingHTML !== "") {
      res.contentType('text/html');
      res.send(landingHTML);
    }
    if (landingPath !== "") {
      app.use(PREFIX + '/hapi', serveIndex(landingPath));
    }
    if (landingPath === "" && landingHTML === "") {
      // This will only occur if force=true; otherwise server will not start.
      res.status(404).send("Not found.");
    }
  });

  // /about
  app.get(PREFIXe + '/hapi/about', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    setHeaders(res, true);
    res.contentType("application/json");

    // Send error if query parameters given
    if (Object.keys(req.query).length > 0) {
      error(req, res, hapiversion, 1401, "This endpoint takes no query string.");
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

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    setHeaders(res, true);
    res.contentType("application/json");

    // Send error if query parameters given
    if (Object.keys(req.query).length > 0) {
      error(req, res, hapiversion, 1401, "This endpoint takes no query string.");
      return;
    }

    res.send(metadata(CATALOG,"capabilities"));
  })

  // /catalog
  app.get(PREFIXe + '/hapi/catalog', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    setHeaders(res, true);
    res.contentType("application/json");

    // Send error if query parameters given
    if (Object.keys(req.query).length > 0) {
      error(req, res, hapiversion, 1401, "This endpoint takes no query string.");
      return;
    }

    res.send(metadata(CATALOG,"catalog"));
  })

  // /info
  app.get(PREFIXe + '/hapi/info', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    setHeaders(res, true);
    res.contentType("application/json");

    // Check query string and set defaults as needed.
    if (!queryCheck(req,res,hapiversion,CATALOG,'info')) {
      return; // Error already sent, so return;
    }

    // Get subsetted info response based on requested parameters.
    // info() returns integer error code if error.
    // TODO: Reconsider this interface to info() -
    // infoCheck() is more consistent with other code.
    var header = info(req,res,CATALOG);
    if (typeof(header) === "number") {
      error(req, res, hapiversion, 1407);
      return;
    } else {
      res.send(JSON.stringify(header,null,2));
      return;
    }
  })

  // /data
  app.get(PREFIXe + '/hapi/data', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    setHeaders(res, true);

    // Check query string and set defaults as needed.
    if (!queryCheck(req,res,hapiversion,CATALOG,'data')) {
      return; // Error already sent, so return;
    }

    // Get subsetted /info response based on requested parameters.
    var header = info(req,res,CATALOG);
    if (typeof(header) === "number") {
      // One or more of the requested parameters are invalid.
      error(req, res, hapiversion, 1407);
      return;
    };

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
      error(req,res,hapiversion,timeOK);
      return;
    }

    header["format"] = "csv"; // Set default format
    if (req.query["format"]) {
      if (!["csv","json","binary"].includes(req.query["format"])) {
        error(req, res, hapiversion, 1409,
          "Allowed values of 'format' are csv, json, and binary.");
        return;
      }
      // Use requested format.
      header["format"] = req.query["format"];
    }

    if (req.query["include"]) {
      if (req.query["include"] !== "header") {
        error(req, res, hapiversion, 1410,
          "Allowed value of 'include' is 'header'.");
        return;
      }
    }
    // If include was given, set include = true
    let include = req.query["include"] === "header";

    if (header["format"] === "csv")    {res.contentType("text/csv")};
    if (header["format"] === "binary") {res.contentType("application/octet-stream")};
    if (header["format"] === "json")   {res.contentType("application/json")};

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
    if (req.path.startsWith(PREFIXe + '/hapi/')) {
      let base = req.headers['x-forwarded-for'] || req.connection.remoteAddress
      let msg = "Invalid URL. See " + base + PREFIXe + "/hapi";
      error(req, res, hapiversion, 1400, msg, req.originalUrl);
    } else {
      res.status(404).send("Not found");
    }
  })

  apiInit(CATALOGS, PREFIXES, ++i);
}


function setHeaders(res, cors) {
  let packagejson = require("./package.json");
  if (cors) {
    // CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  res.header("X-Powered-By",packagejson.repository.url + " v" + packagejson.version);
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
  for (var i = 1;i < knownparams.length;i++) {
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
  var d = metadata(catalog,'data');

  if (d.proxy) {
    let url = replacevars(d.proxy).replace(/\/$/,"") + req.originalUrl;
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
      .web(req, res, {target: d.proxy});
    return;
  } else {
    let com = buildcom(d, header, req);
    executecom(com, d, req, res, header, include);
    return;
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
      var submilli = timestr.replace(/.*\.[0-9]{3}([0-9].*)Z$/,"$1");
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

  function buildcom(d, header, req) {

    function columnsstr() {
      // If command does not contain ${parameters} or ${{parameters}}, assume CL program
      // always outputs all variables. Subset the output using subset.js.

      let fieldstr = "";
      if (req.query["parameters"] && !/\$\{{1,2}parameters\}{1,2}/.test(d.command)) {
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
        for (var i = 0;i < headerfull.parameters.length;i++) {
          df = prod(headerfull.parameters[i].size || [1]);
          if (df > 1) {
            fields[headerfull.parameters[i].name] = col + "-" + (col+df-1);
          } else {
            fields[headerfull.parameters[i].name] = col;
          }
          col = col + df;
        }
        for (var i = 0;i < params.length;i++) {
          fieldstr = fieldstr + fields[params[i]] + ",";
        }
        fieldstr = fieldstr.slice(0, -1); // Remove last comma.
      }
      return fieldstr;
    }

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
      com = com + " --format " + header["format"];
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

  function executecom(com, d, req, res, header, include) {

    function dataErrorMessage() {
      let msg = "Problem with the data server.";
      if (d.contact) {
        error(req, res, header["HAPI"], 1500, 
              msg + " Please send URL to " + d.contact + ".");
      } else {
        error(req, res, header["HAPI"], 1500, "Problem with the data server.");
      }
    }

    log.info("Executing: " + com);

    // See if cmd line program supports requested format
    let formats = d.formats; // formats supported by cmd line program
    let convert = true;      // true if conversion is needed
    if (formats && formats.includes(req.query["format"])) {
      // cmd line program can create requested format
      convert = false;
    }

    // Call the cmd line command and send output.
    if (process.platform.startsWith("win")) {
      let opts = {"cwd": __dirname, "encoding": "buffer", shell: true, stdio: "pipe"};
      var child = require('child_process').spawn('cmd.exe', ['/s','/c', com], opts);
    } else {
      // See https://azimi.me/2014/12/31/kill-child_process-node-js.html for
      // reason for detached: true
      let opts = {"cwd": __dirname, "encoding": "buffer", detached: true};
      var child = require('child_process').spawn('sh', ['-c', com], opts);
    }

    child.stderr.on('data', function (err) {
      log.error(`Command ${com} gave stderr: '${err.toString().trim()}'`);
    });

    child.on('error', function (err) {
      log.error(`Command ${com} gave err: '${err.toString().trim()}'`);
    });

    let usePipe = false;
    let gotData = false;     // First chunk of data received.
    let wroteHeader = false; // If header already sent.
    let childFinished = false;
    let connectionClosed = false;

    req.connection.on('close',function () {
      // https://azimi.me/2014/12/31/kill-child_process-node-js.html
      connectionClosed = true;
      if (childFinished === false) {
        log.info(`HTTP Connection closed before child finished. Killing ${com}`);
        process.kill(-child.pid);
      } else {
        log.debug(`HTTP Connection closed.`);
      }
      log.info("Executed: " + com);
    });

    if (usePipe) {

      log.debug("Using pipe");
      child.stdout.on('end', function () {

        log.info(`Child end event.`);
        if (gotData === false) {
          header["status"]["code"] = 1201;
          header["status"]["message"] = "OK - No data in interval";
          if (convert && header["format"] === "json") {
            // Send header only
            res.write(csvTo("",true,true,header,include));
          } else if (include === true) {
            res.write("#" + JSON.stringify(header) + "\n");
          }
        }
      });

      child.stdout.on('data', function () {
        gotData = true;
        log.debug(`Child data event.`);
        // TODO: Only need this called once. Disable after first call?
      });

      child.on('close', function (code) {

        childFinished = true;
        if (code !== 0 && connectionClosed === false) {
          log.error(`Child closed with status ${code}: ${com}`);
          dataErrorMessage();
          return;
        } else {
          log.info(`Child closed with status ${code}: ${com}`);
        }

      });

      // Use pipe to prevent backpressure causing large memory usage.
      const { Transform } = require("stream");

      const writeTransform = new Transform({

        transform(chunk, encoding, callback) {

          log.debug("Got chunk.")
          let headerStr = undefined;
          if (include === true && wroteHeader === false) {
            // If header requested and header not written
            wroteHeader = true;
            if (header["format"] === "csv" || header["format"] === "binary") {
              headerStr = "#" + JSON.stringify(header) + "\n";
            }
          }
          if (header["format"] === "csv") {
            if (headerStr === undefined) {
              callback(null, chunk.toString());
            } else {
              callback(null, headerStr + chunk.toString());
            }
          }
          if (convert === false) {
            if (header["format"] === "json") {
              if (headerStr === undefined) {
                callback(null, chunk.toString());
              } else {
                callback(null, headerStr + chunk.toString());
              }
            }
            if (header["format"] === "binary") {
              if (headerStr === undefined) {
                callback(null, chunk);
              } else {
                callback(null, headerStr + chunk);
              }
            }
          } else {
            if (header["format"] === "json") {
            }
            if (header["format"] === "binary") {
            }
          }

        }
      });

      const { pipeline } = require("stream");
      pipeline(child.stdout, writeTransform, res,
        (err) => {
          if (err) {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
              log.debug("ERR_STREAM_PREMATURE_CLOSE");
            } else {
              log.error(err);
            }
          }
        });
    }

    if (usePipe == true) {
      return;
    }

    let incrementalBinary = false;
    let bufferstr = "";
    let bufferstrRemainder = "";

    child.on('close', function (code) {

      childFinished = true;

      log.info(`Child closed with status ${code}: ${com}`);
      if (code !== 0 && connectionClosed === false) {
        dataErrorMessage();
        return;
      }

      if (gotData) { // Data returned and normal exit.
        if (!incrementalBinary && convert) {
          // Convert accumulated data and send it.
          res.send(csvTo(bufferstr,true,true,header,include));
          bufferstr = null;
        } else {
          res.end(); // Data was being sent incrementally.
        }
      } else { // No data returned and normal exit.
        res.statusMessage = "HAPI 1201: No data in interval";
        if (convert && header["format"] === "json") {
          // Send header only
          res.write(csvTo("",true,true,header,include));
          return;
        }
        if (include) {
          res.status(200).send("#" + JSON.stringify(header) + "\n");
        } else {
          res.status(200).end();
        }
      }
    });

    child.stdout.on('data', function (buffer) {
      gotData = true;
      if (!wroteHeader && include && header["format"] !== "json") {
        // If header not written, header requested, and format requested
        // is not JSON, so send header.
        wroteHeader = true;
        res.write("#" + JSON.stringify(header) + "\n");
      }

      if (header["format"] === "csv") {
        // No conversion needed; dump buffer immediately.
        res.write(buffer.toString());
      }
      if (header["format"] === "json") {
        if (!convert) {
          // No conversion needed; dump buffer immediately.
          res.write(buffer.toString());
          return;
        } else {
          // JSON requested and command line program cannot produce it.
          // Accumulate output and send everything at once.
          // TODO: Write incrementally; use
          //    buffer.toString().lastIndexOf(/\n/)
          // along with saving part of string that was not written.
          bufferstr = bufferstr + buffer.toString();
        }
      }
      if (header["format"] === "binary") {
        if (!convert) {
          // No conversion needed; dump buffer immediately.
          res.write(buffer,'binary');
          return;
        } else {
          // Conversion from CSV to binary needed.
          if (incrementalBinary) {
            bufferstr = buffer.toString();
            if (bufferstrRemainder !== "") {
              bufferstr = bufferstrRemainder + bufferstr;
            }
            var lastnl = bufferstr.lastIndexOf("\n");
            if (lastnl+1 == bufferstr.length) {
              bufferstrRemainder = "";
            } else {
              bufferstrRemainder = bufferstr.slice(lastnl);
              bufferstr = bufferstr.slice(0,lastnl);
            }
            res.write(csvTo(bufferstr,null,null,header,include));
          } else {
            bufferstr = bufferstr + buffer.toString();
          }
        }
      }
    });
  }
}

// Multiply all elements in array
function prod(arr) {return arr.reduce(function(a,b){return a*b;})}


function csvTo(records, first, last, header, include) {

  // Helper function
  function append(str,arr,N) {for (var i=0;i<N;i++) {arr.push(str);};return arr;}

  // TODO: Do this on first call only.
  var size    = [];
  var sizes   = [];
  var name    = "";
  var names   = []; // Name associated with number in each column
  var type    = "";
  var types   = []; // Type associated with number in each column
  var length  = -1;
  var lengths = [];
  var po      = {}; // Parameter object
  for (var i = 0;i < header.parameters.length; i++) {
    size  = header.parameters[i]["size"] || [1];
    sizes = append(size,sizes,prod(size));
    name  = header.parameters[i]["name"];
    names = append(name,names,prod(size));
    type  = header.parameters[i]["type"];
    types = append(type,types,prod(size));
    length  = header.parameters[i]["length"] || -1;
    lengths = append(length,lengths,prod(size));
    po[header.parameters[i].name] = {};
    po[header.parameters[i].name]["type"] = header.parameters[i].type;
    po[header.parameters[i].name]["size"] = header.parameters[i].size || [1];
    if (po[header.parameters[i].name]["size"].length > 1) {
      log.warn("Warning. JSON for parameter "
                + name
                + " will be 1-D array instead of "
                + po[header.parameters[i].name]["size"].length
                + "-D");
      po[header.parameters[i].name]["size"] =
      prod(po[header.parameters[i].name]["size"]);
    }
  }

  if (header["format"] === "json") {
    return csv2json(records, po, names, first, last, header, include);
  }

  if (header["format"] === "binary") {
    return csv2bin(records, types, lengths, sizes);
  }

  function csv2bin(records, types, lengths, sizes) {

    // TODO: Only handles integer and double.
    // TODO: Make this a command line program.

    // Does not use length info for Time variable - it is inferred
    // from input (so no padding).

    records = records.trim();
    var recordsarr = records.split("\n");
    var Nr = recordsarr.length; // Number of rows

    // Regex that handles quoted commas
    // from: https://stackoverflow.com/a/23582323
    var re = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/g;
    var record1 = recordsarr[0].split(re);
    var Nd = record1.length - 1; // Number of data columns

    var Nb = 0;
    for (var i = 0;i < types.length;i++) {
      if (types[i] === 'double') {
        Nb = Nb + 8;
      }
      if (types[i] === 'integer') {
        Nb = Nb + 4;
      }
      if (types[i] === 'string' || types[i] === 'isotime') {
        Nb = Nb + lengths[i];
      }
    }

    var recordbuff = new Buffer.alloc(Nr*Nb);
    var pos = 0;
    var truncated = 0;
    for (var i = 0; i < Nr; i++) {
      var record = recordsarr[i].split(re);
      for (var j = 0;j < Nd+1;j++) {
        if (types[j] === 'double') {
          recordbuff.writeDoubleLE(record[j],pos);
          pos = pos + 8;
        }
        if (types[j] === 'integer') {
          recordbuff.writeInt32LE(record[j],pos);
          pos = pos + 4;
        }
        if (types[j] === 'string' || types[j] === 'isotime') {
          let buffer = Buffer.from(record[j],'utf8');
          if (buffer.length > lengths[j]) {
            log.error("Truncated:",record[j],buffer.length,"bytes");
            truncated = truncated + 1;
          }
          recordbuff.write(record[j],pos,'utf8')
          pos = pos + lengths[j];
        }
      }
    }
    if (truncated > 0) {
      log.error(truncated
                + " string(s) were truncated because they"
                + " were longer than length given in metadata");
    }
    return recordbuff;
  }

  function csv2json(records, po, names, first, last, header, include) {

    // Only handles 1-D arrays, e.g., size = [N], N integer.

    recordsarr  = records.split("\n");
    if (recordsarr[recordsarr.length-1] === '') {
      // Empty element due to trailing newline.
      recordsarr.pop();
    }

    var cols    = [];
    var records = "";
    var open    = "";
    var close   = "";
    var nw      = 0;
    for (var i = 0;i < recordsarr.length;i++) {
      cols    = recordsarr[i].split(",");
      record  = "";
      nw      = 0;
      for (var j = 0;j < cols.length;j++) {
        if (j == 0) {
          record = "[";
        }
        open  = "";
        close = "";
        if (po[names[j]].size[0] > 1) {
          if (open.length == 0 && nw == 0) {open = "["};
          nw = nw + 1;
        }
        if (po[names[j]].size[0] > 1 && nw == po[names[j]].size[0]) {
          close = "]";
          open = "";
          nw = 0;
        }
        if (types[j] === "integer") {
          record = record + open + parseInt(cols[j])   + close + ",";
        } else if (types[j] === "double") {
          record = record + open + parseFloat(cols[j]) + close + ",";
        } else {
          record = record + open + '"' + cols[j] + '"' + close + ",";
        }
      }
      if (i > 0) {
        records = records + "\n" + record.slice(0,-1) + "],";
      } else {
        records = record.slice(0,-1) + "],";
      }
    }
    open = "";close = "";
    if (first == true) {
      if (include) {
        // Remove closing } and replace with new element.
        open = JSON
        .stringify(header,null,4)
        .replace(/}\s*$/,"") + ',\n"data":\n[\n';
      } else {
        open = '[\n';
      }
    }
    if (last == true) {
      if (include) {
        close = "\n]\n}\n";
      } else {
        close = "\n]\n";
      }
    }
    return open + records.slice(0,-1) + close;
  }
}


function queryCheck(req, res, hapiversion, catalog, type) {

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
    error(req, res, hapiversion, 1400, emsg);
    return false;
  }

  if (req.query.id && req.query.dataset) {
    error(req, res, hapiversion, 1400, "Only one of 'id' and 'dataset' is allowed.");
    return false;
  }

  let ids = metadata(catalog,'ids');
  if (!ids.includes(dataset)) {
    error(req,res,hapiversion,1406);
    return false;
  }

  if (type === 'info') {
    // Check if extra parameters given
    let allowed = ["id", "parameters", "resolve_references"];
    let emsg = "'id', 'parameters', and 'resolve_references' are the only valid query parameters."
    if (parseInt(catalogObj.HAPI) >= 3) {
      allowed.push('dataset');
      let emsg = "'dataset' or 'id', 'parameters', and 'resolve_references' are the only valid query parameters."
    }
    for (var key in req.query) {
      if (!allowed.includes(key)) {
        error(req, res, hapiversion, 1401, emsg);
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

    for (var key in req.query) {
      if (!allowed.includes(key)) {
        error(req, res, hapiversion, 1401,
              "The only allowed query parameters are " + allowed.join(", "));
        return false;
      }
    }

    if (!req.query["time.min"] && !req.query["start"]) {
      error(req,res,hapiversion,1402);
      return;
    }
    if (!req.query["time.max"] && !req.query["start"]) {
      error(req,res,hapiversion,1403);
      return;
    }
  }

  // Set default resolve_references to be true if not given
  if (req.query.resolve_references === undefined) {
    req.query.resolve_references = "true";
  }

  // If resolve_references given, check that it is "true" or "false".
  if (!["true","false"].includes(req.query.resolve_references)) {
    error(req, res, hapiversion, 1411, "resolve_references must be 'true' or 'false'");
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

 for (var i = 0;i < times.length;i++) {
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
  var r = validHAPITime(times[1],header["HAPI"]);
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
  for (var i = 0;i < 4;i++) {
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
function error(req, res, hapiversion, code, message, messageFull) {

  let start = "time.min";
  let stop  = "time.max";
  let dataset = "id";

  if (parseInt(hapiversion) >= 3) {
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
    "1500": {status: 500, "message": "HAPI error 1500: internal server error"},
    "1501": {status: 500, "message": "HAPI error 1501: upstream request error"}
  }

  // Defaults
  var json = {
                "HAPI" : hapiversion,
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

  if (res.headersSent) {
    res.end();
    return;
  }

  res.on('finish', () => log.request(req, req.socket.bytesWritten));
  res.contentType("application/json");
  res.statusMessage = httpmesg;
  res.status(httpcode).send(JSON.stringify(json, null, 4) + "\n");

  let addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  let msg = "Responded with " + ecode + " to " + addr + ": " + req.originalUrl;
  log.info(msg);
}

// Uncaught errors in API request code.
function errorHandler(err, req, res, next) {
  let addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  let msg = "Request from " + addr + ": " + req.originalUrl;
  error(req, res, "", "1500", null, msg);
}

// Errors in non-API part of application
function exceptions() {
  process.on('uncaughtException', function(err) {
    if (err.errno === 'EADDRINUSE') {
      log.error("Port " + argv.port + " already in use.",1);
    } else {
      console.log(err)
      log.error("Uncaught Exception\n" + err,1);
    }
  });
}
