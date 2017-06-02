# Nodejs HAPI Sample Server

A minimal-feature HAPI server implemented in (node.js)[http://node.js].

Implements the four [HAPI 1.1](https://github.com/hapi-server/data-specification/) endpoints and required response elements and serves three types of code-generated parameters (scalar, vector, spectra).

Software for a full-featured HAPI server, (TSDS)[http://tsds.org/] is available at (http://github.org/tsds/tsds2)[http://github.org/tsds/tsds2].  If you would like to use (TSDS)[http://tsds.org/] to make your data server or file-based data set HAPI compliant, contact <rweigel@gmu.edu>.  

Data from this server are available from http://mag.gmu.edu/hapi or http://tsds.org/get/#catalog=TestData.

# Installation

Install [nodejs](https://nodejs.org/en/download/) (tested with v7.10.0)

```bash
git clone https://github.com/hapi-server/data-specification/nodejs-server
npm install
node server.js --port 8999
```

Open http://localhost:8999/hapi

# Contact

Bob Weigel <rweigel@gmu.edu>