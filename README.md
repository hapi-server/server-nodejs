# Nodejs HAPI Sample Server

A (HAPI)[https://github.com/hapi-server/data-specification/] 1.1 implemented in (node.js)[http://node.js] intended for testing (HAPI clients)[https://github.com/hapi-server/data-specification/].

Serves code-generated (parameters)[https://github.com/hapi-server/nodejs-server/blob/master/parameters.js].

Software for a full-featured HAPI server, (TSDS)[http://tsds.org/], is available at (http://github.org/tsds/tsds2)[http://github.org/tsds/tsds2].  If you would like to use (TSDS)[http://tsds.org/] to make your data server or file-based data set HAPI compliant, contact <rweigel@gmu.edu>.  

A running instance of this server is available at (http://mag.gmu.edu/hapi)[http://mag.gmu.edu/hapi].

# Installation

Install [nodejs](https://nodejs.org/en/download/) (tested with v7.10.0) and then

```bash
git clone https://github.com/hapi-server/data-specification/nodejs-server
cd nodejs-server; npm install
node server.js --port 8999
```

Open http://localhost:8999/hapi in a web browser.

# Sample Requests

See [tests.sh](https://github.com/hapi-server/nodejs-server/blob/master/tests.sh) in <code>./nodejs-server</code>.

# Contact

Bob Weigel <rweigel@gmu.edu>.