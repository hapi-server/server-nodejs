//~/Desktop/jx_osx64v8/jx package server.js "test" --native
// Lots of compiler errors, but final binary size is much smaller

// nexe works, but does not seem to allow to call internal node

// pkg works, but it seems maybe easier to just include node

// Consider packaging from top-level so no need to expose node_modules

// Alternative method to packaging. Create a single binary
// and then add switch to allow demo files to be created.
// Need to add to main package.json.

  "scripts": {
    "clean": "rm -rf node_modules/; rm -rf public/data/QinDenton/",
    "preinstall": "npm install hapi-server-verifier",
    "postinstall": "ln -s -f node_modules/hapi-server-verifier/verify.js",
    "pkg:osx": "rm -rf dist/hapi-server-${dist}-v$npm_package_version; pkg . -t node6-osx-x64 --public --out-path dist/hapi-server-osx-x64-$npm_package_version",
    "zip:osx": "cp -r public bin metadata lib dist/hapi-server-osx-x64-$npm_package_version; cd dist; zip -r hapi-server-osx-x64-$npm_package_version.zip hapi-server-osx-x64-$npm_package_version",
    "pkg:linux": "rm -rf dist/hapi-server-linux-x64-$npm_package_version; pkg . -t node6-linux-x64 --public --out-path dist/hapi-server-linux-x64-$npm_package_version",
    "zip:linux": "cp -r public bin metadata lib dist/hapi-server-linux-x64-$npm_package_version; cd dist; zip -r hapi-server-linux-x64-$npm_package_version.zip hapi-server-linux-x64-$npm_package_version",
    "test": "node test/test.js",
    "start": "node server.js --port 8999"
  },
  "bin": "server.js",
  "pkg": {
    "assets": [
      "lib/**/*",
      "public/**/*",
      "metadata/**/*",
      "conf/**/*",
      "bin/**/*"
    ]
  }

if (process.pkg) {

	unzipper = require('unzipper');
	fs.createReadStream(__dirname + '/public/demo.zip')
			.pipe(unzipper.Extract({ path: '/tmp' }));

	usage = "hapi-server";
	env = { PKG_EXECPATH: 'PKG_INVOKE_NODEJS' };


	// If just --demo given, use default path.
	if (argv.demo) {
		demodir = 'hapi-server-demo';
		// Write demo files and exit.
		if (!fs.existsSync(demodir)){
			fs.mkdirSync(demodir);
		}

		if (false) {
			// Ideally we would do this, but then all of the main code
			// would need to be wrapped in a function and executed
			// in the (!yargs.demo) case. 
			p = fs.createReadStream(__dirname + '/public/demo.zip').pipe(unzipper.Extract({ path: demodir }))
			p.on('finish', function() {
				console.log('Wrote ' + demodir);
			});
		} else {
			// https://stackoverflow.com/a/50098685/1491619
			// Hack to allow unzip to be syncronous.
			var unzipper = require('unzipper');
			console.log(process.execPath)
			var com = "console.log('" + __dirname + "/public/demo.zip');"//unzipper = require('unzipper');fs.createReadStream(__dirname + '/public/demo.zip').pipe(unzipper.Extract({ path: '" + demodir + "'}))";
			var child = require('child_process').spawnSync(process.execPath, ['-e', com], {stdio: 'pipe',env: env});
			console.log(child.stdout.toString())
			console.log(child.stderr.toString())
			console.log('Wrote demo files to ' + demodir);
			console.log('Execute using, e.g., cd ' + demodir + ';../hapi-server -f metadata/Example0.json');
			process.exit(0);
		}
	}
	var pkgtest = true;
	if (pkgtest) {
		var fse = require('fs-extra');
		fse.copySync(process.cwd() + '/conf/capabilities.json', 'tmp.json');


		console.log("require.main.filename = " + require.main.filename);
		console.log("__dirname = " + __dirname);
		console.log("process.cwd() = " + process.cwd());
		console.log("process.execPath = " + process.execPath);
		console.log("process.argv = ",process.argv);
		if (fs.existsSync(process.argv[2])) {
			console.log('File = ' + process.argv[2]);
		}

		com = process.execPath + " -e 'console.log(process.version);'";
		console.log(com);
		env = { PKG_EXECPATH: 'PKG_INVOKE_NODEJS' };
		var achild = require('child_process')
						.spawn('sh',['-c',com],
							{"encoding":"buffer", env: env}
						)
		achild.stdout.on('data', function (buffer) {
			console.log("sync output: " + buffer.toString());
		})
		achild.stderr.on('data', function (err) {
			console.log(ds() + "Error message: " + clc.red(err.toString()));
		})
		achild.on('exit', function (code) {console.log('async exit')});

		const testFolder = __dirname + '/../';
		console.log(testFolder);
		fs.readdir(testFolder, (err, files) => {
			if (err) console.log(err);		
			files.forEach(file => {
				console.log("-" + file);
			});
		})

		var spawnSync = require('child_process').spawnSync;
		var child = spawnSync(
			process.execPath, [
				'-e', 'console.log("sync output: ",process.version);'
				], {
					stdio: 'pipe',
					// if run under node (process.execPath points to node.exe),
					// then node ignores PKG_EXECPATH, but if run as pkged app,
					// PKG_INVOKE_NODEJS is a hack to access internal nodejs
					env: { PKG_EXECPATH: 'PKG_INVOKE_NODEJS' }
				}
		);
		console.log(child.stdout.toString());
		//process.exit(0);
	}
}