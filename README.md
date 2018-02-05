# HAPI Server Front-End

The intended use case for this server is for a data provider that has

1. [HAPI](https://github.com/hapi-server/data-specification) metadata for a set of datasets (see examples in [`./metadata`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/)) and
2. a command line program that returns at least [HAPI CSV](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) given inputs of a dataset, a list of one or more parameters in a dataset, start/stop times, and (optionally) an output format.

This server handles

1. dataset metadata validation,
2. API input validation,
3. error responses,
4. logging,
5. sending emails when an error occurs, and
6. generation of [HAPI JSON](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) or [HAPI Binary](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) (if needed)

# Usage

`node server.js`

starts server on port 8999 and uses the catalog [`./catalog/TestDataSimple.json`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestDataSimple.json). 
 
All command line options:

```bash
server.js --port PORT --catalog CATALOG --prefix PREFIX
```

Serves data from `http://localhost:PORT/hapi` using datasets and command line program specified in `CATALOG.json`. If `PREFIX` is given, serves data from `http://localhost:8999/PREFIX/hapi`.

All metadata for datasets to be served should be combined and placed in a single file, e.g., `./catalog/CATALOG.json`.

When a request is made for data, output from the command line program specified in `CATALOG.json` will be piped to the response.

For example, in [`./metadata/TestDataSimple.json`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestDataSimple.json), the command line syntax is given as

```bash
python ./bin/TestDataSimple.py --dataset ${dataset} --parameters ${parameters} --start ${start} --stop ${stop} --format ${format}"`
```

and in [`./metadata/TestData.json`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestData.json), it is

```bash
node ./bin/TestData.js --dataset ${dataset} --parameters ${parameters} --start ${start} --stop ${stop} --format ${format}
```

When data is requested, this command line program is executed after variable substitution and the output is sent as the response.

# Installation

Install [nodejs](https://nodejs.org/en/download/) (tested with v7.10.0) 

```bash
# Install Node Version Manager https://github.com/creationix/nvm
curl https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
# Use node.js version 7
nvm install 7
```

Clone the server respository

```bash
git clone https://github.com/hapi-server/data-specification/nodejs-server
cd nodejs-server; npm install
node server.js
```

Then open [http://localhost:8999/TestDataSimple/hapi](http://localhost:8999/TestDataSimple/hapi) in a web browser.

To expose this URL through Apache, add the following to the Apache configuration file

```
ProxyPass /TestDataSimple/hapi http://server:8999/TestDataSimple/hapi retry=1
ProxyPassReverse /TestDataSimple/hapi http://server:8999/TestDataSimple/hapi
```

In production, it is recommended that [forever](https://github.com/foreverjs/forever) is used to automatically restart the application after an uncaught execption causes the application to abort (this should rarely happen).

```bash
npm install -g forever # Install forever
forever server.js
# or forever server.js --port PORT --catalog CATALOG --prefix PREFIX
```

# Tests

The following commands creates a local installation of the [HAPI verifier](https://github.com/hapi-server/verifier-nodejs) and tests the URL ```http://localhost:8999/hapi```.

```bash
mkdir tmp; cd tmp; 
git clone https://github.com/hapi-server/verifier-nodejs.git; 
cd verifier-nodejs; 
npm install; 
node test.js http://localhost:8999/hapi"
```

# Contact

Bob Weigel <rweigel@gmu.edu>