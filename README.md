# HAPI Server Front-End

## Contents

1. [About](#About)
2. [Examples](#Examples)
3. [Usage](#Usage)
4. [Installation](#Installation)
5. [Metadata](#Metadata)
6. [Tests](#Tests)
7. [Contact](#Contact)

<a name="About"></a>
## 1. About
The intended use case for this server is for a data provider that has

1. [HAPI](https://github.com/hapi-server/data-specification) metadata, in one of a [variety of forms](#Metadata), for a  dataset and
2. a command line program that returns at least [HAPI CSV](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) (headerless) for all parameters in the dataset over a given start/stop timerange. Optionally, the command line program can take inputs of a list of one or more parameters to output and an output format.

This server handles

1. HAPI metadata validation,
2. request validation and error responses,
3. logging and alerts,
4. parameter subsetting (as needed), and
5. generation of [HAPI JSON](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) or [HAPI binary](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) (as needed).

A list of datasets that are served using this sofware is given at [http://hapi-server.org/servers]([http://hapi-server.org/servers]).

<a name="Examples"></a>
## 2. Examples

### 2.1 Serve data from a minimal Python program

In this example, we assume that the command line program that returns a dataset has the minimal capabilities required - when executed with inputs of a start and stop time, it generates a headerless HAPI CSV file with all parameters in the dataset. The server handles parameter subsetting and the generation of HAPI Binary and JSON.

In this example, a Python script [Example.py](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/bin/Example.py) returns HAPI-formatted CSV data (with no header) with two parameters. To serve this data, only a configuration file, [Example1.json](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/metadata/Example1.json) is needed. The configuration file has information that is used to call the command line program and it also has HAPI metadata that describes the output of [Example.py](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/bin/Example.py). Details about the configuration file format are described in the [Metadata](#Metadata) section.

The Python calling syntax of [Example.py](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/bin/Example.py) is 

```
python Example.py --start START --stop STOP
```

To run this example locally after [installation](#Install), execute

```bash
node server.js --catalog Example1
```

and then open http://localhost:8999/Example1/hapi. You should see the same landing page as that at [http://hapi-server.org/servers/Example1/hapi](http://hapi-server.org/servers/Example1/hapi).

### 2.2 Serve data from a enhanced Python program

The Python script [Example.py](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/bin/Example.py) actually has the ability to subset parameters and to provide binary output. To force the server to use these capabilities, we need to modify the server configuration metadata in [Example1.json](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/metadata/Example1.json). The changes are replacing

```
"command": "python bin/Example.py --start ${start} --stop ${stop}"
```

with

```
"command": "python bin/Example.py --params ${parameters} --start ${start} --stop ${stop} --fmt ${format}"
```

and adding

```
"formats": ["csv","binary"]
```

The modified file is [Example2.json](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/metadata/Example2.json). To run this example locally after [installation](#Install), execute

```bash
node server.js --catalog Example2
```

and then open http://localhost:8999/Example2/hapi.  The command line program now produces binary output and performs parameter subsetting as needed and the response time for data should decrease.

The server responses will be idential to that in the previous example. You should see the same landing page as that at [http://hapi-server.org/servers/Example1/hapi](http://hapi-server.org/servers/Example1/hapi).

### 2.3 Serve data from a non-HAPI web service

A non-HAPI server can be quickly be made HAPI compliant by using this server as a pass-through. Data from [SSCWeb](https://sscweb.sci.gsfc.nasa.gov/), which is available from a [REST API](https://sscweb.sci.gsfc.nasa.gov/WebServices/REST/), has been made avaliable through a HAPI API at [http://hapi-server.org/servers/SSCWeb/hapi](http://hapi-server.org/servers/SSCWeb/hapi). The configuration file is [SSCWeb.json](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/metadata/SSCWeb.json) and the command line program is [SSCWeb.js](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/bin/SSCWeb.js). Note that the configuration file [SSCWeb.json](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/metadata/SSCWeb.json) was created using code in [metadata/SSCWeb](https://github.com/hapi-server/server-nodejs/tree/master/metadata/SSCWeb).

 this example locally after [installation](#Install), execute

```bash
node server.js --catalog SSCWeb
```

and then open http://localhost:8999/SSCWeb/hapi. You should see the same landing page as that at [http://hapi-server.org/servers/SSCWeb/hapi](http://hapi-server.org/servers/SSCWeb/hapi).

### 2.4 Serve data stored in a single file

### 2.5 Serve data stored in multiple files

### 2.6 Serve data read by Autoplot

Nearly any data file that can be read by Autoplot can be served using this server. 

Serving data requires at most two steps:

1. Genering an Autoplot URI for each parameter; and (in some cases)
2. Writing (by hand) metadata for each parameter.

The second step is not required in this example because the data file has metadata that is in a format that Autoplot can translate to HAPI metadata.

To run this example locally, execute

```bash
node server.js --catalog AutoplotTest
```

The landing page for this example are shown at [http://hapi-server.org/servers/AutoplotTest/hapi](http://hapi-server.org/servers/AutoplotTest/hapi).

<details> 
  <summary>Show configuration [file](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/metadata/AutoplotTest.json)</summary>

```javascript

```
</details>

<a name="Usage"></a>
## 3. Usage

`node server.js`

Starts HAPI server at [http://localhost:8999/hapi](http://localhost:8999/hapi) and serves datasets specified in the catalog [`./metadata/TestDataSimple.json`](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestDataSimple.json). 
 
### Single Dataset
All command line options:

```bash
node server.js --port PORT --catalog CATALOG --prefix PREFIX --force [true]|false
```

Serves data from `http://localhost:PORT/PREFIX/hapi` using datasets and command line program template specified in `./metadata/CATALOG.json`. If `./metadata/CATALOG.{htm,html}` is found, it is used as the landing page.

When requests for metadata are made, information in `CATALOG.json` is used to generate the response. See the [Metadata](#Metadata) section for details.

When a request is made for data, output from a command line program specified in `CATALOG.json` will be piped to the response.

If `--force=true` is used, the server will start even if the HAPI metadata is does not pass the validation test.

### Multiple Datasets

```bash
node server.js --port PORT --catalogs CATALOGs --prefixes PREFIXES
```

The server can serve multiple datasets by giving a comma-separated list for `CATALOGS`. By default, `PREFIXES=CATALOGS`. For example

```bash
node server.js --catalogs TestDataSimple,OneWire
```

and

```bash
node server.js --catalogs TestDataSimple,OneWire --prefixes TestData,OneWire
```

will serve the two datasets at

```
http://localhost:8999/TestData/hapi
http://localhost:8999/OneWire/hapi
```

<a name="Installation"></a>
## 4. Installation

Install [nodejs](https://nodejs.org/en/download/) (tested with v7.10.0) 

```bash
# Install Node Version Manager https://github.com/creationix/nvm
curl https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
# Reload modified shell configuration (may not be needed)
source ~/.bash_profile ~/.bashrc
# Install and use node.js version 7
nvm install 7
```

then

```bash
# Clone the server respository
git clone https://github.com/hapi-server/server-nodejs
# Install dependencies
cd server-nodejs; npm install

# Start the server
node server.js

# or, to allow use of the "Run Validation Tests" links on the 
# /hapi landing pages if testing a server with a localhost URL,
# (1) Start the server and specify the verifier server location
node server.js --verifier 'http://localhost:9000/'
# (2) Start the verifier server,
node verify.js --port 9000
```

Open [http://localhost:8999/TestDataSimple/hapi](http://localhost:8999/TestDataSimple/hapi) in a web browser.

To expose this URL through Apache, add the following to the Apache configuration file

```
ProxyPass /TestDataSimple/hapi http://localhost:8999/TestDataSimple/hapi retry=1
ProxyPassReverse /TestDataSimple/hapi http://localhost:8999/TestDataSimple/hapi
```

In production, it is recommended that [forever](https://github.com/foreverjs/forever) is used to automatically restart the application after an uncaught execption causes the application to abort (this should rarely happen).

```bash
# Install forever
npm install -g forever
# Start server
forever server.js
# or forever server.js --port PORT --catalog CATALOG --prefix PREFIX
```

<a name="Metadata"></a>
## 5. Metadata
 
The top-level structure of `CATALOG.json` file is

```
{
	"catalog": [See 5.1: Combined HAPI /catalog and /info object],
	// or
	"catalog": [See 5.2: HAPI /catalog response with file or command line template for info object],
	// or
	"catalog": "See 5.3: Command line template or file",
	"data": {
	    "command": "Command line template",
	    "contact": "Email address if error in command line program",
	    "test": "Server will not start if this command line call is given and fails (gives exit 1 signal)"
	},

}
```

See also examples in [`./metadata`](https://github.com/hapi-server/server-nodejs/blob/master/metadata/).

Each of the options for the catalog property are described in the following sections.

The command line template string in the JSON `data` object will have placeholders for a dataset id (`${ID}`), start (`${start}`) and stop (`${stop}`) times, and optionally a output format (`${format}`). For example,

```bash
python ./bin/TestDataSimple.py --dataset ${ID} --parameters \
	${parameters} --start ${start} --stop ${stop} --format ${format}"`
```

### 5.1 Combined HAPI `/catalog` and `/info` object

If `catalog` is an array, it should have the same format as a HAPI `/catalog` response (each object in the array has an `id` property and and optional `title` property) **with the addition** of an `info` property that is the HAPI response for that `id`, e.g., `/info?id=dataset1`. 

```json
"catalog":
 [
	{
		"id": "dataset1",
		"title": "a dataset",
		"info": {"startDate":"2000-01","stopDate":"2000-02","parameters":[...]}
	},
	{
		"id": "dataset2",
		"title": "another dataset",
		"info": {"startDate":"2000-01","stopDate":"2000-02","parameters":[...]}
	}
 ]
```

In the following subsections, this type of JSON structure is referred to as a **fully resolved catalog**.

Examples of this type of catalog include

* [TestDataSimple.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestDataSimple.json)
* [TestData.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestData.json)

### 5.2 `/catalog` response with file or command template for `info` object

Examples of this type of catalog include

* [TestDataSimple2](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestDataSimple2.json)
* [TestDataSimple3](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestDataSimple3.json)

```json
"catalog": 
 [
	{
		"id": "dataset1",
		"title": "a dataset",
		"info": "relativepath/to/dataset2/info_file.json"
	},
	{
		"id": "dataset2",
		"title": "another dataset",
		"info": "/absolutepath/to/dataset2/info_file.json"
	}
 ]
```

Alternatively, the metadata for each dataset may be produced by execution of a command line program for each dataset. For example, in the following `program1` should result in a HAPI JSON response from `/info?id=dataset1` to `stdout`. Before execution, the string `${ID}`, if found, is replaced with the requested dataset ID. Execution of `program2` should produce the HAPI JSON corresponding to the query `/info?id=dataset2`.


```json
"catalog":
 [
	{
		"id": "dataset1",
		"title": "a dataset",
		"info": "bin/program --id ${ID}" 
	}
	{
		"id": "dataset2",
		"title": "another dataset",
		"info": "program2"
	}
 ]
```

### 5.3 References to a command line template or file

The in the following the file or command line output can contain either a fully resolved catalog in the form shown in section 5.1 or a catalog with references as given in section 5.2.

```json
"catalog": "program --arg1 val1 ..."
```

The command line command should return the response of an `/info` query (with no `id` argument). 

The path to a fully resolved catalog can also be given

```json
"catalog": "file:///"
```

<a name="Tests"></a>
## 6. Tests

The following commands creates a local installation of the [HAPI verifier](https://github.com/hapi-server/verifier-nodejs) and tests the URL ```http://localhost:8999/hapi```.

```bash
mkdir tmp; cd tmp; 
git clone https://github.com/hapi-server/verifier-nodejs.git; 
cd verifier-nodejs; 
npm install; 
node test.js http://localhost:8999/hapi"
```

<a name="Contact"></a>
## 7. Contact

Bob Weigel <rweigel@gmu.edu>
