const log = require('log');

module.exports = initServer;
function initServer(CATALOGS, PREFIXES, app, argv) {

  let protocol = argv.https ? "https" : "http";
  let options = serverOptions(argv);

  // List all routes (https://stackoverflow.com/a/35089029):
  let routes = app._router.stack.filter(r => r.route).map(r => r.route.path);
  for (let route of routes) {
    log.debug("Route: " + route);
  }

  startServer(protocol, argv.port, app, options, argv.test || argv.verify);

  function startServer(protocol, port, app, options, find_open_port) {

    if (find_open_port) {
      getPort(port, 0, start);
    } else {
      start(port);
    }

    function start(port) {

      log.info("Starting server on port " + port);
      require(protocol)
        .createServer(options, app)
        .on('error', (err) => {
          log.error(err,true);
        })
        .listen(port, function () {
          let url = protocol + '://localhost:' + port;
          startupMessages(url);

          if (argv.open) {
            // Open browser window
            var start = (process.platform == 'darwin' ? 'open': process.platform == 'win32' ? 'start': 'xdg-open');
            require('child_process').exec(start + ' ' + url);
          }

          if (argv.test) {
            const test = require('./test.js');
            // Exits with signal 0 or 1
            test.urls(CATALOGS, PREFIXES, url);
          }

          if (argv.verify) {
            // Run verifier
            // TODO: This only verifies first server

            const metadata = require('./metadata.js').metadata;
            const verify   = require('hapi-server-verifier').tests.run;

            let serverConfig = metadata(PREFIXES[0],'server');
            // verify() exits with code 1 if error.
            let vopts = {"url": url + "/" + PREFIXES[0] + "/hapi", "output": "console"};
            if (serverConfig.verify) {
              log.debug(`server.verify = ${serverConfig.verify} given; Verifying only this dataset.`);
              // If server has many datasets, select subset to verify.
              verify({...vopts, "id": serverConfig.verify});
            } else {
              log.debug("Verifying all datasets.")
              verify(vopts);
            }
          }
        });
    }

    function getPort(port, tries, cb) {

      // Find the first available port. Asynchronously checks, so first port
      // determined as available is returned.
      let porti = 3000;
      let portf = 3050;
      log.debug(`Looking for an open port in range [${porti}, ${portf}]`)
      var portscanner = require('portscanner');
      portscanner.findAPortNotInUse(porti, portf, '127.0.0.1', function(error, port) {
        if (error) {
          log.error(error,true);
          return;
        }
        log.debug(`Port ${porti} is not in use.`);
        cb(port);
      });
    }

    function startupMessages(url){

      log.info("Listening at " + url);

      log.info("HAPI server list is at");
      log.info("  " + url);
      log.info("This server provides");
      for (var i = 0;i < CATALOGS.length;i++) {
        log.info("  " + url + "/" + PREFIXES[i] + "/hapi");
      }

      log.info("To open a browser at " + url + ", use the --open option.");
      log.info("To run test URLs and exit, use the --test option.");
      log.info("To run command-line verification tests and exit, use the --verify option.");

    }

  }

  function serverOptions(argv) {

    const fs = require('fs');

    let options = {};
    let protocol = "http";
    if (argv.https === false) {
      log.info("Server will use http.");
    } else {
      log.info("Server will use https.");
      if (argv.key == undefined && argv.cert != undefined) {
        log.error("If --cert is given, key must be given.",true);
      }
      if (argv.key != undefined && argv.cert == undefined) {
        log.error("If --key is given, --cert must be given.",true);
      }
      if (argv.key && !fs.existsSync(argv.key)) {
        log.error("Could not find https key file " + argv.key,true);
      }
      if (argv.cert && !fs.existsSync(argv.cert)) {
        log.error("Could not find https cert file " + argv.cert,true);
      }

      if (argv.cert && argv.key) {
        // Both cert and key file given
        options = {
          key:  fs.readFileSync(argv.key),
          cert: fs.readFileSync(argv.cert)
        };
      } else {
        // Generate key and cert file
        if (process.platform.startsWith("win")) {
          log.error("Generation of SSL key and certifications files not implemented on Windows",true);
        }
        let com = 'sh \"' + __dirname + '/../ssl/gen_ssl.sh' + '\"';

        // execSync requires a callback. Replaced it with spawnSync.
        let child;
        try {
          child = require('child_process').spawnSync('sh', ['-c', com], {stdio: 'pipe'});
        } catch (ex) {
          log.error("Error when executing: " + com + ".");
          if (ex.stderr) {
            log.error(ex.stderr.toString(),exit_if_fail);
          }
          if (!exit_if_fail) {
            return false;
          }
        }

        if (child.status !== 0) {
          log.error("Command returned non-zero status: " + com + ".");
          if (child.stdout.toString().trim().length > 0)
            log.error("\nstdout:\n" + child.stdout.toString(),true);
          if (child.stderr)
            log.error("\nstderr:\n" + child.stderr.toString(),true);
        }
        // TODO: Report error and exit if key.pem and cert.pem not found.
        options = {
          key:  fs.readFileSync(__dirname + "/../ssl/key.pem"),
          cert: fs.readFileSync(__dirname + "/../ssl/cert.pem")
        };
      }
    }
    return options;
  }

}
