const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const semver = require('semver')

// Run tests on tests given in data node.
const test = require('./test.js')

// Logging
const log = require('log')

// Command line interface
const argv = require('./cli.js').argv

// Command line configuration variables
const conf = require('./conf.js')

const trimPath = require('./trimPath.js')

exports.metadata = metadata
function metadata (catalog, part, id) {
  if (id) {
    return metadata.cache[catalog][part][id]
  } else {
    return metadata.cache[catalog][part]
  }
}

exports.prepmetadata = prepmetadata
function prepmetadata (FILES, FORCE, IGNORE, SKIP_CHECKS, cb) {
  const retryFailedPrep = 60 // seconds

  if (!prepmetadata.Nservers) {
    prepmetadata.Nservers = FILES.length
    const plural = prepmetadata.Nservers > 1 ? 's.' : '.'
    const msg = 'Preparing metadata for ' + prepmetadata.Nservers + ' server' + plural
    log.info('-'.repeat(msg.length))
    log.info(msg)
  }

  if (FILES.length === 0) {
    const plural = prepmetadata.Nservers > 1 ? 's.' : '.'
    const msg = 'Prepared metadata for ' + prepmetadata.Nservers + ' server' + plural
    log.info(msg)
    cb()
    return
  }

  const serverfile = FILES[0]

  if (!metadata.cache) {
    metadata.cache = {}
  }

  // Read file passed as -f argument on command line
  const json = readCatalogConfig(serverfile)

  const HAPI = json.server.HAPI
  json.status = { code: 1200, message: 'OK' }

  const catalogid = json.server.id
  metadata.cache[catalogid] = {}
  metadata.cache[catalogid].server = json.server

  // /hapi (landing).
  // Set
  // metadata.cache[catalogid]['server']['landingHTML'] and
  // metadata.cache[catalogid]['server']['landingPath']
  landing(json, serverfile, catalogid, IGNORE)

  // /about
  if (json.about && semver.satisfies(HAPI + '.0', '>=3.0')) {
    json.about.status = json.status
    validHAPIJSON(json.about, HAPI, 'about', IGNORE)
    metadata.cache[catalogid].about = json.about
  }

  // /capabilities
  const capabilities = {
    HAPI,
    outputFormats: ['csv', 'binary', 'json'],
    status: json.status
  }

  if (semver.satisfies(HAPI + '.0', '>=3.2.0')) {
    capabilities.catalogDepthOptions = ['dataset', 'all']
  }

  // Sync function; will throw error or warning.
  validHAPIJSON(capabilities, HAPI, 'capabilities', IGNORE)
  metadata.cache[catalogid].capabilities = capabilities

  // Command line program information
  const formats = json.data.formats || 'csv'
  if (!json.data.file && !json.data.command && !json.data.url) {
    const msg = "A 'file', 'command', or 'url' must be specified in the 'data' node."
    log.error(msg, true)
  }

  // TODO: Write schema for data node. As written,
  // if a command is specified, it will be used and file and url
  // will be ignored. Need to catch this error.

  if (json.data.file) {
    json.data.file = conf.replaceConfigVars(json.data.file)
    if (/\${/.test(json.data.file) === false && !fs.existsSync(json.data.file)) {
      const msg = json.data.file + ' referenced in ' + catalogid + ' not found.'
      log.error(msg, true)
    }
  }

  if (json.data.command) {
    json.data.command = conf.replaceConfigVars(json.data.command)
    if (json.data.testcommands !== undefined) {
      json.data.testcommands = conf.replaceConfigVars(json.data.testcommands)
    }
  }

  metadata.cache[catalogid].data = JSON.parse(JSON.stringify(json.data))

  jsonWarn(formats, catalogid)

  const updateSeconds = json.server['catalog-update']
  if (updateSeconds) {
    if (!Number.isInteger(updateSeconds)) {
      log.error(serverfile + ' has a non-integer value for server.catalog-update.', true)
    }
    if (updateSeconds < 0) {
      log.error(serverfile + ' has a negative value for server.catalog-update.', true)
    }
    log.info('Updating ' + catalogid + ' every ' + updateSeconds + ' seconds.')
    setInterval(() => {
      updatemetadata(FORCE, IGNORE, SKIP_CHECKS, json, (e) => {
        const catalogid = json.server.id
        log.info('Updating ' + catalogid)
        if (e) {
          log.info('Failure in updating ' + catalogid + '. Will use last version.')
          // TODO: Send email?
        } else {
          log.info('Updated ' + catalogid)
        }
      })
    }, updateSeconds * 1000)
  }

  updatemetadata(FORCE, IGNORE, SKIP_CHECKS, json, (err) => {
    FILES.shift()
    if (err) {
      const badFILE = serverfile
      let msg = `Could not create metadata for ${catalogid} due to error. `
      msg += `Retrying in ${retryFailedPrep} seconds.`
      log.info(msg)
      setTimeout(() => {
        prepmetadata([badFILE], FORCE, IGNORE, SKIP_CHECKS, cb)
      }, retryFailedPrep * 1000)
      return
    }
    if (json.data.testcommands !== undefined && SKIP_CHECKS === false) {
      const Nc = json.data.testcommands.length
      const plural = Nc > 1 ? 's' : ''
      log.info(`Executing ${Nc} test command${plural}.`)
      test.commands(json.data.testcommands, catalogid, true)
      log.info(`Executed test command${plural}.`)
    }
    let msg = 'Finished reading, parsing, and resolving metadata in '
    msg += trimPath(serverfile)
    log.info(msg)
    prepmetadata(FILES, FORCE, IGNORE, SKIP_CHECKS, cb)
  })
}

function updatemetadata (FORCE, IGNORE, SKIP_CHECKS, json, cb) {
  // Given the contents of the catalog file specified on the command line on start-up,
  // resolve any references to external parts and then populate metadata.cache, which
  // is used by /catalog and /info.

  const catalog = { catalog: [] }
  const catalogid = json.server.id

  if (!metadata.newcache) {
    metadata.newcache = {}
  }

  metadata.newcache[catalogid] = {}
  for (const key in metadata.cache[catalogid]) {
    if (key !== 'catalog') {
      metadata.newcache[catalogid][key] = metadata.cache[catalogid][key]
    }
  }

  metadata.newcache[catalogid].ids = []
  metadata.newcache[catalogid].info = {}
  metadata.newcache[catalogid]['info-raw'] = {}

  catalog.HAPI = json.server.HAPI
  catalog.status = json.status

  getmetadata(json, 'catalog', FORCE, (e, xcatalog) => {
    if (e) {
      log.error(e, !FORCE)
      if (FORCE) cb(e)
    } else {
      createcat(0, xcatalog)
    }
  })

  function createcat (dsNumber, xcatalog) {
    // Each element of xcatalog is a dataset
    // Resolve info nodes and checks catalog and info.

    if (!xcatalog[dsNumber]) {
      const msg = `Dataset number ${dsNumber} does not have an id element.`
      log.error(msg, true)
    }

    const id = xcatalog[dsNumber].id

    if (dsNumber === 0) {
      log.info(`Reading, parsing, and resolving metadata for ${catalogid}`)
    }

    metadata.newcache[catalogid].ids.push(id)

    catalog.catalog[dsNumber] = xcatalog[dsNumber]

    getmetadata(xcatalog[dsNumber], 'info', FORCE, (e, info) => {
      if (e) {
        log.error(e, !FORCE)
        if (FORCE) cb(e)
      } else {
        checkinfo(info)
      }
    })

    function checkinfo (info) {
      for (const infoType of ['info', 'info_inline', 'info_url', 'info_file', 'info_command']) {
        delete catalog.catalog[dsNumber][infoType]
      }

      info = JSON.parse(JSON.stringify(info))
      info.HAPI = json.server.HAPI
      info.status = json.status

      // Resolve JSON refs in info.
      const infoResolved = resolveJSONRefs(JSON.parse(JSON.stringify(info)))
      if (SKIP_CHECKS === false) {
        // log.info("Checking schema validity of /info response metadata for " + id);
        validHAPIJSON(infoResolved, info.HAPI, 'info', IGNORE, xcatalog[dsNumber].id)
        // log.info("Checked schema validity of /info response metadata for " + id);
      }
      delete infoResolved.definitions
      metadata.newcache[catalogid].info[id] = infoResolved
      metadata.newcache[catalogid]['info-raw'][id] = info

      if (dsNumber < xcatalog.length - 1) {
        createcat(++dsNumber, xcatalog)
      } else {
        checkcat()
      }
    }

    function checkcat () {
      if (SKIP_CHECKS === false) {
        log.info('Checking schema validity of /catalog response metadata for ' + catalogid)
        validHAPIJSON(catalog, json.server.HAPI, 'catalog', IGNORE)
        // log.info("Checked schema validity of /catalog response metadata for " + catalogid);
      }
      metadata.newcache[catalogid].catalog = catalog
      // Update of metadata complete. Copy update to metadata.cache.
      metadata.cache[catalogid] = Object.assign({}, metadata.newcache[catalogid])
      metadata.newcache[catalogid] = {}
      cb()
    }
  }
}

function getmetadata (obj, nodeType, FORCE, cb) {
  function metadataType (json, nodeType) {
    if (json[nodeType + '_file']) {
      return 'file'
    } else if (json[nodeType + '_url']) {
      return 'url'
    } else if (json[nodeType + '_command']) {
      return 'command'
    } else if (json[nodeType + '_inline']) {
      return 'inline'
    } else if (json[nodeType]) {
      return null
    } else {
      return undefined
    }
  }

  function getinfos (caturl, catalog, cb) {
    getone(0)

    function getone (i) {
      if (i === catalog.length) {
        cb(null, catalog)
        return
      }
      const url = caturl.replace('hapi/catalog', 'hapi/info') + '?id=' + catalog[i].id
      request(url, (e, data) => {
        if (e) {
          cb(e)
        } else {
          try {
            catalog[i].info = JSON.parse(data.toString())
          } catch (e) {
            log.error(url + ' output is not JSON parse-able. Try https://jsonlint.com/.', !FORCE)
            cb(e)
          }
          getone(++i)
        }
      })
    }
  }

  function request (url, cb) {
    log.info('Getting ' + url)

    function process_ (resp) {
      let data = ''

      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk
      })
      resp.on('end', () => {
        log.info('Got ' + url)
        cb(null, data)
      })
    }

    if (url.substring(0, 5) === 'https') {
      https.get(url, process_).on('error', (err) => cb(err))
    } else {
      http.get(url, process_).on('error', (err) => cb(err))
    }
  }

  function readfile (fname, cb) {
    log.info('Reading ' + trimPath(fname))
    fs.readFile(fname, 'utf8', (e, info) => {
      if (e) {
        log.error('Could not read ' + fname + '. Error message: ' + e.message, !FORCE)
        if (FORCE) cb(e)
      }
      try {
        info = JSON.parse(info)
      } catch (e) {
        log.error(fname + ' is not JSON.parse-able. Try https://jsonlint.com/.', !FORCE)
        if (FORCE) cb(e)
      }
      cb(null, info)
    })
  }

  const type = metadataType(obj, nodeType)
  if (type === 'inline') {
    // obj is inline JSON.
    cb(null, obj[nodeType + '_' + type])
    return
  }

  if (type === undefined) {
    const msg = `No '${nodeType}_{file,url,command,inline}', or '${nodeType}' node found.`
    log.error(msg, true)
  }

  let nodeStr = ''
  if (type === null) {
    if (typeof (obj[nodeType]) === 'object') {
      // obj is inline JSON.
      cb(null, obj[nodeType])
      return
    } else {
      log.warn(`Warning: '${nodeType}' is deprecated. Use '${nodeType}_{file,command,url,inline}'`)
      nodeStr = obj[nodeType]
    }
  } else {
    nodeStr = obj[nodeType + '_' + type]
  }

  nodeStr = conf.replaceConfigVars(nodeStr)
  // nodeStr = nodeStr.trimStart();

  if (type === 'url' || (nodeType == null && nodeStr.startsWith('http'))) {
    log.info('Requesting ' + nodeStr)
    request(nodeStr, (e, data) => {
      if (e) {
        log.error('Error getting ' + nodeStr + ': ' + e.message, !FORCE)
        if (FORCE) cb(e)
      }
      const jsonstr = data.toString()
      try {
        obj = JSON.parse(jsonstr)
      } catch (e) {
        nodeStr += nodeStr + ' output is not JSON parse-able. Try https://jsonlint.com/. Exiting. '
        log.error(nodeStr, !FORCE)
        if (FORCE) cb(e)
      }
      if (nodeType === 'catalog' && /hapi\/catalog\/?$/.test(nodeStr)) {
        let msg = 'catalog node in server configuration is a HAPI server. '
        msg += 'Getting info metadata for all server datasets.'
        log.info(msg)
        getinfos(nodeStr, obj.catalog, (e, obj) => {
          if (e) {
            log.error(e.message, !FORCE)
            if (FORCE) cb(e)
          } else {
            cb(null, obj)
          }
        })
      } else {
        cb(null, obj)
      }
    })
  } else if (type === 'file' || (nodeType == null && nodeStr.startsWith('file:'))) {
    log.info('Executing: ' + nodeStr)
    readfile(nodeStr, cb)
  } else if (type === 'command') {
    nodeStr = nodeStr.trim()
    log.info('Executing: ' + nodeStr)
    const eopts = { cwd: path.join(__dirname, '..'), maxBuffer: 100000000 }
    require('child_process').exec(nodeStr, eopts, (e, info) => {
      if (e) {
        log.error(e.message.replace(/\n$/, '').replace('\n', '\n  '), !FORCE)
        if (FORCE) cb(e)
      } else {
        try {
          info = JSON.parse(info)
        } catch (e) {
          log.error(nodeStr + ' output is not JSON parse-able. Try https://jsonlint.com/. Exiting.', !FORCE)
          if (FORCE) cb(e)
        }
        cb(null, info)
      }
    })
  } else if (type == null) {
    // See: https://github.com/hapi-server/server-nodejs/issues/24
    // Attempt to execute as a command first and if parseable JSON is returned, use that.
    // Otherwise, attempt to read as a file.
    log.info(`'${nodeType}' is ambiguious. It could be a file or command. Attempting to evaluate as a command.`)
    log.info(`Attempting to execute '${nodeStr}'`)
    const eopts = { cwd: path.join(__dirname, '..'), maxBuffer: 100000000 }
    require('child_process').exec(nodeStr, eopts, (e, info) => {
      if (!e) {
        try {
          info = JSON.parse(info)
          cb(null, info)
        } catch (e) {
          log.info(`'${nodeStr}' was not a command that returned JSON. Attempting to read '${nodeStr}' as a file.`)
          readfile(nodeStr, cb)
        }
      } else {
        readfile(nodeStr, cb)
      }
    })
  }
}

