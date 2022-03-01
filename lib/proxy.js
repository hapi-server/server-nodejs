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
    if (SERVER_UI_INCLUDE !== '') {
        if (SERVER_UI_INCLUDE.startsWith("http")) {
            console.log(ds() + "Retrieving " + SERVER_UI_INCLUDE);
            superagent
                    .get(SERVER_UI_INCLUDE)
                    .then(function (res) {
                        console.log(ds() + "Retrieved " + SERVER_UI_INCLUDE);
                        let serveruilist = res.text;
                        configproxy(serverlist,proxylist,serveruilist);
                    })
                    .catch(function (err) {
                        console.log(err)
                        console.log(ds() + clc.red("Could not fetch " + SERVER_UI_INCLUDE));
                        process.exit(1);
                    })
        } else {
            if (fs.existsSync(SERVER_UI_INCLUDE)) {
                console.log(ds() + "Reading " + SERVER_UI_INCLUDE + ".");
                let serveruilist = fs.readFileSync(SERVER_UI_INCLUDE).toString();
                configproxy(serverlist,proxylist,serveruilist);
            } else {
                console.log(ds() + clc.red("Did not find " + SERVER_UI_INCLUDE));
                process.exit(1);
            }               
        }
    } else {
        configproxy(serverlist,proxylist,'');
    }

    function configproxy(serverlist,proxylist,serveruilist) {

        console.log(ds() + "Configuring proxy end-point /proxy.");
        serverlistArray = serverlist.split("\n").filter(function(e){ return e.replace(/(\r\n|\n|\r)/gm,"")});
        serverlistIDs = [];
        serverlistURLs = [];
        for (var i in serverlistArray) {
            var url = serverlistArray[i].split(",")[0];
            var id = serverlistArray[i].split(",")[1];
            serverlistURLs.push(url);
            serverlistIDs.push(id.trim());
        }

        var proxylistURLs = [];

        var tmp = serveruilist.split("\n").filter(function(e){ return e.replace(/(\r\n|\n|\r)/gm,"")});
        for (var i in tmp) {
            console.log(ds() + "Allowing proxy of " + tmp[i].split(",")[0]);
            var url = tmp[i].split(",")[0];
            var id = tmp[i].split(",")[1].trim();
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
                res.status(403).send("Cannot proxy this URL.");
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
                delete res_proxy.headers['content-encoding'];
                res.set(res_proxy.headers);
                res.send(res_proxy.text);
            });
        });

        //app.get('/all-proxy.txt', function (req, res) {res.send(proxylist + serveruilist);});
        app.get('/all-combined.txt', function (req, res) {res.send(serverlist + serveruilist);});
        cb();
    }
}
exports.proxyInit = proxyInit;
