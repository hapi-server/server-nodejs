# HAPI Server Front-End

## Contents

1. [About](#About)
2. [Usage](#Usage)
3. [Installation](#Installation)
4. [Metadata](#Metadata)
5. [Examples](#Examples)
6. [Tests](#Tests)
7. [Contact](#Contact)

## 1. About

The intended use case for this server is for a data provider that has

1. [HAPI](https://github.com/hapi-server/data-specification) metadata, in one of a [variety of forms](#Metadata), for a set of datasets and
2. a command line program that returns at least [HAPI CSV](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) given inputs of a dataset, a list of one or more parameters in a dataset, start/stop times, and (optionally) an output format.

This server handles

1. HAPI metadata validation,
2. request validation,
3. error responses,
4. logging and alerts,
5. generation of [HAPI JSON](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) or [HAPI Binary](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) (as needed)

## 2. Usage

`node server.js`

starts server on port 8999 and uses the catalog [`./metadata/TestDataSimple.json`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestDataSimple.json). 
 
All command line options:

```bash
server.js --port PORT --catalog CATALOG --prefix PREFIX
```

Serves data from `http://localhost:PORT/hapi` using datasets and command line program template specified in `metadata/CATALOG.json`. If `metadata/CATALOG.htm` is found, it is used as the landing page at `/hapi`.

If `PREFIX` is given, serves data from `http://localhost:8999/PREFIX/hapi`. 

When requests for metadata are made, information in `CATALOG.json` is used to generate the response. See the [Metadata](#Metadata) section for details.

When a request is made for data, output from a command line program specified in `CATALOG.json` will be piped to the response.

For example, in [`./metadata/TestDataSimple.json`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestDataSimple.json), the command line syntax is given as

```bash
python ./bin/TestDataSimple.py --dataset ${dataset} --parameters \
   ${parameters} --start ${start} --stop ${stop} --format ${format}"`
```

and in [`./metadata/TestData.json`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestData.json), it is

```bash
node ./bin/TestData.js --dataset ${dataset} --parameters \
   ${parameters} --start ${start} --stop ${stop} --format ${format}
```

When data is requested, this command line program is executed after variable substitution and the output is sent as the response.

## 3. Installation

Install [nodejs](https://nodejs.org/en/download/) (tested with v7.10.0) 

```bash
# Install Node Version Manager https://github.com/creationix/nvm
curl https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
# Use node.js version 7
nvm install 7
```

Clone the server respository

```bash
git clone https://github.com/hapi-server/server-nodejs
cd server-nodejs; npm install
node server.js --prefix TestDataSimple
```

and then open [http://localhost:8999/TestDataSimple/hapi](http://localhost:8999/TestDataSimple/hapi) in a web browser.

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

## 4. Metadata
 
The top-level structure of `CATALOG.json` file is

```
{
	"data": {
	    "command": "Command line template",
	    "contact": "Email address if error in command line program"
	},
	"catalog": [See 4.1: Combined HAPI /catalog and /info object]
	// or
	"catalog": [See 4.2: HAPI /catalog response with file or command line references for info object]
	// or
	"catalog": "See 4.3: Command line command or file"
}
```

See also examples in [`./metadata`](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/).

The command line template has placeholders for a dataset id (`${ID}`), start (`${start}`) and stop (`${stop}`) times, and optionally a output format (`${format}`). For example,

```bash
python ./bin/TestDataSimple.py --dataset ${ID} --parameters \
	${parameters} --start ${start} --stop ${stop} --format ${format}"`
```

```bash
node ./bin/TestData.js -id ${dataset} -params ${parameters} \
	-startDate ${start} -stopDate ${stop}
```

Each of the options for the catalog property are described in the following sections.

### 4.1 Combined HAPI `/catalog` and `/info` object

If `catalog` is an array, it should have the same format as a HAPI `/catalog` response (each object in the array has an `id` property and and optional `title` property) **with the addition** of an `info` property that is the HAPI response for that `id`, e.g., `/info?id=dataset1`. 

```json
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

* [TestDataSimple.json](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestDataSimple.json)
* [TestData.json](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestData.json)

### 4.2 `/catalog` response with file or command line references for `info` object

Examples of this type of catalog include

* [TestDataSimple2](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestDataSimple)
* [TestDataSimple3](https://github.com/hapi-server/server-nodejs/blob/v2/metadata/TestDataSimple2)

```json
 [
	{
		"id": "dataset1",
		"title": "a dataset",
		"info": "relativepath/to/dataset2/info_file.json"
	},
	{
		"id": "dataset2",
		"title": "another dataset",
		"info": "/absolutepath/to/dataset1/info_file.json"
	}
 ]
```

Alternatively, the metadata for each dataset may be produced by execution of a command line program for each dataset. For example, in the following `program1` should result in a HAPI JSON response from `/info?id=dataset1` to `stdout`. Before execution, the string `${ID}`, if found, is replaced with the requested dataset ID. Execution of `program2` should produce the HAPI JSON corresponding to the query `/info?id=dataset2`.


```json
 [
	{
		"id": "dataset1",
		"title": "a dataset",
		"info": "program --id ${ID}" 
	}
	{
		"id": "dataset2",
		"title": "another dataset",
		"info": "program2"
	}
 ]
```

### 4.3 References to a Command Line Program or File

The in the following the file or command line output can contain either a fully resolved catalog in the form shown in section 4.1 or a catalog with references as given in section 4.2.

```json
{
    "data": {
        "command": "Command line template",
        "contact": "Email address if error in command line program"
    },
	"catalog": "program --arg1 val1 ..."
}
```

The command line command should return the response of an `/info` query. 

```json
{
    "data": {
        "command": "Command line template",
        "contact": "Email address if error in command line program"
    },
	"catalog": "file:///"
}
```

## 5. Examples

Discuss using Autoplot on a pile of files.

## 6. Tests

The following commands creates a local installation of the [HAPI verifier](https://github.com/hapi-server/verifier-nodejs) and tests the URL ```http://localhost:8999/hapi```.

```bash
mkdir tmp; cd tmp; 
git clone https://github.com/hapi-server/verifier-nodejs.git; 
cd verifier-nodejs; 
npm install; 
node test.js http://localhost:8999/hapi"
```

## 7. Contact

Bob Weigel <rweigel@gmu.edu>