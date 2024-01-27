const http = require('http');
const https = require('https');

const log = require('../lib/log.js');
const shellcmd = require('../lib/shellcmd.js');

exports.commands = commands;
exports.urls = urls;

function commands(cmdArray, testName, exitIfFail) {

  const results = [];
  for (let i = 0; i < cmdArray.length; i++) {
    if (!('exitStatus' in cmdArray[i])) {
      cmdArray[i].exitStatus = 0;
    }

    const command = cmdArray[i].command;

    const opts = {"return": "object", "exitIfFail": exitIfFail, "logError": false};
    const child = shellcmd.spawnSync(command,opts);

    if (exitIfFail) {
      log.debug("Running " + testName + " test command " + i + ".");
      log.debug(command);
    }

    const result = testOutput(cmdArray[i], child.stdout.toString(), child.status);

    if (child.status === 0) {
      cmdArray[i].testNumber = i;
      cmdArray[i].testName = testName;
      results.push(result);
    } else {
      if (exitIfFail) {
        log.error("Command returned non-zero status: " + command + ".");
        if (child.stdout.toString().trim().length > 0)
          log.error("\nstdout:\n" + child.stdout.toString(),true);
        if (child.stderr.toString().trim().length > 0)
          log.error("\nstderr:\n" + child.stderr.toString(),true);
        process.exit(1);
      } else {
        results.push(result);
      }
    }
  }
  return results;
}

function urls(CATALOGS, PREFIXES, server) {

  let metadata = require('./metadata.js').metadata;

  function finished() {
    urls.running = urls.running - 1;
    if (urls.running == 0) {
      log.info("Exiting with status 0 (pass).");
      process.exit(0);
    }
  }

  if (!urls.running) {
    urls.running = 0;
  }

  let noTests = true;
  for (let i = 0; i < CATALOGS.length; i++) {
    var d = metadata(CATALOGS[i],'data');
    if (d.testurls) {
      noTests = false;
      urls.running = urls.running + 1;
      runtests(d.testurls, CATALOGS[i], PREFIXES[i], finished);
    }
  }
  if (noTests === true) {
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

    for (let j = 0; j < testarr.length; j++) {
      runtests.running = runtests.running + 1;
      testarr[j].testNumber = j;
      test(testarr[j], testName);
    }

    function test(testObj, testName) {
      if (!('httpStatus' in testObj)) {
        testObj.httpStatus = 200;
      }
      let tn = testObj.testNumber;
      testurl = encodeURI(server + "/" + prefix + "/hapi/" + testObj["url"]);
      testObj.testurl = testurl;
      testObj.testName = testName;
      log.info("Running " + testName + " test URL " + tn + " on " + testurl);

      if (testurl.indexOf("https") === 0) {
        // This is needed to suppress errors associated with self-signed SSL
        // certificates.
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
          let datas = data.split("\n");
          let i;
          for (i = 0; i < datas.length; i++) {
            if (!datas[i].startsWith("#")) {
              break;
            }
          }
          data = datas.slice(i).join("\n");
          testOutput(testObj, data, resp.statusCode, true);
          finished();
        });
      }
    }
  }
}

function testOutput(testObj, body, statusCode, exitIfFail) {

  var tn = testObj.testNumber;
  if (testObj.command) {
    type = "command";
    teststr = "";
  }
  if (testObj.url) {
    type = "URL";
    teststr = " for test URL number " + tn;
  }

  function compare(n1,n2,s) {
    let err = false;
    let msg = "";
    if (n1 !== n2) {
      err = true;
      msg = testObj.testName + " test command " + tn + ": ";
      msg = s + " = " + n1 + " found but expected " + n2;
    }
    return {'test': s, 'expected': n1, 'got': n2, 'err': err, 'msg': msg};
  }

  function md5(data) {
    return require('crypto').createHash('md5').update(data).digest('hex');
  }

  let results = [];

  if ("Nbytes" in testObj) {
    retobj = compare(Buffer.byteLength(body, 'utf8'), testObj.Nbytes,'bytes');
    results.push(retobj);
  }
  if ("Nlines" in testObj) {
    retobj = compare(body.split("\n").length - 1, testObj.Nlines,'lines');
    results.push(retobj);
  }
  if ("Ncommas" in testObj) {
    retobj = compare((body.match(/,/g) || []).length, testObj.Ncommas,'commas');
    results.push(retobj);
  }
  if ("md5sum" in testObj) {
    retobj = compare(md5(body),testObj.md5sum,'md5sum');
    results.push(retobj);
  }
  if ("exitStatus" in testObj) {
    retobj = compare(statusCode,testObj.exitStatus,'exitStatus');
    results.push(retobj);
  }
  if ("httpStatus" in testObj) {
    retobj = compare(statusCode,testObj.httpStatus,'httpStatus');
    results.push(retobj);
  }

  let foundFail = false;
  for (let j = 0; j < results.length; j++) {
    if (results[j].err === true) {
      foundFail = true;
      let msg = `Test failure on\n${testObj.command || testObj.url}\nMessage: ${results[j].msg}`;
      log.error(msg);
    }
  }
  if (foundFail && exitIfFail) {
    process.exit(1);
  }

  return results;
}