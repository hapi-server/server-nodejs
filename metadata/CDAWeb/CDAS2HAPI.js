// Create a HAPI catalog based on
//   https://spdf.gsfc.nasa.gov/pub/catalogs/all.xml
// and queries to
//   https://cdaweb.gsfc.nasa.gov/WebServices/REST/

let DATSET_ID_RE = new RegExp(/^AC_H0_MFI/);

let fs      = require('fs');
let request = require("request");
let moment  = require('moment');
let xml2js  = require('xml2js').parseString;

// pool should be set outside of loop. See
// https://www.npmjs.com/package/request#requestoptions-callback
// Set max sockets to a single host.
let pool = {maxSockets: 3};  

let baseurl = "https://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/";
let allurl  = "https://spdf.gsfc.nasa.gov/pub/catalogs/all.xml";

if (!fs.existsSync('cdas')) {fs.mkdirSync('cdas')}

catalog();

function catalog() {

  let fnameJSON = "cdas/all.json";

  if (fs.existsSync(fnameJSON)) {
    console.log("Reading: " + fnameJSON);
    let body = fs.readFileSync(fnameJSON);
    //console.log("Read:    " + fnameJSON);
    finished(JSON.parse(body), true);
    return;
  }
  let reqOpts = {uri: allurl};
  console.log("Requesting: " + allurl);
  request(reqOpts, function (err,res,body) {
    if (err) console.log(err);
    console.log("Received: " + allurl);
    xml2js(body, function (err, jsonObj) {
      finished(jsonObj, false);
    });
  });

  function finished(body, fromCache) {

    if (fromCache == false) {
      console.log("Writing: " + fnameJSON);
      fs.writeFileSync(fnameJSON, JSON.stringify(body, null, 2), 'utf-8');
      //console.log("Wrote:   " + fnameJSON);
    }    

    let datasets = body['sites']['datasite'][0]['dataset'];
    let allIds = [];
    let allMeta = [];
    for (dataset of datasets) {
      let id = dataset['$']['serviceprovider_ID'];
      if (DATSET_ID_RE.test(id) == false) {
        //console.log("Skipping " + id);
        continue;
      }
      //console.log("Keeping " + id);
      let start = dataset['$']['timerange_start'].replace(" ","T") + "Z";
      let stop = dataset['$']['timerange_stop'].replace(" ","T") + "Z";
      let contact = dataset['data_producer'][0]['$']['name'].trim() + ' @ ' + dataset['data_producer'][0]['$']['affiliation'].trim();
      allMeta.push({
        "id": id,
        "start": start,
        "stop": stop,
        "contact": contact,
        "resourceURL": "https://cdaweb.gsfc.nasa.gov/misc/Notes.html#" + id
      });
      allIds.push(id);
    }

    let allIdsFile = "cdas/ids-all.txt";
    console.log("Writing: " + allIdsFile);
    fs.writeFileSync(allIdsFile, allIds.join("\n"));
    //console.log("Wrote:   " + allIdsFile);

    variables(allMeta);
  }
}

function variables(CATALOG) {

  let ididx = 0;

  for (ididx = 0; ididx < CATALOG.length; ididx++) {
    let url = baseurl + CATALOG[ididx]['id'] + "/variables";
    let fname = "cdas/" + CATALOG[ididx]['id'] + "-variables.json";
    requestVariables(url, fname, ididx);
  }

  function requestVariables(url, fname, ididx) {

    if (fs.existsSync(fname)) {
      console.log("Reading: " + fname);
      let body = fs.readFileSync(fname, 'utf-8');
      //console.log("Read:    " + fname);
      finished(ididx, fname, body, true)
      return;
    }

    let reqOpts = {uri: url, pool: pool, headers: {'Accept':'application/json'}};
    console.log("Requesting: " + url.replace(baseurl,""));
    request(reqOpts, function (err,res,body) {
      if (err) console.log(err);
      console.log("Received: " + url.replace(baseurl, ""));
      finished(ididx, fname, body, false);
    });
  }

  function finished(ididx, fname, body, fromCache) {

    if (!finished.N) {finished.N = 0;}
    finished.N = finished.N + 1;
    body = JSON.parse(body);

    if (fromCache == false) {
      console.log("Writing: " + fname);
      fs.writeFileSync(fname, JSON.stringify(body, null, 2));
      //console.log("Wrote:   " + fname);
    }

    CATALOG[ididx]['_parameters'] = {};
    let VariableDescription = body['VariableDescription'];
    for (variable of VariableDescription) {
      parameter = {
                    'name': variable['Name'],          
                    'description': variable['LongDescription'] || variable['ShortDescription']
                  };
      CATALOG[ididx]['_parameters'][variable['Name']] = parameter;
    }

    if (finished.N == CATALOG.length) {
      variableDetails(CATALOG);
    }
  }
}