function readCatalogConfig (file) {
  if (!fs.existsSync(file)) {
    log.error('Did not find ' + file + '. Exiting.')
    process.exit(1)
  }

  let fileStr
  log.info('Start reading, parsing, and resolving ' + trimPath(file))
  try {
    fileStr = fs.readFileSync(file)
  } catch (ex) {
    log.error(file + ' is not readable: ' + ex.message, true)
  }

  let json
  try {
    json = JSON.parse(fileStr)
  } catch (ex) {
    const msg = file + ' is not JSON parse-able. Try https://jsonlint.com/. Message: ' + ex.message
    log.error(msg, true)
  }

  // If catalog is missing
  if (!json.catalog && !json.catalog_file && !json.catalog_url && !json.catalog_command && !json.catalog_inline) {
    log.error(file + " does not have a 'catalog' or 'catalog_{file,url,command,inline}'", true)
  }

  if (!json.data) {
    const msg = file + " must have a 'data' object"
    log.error(file + msg, true)
  }
  if (!json.data.contact) {
    const msg = file + ' must have a non-empty string value in data.contact'
    log.error(file + msg, true)
  }
  if (json.data.timeout === undefined) {
    // If no data received in 59 seconds, 500 error.
    json.data.timeout = 59000
  }

  if (!json.server) {
    json.server = {}
  }
  if (!json.about) {
    json.about = {}
  }

  function select (key, exitIfNeitherMsg, neitherMsg) {
    if (json.server[key] && json.about[key]) {
      json.server[key] = json.about[key]
      log.warn(`Both server.${key} and about.${key} are given. Using about.${key}.`)
    } else if (!json.server[key] && !json.about[key]) {
      if (exitIfNeitherMsg) {
        log.error(neitherMsg, true)
      } else {
        log.warn(neitherMsg)
      }
      json.server[key] = path.parse(file).name
    } else if (json.server[key] && !json.about[key]) {
      json.about[key] = json.server[key]
    } else {
      json.server[key] = json.about[key]
    }
  }

  select('id', true, file + " must have a non-empty 'id' value in either the server or about object.")
  select('contact', true, file + " must have a non-empty server 'contact' value in the server or about object.")

  let vmsg = ' should have a non-empty version string for HAPI in '
  vmsg += 'the server object or the about object for HAPI 3.0+. '
  vmsg += 'Assuming "2.1."'
  select('HAPI', false, vmsg)
  if (!json.server.HAPI && !json.about.HAPI) {
    json.server.HAPI = '2.1'
  }

  if (!json.server.prefix) {
    json.server.prefix = json.server.id
  }

  return json
}

