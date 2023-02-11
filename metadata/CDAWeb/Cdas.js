var http = require('https');
const os = require('os');
var path = require('path');
const util = require('util');

var userAgent = path.basename(__filename) + ' (node.js ' +
    process.version + '; ' + os.platform() + '; ' + 
        os.arch() + ')';

var cdfRequest = {
    CdfRequest: {
        TimeInterval: [
            {
                Start: new Date("2014-01-01T00:00:00Z"),
                End: new Date ("2014-01-01T00:10:00Z")
            }
        ],
        DatasetRequest: {
            DatasetId: "AC_H0_MFI",
            VariableName: [
                "Magnitude"
            ]
        },
        CdfFormat: "ICDFML"
    }
};

var data = JSON.stringify(cdfRequest);

var options = {
    host : 'cdaweb.gsfc.nasa.gov',
//    host : 'cdaweb-dev.sci.gsfc.nasa.gov',
    port : 443,
    path : '/WS/cdasr/1/dataviews/sp_phys/datasets/',
    method : 'POST',
    headers : {
      'User-Agent': userAgent,
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      'Content-Length': data.length
    },
//    rejectUnauthorized: false
};

function printHeaders(headers, title) {

    console.log(title + " Headers:");
    for (var hdr in headers) {
        console.log("  " + hdr + " = " + headers[hdr]);
    }   
}

var responses = 0;


function handleResponse (res) {
    var msg = '';

    res.setEncoding('utf8');

    res.on('data', (chunk) => {msg += chunk});

    res.on('end', () => {

//        console.log(util.inspect(JSON.parse(msg), 
//                                 {depth: null, colors: true} ))

        console.log("statusCode = " + res.statusCode);
        responses++;
        console.log("responses = " + responses);
        var lastModified = res.headers['last-modified'];
        console.log("Last-Modified = " + lastModified);
        options.headers['If-Modified-Since'] = lastModified;
        console.log("msg.length = " + msg.length);
        console.log(msg);
        if (lastModified !== undefined &&
            lastModified.length > 0 &&
            res.statusCode === 200 &&
            responses < 2) {

            printHeaders(options.headers, "Request " + responses);
            var req = http.request(options, handleResponse);
            req.write(data);
            req.end();
        }
    });
    res.on('error', (e) => {
        console.log("Error: " + e.message);
    });
}

printHeaders(options.headers, "Request " + responses);

var req = http.request(options, handleResponse);
req.write(data);
req.end();

