const fs    = require('fs');
const path  = require('path');
const http  = require('http');
const https = require('https');

// Run tests on tests given in data node.
const test = require('./test.js');

// Logging
const log = require('./log.js');

// Command line interface
const argv = require('./cli.js').argv;

// Command line configuration variables
const conf = require('./conf.js');

function validHAPIJSON(json, schema, subschema, force, dsid) {

  const is = require('hapi-server-verifier').is;
  const v = is.HAPIJSON(json, schema, subschema);

  let msg = "";
  if (dsid) {
    msg = " for dataset " + dsid;
  }

  if (v.error) {
    log.error(`Invalid HAPI '${json.HAPI}' /${subschema} node${msg}. Error(s):\n${v.got}`);
    if (force) { 
      log.warn("Starting server with invalid HAPI because --ignore command-line option used.");
    } else {
      log.warn("Use the --ignore command-line option to force start the server when metadata is not schema-valid. Exiting.");
      process.exit(1);
    }
  }
}


function metadata(catalog, part, id) {
  if (id) {
    return metadata.cache[catalog][part][id];
  } else {
    return metadata.cache[catalog][part];
  }
}
exports.metadata = metadata;


function prepmetadata(FILES, FORCE_START, SKIP_CHECKS, cb) {

  if (!prepmetadata.Nservers) {
    prepmetadata.Nservers = FILES.length;
    let plural = prepmetadata.Nservers > 1 ? "s." : ".";
    let msg = "Preparing metadata for " + prepmetadata.Nservers + " server" + plural;
    log.info("-".repeat(msg.length));
    log.info(msg);
  }

  if (FILES.length == 0) {
    let plural = prepmetadata.Nservers > 1 ? "s." : ".";
    let msg = "Prepared metadata for " + prepmetadata.Nservers + " server" + plural;
    log.info(msg);
    log.info("-".repeat(msg.length));
    cb();
    return;
  }

  let serverfile = FILES[0];

  if (!metadata.cache) {
    metadata.cache = {};
  }

  // Read file passed as -f argument on command line
  let json = readCatalogConfig(serverfile);

  let HAPI = json["server"]["HAPI"];

  json["status"] = {"code": 1200, "message": "OK"};
  if (!json["server"]) {
    json["server"] = {};
  }
  if (!json["server"]["id"]) {
    json["server"]["id"] = path.parse(serverfile).name;
  }
  catalogid = json["server"]["id"];
  if (!json["server"]["prefix"]) {
    json["server"]["prefix"] = catalogid;
  }

  metadata.cache[catalogid] = {};
  metadata.cache[catalogid]["server"] = json["server"];

  // /hapi (landing).
  // Set
  // metadata.cache[catalogid]['server']['landingHTML'] and
  // metadata.cache[catalogid]['server']['landingPath']
  landing(json, serverfile);

  // /about
  if (json["about"]) {
    json['about']['status'] = json['status'];
    validHAPIJSON(json["about"], HAPI, 'about', FORCE_START);
    metadata.cache[catalogid]['about'] = json["about"];
  }

  // /capabilities
  var capabilities = {
    "HAPI": HAPI,
    "outputFormats": ["csv", "binary", "json"],
    "status": json["status"]
  };
  // Sync function; will throw error or warning.
  validHAPIJSON(capabilities, HAPI, 'capabilities', FORCE_START);
  metadata.cache[catalogid]['capabilities'] = capabilities;

  // data
  if (!json.data) {
    log.error(serverfile + " Does not have a 'data' node. Exiting.");
    process.exit(1);
  }

  // Command line program information
  var formats = json.data.formats || "csv";
  if (!json.data.file && !json.data.command && !json.data.url && !json.data.proxy) {
    log.error("A 'file', 'command', 'url', or 'proxy' must be specified in the 'data' node.");
    process.exit(1);
  }

  // TODO: Write schema for data node. As written,
  // if a command is specified, it will be used and file and url
  // will be ignored. Need to catch this error.

  if (json.data.file) {
    json.data.file = conf.replaceConfigVars(json.data.file);
    if (/\${/.test(json.data.file) == false && !fs.existsSync(json.data.file)) {
      let msg = json.data.file + " referenced in " + catalogid + " not found.";
      log.error(msg);
      process.exit(1);
    }
  }

  if (json.data.command) {
    json.data.command = conf.replaceConfigVars(json.data.command);
    if (json.data.testcommands !== undefined) {
      json.data.testcommands = conf.replaceConfigVars(json.data.testcommands);
    }
  }

  metadata.cache[catalogid]['data'] = JSON.parse(JSON.stringify(json.data));

  jsonWarn(formats);

  let update_seconds = json['server']['catalog-update'];
  if (update_seconds) {
    if (!Number.isInteger(update_seconds)) {
      log.error(serverfile + " has a non-integer value for server.catalog-update.");
      process.exit(1);
    }
    if (update_seconds < 0) {
      log.error(serverfile + " has a negative value for server.catalog-update.");
      process.exit(1);
    }
    log.info("Updating " + catalogid + " every " + update_seconds + " seconds.");
    setInterval( () => {
      updatemetadata(false, FORCE_START, SKIP_CHECKS, json, (e) => {
        let catalogid = json['server']['id'];
        log.info("Updating " + catalogid);
        if (e) {
          log.info("Failure in updating " + catalogid + ". Will use last version.");
          // TODO: Send email?
        } else {
          log.info("Updated " + catalogid);
        }
      });
    }, update_seconds*1000);
  }

  updatemetadata(true, FORCE_START, SKIP_CHECKS, json, (err) => {
    if (json.data.testcommands !== undefined && SKIP_CHECKS == false) {
      test.commands0(json.data.testcommands,catalogid,true);
    }
    log.info("Finished reading, parsing, and resolving metadata in " + trimPath(FILES[0]));
    FILES.shift();
    prepmetadata(FILES, FORCE_START, SKIP_CHECKS, cb);
  })
}
exports.prepmetadata = prepmetadata;


function updatemetadata(exit_if_fail, FORCE_START, SKIP_CHECKS, json, cb) {

  // Given the contents of the catalog file specified on the command line on start-up,
  // resolve any references to external parts and then populate metadata.cache, which
  // is used by /catalog and /info.

  let catalog = {"catalog": []};
  let catalogid = json["server"]["id"];

  if (!metadata.newcache) {
    metadata.newcache = {};
  }

  metadata.newcache[catalogid] = {};
  for (let key in metadata.cache[catalogid]) {
    if (key !== 'catalog') {
      metadata.newcache[catalogid][key] = metadata.cache[catalogid][key];
    }
  }

  metadata.newcache[catalogid]['ids'] = [];
  metadata.newcache[catalogid]['info'] = {};
  metadata.newcache[catalogid]['info-raw'] = {};

  catalog.HAPI = json["server"]["HAPI"];
  catalog.status = json["status"];

  getmetadata(json, "catalog", exit_if_fail, (e, xcatalog) => {
    if (e) {
      exit_conditionally(exit_if_fail, e, cb)
    } else {
      createcat(0, xcatalog);
    }
  });

  function createcat(ds_num, xcatalog) {

    // Each element of xcatalog is a dataset
    // Resolve info nodes and checks catalog and info.

    if (!xcatalog[ds_num]) {
      let msg = `Dataset number ${ds_num} does not have an id element.`;
      log.error(msg);
      process.exit(1);
    }

    let id = xcatalog[ds_num].id;

    if (ds_num == 0) {
      log.info(`Reading, parsing, and resolving metadata for ${catalogid}`);
    }

    metadata.newcache[catalogid]['ids'].push(id);

    catalog.catalog[ds_num] = xcatalog[ds_num];

    getmetadata(xcatalog[ds_num], "info", exit_if_fail, (e, info) => {
      if (e) {
        exit_conditionally(exit_if_fail, e, cb)
      } else {
        checkinfo(info);
      }
    });

    function checkinfo(info) {

      for (infoType of ["info", "info_inline", "info_url", "info_file", "info_command"]) {
        delete catalog.catalog[ds_num][infoType];
      }

      info = JSON.parse(JSON.stringify(info));
      info.HAPI = json["server"]["HAPI"];
      info.status = json["status"];

      // Resolve JSON refs in info.
      let info_resolved = resolveJSONRefs(JSON.parse(JSON.stringify(info)));
      if (SKIP_CHECKS == false) {
        //log.info("Checking schema validity of /info response metadata for " + id);
        validHAPIJSON(info_resolved, info.HAPI, 'info', FORCE_START, xcatalog[ds_num]['id']);
        //log.info("Checked schema validity of /info response metadata for " + id);
      }
      delete info_resolved["definitions"];
      metadata.newcache[catalogid]['info'][id] = info_resolved;
      metadata.newcache[catalogid]['info-raw'][id] = info;

      if (ds_num < xcatalog.length - 1) {
        createcat(++ds_num, xcatalog);
      } else {
        checkcat();
      }
    }

    function checkcat() {

      if (SKIP_CHECKS == false) {
        log.info("Checking schema validity of /catalog response metadata for " + catalogid);
        validHAPIJSON(catalog, json["server"]["HAPI"], 'catalog', FORCE_START);
        //log.info("Checked schema validity of /catalog response metadata for " + catalogid);
      }
      metadata.newcache[catalogid]['catalog'] = catalog;
      // Update of metadata complete. Copy update to metadata.cache.
      metadata.cache[catalogid] = Object.assign({}, metadata.newcache[catalogid]);
      metadata.newcache[catalogid] = {};
      cb();
    }
  }
}


function getmetadata(obj, nodeType, exit_if_fail, cb) {

  function metadataType(json, nodeType) {
    if (json[nodeType + "_file"]) {
      return "file";
    } else if (json[nodeType + "_url"]){
      return "url";
    } else if (json[nodeType + "_command"]) {
      return "command";
    } else if (json[nodeType + "_inline"]) {
      return "inline";
    } else if (json[nodeType]) {
      return null;
    } else {
      return undefined;
    }
  }

  function getinfos(caturl, catalog, cb) {

    getone(0);

    function getone(i) {
      if (i == catalog.length) {
        cb(null, catalog);
        return;
      }
      url = caturl.replace("hapi/catalog","hapi/info") + "?id=" + catalog[i].id;
      request(url, (e, data) => {
        if (e) {
          cb(e);
        } else {
          try {
            catalog[i].info = JSON.parse(data.toString());
          } catch (e) {
            log.error(str + " output is not JSON parse-able. Try https://jsonlint.com/.");
            cb(e);
          }
          getone(++i);
        }
      });
    }
  }

  function request(url, cb) {

    log.info("Getting " + url);

    function process_(resp) {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        log.info("Got " + url);
        cb(null, data);
      });
    }

    if (url.substring(0,5) === 'https') {
      https.get(url, process_).on("error", (err) => cb(err));
    } else {
      http.get(url, process_).on("error", (err) => cb(err));		
    }
  }

  function readfile(fname, cb) {
    log.info("Reading " + fname);
    fs.readFile(fname, "utf8", (e, info) => {
      if (e) {
        log.error("Could not read " + fname + ". Error message: " + e.message);
        exit_conditionally(exit_if_fail, e, cb);
      }
      try {
        info = JSON.parse(info);
      } catch (e) {
        log.error(fname + " is not JSON.parse-able. Try https://jsonlint.com/.");
        exit_conditionally(exit_if_fail, e, cb);
      }
      cb(null, info);
    });
  }

  let type = metadataType(obj, nodeType);
  if (type == "inline") {
    // obj is inline JSON.
    cb(null, obj[nodeType + "_" + type]);
    return;
  }

  if (type === undefined) {
    log.error(`No '${nodeType}_{file,url,command,inline}', or '${nodeType}' node found. Exiting.`);
    process.exit(1);
  }

  let nodeStr = "";
  if (type === null) {
    if (typeof(obj[nodeType]) === 'object') {
      // obj is inline JSON.
      cb(null, obj[nodeType]);
      return;
    } else {
      log.warn(`Warning: '${nodeType}' is deprecated. Use '${nodeType}_{file,command,url,inline}'`);
      nodeStr = obj[nodeType];
    }
  } else {
    nodeStr = obj[nodeType + "_" + type];
  }

  nodeStr = conf.replaceConfigVars(nodeStr);
  nodeStr = nodeStr.trimStart();

  if (type === "url" || (nodeType == null && nodeStr.startsWith('http'))) {
    log.info("Requesting " + nodeStr);
    request(nodeStr, (e, data) => {
      if (e) {
        log.error("Error getting " + nodeStr + ": " + e.message);
        exit_conditionally(exit_if_fail, e, cb);
      }
      let jsonstr = data.toString();
      try {
        obj = JSON.parse(jsonstr);
      } catch (e) {
        nodeStr += nodeStr + " output is not JSON parse-able. Try https://jsonlint.com/. Exiting.";
        log.error(nodeStr);
        exit_conditionally(exit_if_fail, e, cb);
      }
      if (nodeType === "catalog" && /hapi\/catalog\/?$/.test(nodeStr)) {
        let msg = "catalog node in server configuration is a HAPI server. ";
        msg += "Getting info metadata for all server datasets.";
        log.info(msg);
        getinfos(nodeStr, obj.catalog, (e, obj) => {
          if (e) {
            exit_conditionally(exit_if_fail, e, cb);
          } else {
            cb(e, obj);
          }
        });
      } else {
        cb(null, obj);
      }
    });
  } else if (type === "file" || (nodeType == null && nodeStr.startsWith('file:'))) {
    readfile(nodeStr, cb);
  } else if (type === "command")  {
    nodeStr = nodeStr.trim();
    log.info("Executing: " + nodeStr);
    require('child_process').exec(nodeStr, {'maxBuffer': 100000000}, (e, info) => {
      if (e) {
        log.error("Error");
        log.error("  " + e.message.replace(/\n$/,"").replace("\n","\n  "));
        exit_conditionally(exit_if_fail, e, cb);
      } else {
        try {
          info = JSON.parse(info);
        } catch (e) {
          log.error(nodeStr + " output is not JSON parse-able. Try https://jsonlint.com/. Exiting.");
          exit_conditionally(exit_if_fail, e, cb);
        }
        cb(null, info);
      }
    });
  } else if (type == null) {
    // See: https://github.com/hapi-server/server-nodejs/issues/24
    // Attempt to execute as a command first and if parseable JSON is returned, use that.
    // Otherwise, attempt to read as a file.
    log.info(`'${nodeType}' is ambiguious. It could be a file or command. Attempting to evaluate as a command.`);
    log.info(`Attempting to execute '${nodeStr}'`);
    require('child_process').exec(nodeStr, {'maxBuffer': 100000000}, (e, info) => {
      if (!e) {
        try {
          info = JSON.parse(info);
          cb(null, info);
        } catch (e) {
          log.info(`'${nodeStr}' was not a command that returned JSON. Attempting to read '${nodeStr}' as a file.`);
          readfile(nodeStr, cb);
        }
      } else {
        readfile(nodeStr, cb);
      }
    });
  }
}