function landing (json, serverfile, catalogid, IGNORE) {
  // Landing page html
  let landingFile = ''
  let landingPath = ''

  if (json.server.landingFile && typeof (json.server.landingFile) === 'string') {
    landingFile = conf.replaceConfigVars(json.server.landingFile)
    log.info(`Using landingFile = ${trimPath(landingFile)}`)
  }
  if (json.server.landingPath && typeof (json.server.landingPath) === 'string') {
    landingPath = conf.replaceConfigVars(json.server.landingPath)
    log.info(`Using landingPath = ${trimPath(landingPath)}`)
    if (landingFile === '') {
      landingFile = 'index.htm'
      log.info(`Using landingFile = ${trimPath(landingFile)}`)
    }
  }

  if (landingFile === '' && landingPath === '') {
    const uiDir = path.join(__dirname, '..', 'node_modules', 'hapi-server-ui')
    landingFile = path.normalize(path.join(uiDir, 'single.htm'))
    landingPath = path.normalize(uiDir)
    log.info('No landingFile or landingPath given in')
    log.info(`  ${trimPath(serverfile)}`)
    log.info('  Will use')
    log.info(`  landingFile = ${trimPath(landingFile)}`)
    log.info('  and ')
    log.info(`  landingPath = ${trimPath(landingPath)}`)
  }


  const resolvedFile = fs.realpathSync(landingFile)
  if (!fs.existsSync(landingFile) || !fs.lstatSync(landingFile).isFile()) {
    log.error(`landingFile = '${landingFile}' not found or is not a file.`, true)
  }

  const resolvedPath = fs.realpathSync(landingPath)
  if (!fs.existsSync(resolvedPath) || !fs.lstatSync(resolvedPath).isDirectory()) {
      log.error(`landingPath = '${landingPath}' not found or is not a directory.`, true)
  }

  let landingHTML = fs
    .readFileSync(landingFile, 'utf8').toString()
    .replace(/__CATALOG__/g, catalogid.replace(/.*\//, ''))
    .replace(/__VERIFIER__/g, argv.verifier)
    .replace(/__PLOTSERVER__/g, argv.plotserver)

  if (json.server.HAPI) {
    landingHTML = landingHTML.replace(/__VERSION__/g, json.server.HAPI)
  }
  if (json.data.contact) {
    landingHTML = landingHTML.replace(/__DATACONTACT__/g, json.data.contact)
  }

  let serverContact = json.server.contact
  if (json.about && json.about.contact) {
    serverContact = json.about.contact
  }
  if (serverContact) {
    landingHTML = landingHTML.replace(/__SERVERCONTACT__/g, serverContact)
  }

  if (landingPath === '' && landingFile !== '') {
    if (!fs.existsSync(landingFile)) {
      const msg = 'Did not find landing file: ' + landingFile + '. '
      if (IGNORE) {
        log.info(msg + 'Will start server with no landing page because ignore=true.')
      } else {
        log.error(msg + 'Exiting b/c ignore=false.', true)
      }
    }
  }

  metadata.cache[catalogid].server.landingHTML = landingHTML
  metadata.cache[catalogid].server.landingPath = landingPath
}

function validHAPIJSON (json, schema, subschema, IGNORE, dsid) {
  const is = require('hapi-server-verifier').is
  const v = is.HAPIJSON(json, schema, subschema)

  let msg = ''
  if (dsid) {
    msg = ' for dataset ' + dsid
  }

  if (v.error) {
    log.error(`Invalid HAPI '${json.HAPI}' /${subschema} node${msg}. Error(s):\n${v.got}`)
    if (IGNORE) {
      log.warn('Starting server with invalid HAPI because --ignore command-line option used.')
    } else {
      log.warn('Use the --ignore command-line option to start the server when metadata is not schema-valid. Exiting.')
      process.exit(1)
    }
  }
}

function jsonWarn (formats, catalogid) {
  if (!formats.includes('json')) {
    // If data program does not produce JSON, see if
    // any multi-dimensional arrays and warn.
    for (const i in metadata.cache[catalogid].info) {
      for (let j = 0; j < metadata.cache[catalogid].info[i].parameters.length; j++) {
        if (metadata.cache[catalogid].info[i].parameters[j].size) {
          if (metadata.cache[catalogid].info[i].parameters[j].size.length > 1) {
            log.warn('Warning: ' + i + '/' +
                  metadata.cache[catalogid].info[i].parameters[j].name +
                  ' has size.length > 1 and data program does not produce JSON.' +
                  ' Server cannot produce JSON from CSV for this parameter.')
          }
        }
      }
    }
  }
}

function resolveJSONRefs (obj) {
  if (obj && obj.definitions === undefined) {
    return obj
  }
  const definitions = obj.definitions

  // Slightly modified version of
  // https://willseitz-code.blogspot.com/2013/01/javascript-to-deserialize-json-that.html

  // This resolver does not handle external references.
  // Resolvers that handle external references on npm require
  // async/await, which was introduced in node 8. I want to continue
  // using node 6 so that binary packages can be updated without
  // the need update the node binaries.
  const hashOfObjects = {}

  const collectIds = function (obj) {
    if (!obj) { return }
    if (typeof (obj) === 'object') {
      if (Object.prototype.hasOwnProperty.call(obj, '$ref')) {
        // Remove #/definitions/ from $ref
        const name = obj.$ref.replace(/.*\//, '')
        hashOfObjects[obj.$ref] = definitions[name]
      }
      for (const prop in obj) {
        collectIds(obj[prop])
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(function (element) {
        collectIds(element)
      })
    }
  }

  const setReferences = function (obj) {
    if (!obj) { return }
    if (typeof (obj) === 'object') {
      for (const prop in obj) {
        if (obj[prop] && typeof (obj[prop]) === 'object' && Object.prototype.hasOwnProperty.call(obj[prop], '$ref')) {
          obj[prop] = hashOfObjects[obj[prop].$ref]
        } else {
          setReferences(obj[prop])
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(function (element, index, array) {
        if (element && typeof (element) === 'object' &&
          Object.prototype.hasOwnProperty.call(element, '$ref')) {
          array[index] = hashOfObjects[element.$ref]
        } else {
          setReferences(element)
        }
      })
    }
    return obj
  }

  collectIds(obj)
  return setReferences(obj)
}
