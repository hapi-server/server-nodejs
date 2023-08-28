#!/usr/bin/env node

const fs   = require('fs');
const clc  = require('chalk'); // Colorize command line output
const ver  = parseInt(process.version.slice(1).split('.')[0]);

if (parseInt(ver) < 6) {
  // TODO: On windows, min version is 8
  console.log(clc.red("!!! node.js version >= 6 required.!!! "
    + "node.js -v returns " + process.version
    + ".\nConsider installing https://github.com/creationix/nvm and then 'nvm install 6'.\n"));
  process.exit(1);
}

process.on('SIGINT', function() {
  process.exit(1);
});

const superagent = require('superagent');
const express    = require('express');    // Client/server library
const app        = express();
const serveIndex = require('serve-index');
const compress   = require('compression');  // Express compression module
const moment     = require('moment');     // Time library http://moment.js
const yargs      = require('yargs');
const metadata   = require('./lib/metadata.js').metadata;
const prepmetadata = require('./lib/metadata.js').prepmetadata;

// Test commands and urls
const test = require('./lib/test.js');

// Logging
const log = require('./lib/log.js');

// HAPI schema tests
const is = require('hapi-server-verifier').is;

// Verify function
const verify = require('hapi-server-verifier').tests.run;

let usage = "node server.js";
if (/server$/.test(process.execPath)) {
  // Binary executable caled.
  usage = "server";
}

let argv = yargs
  .strict()
  .help()
  .describe('https','Start https server')
  .describe('cert','https certificate file path')
  .describe('key','https key file path')
  .describe('file','Catalog configuration file or file pattern')
  .alias('file','f')
  .describe('port','Server port')
  .alias('port','p')
  .describe('conf','Server configuration file')
  .alias('conf','c')
  .describe('ignore','Start server even if metadata errors')
  .alias('ignore','i')
  .describe('logdir','Log directory')
  .alias('logdir','l')
  .describe('open','Open web page on start')
  .alias('open','o')
  .describe('test','Run URL tests and exit')
  .alias('test','t')
  .describe('verify','Run verification tests on command line and exit')
  .alias('verify','v')
  .describe('loglevel','info or debug')
  .alias('l','l')
  .option('file',{'type': 'string'})
  .option('ignore',{'type': 'boolean'})
  .option('https',{'type': 'boolean'})
  .option('open',{'type': 'boolean'})
  .option('test',{'type': 'boolean'})
  .option('verify',{'type': 'boolean'})
  .option('verifier',{'description': 'Verifier server URL on landing page'})
  .option('plotserver',{'description': 'Plot server URL on landing page'})
  .option('help', {alias: 'h'})
  .describe('server-ui-include','Also include these servers in server-ui server drop-down.')
  .describe('proxy-whitelist','Allow proxying of these servers (so one can use server=http://... in addressbar of server-ui).')
  .epilog("For more details, see README at https://github.com/hapi-server/server-nodejs/")
  .usage('Usage: ' + usage + ' [options]')
  .default({
    'ignore': false,
    'loglevel': 'info',
    'https': false,
    'open': false,
    'test': false,
    'verify': false,
    'logdir': __dirname + "/log",
    'file': __dirname + '/metadata/TestData2.0.json',
    'port': 8999,
    'proxy-whitelist': '',
    'server-ui-include': '',
    'conf': __dirname + '/conf/server.json',
    'verifier': 'http://hapi-server.org/verify',
    'plotserver': 'http://hapi-server.org/plot'
  })
  .argv

log.set('level',argv.loglevel);

const config = require(__dirname + "/lib/metadata.js").configVars(argv.conf);
for (key in config) {
  log.info(key + " = " + configd[key]);
}

const FILE        = argv.file;
const PORT        = argv.port;
const FORCE_START = argv.ignore;
const OPEN        = argv.open;
const TEST        = argv.test;
const VERIFY      = argv.verify;
const LOGDIR      = argv.logdir;
const VERIFIER    = argv.verifier;
const PLOTSERVER  = argv.plotserver;
const HTTPS       = argv.https;
const KEY_PATH    = argv.key;
const CERT_PATH   = argv.cert;
const METADIR     = __dirname + "/public/meta";

const PROXY_WHITELIST   = argv["proxy-whitelist"];
const SERVER_UI_INCLUDE = argv["server-ui-include"];