function readCatalogConfig(file) {

  if (!fs.existsSync(file)) {
    log.error("Did not find " + file + ". Exiting.");
    process.exit(1);
  }
  log.info("Start reading, parsing, and resolving " + trimPath(file));
  try {
    var str = fs.readFileSync(file);
  } catch (ex) {
    log.error(file + " is not readable. Exiting.");
    log.error(ex.message);
    process.exit(1);
  }
  try {
    var json = JSON.parse(str);
  } catch (ex) {
    let msg = file + " is not JSON parse-able. Try https://jsonlint.com/. Exiting.";
    log.error(msg);
    log.error(ex.message);
    process.exit(1);
  }
  if (!json.server) {
    log.error(file + " does not have a server node.");
    process.exit(1);
  }
  if (!json.server.contact) {
    let msg = " must have a non-empty contact string in the server object.";
    log.error(file + msg);
    process.exit(1);
  }
  if (!json.data.contact) {
    let msg = " must have a non-empty contact string in the data object.";
    log.error(file + msg);
    process.exit(1);
  }

  if (!json.server.HAPI) {
    if (json.about && json.about.HAPI) {
      json.server.HAPI = json.about.HAPI;
    } else {
      let HAPIVerError = ' should have a non-empty version string for HAPI in ';
      HAPIVerError += 'the server object or the about object for HAPI 3.0+. ';
      HAPIVerError += 'Assuming "2.1."';
      log.warn(file + HAPIVerError);
      json.server.HAPI = "2.1";
    }
  }

  // If catalog is missing
  if (!json.catalog && !json.catalog_file && !json.catalog_url && !json.catalog_command && !json.catalog_inline ) {
    log.error(file + " does not have a 'catalog' object. Exiting.");
    process.exit(1);
  }

  return json;
}


