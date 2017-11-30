# HAPI Server Front-End

The intended use case for this server is for a data provider that has

# HAPI metadata for a set of datasets (see examples in `./metadata`) and
# a command line program that returns at least HAPI CSV given inputs of a dataset, a list of one or more parameters in a dataset, start/stop times, and (optionally) a file format.

This code takes care of
# metadata validation
# input validation
# error responses
# logging
# sending emails when error occurs
# generation of JSON or Binary (if needed)

Usage:

`node server.js`

starts server on port 8999 and uses the catalog `./catalog/TestData.json`. 
 
All command line options:

`server.js --port PORT --catalog CATALOG`

All metadata for datasets to be served should be combined and placed in a single file, e.g., ./catalog/CATALOG.json.

When a request is made for data, output from the command line program specified in `CATALOG.json` will be piped to the response.

For example, in `./metadata/TestDataSimple.json`, the command line syntax is given as

`python ./bin/TestDataSimple.py --dataset ${dataset} --parameters ${parameters} --start ${start} --stop ${stop} --format ${format}"`

and in `./metadata/TestData.json`, it is

`node ./bin/TestData.js --dataset ${dataset} --parameters ${parameters} --start ${start} --stop ${stop} --format ${format}`

When data is requested, this command line program is executed after variable substitution and the output is sent as the response.

# Installation

Install [nodejs](https://nodejs.org/en/download/) (tested with v7.10.0) and then

```bash
git clone https://github.com/hapi-server/data-specification/nodejs-server
cd nodejs-server; npm install
node server.js --port 8999 --contact 'abc@example.com'
```

Then open http://localhost:8999/TestData/hapi in a web browser.

To expose this URL through Apache, use

```
ProxyPass /TestData/hapi http://server:8999/TestData/hapi retry=1
ProxyPassReverse /TestData/hapi http://server:8999/TestData/hapi
```

In production, it is recommended that `forever` is used to restart the application after a crash.

```
forever server.js --port 8999 --contact 'abc@example.com'
```

# Unit Tests

To run unit tests (executes `test` target in `package.json`)

```
npm test
```

# Contact

Bob Weigel <rweigel@gmu.edu>