let server;

if (HTTPS === false) {
  log.info("Server will use http.");
  server = require("http").createServer(app);
} else {
  log.info("Starting HTTPS Server");
  if (KEY_PATH  == undefined && CERT_PATH != undefined) {
    console.log(clc.red("If cert is given, key must be given. Exiting."));
    process.exit(1);
  }
  if (KEY_PATH  != undefined && CERT_PATH == undefined) {
    console.log(clc.red("If key is given, cert must be given. Exiting."));
    process.exit(1);
  }
  if (KEY_PATH && !fs.existsSync(KEY_PATH )) {
    console.log(clc.red("Could not find https key file " + KEY_PATH));
    process.exit(1);
  }
  if (CERT_PATH && !fs.existsSync(CERT_PATH)) {
    console.log(clc.red("Could not find https cert file " + CERT_PATH));
    process.exit(1);
  }

  if (CERT_PATH && KEY_PATH) {
    // Both cert and key file given
    options = {
      key:  fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH)
    };
    server = require("https").createServer(options, app);
  } else {
    // Genererate key and cert file
    if (process.platform.startsWith("win")) {
      console.log(clc.red("Generation of SSL key and certifications files not implemented on Windows"));
      process.exit(1);
    }
    let com = 'sh \"' + __dirname + '/ssl/gen_ssl.sh' + '\"';
    
    // execSync requires a callback. Replaced it with spawnSync.
    let child;
    try {
      child = require('child_process').spawnSync('sh', ['-c', com], {stdio: 'pipe'});
    } catch (ex) {
      console.log(clc.red("Error when executing: " + com + "."));
      if (ex.stderr) {
        console.log(clc.red(ex.stderr.toString()));
      }
      if (exit_if_fail) {
        process.exit(1);
      } else {
        return false;
      }
    }

    if (child.status == 0) {

      // TODO: Report error and exit if key.pem and cert.pem not found.
      options = {
        key:  fs.readFileSync(require("path").resolve(__dirname, "./ssl/key.pem")),
        cert: fs.readFileSync(require("path").resolve(__dirname, "./ssl/cert.pem"))
      };
      
      server = require("https").createServer(options, app);

    } else {
      console.log(clc.red("Command returned non-zero status: " + com + "."));
      console.log("\nstdout:\n" + child.stdout.toString());
      console.log("\nstderr:\n" + child.stderr.toString());
      console.log("Exiting.");
      process.exit(1);
    }
 }
}

let FILES;
if (typeof(FILE) == 'string') {
  FILES = [FILE];
} else {
  FILES = FILE;
}

// Deal with file patterns.
const expandfiles = require(__dirname + '/lib/expandfiles.js').expandfiles;

FILES = expandfiles(FILES);

exceptions(); // Catch common start-up exceptions and un--caught exceptions

if (!fs.existsSync(LOGDIR)) {
  fs.mkdirSync(LOGDIR);
  log.info("Created " + LOGDIR);
} else {
  log.info("Log directory = " + LOGDIR);
}
log.LOGDIR = LOGDIR;

// Populate metadata.cache array, which has elements of catalog objects
// main() is callback.
prepmetadata(FILES, FORCE_START, VERIFIER, PLOTSERVER, main);