function landing(json, serverfile) {

  // Landing page html
  let landingFile = "";
  let landingPath = "";
  if (json["server"]["landingFile"] && "string" === typeof(json["server"]["landingFile"])) {
    landingFile = conf.replaceConfigVars(json["server"]["landingFile"]);
  }
  if (json["server"]["landingPath"] && "string" === typeof(json["server"]["landingPath"])) {
    landingPath = conf.replaceConfigVars(json["server"]["landingPath"]);
    if (landingFile === "") {
      landingFile = "index.htm";
    }
  }

  if (landingFile === "" && landingPath === "") {
    landingFile = __dirname + "/../node_modules/hapi-server-ui/single.htm";
    landingPath = __dirname + "/../node_modules/hapi-server-ui/";
    log.info("No landingFile or landingPath given in");
    log.info(`  ${trimPath(serverfile)}`)
    log.info("  Will use");
    log.info(`  landingFile = ${trimPath(landingFile)}`);
    log.info("  and ")
    log.info(`  landingPath = ${trimPath(landingPath)}`);
  }

  let landingHTML = fs
            .readFileSync(landingFile, "utf8").toString()
            .replace(/__CATALOG__/g, catalogid.replace(/.*\//,""))
            .replace(/__VERIFIER__/g, argv.verifier)
            .replace(/__PLOTSERVER__/g, argv.plotserver)


  if (json["server"]['HAPI']) {
    landingHTML = landingHTML.replace(/__VERSION__/g, json["server"]['HAPI']);
  }
  if (json["data"]['contact']) {
    landingHTML = landingHTML.replace(/__DATACONTACT__/g, json["data"]['contact']);
  }

  let serverContact = json["server"]["contact"];;
  if (json["about"] && json["about"]["contact"]) {
    serverContact = json["about"]["contact"];
  }
  if (serverContact) {
    landingHTML = landingHTML.replace(/__SERVERCONTACT__/g, serverContact);
  }

  if (landingPath === "" && landingFile !== "") {
    if (!fs.existsSync(landingFile)) {
      let msg = "Did not find landing file: " + landingFile + ". ";
      if (FORCE_START) {
        log.info(msg + "Will start server with no landing page because ignore=true.");
      } else {
        log.error(msg + "Exiting b/c ignore=false.");
        process.exit(1)
      }
    } 
  }	

  metadata.cache[catalogid]['server']['landingHTML'] = landingHTML;
  metadata.cache[catalogid]['server']['landingPath'] = landingPath;
}


function jsonWarn(formats) {
  if (!formats.includes("json")) {
    // If data program does not produce JSON, see if
    // any multi-dimensional arrays and warn.
    for  (i in metadata.cache[catalogid]['info']) {
      for (var j = 0; j < metadata.cache[catalogid]['info'][i].parameters.length; j++) {
        if (metadata.cache[catalogid]['info'][i].parameters[j].size) {
          if (metadata.cache[catalogid]['info'][i].parameters[j].size.length > 1) {
            log.warn("Warning: " + i + "/" 
                  + metadata.cache[catalogid]['info'][i].parameters[j].name 
                  + " has size.length > 1 and data program does not produce JSON."
                  + " Server cannot produce JSON from CSV for this parameter.");
          }
        }
      }
    }
  }
}

function resolveJSONRefs(obj) {

  if (obj && obj['definitions'] === undefined) {
    return obj;
  }
  let definitions = obj['definitions'];

  // Slightly modified version of
  // https://willseitz-code.blogspot.com/2013/01/javascript-to-deserialize-json-that.html

  // This resolver does not handle external references.
  // Resolvers that handle external references on npm require
  // async/await, which was introduced in node 8. I want to continue
  // using node 6 so that binary packages can be updated without
  // the need update the node binaries.
  var hashOfObjects = {};

  var collectIds = function (obj) {
    if (!obj) {return;};
    if (typeof(obj) === "object") {
      if (obj.hasOwnProperty("$ref")) {
        // Remove #/definitions/ from $ref
        let name = obj.$ref.replace(/.*\//,"");
        hashOfObjects[obj.$ref] = definitions[name];
      }
      for (var prop in obj) {
        collectIds(obj[prop]);
      }
    } else if (typeof(obj) === "array") {
      obj.forEach(function (element) {
        collectIds(element);
      });
    }
  };

  var setReferences = function (obj) {

    if (!obj) {return;};
    if (typeof(obj) === "object") {
      for (var prop in obj) {
        if (obj[prop] && typeof(obj[prop]) === "object" && obj[prop].hasOwnProperty("$ref")) {
          obj[prop] = hashOfObjects[obj[prop]["$ref"]];
        } else {
          setReferences(obj[prop]);
        }
      }
    } else if (typeof(obj) === "array") {
      obj.forEach(function (element, index, array) {
        if (element && typeof(element) === "object" &&
          element.hasOwnProperty("$ref")) {
          array[index] = hashOfObjects[element["$ref"]];
        } else {
          setReferences(element);
        }
      });
    }
    return obj;
  }

  collectIds(obj);

  //console.log("---")
  //console.log(hashOfObjects);
  //console.log("---")
  //console.log(JSON.stringify(setReferences(obj),null,4));
  return setReferences(obj);
}

function exit_conditionally(exit_if_fail, e, cb) {
  if (exit_if_fail) {
    log.error(e);
    process.exit(1);
  } else {
    cb(e);
  }
}


function trimPath(str) {
  return path.normalize(str).replace(conf.configVars.config["HAPISERVERPATH"], "HAPISERVERPATH");
}