function variableDetails(CATALOG) {

  for (ididx = 0; ididx < CATALOG.length; ididx++) {
    parameters = null;
    parameters = [];
    for (name of Object.keys(CATALOG[ididx]['_parameters'])) {
      parameters.push(name);
    }
    parameters = parameters.join(",")

    let stop = moment(CATALOG[ididx]['start']).add(1,'day').toISOString().replace(".000Z","Z");

    let url = baseurl + CATALOG[ididx]['id'] + "/variables";
    url = baseurl
            + CATALOG[ididx]['id']
            + "/data/"
            + CATALOG[ididx]['start'].replace(/-|:/g,"")
            + "," 
            + stop.replace(/-|:/g,"")
            + "/"
            + parameters
            + "?format=json";

    let fname = "cdas/" + CATALOG[ididx]['id'] + '-cdfml.json';
    requestVariableDetails(url, fname, ididx);
  }

  function cdfVAttributes(attributes) {

    let keptAttributes = {}
    for (attribute of attributes) {
      //console.log(attribute['name'])
      if (attribute['name'] === 'LABLAXIS') {
        keptAttributes['label'] = attribute['entry'][0]['value'];
      }
      if (attribute['name'] === 'FILLVAL') {
        keptAttributes['fill'] = attribute['entry'][0]['value'];
      }
      if (attribute['name'] === 'UNITS') {
        keptAttributes['units'] = attribute['entry'][0]['value'];
      }
      if (attribute['name'] === 'DIM_SIZES') {
        let size = attribute['entry'][0]['value'];
        if (size !== "0")
          keptAttributes['size'] = [parseInt(size)];
      }
      if (attribute['name'] === 'DEPEND_1') {
        keptAttributes['DEPEND_1'] = attribute['entry'][0]['value'];
      }
      if (attribute['name'] === 'LABL_PTR_1') {
        keptAttributes['LABL_PTR_1'] = attribute['entry'][0]['value'];
      }
      if (attribute['name'] === 'VAR_TYPE') {
        keptAttributes['VAR_TYPE'] = attribute['entry'][0]['value'];
      }      
    }
    return keptAttributes;
  }

  function requestVariableDetails(url, fname, ididx) {

    if (fs.existsSync(fname)) {
      console.log("Reading: " + fname);
      let body = fs.readFileSync(fname, 'utf-8');
      //console.log("Read:    " + fname);
      finished(ididx, fname, body, true)
      return;
    }

    let reqOpts = {uri: url, pool: pool, headers: {'Accept':'application/json'}};
    console.log("Requesting: " + url);
    request(reqOpts, function (err,res,body) {
      if (err) console.log(err);
      console.log("Received: " + url);
      finished(ididx, fname, body, false);
    });
  }

  function finished(ididx, fname, body, fromCache) {

    if (!finished.N) {finished.N = 0;}
    finished.N = finished.N + 1;

    if (!body) {
      console.error("Problem with: " + fname);
      return;
    }

    if (body.match("Internal Server Error") || body.match("Bad Request") || body.match("No data available") || body.match("Not Found")) {
      console.error("Problem with: " + fname);
      return;
    }

    body = JSON.parse(body);

    if (!body['CDF']) {
      console.error("Problem with: " + fname);
      return;
    }
  
    if (body && body['Error'] && body['Error'].length > 0) {
      console.error("Request for "
          + CATALOG[ididx]['id']
          + " gave\nError: "
          + body['Error'][0]
          + "\nMessage: "
          + body['Message'][0]
          + "\nStatus: "
          + body['Message'][0]);
      return;
      //console.log(body);
      //process.exit(1);
    }

    // Keep only first two data records.
    let cdfVariables = body['CDF'][0]['cdfVariables'];
    for ([idx, variable] of Object.entries(cdfVariables['variable'])) {
      let cdfVarRecords = variable['cdfVarData']['record'];
      if (cdfVarRecords.length > 2) {
        body['CDF'][0]['cdfVariables']["variable"][idx]['cdfVarData']['record'] = cdfVarRecords.slice(0, 2);
      }
    }

    if (fromCache == false) {
      console.log("Writing: " + fname);
      fs.writeFileSync(fname, JSON.stringify(body, null, 4));
      //console.log("Wrote:   " + fname);
    }

    let cdfGAttributes = body['CDF'][0]['cdfGAttributes']['attribute'];
    for (attribute of cdfGAttributes) {
      if (attribute['name'] === 'TIME_RESOLUTION') {
        CATALOG[ididx]['cadence'] = attribute['entry'][0]['value'];
      }
    }

    //let cdfVariables = body['CDF'][0]['cdfVariables'];
    if (cdfVariables.length > 1) {        
      console.log("More than one cdfVariable");
      console.error(cdfVariables)
      process.exit(1);
    }

    for (variable of cdfVariables['variable']) {
      let vAttributesKept = cdfVAttributes(variable['cdfVAttributes']['attribute']);

      if (!CATALOG[ididx]['_parameters'][variable['name']]) {
        CATALOG[ididx]['_parameters'][variable['name']] = {};
        // CATALOG[ididx]['_parameters'] was initialized with
        // all of the variables returned by /variables endpoint.
        // This list does not include support variables. So we add them
        // here. 
        CATALOG[ididx]['_parameters'][variable['name']]['name'] = variable['name'];
      }
      CATALOG[ididx]['_parameters'][variable['name']]['vAttributesKept'] = vAttributesKept;
      CATALOG[ididx]['_parameters'][variable['name']]['variable'] = variable;
    }

    if (finished.N == CATALOG.length) {
      finalizeCatalog(CATALOG);
    }
  }
}

