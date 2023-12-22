<!-- TOC -->
[1 About](#1-about)<br/>
[2 Installation](#2-installation)<br/>
[3 Examples](#3-examples)<br/>
&nbsp;&nbsp;&nbsp;[3.1 List of Included Examples](#31-list-of-included-examples)<br/>
&nbsp;&nbsp;&nbsp;[3.2 Serve data from a minimal Python program](#32-serve-data-from-a-minimal-python-program)<br/>
&nbsp;&nbsp;&nbsp;[3.3 Serve data from an enhanced Python program](#33-serve-data-from-an-enhanced-python-program)<br/>
&nbsp;&nbsp;&nbsp;[3.4 Serve data from a non-HAPI web service](#34-serve-data-from-a-non-hapi-web-service)<br/>
&nbsp;&nbsp;&nbsp;[3.5 Serve data stored in a single file](#35-serve-data-stored-in-a-single-file)<br/>
&nbsp;&nbsp;&nbsp;[3.6 Serve data read by Autoplot](#36-serve-data-read-by-autoplot)<br/>
[4 Usage](#4-usage)<br/>
[5 Server Configuration](#5-server-configuration)<br/>
&nbsp;&nbsp;&nbsp;[5.1 conf/config.json](#51-conf-config.json)<br/>
&nbsp;&nbsp;&nbsp;[5.2 Apache](#52-apache)<br/>
&nbsp;&nbsp;&nbsp;[5.3 Nginx](#53-nginx)<br/>
[6 Metadata](#6-metadata)<br/>
&nbsp;&nbsp;&nbsp;[6.1 server](#61-server)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[6.1.1 id and prefix](#611-id-and-prefix)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[6.1.2 contact](#612-contact)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[6.1.3 landingFile and landingPath](#613-landingfile-and-landingpath)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[6.1.4 catalog-update](#614-catalog-update)<br/>
&nbsp;&nbsp;&nbsp;[6.2 catalog](#62-catalog)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[6.2.1 Combined HAPI /catalog and /info object](#621-combined-hapi-catalog-and-info-object)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[6.2.2 /catalog response with file or command template for info object](#622-catalog-response-with-file-or-command-template-for-info-object)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[6.2.3 References to a command-line template or file](#623-references-to-a-command-line-template-or-file)<br/>
&nbsp;&nbsp;&nbsp;[6.3 data](#63-data)<br/>
[7 Development](#7-development)<br/>
[8 Contact](#8-contact)
<!-- \TOC -->

<a name="About"></a>
# 1 About

The intended use for this server-side software is a data provider wants to serve data through a [HAPI API](https://github.com/hapi-server/data-specification). To be able to serve data from a HAPI API from their server using this software, the data provider only needs

1. [HAPI](https://github.com/hapi-server/data-specification) metadata, in one of a [variety of forms](#Metadata), for a collection of datasets and
2. a command-line program that returns at least [headerless HAPI CSV](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) for all parameters in the dataset over the full time range of available data. Optionally, the command line program can take inputs of a start and stop time, a list of one or more parameters to output, and an output format.

This software handles

1. HAPI metadata validation,
2. request validation and error responses,
3. logging and alerts,
4. time and parameter subsetting (as needed), and
5. generation of [HAPI JSON](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) or [HAPI binary](https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#data-stream-content) (as needed).

%A list of catalogs that are served using this software is given at [http://hapi-server.org/servers]([http://hapi-server.org/servers]).

<a name="Installation"></a>
# 2 Installation

Requires [NodeJS](https://nodejs.org/).

```
git clone https://github.com/hapi-server/server-nodejs.git
cd server-nodejs
npm install
node server.js
```

<a name="Examples"></a>
# 3 Examples

## 3.1 List of Included Examples

The following examples are included in the [metadata](https://github.com/hapi-server/server-nodejs/blob/master/metadata/) directory. The examples can be run using

```
./hapi-server -f metadata/FILENAME.json
```

where `FILENAME.json` is one of the file names listed below (e.g., `Example0.json`).

* [Example0.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example0.json) - A Python program dumps a full dataset in the headerless HAPI CSV format; the server handles time and parameter subsetting and creation of HAPI Binary and JSON.
* [Example1.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example1.json) - Same as Example0 except the Python program handles time subsetting.
* [Example2.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example2.json) - Same as Example1 except the Python program handles time and parameter subsetting and creation of HAPI CSV and Binary.
* [Example3.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example3.json) - Same as Example2 except for HAPI info metadata for each dataset is stored in an external file.
* [Example4.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example4.json) - Same as Example3 except for HAPI info metadata for each dataset is generated by a command-line command.
* [Example5.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example5.json) - Same as Example4 except catalog metadata is stored in an external file.
* [Example6.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example6.json) - Same as Example5 except catalog metadata is generated by a command-line command.
* [Example7.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example7.json) - Pass-through example; Same as Example2 except that data is generated by remote request and catalog metadata is returned from a URL.
* [Example8.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example8.json) - A dataset in headerless HAPI CSV format is stored in a single file; the server handles parameter and time subsetting and creation of HAPI JSON and Binary.
* [Example9.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example9.json) - A dataset in headerless HAPI CSV format is returned by a URL; the server handles parameter and time subsetting and creation of HAPI JSON and Binary.
* [AutoplotExample1.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/AutoplotExample1.json) - A dataset is stored in multiple files and AutoplotDataServer is used to subset in time.
* [AutoplotExample2.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/AutoplotExample2.json) - A dataset is stored in a CDF file and AutoplotDataserver is used to generate HAPI CSV.
* [TestData2.0.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestData.json) - A test dataset used to test HAPI clients.
* [SSCWeb.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/SSCWeb.json) - Data from a non-HAPI web service is made available from a HAPI server.
* [QinDenton.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/QinDenton) - Data in a single ASCII file is converted to headerless HAPI CSV by a Python program. See section 2.5.

## 3.2 Serve data from a minimal Python program

In this example, we assume that the command line program that returns a dataset has the minimal capabilities required - when executed, it generates a headerless HAPI CSV file with all parameters in the dataset over the full time range of available data. The server handles time and parameter subsetting and the generation of HAPI Binary and JSON.

The Python script [Example.py](https://github.com/hapi-server/server-nodejs/blob/master/bin/Example.py) returns HAPI-formatted CSV data (with no header) with two parameters. To serve this data, only a configuration file, [Example0.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example0.json), is needed. The configuration file has information that is used to call the command line program and it also has HAPI metadata that describes the output of [Example.py](https://raw.githubusercontent.com/hapi-server/server-nodejs/master/bin/Example.py). Details about the configuration file format are described in the [Metadata](#Metadata) section.

The Python calling syntax of [Example.py](https://github.com/hapi-server/server-nodejs/blob/master/bin/Example.py) is 

```
python Example.py
```

To run this example locally after [installation](#Installation), execute

```bash
./hapi-server --file metadata/Example0.json
```

and then open `http://localhost:8999/Example0/hapi`. You should see the same landing page as that at [http://hapi-server.org/servers-dev/Example0/hapi](http://hapi-server.org/servers-dev/Example0/hapi). Note that the `--open` command-line switch can be used to automatically open the landing page, e.g.,

```bash
./hapi-server --file metadata/Example0.json --open
```

## 3.3 Serve data from an enhanced Python program

The Python script [Example.py](https://github.com/hapi-server/server-nodejs/blob/master/bin/Example.py) actually can subset parameters and time and provide binary output. To force the server to use these capabilities, we need to modify the server configuration metadata in [Example1.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example2.json). The changes are replacing

```
"command": "python bin/Example.py"
```

with

```
"command": "python bin/Example.py --params ${parameters} --start ${start} --stop ${stop} --fmt ${format}"
```

and adding

```
"formats": ["csv","binary"]
```

The modified file is [Example2.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example2.json). To run this example locally after [installation](#Installation), execute

```bash
./hapi-server --file metadata/Example2.json
```

and then open `http://localhost:8999/Example2/hapi`.  The command-line program now produces binary output and performs parameter subsetting as needed and the response time for data should decrease.

The server responses will be identical to that in the previous example. You should see the same landing page as that at [http://hapi-server.org/servers-dev/Example2/hapi](http://hapi-server.org/servers-dev/Example2/hapi).

## 3.4 Serve data from a non-HAPI web service

A non-HAPI server can be quickly made HAPI compliant by using this server as a pass-through. Data from [SSCWeb](https://sscweb.sci.gsfc.nasa.gov/), which is available from a [REST API](https://sscweb.sci.gsfc.nasa.gov/WebServices/REST/), has been made available through a HAPI API at [http://hapi-server.org/servers/SSCWeb/hapi](http://hapi-server.org/servers/SSCWeb/hapi). The configuration file is [SSCWeb.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/SSCWeb.json) and the command line program is [SSCWeb.js](https://github.com/hapi-server/server-nodejs/blob/master/bin/SSCWeb.js). Note that the metadata file [SSCWeb.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/SSCWeb.json) was created using code in [metadata/SSCWeb](https://github.com/hapi-server/server-nodejs/blob/master/metadata/SSCWeb).

To run this example locally after [installation](#Installation), execute

```bash
./hapi-server --file metadata/SSCWeb.json --open
```

You should see the same landing page as that at [http://hapi-server.org/servers/SSCWeb/hapi](http://hapi-server.org/servers/SSCWeb/hapi).

## 3.5 Serve data stored in a single file

The [Qin-Denton](http://virbo.org/QinDenton) dataset contains multiple parameters stored in a single large file.

The command-line program that produces HAPI CSV from this file is [QinDenton.py](https://github.com/hapi-server/server-nodejs/blob/master/bin/QinDenton.py) and the metadata is in [QinDenton.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/QinDenton.json).

To run this example, use

```
./hapi-server --file metadata/QinDenton.json
```

## 3.6 Serve data read by Autoplot

Nearly any data file that can be read by [Autoplot](http://autoplot.org/) can be served using this server. 

Serving data requires at most two steps:

1. Generating an Autoplot URI for each parameter; and (in some cases)
2. Writing (by hand) metadata for each parameter.

**Example 1**

The first example serves data stored in a single CDF file. The configuration file is [AutoplotExample1.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/AutoplotExample1.json).

In this example, step 2. above (writing metadata by hand) is not required because the data file has metadata that is in a format that Autoplot can translate to HAPI metadata.

To run this example locally, execute

```bash
./hapi-server --file metadata/AutoplotExample1.json
```

**Example 2**

The second example serves data stored in multiple ASCII files. The configuration file is [AutoplotExample2.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/AutoplotExample2.json).

To run this example locally, execute

```bash
./hapi-server --file metadata/AutoplotExample2.json
```

<a name="Usage"></a>
# 4 Usage

List command-line options:

```
./hapi-server -h

Usage: node server.js [options]

Options:
  --help, -h           Show help                                       [boolean]
  --https              Start https server             [boolean] [default: false]
  --cert               https certificate file path
  --key                https key file path
  --file, -f           Catalog configuration file or file pattern [string]
                                 [default: "./lib/../metadata/TestData2.0.json"]
  --port, -p           Server port                               [default: 8999]
  --conf, -c           Server configuration file
  --ignore, -i         Start server even if metadata validation errors
                                                      [boolean] [default: false]
  --skipchecks, -s     Skip startup metadata validation and command line tests
                                                      [boolean] [default: false]
  --logdir, -l         Log directory                   [default: "./lib/../log"]
  --open, -o           Open web page on start         [boolean] [default: false]
  --test, -t           Run URL tests and exit         [boolean] [default: false]
  --verify, -v         Run verification tests on command line and exit
                                                      [boolean] [default: false]
  --loglevel           info or debug                           [default: "info"]
  --verifier           Verifier server URL on landing page (__VERIFIER__ in html
                       is replaced with this value)                [default: ""]
  --plotserver         Plot server URL on landing page (__PLOTSERVER__ in html
                       is replaced with this value)                [default: ""]
  --python             Location of Python binary to use (if needed for command
                       line calls).                                [default: ""]
  --nodejs             Location of NodeJS binary to use (if needed for command
                       line calls).
  --server-ui-include  Also include these servers in server-ui server drop-down.
                       Use multiple times for more than one list.  [default: ""]
  --proxy-whitelist    Allow proxying of these servers (so one can use
                       server=http://... in addressbar of server-ui).
                                                                   [default: ""]

For more details, see README at https://github.com/hapi-server/server-nodejs/
```

Basic usage:

```
./hapi-server --file metadata/TestData.json
```

Starts HAPI server at [`http://localhost:8999/TestData/hapi`](http://localhost:8999/hapi) and serves datasets specified in the catalog [./metadata/TestData.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestData.json). 

Multiple catalogs can be served by providing multiple catalog files on the command line:

```bash
./hapi-server --file CATALOG1.json --file CATALOG2.json
```

For example

```bash
./hapi-server --file metadata/TestData2.0.json --file metadata/Example1.json
```
will serve the two datasets at

```
http://localhost:8999/TestData2.0/hapi
http://localhost:8999/Example1/hapi
```

And the page at `http://localhost:8999/` will point to these two URLs.

<a name="Server_Configuration"></a>
# 5 Server Configuration

## 5.1 conf/config.json

The variables `$HAPISERVERPATH`, `$PYTHONEXE`, and `$NODEJSEXE` can be used in commands, files, and URLs in the server metadata (which are files passed using the command-line `--file` switch). See [the examples](https://github.com/hapi-server/server-nodejs/tree/master/metadata) for use cases.

These variables can be passed as command line arguments or set in the default configuration file `conf/server.json`; an alternative location can be set using a command-line argument, e.g.,

```
./hapiserver -c /tmp/config.json
```

Variables set on the command line take precedence over those set in `conf/server.json`.

**`$HAPISERVERPATH`**

`$HAPISERVERPATH` can be used in metadata files. For example,

```javascript
{
  "server": {...},
  "data": {...},
  "catalog_file": "$HAPISERVERPATH/mymetadata/Data.json"
}
```

By default, `$HAPISERVERPATH` is the installation directory (the directory containing the shell launch script `hapi-server`). Modify `HAPISERVERPATH` in `conf/server.json` to use a custom path.

All relative paths in commands in metadata files are relative to the directory where `hapi-server` was executed.

**`PYTHONEXE`**

This is the command used to call Python. By default, it is `python`. If `python` is not in the path, this can be set using a relative or absolute path. Python is used by several of the demonstration catalogs.

This variable can also be set using the `--python` command line switch, which has the highest precedence.

Example:

```javascript
data: {
  "command": "$PYTHONEXE $HAPISERVERPATH/mybin/Data.py"
}
```

**`NODEJSEXE`**

This variable can also be set using the `--nodejs` command line switch, which has the highest precedence.

This is the command used to call NodeJS. By default, it is the command used to start the server. The start-up script looks for a NodeJS executable in `$HAPISERVERPATH/bin` and then tries `node` and then `nodejs`.

## 5.2 Apache

To expose a URL through Apache, (1) enable `mod_proxy` and `mod_proxy_http`, (2) add the following in a `<VirtualHost>` node in a [Apache Virtual Hosts](https://httpd.apache.org/docs/2.4/vhosts/examples.html) file

```
<VirtualHost *:80>
ProxyPass /TestData2.0 http://localhost:8999/TestData2.0 retry=1
ProxyPassReverse /TestData2.0 http://localhost:8999/TestData2.0
</VirtualHost>
```

and (3) `Include` this file in the Apache start-up configuration file.

If serving multiple catalogs, use

```
<VirtualHost *:80>
ProxyPass /servers http://localhost:8999/servers retry=1
ProxyPassReverse /servers http://localhost:8999/servers
</VirtualHost>
```

## 5.3 Nginx

For Nginx, add the following to `nginx.conf`

```
location /TestData2.0 { proxy_pass http://localhost:8999/TestData2.0;}
```

If serving multiple catalogs, use

```
location /servers {proxy_pass http://localhost:8999/servers;}
```

<a name="Metadata"></a>
# 6 Metadata

The metadata required for this server is similar to the `/catalog` and `/info` response of a HAPI server. 

* Example HAPI [`/catalog`](http://hapi-server.org/servers/TestData2.1/hapi/catalog) response
* Example HAPI [`/info`](http://http://hapi-server.org/servers/TestData2.1/hapi/info?id=dataset1) response

The server requires that the `/catalog` response is combined with the `/info` response for all datasets in the catalog in a single JSON catalog configuration file. Additional information about how to generate data must also be included in this JSON file.

The top-level structure of the configuration file is

```
{
  "server": // See section 5.1
  {
    "id": "",
    "prefix": "",
    "HAPI": "",
    "contact": "",
    "landingFile": "",
    "landingPath": "",
    "verify": "",
    "catalog-update": null
  },
  "catalog": "array or string" // See section 5.2 
  "data":  // See section 5.3
  {
     "command": "Command line template",
     or
     "file": "HAPI CSV file"
     "fileformat": "one of 'csv', 'binary', 'json'"
     or
     "url": "URL that returns HAPI data"
     "urlformat": "one of 'csv', 'binary', 'json'"
     "contact": "Email address if error in command line program",
     "testcommands": [
       {
        "command": string,  
        "Nlines": integer,
        "Nbytes": integer,
        "Ncommas", integer
        },
        ...
      ],
      "testurls": [
        {
          "url": string,  
          "Nlines": integer, 
          "Nbytes": integer,  
          "Ncommas": integer
        },
        ...
      ]
        },
    }
```

A variety of examples are given in [`./metadata`](https://github.com/hapi-server/server-nodejs/blob/master/metadata/) and described below along with options for the catalog property.

The string `command` in the data node is a command that produces a headerless HAPI data response and can have placeholders for time range of data to return (using start (`${start}`) and stop (`${stop}`)), a dataset id (`${id}`), a comma-separated list of parameters (`${parameters}`) and an output format (`${format}`). For example,

```bash
python ./bin/Example.py --dataset ${id} --parameters \
    ${parameters} --start ${start} --stop ${stop} --format ${format}"`
```

## 6.1 server

The server node has the form

```
"server": {
  "id": "", 		    // Default is file name without extension.
  "prefix": "", 	  // Default is id.
  "contact": "",    // Required. Server will not start without this set.
  "HAPI": "",       // Default is 2.1. HAPI API and schema to use for checking metadata.
  "contact": "",
  "landingFile": "",
  "landingPath": "",
  "verify": "",
  "catalog-update": null // How often in seconds to re-read content
                         // in the catalog node (5.2).
}
```

### 6.1.1 id and prefix

The `id` is by default the name of the server configuration file, e.g.,

```
./hapi-server --file metadata/TestData2.0.json
```

then `id=TestData2.0` and `prefix=TestData2.0`.

By default, this catalog would be served from

```
http://localhost:8999/TestData2.0/hapi
```

`TestData2.0` in the URL can be changed to `TestData2.0.0` by using `prefix=TestData2.0.0`.

### 6.1.2 contact

This element must not be empty or the server will not start. It should be at minimum the email address of a system administrator.

### 6.1.3 landingFile and landingPath

`landingFile` is the file to serve in response to requests for

```
http://localhost:8999/TestData2.0/hapi
```

By default, the landing page served is [single.htm](https://github.com/hapi-server/server-ui/blob/master/single.htm) from the HAPI server UI codebase. The double underscore variables in this file are replaced using the information in the metadata file (e.g., `__CONTACT__` is replaced with the `server.contact` value. A different landing page can be served by setting the `landingFile` configuration variable, e.g. `"landingFile": "$HAPISERVERPATH/public/index.htm"`, where `$HAPISERVERPATH` is described in [Server Configuration](#Server_Configuration). 

If `landingFile` has local CSS and JS dependencies, set `landingPath` to be the local directory of the referenced files. Several possible settings are

```
"landingFile": "$HAPISERVERPATH/index.htm", 
// $HAPISERVERPATH will be replaced with location of hapi-server binary
"landingPath": "/var/www/public/" // Location of CSS and JS files
// If index.htm has <script src="index.js">, index.js should be in /var/www/public/
```

To serve a directory listing, use

```
"landingFile": "",
"landingPath": "/var/www/public/"
// Server will look for index.htm and index.html in /var/www/public/. If not
// found, directory listing of /var/www/public/ will be served.
```

### 6.1.4 catalog-update

This is an integer number of seconds corresponding to how often the `catalog` node should be updated. Use this if the `catalog` node is not static.

## 6.2 catalog

The `catalog` node can be either a string or an array. 

In the case that it is an array, it should contain either the combined HAPI `/catalog` and `/info` response (5.2.1) or a `/catalog` response with references to the `\info` response (5.2.1).

In the case that it is a string (5.2.3), the string is either a file containing a catalog array or a command-line template that returns a catalog array. 

### 6.2.1 Combined HAPI /catalog and /info object

If `catalog` is an array, it should have the same format as a HAPI `/catalog` response (each object in the array has an `id` property and optional `title` property) **with the addition** of an `info` property that is the HAPI response for that `id`, e.g., `/info?id=dataset1`. 

```json
"catalog":
    [
       {
        "id": "dataset1",
        "title": "a dataset",
        "info": {
          "startDate": "2000-01-01Z",
          "stopDate": "2000-01-02Z",
          "parameters": [...]
        }
      },
      {
        "id": "dataset2",
        "title": "another dataset",
        "info": {
         "startDate": "2000-01-01Z",
         "stopDate": "2000-01-02Z",
         "parameters": [...]
       }
     }
    ]
```

In the following subsections, this type of JSON structure is referred to as a **fully resolved catalog**.

Examples of this type of catalog include

* [Example1.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example1.json)
* [TestData2.0.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/TestData2.0.json)

### 6.2.2 /catalog response with file or command template for info object

The `info` value can be a path to an `info` JSON file

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
See also [Example3.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example3.json).

Alternatively, the metadata for each dataset may be produced by the execution of a command-line program for each dataset. For example, in the following, `program1` should result in a HAPI JSON response from `/info?id=dataset1` to `stdout`. Before execution, the string `${id}`, if found, is replaced with the requested dataset ID. Execution of `program2` should produce the HAPI JSON corresponding to the query `/info?id=dataset2`. 

```json
"catalog":
    [
    	{
    		"id": "dataset1",
    		"title": "a dataset",
    		"info": "bin/program --id ${id}" 
    	},
    	{
    		"id": "dataset2",
    		"title": "another dataset",
    		"info": "program2"
    	}
    ]
```
See also [Example4.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example4.json).

### 6.2.3 References to a command-line template or file

The `catalog` value can be a command-line program that generates a fully resolved catalog, e.g.,

```json
"catalog": "program --arg1 val1 ..."
```

The command-line command should return the response of an `/info` query (with no `id` argument). 

The path to a fully resolved catalog can also be given. See also [Example5.json](https://github.com/hapi-server/server-nodejs/blob/master/metadata/Example4.json).

## 6.3 data

<a name="Development"></a>
# 7 Development

Install [nodejs](https://nodejs.org/en/download/) (tested with v8) using either the [standard installer](https://nodejs.org/en/download/) or [NVM](https://github.com/creationix/nvm#install--update-script).

```bash
# Install Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash

# Open a new shell (see displayed instructions from above command)

# Install and use node.js version 8
nvm install 8
```


```bash
# Clone the server repository
git clone https://github.com/hapi-server/server-nodejs

# Install dependencies
cd server-nodejs; npm install

# Start server
node server.js

# Run tests; Python 2.7+ required for certain tests.
npm test
```

<a name="Contact"></a>
# 8 Contact

Please submit questions, bug reports, and feature requests to the [issue tracker](https://github.com/hapi-server/server-nodejs/issues).
