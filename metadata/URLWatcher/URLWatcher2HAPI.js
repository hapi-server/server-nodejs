const fs = require("fs");
const superagent = require('superagent');

let catalog = [];
let parameters = 
      [
        {
          'name': 'Time',
          'label': 'Time of test',
          'type': 'isotime',
          'units': 'UTC',
          'fill': ''
        },
        {
          'name': 'status',
          'label': 'HTTP status code',
          'type': 'integer',
          'units': null,
          'fill': "-1"
        },
        {
          'name': 'ttfb',
          'label': 'Time to First Byte',
          'type': 'integer',
          'units': 'ms',
          'fill': "-1"
        },
        {
          'name': 'dl',
          'label': 'Download time',
          'type': 'integer',
          'units': 'ms',
          'fill': "-1"
        },
        {
          'name': 'total',
          'label': 'Total request time',
          'type': 'integer',
          'units': 'ms',
          'fill': "-1"
        },
        {
          'name': 'size',
          'label': 'Response size',
          'type': 'integer',
          'units': 'bytes',
          'fill': "-1"
        },
        {
          'name': 'fails',
          'label': '# of test failures',
          'type': 'integer',
          'units': null,
          'fill': "-1"
        }
      ];
const urlwatcher = 'https://hapi-server.org/urlwatcher/';
//const urlwatcher = 'http://localhost:4444/';

superagent
  .get(urlwatcher + 'log/tests.json')
  .end((err, res) => {
    processDirs(err, res.body)
  });

function processDirs(err, dirs) {

  processDirs.done = 0;

  for (let dir of dirs) {
    //console.log(urlwatcher + "/log/" + dir + "/files.json")
    superagent
      .get(urlwatcher + "log/" + dir + "/log/files.json")
      .end((err, res) => {
        processFiles(dir, res.body);
    })
  }

  function processFiles(dir, files) {
    superagent
      .get(urlwatcher + "log/" + dir + "/settings.json")
      .end((err, res) => {
        catalog.push(dataset(dir, files.sort(), res.body));
        processDirs.done = processDirs.done + 1;
        if (processDirs.done == dirs.length) {
          let catalogJSON = JSON.stringify(catalog, null, 2);
          //fs.writeFile("URLWatcher.json", catalogJSON, () => {});
          console.log(catalogJSON);
        }
    })
  }
}

function dataset(id, files, settings) {
  let N = files.length - 1;
  let start = files[0].split("/").slice(-1)[0].slice(0,10) + "Z";
  let stop  = files[N].split("/").slice(-1)[0].slice(0,10) + "Z";
  stop = new Date(stop);
  stop = new Date(stop.getTime() + 60*60*24*1000).toISOString().slice(0,10) + "Z";
  let ds = {};
  ds['id'] = id;
  ds['title'] = settings['url'];
  ds['info'] = {
      "startDate": start,
      "stopDate": stop,
      "cadence": "PT" + parseFloat(parseFloat(settings['interval'])/1000,3) + "S",
      "parameters": parameters
  }
  return ds;
}