function extractLabel(labelVariable) {

  let delimiter = labelVariable['cdfVarData']['record'][0]['elementDelimiter'];
  let re = new RegExp(delimiter,'g');
  let label = labelVariable['cdfVarData']['record'][0]['value'][0]
                .replace(re,"")
                .replace(/[^\S\r\n]/g,"")
                .trim()
                .split("\n")
    return label;
}

function extractDepend1(depend1Variable) {

  if (depend1Variable['cdfVarInfo']['cdfDatatype'] !== "CDF_CHAR") {
    console.error("DEPEND_1 variable '" + depend1Variable['name'] + "' is not of type CDF_CHAR");
    console.error('This case is not implemented.');
    process.exit(0);
  }

  let delimiter = depend1Variable['cdfVarData']['record'][0]['elementDelimiter'];
  let re = new RegExp(delimiter,'g');
  let depend1 = depend1Variable['cdfVarData']['record'][0]['value'][0]
                .replace(re,"")
                .replace(/[^\S\r\n]/g,"")
                .trim()
                .split("\n")
    return depend1;
}

function finalizeCatalog(CATALOG) {

  for (dataset of CATALOG) {

    let pidx = 0;
    dataset['parameters'] = [];

    if (dataset['cadence']) {
      dataset['cadence'] = str2ISODuration(dataset['cadence']);
    }  

    for (parameter of Object.keys(dataset['_parameters'])) {

      if (dataset['_parameters'][parameter]['vAttributesKept']['VAR_TYPE'] === "metadata") {
        continue;
      }

      let copy = JSON.parse(JSON.stringify(dataset['_parameters'][parameter]));
      dataset['parameters'].push(copy);

      // Move kept vAttributes up
      for (key of Object.keys(dataset['_parameters'][parameter]['vAttributesKept'])) {
        dataset['parameters'][pidx][key] = dataset['_parameters'][parameter]['vAttributesKept'][key];
      }
      // Remove non-HAPI content
      delete dataset['parameters'][pidx]['vAttributesKept'];
      delete dataset['parameters'][pidx]['variable']
      delete dataset['parameters'][pidx]['VAR_TYPE'];

      // Extract DEPEND_1
      if (dataset['_parameters'][parameter]['vAttributesKept']['DEPEND_1']) {
        let DEPEND_1 = dataset['_parameters'][parameter]['vAttributesKept']['DEPEND_1'];
        let depend1 = extractDepend1(CATALOG[ididx]['_parameters'][DEPEND_1]['variable'])
        if (depend1.length == 3 && depend1[0] === 'x_component' && depend1[1] === 'y_component' && depend1[2] === 'z_component') {
          dataset['parameters'][pidx]['vectorComponents'] = ['x', 'y', 'z']
        } else {
          dataset['parameters'][pidx]['depend1'] = depend1;
          delete dataset['parameters'][pidx]['DEPEND_1'];
        }
      }

      // Extract labels
      if (dataset['_parameters'][parameter]['vAttributesKept']['LABL_PTR_1']) {
        let LABL_PTR_1 = dataset['_parameters'][parameter]['vAttributesKept']['LABL_PTR_1'];
        let label = extractLabel(CATALOG[ididx]['_parameters'][LABL_PTR_1]['variable'])
        dataset['parameters'][pidx]['label'] = label;
        delete dataset['parameters'][pidx]['LABL_PTR_1'];
      }

      pidx = pidx + 1;
    }
  }

  let fnameAllFull = 'all-cdas-full.json' 
  console.log("Writing: " + fnameAllFull);
  fs.writeFileSync(fnameAllFull, JSON.stringify(CATALOG, null, 2));

  for (dataset of CATALOG) {
    delete dataset['_parameters'];
  }
  let fnameAll = 'all-cdas.json' 
  console.log("Writing: " + fnameAll);
  fs.writeFileSync(fnameAll, JSON.stringify(CATALOG, null, 2));

  function str2ISODuration(cadenceStr) {

    let cadence;
    if (cadenceStr.match(/day/)) {
      cadence = "P" + cadenceStr.replace(/\s.*days?/,'D');
    } else if (cadenceStr.match(/hour/)) {
      cadence = "PT" + cadenceStr.replace(/\s.*hours?/,'H');
    } else if (cadenceStr.match(/minute/)) {
      cadence = "PT" + cadenceStr.replace(/\s.*minute?/,'M');
    } else if (cadenceStr.match(/second/)) {
      cadence = "PT" + cadenceStr.replace(/\s.*second?/,'S');
    } else {
      console.log("Could not parse cadence: " + cadenceStr);
    }
    return cadence;
  }
}
