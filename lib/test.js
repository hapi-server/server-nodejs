const http = require('http');
const https = require('https');

const log = require('log');

const shellcmd = require('./shellcmd.js');

exports.commands = commands;
exports.urls = urls;

function commands(cmdArray, testName, exitIfFail) {

  const results = [];
  for (let i = 0; i < cmdArray.length; i++) {

    if (cmdArray[i].exitStatus === undefined) {
      cmdArray[i].exitStatus = 0;
    }

    if (exitIfFail && cmdArray[i].exitStatus !== 0) {
      // If test has a non-zero exitStatus value, we don't want to exit.
      let msg = "ExitIfFail = true but command test has exitStatus !=0. ";
      msg += "Not exiting if command returns non-zero exit status.";
      log.debug(msg);
      exitIfFail = false;
    }

    const command = cmdArray[i].command;

    const opts = {"return": "object", "exitIfFail": exitIfFail, "logError": false};
    const child = shellcmd.spawnSync(command,opts);

    log.debug("Running " + testName + " test command " + i + ".");
    log.debug(command);

    const result = testOutput(cmdArray[i], child.stdout.toString(), child.status, exitIfFail, child.stderr.toString());

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
    if (urls.running === 0) {
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
      if (runtests.running === 0) {
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
      let testurl = encodeURI(server + "/" + prefix + "/hapi/" + testObj["url"]);
      testObj.testurl = testurl;
      testObj.testName = testName;
      log.info("Running " + testName + " test URL " + tn + " on " + testurl);

      if (testurl.indexOf("https") === 0) {
        // This is needed to suppress errors associated with self-signed SSL
        // certificates.
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0
        https.get(testurl, (resp) => {processResponse(resp);});
        //https.get({url: testurl, rejectUnauthorized: true}, (resp) => {processResponse(resp);});
      } else {
        // If HTTP server is started
        http.get(testurl, (resp) => {processResponse(resp);});
      }

      function processResponse(resp) {

        let data = Buffer.from('');

        resp.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });

        resp.on('end', () => {
          if (resp.headers['content-type'].trim().startsWith('application/octet-stream')) {
            if (data.slice(0,1).toString() === "#") {
              let i = data.indexOf("\n",1);
              data = data.slice(i+1);
            }
          } else if (resp.headers['content-type'].trim().startsWith('application/json')) {
            let dataParsed = JSON.parse(data);
            if (dataParsed["data"] === undefined) {
              if (Array.isArray(dataParsed)) {
                if (dataParsed.length === 0) {
                  data = "";
                } else {
                  data = dataParsed.join("\n") + "\n";
                }
              } else {
                data = dataParsed;
              }
            } else {
              dataParsed = dataParsed["data"];
              data = "";
              for (let record of dataParsed) {
                data += record.flat().join(",") + "\n";
              }
            }
          } else {
            data = data.toString();
            if (data.length > 0 && data.slice(0,1).toString() === "#") {
              let dataSplit = data.split("\n");
              let i;
              for (i = 0; i < dataSplit.length; i++) {
                if (!dataSplit[i].startsWith("#")) {
                  break;
                }
              }
              data = dataSplit.slice(i).join("\n");
            }
          }
          testOutput(testObj, data, resp.statusCode, true);
          finished();
        });
      }
    }
  }
}

function testOutput(testObj, body, statusCode, exitIfFail, stderr) {

  let results = [];
  let compareObj = {};

  if ("Nbytes" in testObj) {
    compareObj = valuesMatch(Buffer.byteLength(body, 'utf8'), testObj.Nbytes,'bytes');
    results.push(compareObj);
  }
  if ("Nlines" in testObj) {
    compareObj = valuesMatch(body.split("\n").length - 1, testObj.Nlines,'lines');
    results.push(compareObj);
  }
  if ("Ncommas" in testObj) {
    compareObj = valuesMatch((body.match(/,/g) || []).length, testObj.Ncommas,'commas');
    results.push(compareObj);
  }
  if ("md5sum" in testObj) {
    compareObj = valuesMatch(md5(body),testObj.md5sum,'md5sum');
    results.push(compareObj);
  }

  if ("exitStatus" in testObj) {
    compareObj = valuesMatch(statusCode,testObj.exitStatus,'exitStatus');
    results.push(compareObj);
  }
  if ("httpStatus" in testObj) {
    compareObj = valuesMatch(statusCode,testObj.httpStatus,'httpStatus');
    results.push(compareObj);
  }

  if ("stderrMatch" in testObj) {
    compareObj = regexMatches(stderr,testObj.stderrMatch,'stderrMatch');
    let passOrFail = compareObj.err ? "FAIL" : "PASS";
    log.debug(`${passOrFail} for ${compareObj.test}.`);
    log.debug(` Expected: '${compareObj.expected}'`);
    log.debug(` stderr    '${stderr}'`);
    log.debug(` Got:      '${compareObj.got}'`);
    log.debug(` Message:  '${compareObj.msg}'`);
    results.push(compareObj);
  }

  if ("jsonContains" in testObj) {
    compareObj = objectsMatch(body,testObj.jsonContains,'jsonContains',false);
    results.push(compareObj);
    let passOrFail = compareObj.err ? "FAIL" : "PASS";
    log.debug(`${passOrFail} for ${compareObj.test}.`);
    log.debug(`Expected: \n${JSON.stringify(testObj.jsonContains,null,2)}`);
    log.debug(`Got       \n${JSON.stringify(body,null,2)}`);
    log.debug(`Message: '${compareObj.msg}'`);
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

  function objectsMatch(o1, o2, s, exact) {

    let returnObj = {'test': s + " test", 'expected': '', 'got': "", 'err': false, msg: ""};
    if (exact) {
      returnObj["expected"] = 'exact match';
      let err = JSON.stringify(o1) !== JSON.stringify(o2);
      returnObj["got"] = 'exact match';
      if (err) {
        returnObj["got"] = 'not an exact match';
      }
      returnObj["msg"] = returnObj["got"];
      returnObj["err"] = err;
      return returnObj;
    }

    let err = compareObjects(o1,o2);
    returnObj["got"] = 'Content in returned JSON matches corresponding content in expected JSON';
    if (err) {
      returnObj["got"] = 'Content in returned JSON does not match corresponding content in expected JSON';
    }
    returnObj["msg"] = returnObj["got"];
    returnObj["err"] = err;
    return returnObj;

    function compareObjects(o1,o2) {
      let matching = true;
      for (let key in o2) {
        if (typeof(o2[key]) === 'object') {
          if (Array.isArray(o2[key])) {
            matching = matching && o2[key].toString() === o1[key].toString();
          } else {
            return compareObjects(o1[key],o2[key],false);
          }
        } else {
          matching = matching && o1[key] !== o2[key];
        }
      }
      return matching;
    }
  }

  function regexMatches(body,regex,s) {
    let returnObj = {'test': s + " test", 'expected': 'body to match ' + regex, 'got': "match", 'err': false, msg: "match"};
    if (!(new RegExp(regex).test(body))) {
      returnObj.err = true;
      returnObj.got = "no match";
      returnObj.msg = "no match";
    }
    return returnObj;
  }

  function valuesMatch(n1,n2,s) {
    let err = false;
    let msg = `${n1} === ${n2}`;
    if (n1 !== n2) {
      msg = `${n1} !== ${n2}`;
      err = true;
      msg = s + " = " + n1 + " found but expected " + n2;
    }
    return {'test': s + " test", 'expected': n1, 'got': n2, 'err': err, 'msg': msg};
  }

  function md5(data) {
    return require('crypto').createHash('md5').update(data).digest('hex');
  }

}