const superagent = require('superagent')

const catalog = []
const parameters =
      [
        {
          name: 'Time',
          label: 'Time of test',
          type: 'isotime',
          units: 'UTC',
          fill: null,
          length: 24
        },
        {
          name: 'status',
          label: 'HTTP status code',
          type: 'integer',
          units: null,
          fill: '-1'
        },
        {
          name: 'ttfb',
          label: 'Time to First Byte',
          type: 'integer',
          units: 'ms',
          fill: '-1'
        },
        {
          name: 'dl',
          label: 'Download time',
          type: 'integer',
          units: 'ms',
          fill: '-1'
        },
        {
          name: 'total',
          label: 'Total request time',
          type: 'integer',
          units: 'ms',
          fill: '-1'
        },
        {
          name: 'size',
          label: 'Response size',
          type: 'integer',
          units: 'bytes',
          fill: '-1'
        },
        {
          name: 'fails',
          label: '# of test failures',
          type: 'integer',
          units: null,
          fill: '-1'
        }
      ]

const urlwatcher = 'https://hapi-server.org/urlwatcher/'
// const urlwatcher = 'http://localhost:4444/';

const ver = parseInt(process.version.slice(1).split('.')[0])
if (parseInt(ver) < 12) {
  // Workaround for Let's Encrypt expiration issue in older
  // node versions.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const testsURL = urlwatcher + 'log/tests.json'
superagent
  .get(testsURL)
  .end((err, res) => {
    if (err) {
      console.error(`Could not get ${testsURL}`)
      process.exit(1)
    }
    const testCategories = Object.keys(res.body)
    const allPaths = []
    for (const testCategory of testCategories) {
      const categoryPaths = res.body[testCategory]
      for (const test of categoryPaths) {
        allPaths.push(testCategory + '/' + test)
      }
    }
    processDirs(allPaths)
  })

function processDirs (dirs) {
  processDirs.done = 0

  for (const dir of dirs) {
    const dirURL = urlwatcher + 'log/' + dir + '/log/files.json'
    superagent
      .get(dirURL)
      .end((err, res) => {
        if (err) {
          console.error(`Could not get ${dirURL}`)
          process.exit(1)
        }
        processFiles(dir, res.body)
      })
  }

  function processFiles (dir, files) {
    const settingsURL = urlwatcher + 'log/' + dir + '/settings.json'
    superagent
      .get(settingsURL)
      .end((err, res) => {
        if (err) {
          console.error(`Could not get ${settingsURL}`)
          process.exit(1)
        }
        catalog.push(dataset(dir, files.sort(), res.body))
        processDirs.done = processDirs.done + 1
        if (processDirs.done === dirs.length) {
          const catalogJSON = JSON.stringify(catalog, null, 2)
          console.log(catalogJSON)
        }
      })
  }
}

function dataset (id, files, settings) {
  const N = files.length - 1
  const start = files[0].split('/').slice(-1)[0].slice(0, 10) + 'Z'
  let stop = files[N].split('/').slice(-1)[0].slice(0, 10) + 'Z'
  stop = new Date(stop)
  stop = new Date(stop.getTime() + 60 * 60 * 24 * 1000).toISOString().slice(0, 10) + 'Z'
  const ds = {}
  ds.id = id
  ds.title = settings.url
  ds.info = {
    startDate: start,
    stopDate: stop,
    cadence: 'PT' + parseFloat(parseFloat(settings.interval) / 1000, 3) + 'S',
    parameters
  }
  return ds
}