function main() {

  if (!fs.existsSync(METADIR)){
    fs.mkdirSync(METADIR);
    log.info("Created " + METADIR);
  } else {
    log.info("*-all.json directory = " + METADIR);
  }

  // Eventually HAPI spec may support request for all metadata associated
  // with server. This creates it.
  function writeall(file, all) {
    log.info("Starting creation of " + file);
    try {
      fs.writeFileSync(file, all, "utf8");
      log.info("Finished creation of " + file);
    } catch(e) {
      console.log(clc.red("Error when writing " + file + ":"));
      console.log(clc.red(e));
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

  if (PROXY_WHITELIST !== '' || SERVER_UI_INCLUDE !== '') {
    const proxy = require('./lib/proxy.js');
    proxy.proxyInit(PROXY_WHITELIST, SERVER_UI_INCLUDE, serverlist, app, cors, apiInit);
  } else {
    app.get('/proxy', function (req, res) {
      res.status(403).send("Server is not configured to proxy URLs.");
    });
    apiInit();
  }
}

function serverInit(CATALOGS, PREFIXES) {

  function startupMessages(url_prefix){
    log.info(clc.blue("Listening on port " + argv.port));

    let url = url_prefix + argv.port;
    log.info("HAPI server list is at");
    log.info("  " + url);
    log.info("This server provides");
    for (var i = 0;i < CATALOGS.length;i++) {
      log.info("  " + url + "/" + PREFIXES[i] + "/hapi");
    }
  
    log.info("To open a browser at " + url + ", use the --open option.");
    log.info("To run test URLs and exit, use the --test option.");
    log.info("To run command-line verification tests and exit, use the --verify option.");

    if (OPEN) {
      // Open browser window
      var start = (process.platform == 'darwin' ? 'open': process.platform == 'win32' ? 'start': 'xdg-open');
      require('child_process').exec(start + ' ' + url);
    }

    if (TEST) {
      // Exits with signal 0 or 1
      test.urls(CATALOGS, PREFIXES, url, TEST);
    }

    if (VERIFY) {
      // TODO: This only verifies first
      let s = metadata(PREFIXES[0],'server');
      // verify() exits with code 0 or 1.
      if (s.verify) {
        // If server has many datasets, select subset to verify.
        verify(url + "/" + PREFIXES[0] + "/hapi", s.verify);
      } else {
        verify(url + "/" + PREFIXES[0] + "/hapi");
      }
    }
  }
    
  // TODO: Server startup should be a callback to apiInit.
  if (HTTPS) {
    // In-case of HTTPS, server.listen is used. app.listen() can only listen to HTTP requests
    var url_prefix = 'https://localhost:';
    server.listen(argv.port, function () {
      startupMessages(url_prefix);
    });
  } else {
    // HTTP connection
    var url_prefix = 'http://localhost:';
    app.listen(argv.port, function () {
      startupMessages(url_prefix);
    });
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
      res.on('finish', () => log.request(req, req.socket.bytesWritten));
      // TODO: read file async
      let html = fs.readFileSync(indexFile, "utf8").toString()
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
    app.use("/css", express.static(__dirname + uidir + '/css'));
    app.use("/js", express.static(__dirname + uidir + '/js'));
    app.use("/scripts", express.static(__dirname + uidir + '/scripts'));
    app.use("/examples", express.static(__dirname + uidir + '/examples'));

    apiInit(CATALOGS, PREFIXES, i);
    return;
  }

  if (i == CATALOGS.length) {
    // Finalize API.
    // The following must occur after last app.get() call.
    // Any requests not matching set app.get() patterns will see error response.
    app.get('*', function(req, res) {
      if (PREFIXES.length == 1) {
        res.status(404).send("Invalid URL. See <a href='" + PREFIXES[0] + "/hapi'>" + PREFIXES[0] + "/hapi</a>");
      } else {
        res.status(404).send("Invalid URL. See <a href='/'>start page</a>");
      }
    });

    // Handle uncaught errors in API request code.
    app.use(errorHandler);
    serverInit(CATALOGS, PREFIXES);
    return;
  }

  let CATALOG = CATALOGS[i];
  let PREFIX = "/" + PREFIXES[i]

  let capabilities = metadata(CATALOG,"capabilities");
  let hapiversion = capabilities["HAPI"];

  log.info(clc.green("Initializing endpoints for http://localhost:" + argv.port + PREFIX + "/hapi"));

  // Serve static files in ./public/data (no directory listing provided)
  app.use(PREFIX + "/data", express.static(__dirname + '/public/data'));

  // Serve all.json file
  app.get(PREFIX + '/hapi/all.json', function (req, res) {
    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    cors(res);
    res.contentType("application/json");
    var file = __dirname + "/public/meta" + PREFIX + "-all.json";
    fs.createReadStream(file).pipe(res);
  })

  app.get(PREFIX + '/hapi/$', function (req, res) {
    res.header('Location', "../hapi");
    // A 301 is more appropriate, but a relative URL is not allowed 
    // Would need to obtain proxied URL in order to get the correct
    // absolute URL.
    res.status(302).send("");
  })

  // Serve static files if a landing path given
  let landing_path = metadata(CATALOG,"landingPath");
  if (landing_path !== "") {
    log.info("Allowing access to files in " + landing_path);
    app.use(PREFIX + "/", express.static(metadata(CATALOG,"landingPath")));
  }

  // Serve landing web page
  // If landing file, serve it.
  // If no landing file but landing path, serve index.htm or index.html if
  // found in landing path. If neither found, serve directory listing of
  // landing path.
  // If no landing file and no landing path, default page is served (this is
  // handled in metadata.js, so case will never occur here).
  let landingFile = "";
  if (metadata(CATALOG,"landingFile") !== "") {
    // Serve landing file
    landingFile = metadata(CATALOG,"landingFile");
  } else {
    let file1 = metadata(CATALOG,"landingPath") + "/index.htm";
    let file2 = metadata(CATALOG,"landingPath") + "/index.html";
    if (fs.existsSync(file1)) {
      landingFile = file1;
    } else {
      if (fs.existsSync(file2)) {
        landingFile = file2;
      } else {
        // Serve directory listing
        log.info("Did not find index.{htm,html}. "
                 + "In " + landing_path 
                 + ". Allowing directory listing.");
        app.use(PREFIX + '/hapi', serveIndex(landing_path));
      }
    }
  }

  function landing(landingFile) {
    app.get(PREFIX + '/hapi', function (req, res) {
      res.on('finish', () => log.request(req, req.socket.bytesWritten));

      if (landingFile !== "") {
        //cors(res); // Set CORS headers
        res.contentType('text/html');
        let tmp = metadata(CATALOG,"catalog");
        let str = fs
       .readFileSync(landingFile,"utf8")
       .toString()
       .replace(/__CATALOG__/g, CATALOG.replace(/.*\//,""))
       .replace(/__VERSION__/g, tmp.HAPI)
       .replace(/__VERIFIER__/g, VERIFIER)
       .replace(/__PLOTSERVER__/g, PLOTSERVER);
       res.send(str);
     } else {
        // In this case, directory listing is served. See
        // serveIndex call.
      }
    })
  }
  landing(landingFile);

  // /capabilities
  app.get(PREFIX + '/hapi/capabilities', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    cors(res);
    res.contentType("application/json");

    // Send error if query parameters given
    if (Object.keys(req.query).length > 0) {
      error(req, res, hapiversion, 1401,
       "This endpoint takes no query string.");
      return;
    }

    res.send(metadata(CATALOG,"capabilities"));
  })

  // /catalog
  app.get(PREFIX + '/hapi/catalog', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    cors(res);
    res.contentType("application/json");

    // Send error if query parameters given
    if (Object.keys(req.query).length > 0) {
      error(req, res, hapiversion, 1401,
       "This endpoint takes no query string.");
      return;
    }

    res.send(metadata(CATALOG,"catalog"));
  })

  // /info
  app.get(PREFIX + '/hapi/info', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    cors(res);
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
      res.send(header);
      return;
    }
  })

  // /data
  app.get(PREFIX + '/hapi/data', function (req, res) {

    res.on('finish', () => log.request(req, req.socket.bytesWritten));
    cors(res);

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
    header["status"]["x_startDateRequested"] = req.query["time.min"];
    header["status"]["x_stopDateRequested"]  = req.query["time.max"];
    header["status"]["x_parentDataset"]      = req.query["id"];

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
    var include = req.query["include"] === "header";

    if (header["format"] === "csv")    {res.contentType("text/csv")};
    if (header["format"] === "binary") {res.contentType("application/octet-stream")};
    if (header["format"] === "json")   {res.contentType("application/json")};

    var fname = "id-"
                 + req.query["id"]
                 + "_parameters-"
                 + req.query["parameters"]
                 + "_time.min-"
                 + req.query["time.min"]
                 + "_time.max-"
                 + req.query["time.max"]
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
  // PREFIX + {/hapi,/hapi/capabilities,/hapi/info,/hapi/data}
  app.get(PREFIX + '/*', function (req, res) {
    let base = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    let msg = "Invalid URL. See " + base + PREFIX + "/hapi";
    error(req, res, hapiversion, 1400, msg, req.originalUrl);
  })

  apiInit(CATALOGS, PREFIXES, ++i);
}

function cors(res) {
  // CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
}

function info(req,res,catalog) {

  // Read parameter metadata.
  if (req.query.resolve_references === "true") {
    json = metadata(catalog,'info',req.query.id);
  } else {
    json = metadata(catalog,'info-raw',req.query.id);
  }

  // Copy string metadata (b/c json will be modified).
  var json = JSON.parse(JSON.stringify(json));

  // Create array of known parameter names
  var knownparams = [];
  for (var i = 0;i < json.parameters.length;i++) {
    knownparams[i] = json.parameters[i].name;
  }

  // Create array from comma-separated parameters in query
  var wantedparams = [];
  if (req.query.parameters) {
    wantedparams = req.query.parameters.split(",");
  } else {
    // If parameters field not in query string, default is all.
    wantedparams = knownparams;
  }

  // Remove repeated parameters from query
  var wantedparams = Array.from(new Set(wantedparams));

  // Catches case where parameters= is given in query string.
  // Assume it means same as if no parameters field was given
  // (which means all parameters wanted).
  if (wantedparams.length == 0) {return json;}

  // Determine if any parameters requested are invalid
  validparams = []; iv = 0;
  invalidparams = []; ii = 0;
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

  // Return JSON string
  return json;
}

function data(req,res,catalog,header,include) {

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
        error(req, res, header["HAPI"], 1500, null, "Proxy " + url + " error: " + err);
      })
      .web(req, res, { target: d.proxy });
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

  function replacevars(com) {

    // Double {{ }} means don't quote
    com = com.replace("${{id}}",req.query["id"]);
    
    if (req.query["parameters"]) {   
      com = com.replace("${{parameters}}",req.query["parameters"]);
    } else {
      com = com.replace("${{parameters}}",'');
    }

    // Times don't need to be quoted
    com = com.replace("${start}",normalizeTime(req.query["time.min"]));
    com = com.replace("${stop}",normalizeTime(req.query["time.max"]));

    com = com.replace("${{start}}",normalizeTime(req.query["time.min"]));
    com = com.replace("${{stop}}",normalizeTime(req.query["time.max"]));

    if (process.platform.startsWith("win")) {
      com = com.replace("${id}",'"' + req.query["id"] + '"');
    } else {
      com = com.replace("${id}","'" + req.query["id"] + "'");
    }
    if (req.query["parameters"]) {
      if (process.platform.startsWith("win")) {
        com = com.replace("${parameters}",'"' + req.query["parameters"] + '"');
      } else {
        com = com.replace("${parameters}","'" + req.query["parameters"] + "'");
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
        var headerfull = metadata(catalog,'info',req.query.id);
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

    var start = normalizeTime(req.query["time.min"]);
    var stop = normalizeTime(req.query["time.max"]);

    let com = "";

    if (d.file || d.url) {
      // Will always need to subset in this case
      // (unless request is for all variables over
      // full range of response, which is not addressed)
      //com = config.PYTHONEXE + " " + __dirname + "/lib/subset.py";
      com = '"' + config.NODEEXE + '" ' + __dirname + "/lib/subset.js";
      if (d.file) com = com + ' --file "' + replacevars(d.file) + '"';
      if (d.url)  com = com + ' --url "' + replacevars(d.url) + '"';
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
               + config.NODEEXE
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
      com = "nice -n 20 " + com;
    }
    return com;
  }

  function executecom(com, d, req, res, header, include) {

    function dataErrorMessage() {
      if (wroteheader) {
        // Set error header and exit if header not sent.
        res.end();
        return;
      }
      let msg = "Problem with the data server.";
      if (d.contact) {
        error(req, res, header["HAPI"], 1500, msg + " Please send URL to " + d.contact + ".");
      } else {
        error(req, res, header["HAPI"], 1500, "Problem with the data server.");
      }
    }

    log.info("Executing: " + com);

    // See if cmd line program supports requested format
    let formats = d.formats; // formats supported by cmd line program
    let convert = true;      // true if conversion is needed
    if (formats) {
      if (formats.includes(req.query["format"])) {
        // cmd line program can create requested format
        convert = false;
      }
    }

    // Call the cmd line command and send output.
    if (process.platform.startsWith("win")) {
      let opts = {shell: true, stdio: "pipe", encoding: "buffer"};
      var child = require('child_process').spawn('cmd.exe', ['/s','/c', com], opts);
    } else {
      let opts = {"encoding": "buffer"};
      var child = require('child_process').spawn('sh', ['-c', com], opts);
    }

    req.connection.on('close',function () {
      // If request closes and child has not exited, kill child.
      if (child.exitCode == null) {
        log.info('HTTP Connection closed. Killing ' + com);
        child.kill('SIGINT');
      }
      log.info("Executed: " + com);
    });

    child.stderr.on('data', function (err) {
      log.error("Command " + com + " gave stderr:\n" + err);
    })

    let wroteheader = false; // If header already sent.
    let gotdata = false;     // First chunk of data received.

    let incrementalBinary = false;
    let bufferstr = "";
    let bufferstrRemainder = "";

    child.on('close', function (code) {

      if (code != 0) {
        dataErrorMessage();
        return;
      }

      if (gotdata) { // Data returned and normal exit.
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
    })

    child.stdout.on('data', function (buffer) {

      gotdata = true;
      if (!wroteheader && include && header["format"] !== "json") {
        // If header not written, header requested, and format requested
        // is not JSON, so send header.
        wroteheader = true;
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
    })
  }
}

// Multiply all elements in array
function prod(arr) {return arr.reduce(function(a,b){return a*b;})}

function csvTo(records,first,last,header,include) {

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
      log.info(clc.yellow("Warning. JSON for parameter "
                + name
                + " will be 1-D array instead of "
                + po[header.parameters[i].name]["size"].length
                + "-D"));
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
          if (record[j].length > lengths[j]) {
            truncated = truncated + 1;
          }
          recordbuff.write(record[j],pos)
          pos = pos + lengths[j];
        }
      }
    }
    if (truncated > 0) {
      log.info(clc.red((truncated) 
                    + " strings were truncated because they"
                    + " were longer than length given in metadata"));
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

  // Check for required id parameter
  if (!req.query.id) {
    error(req, res, hapiversion, 1400, "A dataset id must be given.");
    return false;
  }

  let ids = metadata(catalog,'ids');
  if (!ids.includes(req.query.id)) {
    error(req,res,hapiversion,1406);
    return false;
  }

  if (type === 'info') {
    // Check if extra parameters given
    for (var key in req.query) {
      if (!["id", "parameters", "resolve_references"].includes(key)) {
        error(req, res, hapiversion, 1401,
              "'id', 'parameters', and 'resolve_references' are the only valid query parameters.");
        return false;
      }
    }
  } else {
    // Check if query parameters are all valid
    var allowed = [
      "id","parameters","time.min","time.max",
      "format","include","attach","resolve_references"
    ];
    for (var key in req.query) {
      if (!allowed.includes(key)) {
        error(req, res, hapiversion, 1401,
              "The only allowed query parameters are " + allowed.join(", "));
        return false;
      }
    }

    if (!req.query["time.min"]) {
      error(req,res,hapiversion,1402);
      return;
    }
    if (!req.query["time.max"]) {
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

  var r = is.HAPITime(times[0],header["HAPI"]);
  if (r.error) {
    return 1402;
  }
  var r = is.HAPITime(times[1],header["HAPI"]);
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
function error(req,res,hapiversion,code,message,messageFull) {

  // TODO: Need to determine if headers and/or data were already sent.
  var errs = {
    "1400": {status: 400, "message": "HAPI error 1400: user input error"},
    "1401": {status: 400, "message": "HAPI error 1401: unknown request field"},
    "1402": {status: 400, "message": "HAPI error 1402: error in time.min"},
    "1403": {status: 400, "message": "HAPI error 1403: error in time.max"},
    "1404": {status: 400, "message": "HAPI error 1404: time.min equal to or after time.max"},
    "1405": {status: 400, "message": "HAPI error 1405: time outside valid range"},
    "1406": {status: 404, "message": "HAPI error 1406: unknown dataset id"},
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
                "status": { "code": 1500, "message": "Internal server error"}
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
  error(req, res, "2.0", "1500", null, msg + "\n" + err.stack);
}

// Errors in non-API part of application
function exceptions() {
  process.on('uncaughtException', function(err) {
    if (err.errno === 'EADDRINUSE') {
      console.log(clc.red("Port " + argv.port + " already in use."));
      process.exit(1);
    } else {
      log.error("Uncaught Exception\n" + err);
      let logfile = LOGDIR + '/server-error-' + log.ds().split("T")[0] + ".log";
      fs.appendFileSync(logfile, "\n" + log.ds() + " Uncaught Exception\n" + err.msg);
    }
  });
}
