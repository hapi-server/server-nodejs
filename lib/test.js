const http = require('http');
const https = require('https');

const log  = require('../lib/log.js');
const shellcmd  = require('../lib/shellcmd.js');


exports.commands = commands;
exports.urls = urls;

function commands(commandarr, testName, exit_if_fail) {

  let results = [];
  for (var i = 0;i < commandarr.length;i++) {

    command = commandarr[i].command;

    let opts = {"return": "object", "exit_if_fail": exit_if_fail};
    let child = shellcmd.spawnSync(command,opts);

    if (exit_if_fail) {
      log.debug("Running " + testName + " test command " + i + ".");
      log.debug(command);
    }

    if (child.status === 0) {
      commandarr[i].testNumber = i;
      commandarr[i].testName = testName;
      results.push(testoutput(commandarr[i], child.stdout.toString(),exit_if_fail));
    } else {
      if (exit_if_fail) {
        log.error("Command returned non-zero status: " + command + ".");
        if (child.stdout.toString().trim().length > 0)
          log.error("\nstdout:\n" + child.stdout.toString(),true);
        if (child.stderr.toString().trim().length > 0)
          log.error("\nstderr:\n" + child.stderr.toString(),true);
      } else {
        results.push({'err': true, 'msg': msg0 + "\n" + msg1 + "\n" + msg2});
      }
    }

  }
  return results;
}

function urls(CATALOGS, PREFIXES, server, TEST) {

  var metadata = require('./metadata.js').metadata;

  function finished() {
    urls.running = urls.running - 1;
    if (TEST && urls.running == 0) {
      log.info("Exiting with status 0 (pass).");
      process.exit(0);
    }
  }

  if (!urls.running) {
    urls.running = 0;
  }

  let notests = true;
  for (let i=0; i < CATALOGS.length; i++) {
    var d = metadata(CATALOGS[i],'data');
    if (d.testurls) {
      notests = false;
      urls.running = urls.running + 1;
      runtests(d.testurls, CATALOGS[i], PREFIXES[i], finished);
    }
  }
  if (TEST && notests == true) {
    log.info("No URL tests to run. Exiting with status 0 (pass).");
    process.exit(0);
  }

  function runtests(testarr, testName, prefix, cb) {

    function finished() {
      runtests.running = runtests.running - 1;
      if (runtests.running == 0) {
        cb();
      }
    }

    if (!runtests.running) {
      runtests.running = 0;
    }

    for (j = 0; j < testarr.length; j++) {
      runtests.running = runtests.running + 1;
      testarr[j].testNumber = j;
      test(testarr[j], CATALOGS[i]);
    }

    function test(testobj, testName) {
      var tn = testobj.testNumber;
      testurl = server + "/" + prefix + "/hapi/" + testobj["url"];
      testobj.testurl = testurl;
      testobj.testName = testName;
      log.info("Running " + testName + " test URL " + tn + " on " + testurl);

      if (testurl.indexOf("https") == 0) {
        // If HTTP server is started
        // This is needed to suppress errors associated with self-signed SSL
        // certificates. Can be removed if we are using CA certified certificates.
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0
        https.get(testurl, (resp) => {processResponse(resp);});
      } else {
        // If HTTP server is started
        http.get(testurl, (resp) => {processResponse(resp);});
      }

      function processResponse(resp) {
        let data = '';
        resp.on('data', (chunk) => {data += chunk;});
        resp.on('end', () => {
         testoutput(testobj, data, true);
         finished();
        });
      }

    }
  }
}

function testoutput(testobj, body, exit_if_fail) {

  var tn = testobj.testNumber;
  if (testobj.command) {
    type = "command";
    teststr = "";
  }
  if (testobj.url) {
    type = "URL";
    teststr = " for test URL number " + tn;
  }

  function compare(n1,n2,s) {
    let err = false;
    let msg = "";
    if (n1 !== n2) {
      err = true;
      msg = testobj.testName + " test command " + tn + ": ";
      msg = n1 + " " + s + " found but expected " + n2 + teststr;
      msg = msg + ".\nTest: " + (testobj.command || testobj.url);
      if (exit_if_fail) {
        log.error(msg + "\nTest output:\n" + body, true);
      }
    } else {
      if (exit_if_fail) {
        log.info(testobj.testName + " " + s + " test on " + type + " " + tn + " passed.");
      }
    }
    return {'test': s, 'expected': n1, 'got': n2, 'err': err, 'msg': msg};
  }

  function md5(data) {
    return require('crypto').createHash('md5').update(data).digest('hex');
  }

  let results = [];
  if ("Nbytes" in testobj) {
    retobj = compare(body.length,testobj.Nbytes,'bytes');
    results.push(retobj);
  }
  if ("Nlines" in testobj) {
    retobj = compare(body.split("\n").length - 1,testobj.Nlines,'lines');
    results.push(retobj);
  }
  if ("Ncommas" in testobj) {
    retobj = compare((body.match(/,/g) || []).length,testobj.Ncommas,'commas');
    results.push(retobj);
  }
  if ("md5sum" in testobj) {
    retobj = compare(md5(body),testobj.md5sum,'md5sum');
    results.push(retobj);
  }
  if ("status" in testobj) {
    retobj = compare(0,testobj.status,'status');
    results.push(retobj);
  }

  return results;
}