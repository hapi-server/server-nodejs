#!/bin/sh

/home/ubuntu/.nvm/versions/node/v8.17.0/bin/node \
    --max-old-space-size=256 \
    /home/ubuntu/server-nodejs-dev/server.js \
    --port 8997 \
    --ignore \
    --skipchecks \
    --verifier https://hapi-server.org/verify-dev \
    --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/dev.txt \
    --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/all_.txt \
    -f metadata/SSCWeb.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData2.0.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData2.1.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData3.0.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData3.1.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/Example0.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/Example2.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/CAIO.json \        
    2>&1
