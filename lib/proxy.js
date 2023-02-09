const fs   = require('fs');
const clc  = require('chalk');
const superagent = require('superagent');

function ds() {return (new Date()).toISOString() + " [server] ";};

function proxyInit(PROXY_WHITELIST, SERVER_UI_INCLUDE, serverlist, app, cors, cb) {

  let proxylist = '';
  if (PROXY_WHITELIST !== '') {
    if (fs.existsSync(PROXY_WHITELIST)) {
      console.log(ds() + "Reading " + PROXY_WHITELIST + ".");
      proxylist = fs.readFileSync(PROXY_WHITELIST).toString();
    } else {
      console.log(ds() + clc.red("Did not find " + PROXY_WHITELIST));
      process.exit(1);
    }
  }

  if (SERVER_UI_INCLUDE.length == 0) {
    configproxy(serverlist,proxylist,'');
  } else {
    if (!Array.isArray(SERVER_UI_INCLUDE)) {
      SERVER_UI_INCLUDE = [SERVER_UI_INCLUDE];
    }
    for (file of SERVER_UI_INCLUDE) {
      getFile(file);
    }
  }

  function finished(serveruilist) {
    console.log("finished")
    if (!finished.serveruilist) {
      finished.n = 0;
      finished.serveruilist = serveruilist;
    } else {
      finished.serveruilist = finished.serveruilist + serveruilist; 
    }
    finished.n = finished.n + 1;
    if (finished.n == SERVER_UI_INCLUDE.length) {
      configproxy(serverlist,proxylist,finished.serveruilist);
    }
  }

  function getFile(file) {
    if (file.startsWith("http")) {
      console.log(ds() + "Retrieving " + file);
      superagent
          .get(file)
          .then(function (res) {
            console.log(ds() + "Retrieved " + file);
            finished(res.text)
          })
          .catch(function (err) {
            console.log(err)
            console.log(ds() + clc.red("Could not fetch " + file));
            process.exit(1);
          })
    } else {
      if (fs.existsSync(file)) {
        console.log(ds() + "Reading " + file + ".");
        finished(fs.readFileSync(file).toString());
      } else {
        console.log(ds() + clc.red("Did not find " + file));
        process.exit(1);
      }               
    }
  }

  function configproxy(serverlist,proxylist,serveruilist) {

    console.log(ds() + "Configuring proxy end-point /proxy.");
    serverlistArray = serverlist.split("\n").filter(function(e){ return e.replace(/(\r\n|\n|\r)/gm,"")});
    serverlistIDs = [];
    serverlistURLs = [];
    for (var i in serverlistArray) {
      var url = serverlistArray[i].split(",")[0];
      var id = serverlistArray[i].split(",")[2];
      serverlistURLs.push(url);
      serverlistIDs.push(id.trim());
    }

    var proxylistURLs = [];

    var tmp = serveruilist.split("\n").filter(function(e){ return e.replace(/(\r\n|\n|\r)/gm,"")});
    for (var i in tmp) {
      console.log(ds() + "Allowing proxy of " + tmp[i].split(",")[0]);
      var url = tmp[i].split(",")[0];
      var id = tmp[i].split(",")[2];
      if (id) {
        id = id.trim();
      } else {
        id = url;
      }
      if (!url.startsWith("http")) {
        console.log(ds() + clc.red("URL " + url + " in " + SERVER_UI_INCLUDE + " does not start with http."));
        process.exit(1);
      }
      proxylistURLs.push(url);                        
      if (serverlistIDs.includes(id)) {
        console.log(ds() + "Server ID " + id + " in " + SERVER_UI_INCLUDE + " matches one in this server's IDs list");
        tmp[i] = '';
      }
    }
    serveruilist = tmp.filter(function(e){ return e}).join("\n");

    tmp = proxylist.split("\n").filter(function(e){ return e.replace(/(\r\n|\n|\r)/gm,"")});
    for (var i in tmp) {
      if (tmp[i] !== '') {                
        console.log(ds() + "Allowing proxy of " + tmp[i].split(",")[0]);
        var url = tmp[i].split(",")[0];
        if (!url.startsWith("http")) {
          console.log(ds() + clc.red("URL " + url + " in " + PROXY_WHITELIST + " does not start with http."));
          process.exit(1);
        }
        proxylistURLs.push(url);
      }
    }

    if (proxylistURLs.length == 0) {
      console.log(ds() + clc.red("Problem with parsing file " + PROXY_WHITELIST + " and/or " + SERVER_UI_INCLUDE));
      process.exit(1);
    }

    app.get('/proxy', function (req, res) {
      proxyOK = false;
      let url = decodeURI(req.query.url);
      if (url !== undefined) {
        for (i in proxylistURLs) {
          if (url.startsWith(proxylistURLs[i])) {
            proxyOK = true;
            break;
          }
        }
      }   
      if (proxyOK == false) {
        res.status(407).send("URL not in whitelist.");
        return;
      }
      cors(res);

      // As a work-around to
      // https://github.com/visionmedia/superagent/blob/master/docs/index.md#tls-options
      // one could use
      // .disableTLSCerts()
      // This won't be needed for newer versions of nodejs (TODO: What is minimum version?)
      superagent.get(url).end(function (err, res_proxy) {
        console.log(ds() + "Proxied " + url);
        if (err) {
            console.log(err);
            res.status(501).send("");
            return;
        }
        delete res_proxy.headers['content-encoding'];
        res.set(res_proxy.headers);
        res.send(res_proxy.text);
      });
    });

    app.get('/all-combined.txt', function (req, res) {res.send(serverlist + serveruilist);});
    cb();
  }
}
exports.proxyInit = proxyInit;
