module.exports = rootInit

const path = require('path')
const log = require('log')

function rootInitOptions (argv, localAll) {
  return {
    initProxy: {
      allowOpenProxy: false,
      handleNotFound: false
    },
    initUI: {
      indexHTMLFile: path.join(__dirname, '..', 'node_modules', 'hapi-server-ui', 'index.htm'),
      verifier: argv.verifier,
      plotServer: argv.plotserver,
      proxyServer: 'proxy?url=',
      handleNotFound: false
    },
    initAll: {
      // Data from the next two are combined and returned in response to /all.txt
      allFiles: argv['server-ui-include'] || [],
      allArray: localAll,
      handleNotFound: false
    }
  }
}

function rootInit (app, argv, localAll, setHeaders, cb) {
  const base = path.join(__dirname, '..', 'node_modules', 'hapi-server-ui', 'server', 'lib')
  const initAll = require(path.join(base, 'initAll.js'))
  const initUI = require(path.join(base, 'initUI.js'))
  const initProxy = require(path.join(base, 'initProxy.js'))
  const init404 = require(path.join(base, 'init404.js'))

  // Caution: argv["proxy-whitelist"] and argv["server-ui-include"] should
  // contain only files and URLs that are are trusted.
  const proxyWhiteListFiles = []
  if (argv['proxy-whitelist']) {
    proxyWhiteListFiles.push(argv['proxy-whitelist'])
  }
  if (argv['server-ui-include']) {
    proxyWhiteListFiles.push(...argv['server-ui-include'])
  }
  const noProxy = proxyWhiteListFiles.length === 0

  const opts = rootInitOptions(argv, localAll)

  opts.ui = opts.initUI
  // initUI(app, {opts["initUI"],opts["initProxy"]})

  if (noProxy === true) {
    log.info('No proxy whitelist files given. Not enabling proxy endpoint.')
    initAll(app, opts.initAll)
    initUI(app, opts.initUI)
    init404(app)
    cb(null)
    return
  }

  log.info('Proxy whitelist files given. Enabling /proxy endpoint.')
  initProxy(app, proxyWhiteListFiles, opts.initProxy, (err) => {
    if (err) {
      log.error(err, true)
      cb(err)
      return
    }
    initAll(app, opts.initAll)
    initUI(app, opts.initUI)
    init404(app)
    cb(null)
  })
}
