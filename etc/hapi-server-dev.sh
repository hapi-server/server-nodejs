#!/bin/sh

APPDIR=/home/ubuntu/server-nodejs-dev

#cpulimit -l 5 -- nice -20 \
/home/ubuntu/.nvm/versions/node/v18.10.0/bin/node \
    --max-old-space-size=256 \
    $APPDIR/server.js \
    --port 8998 --ignore \
    --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/dev.txt \
    --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/all_.txt \
    -f $APPDIR/metadata/TestData2.0.json \
    -f $APPDIR/metadata/TestData2.1.json \
    -f $APPDIR/metadata/TestData3.0.json \
    -f $APPDIR/metadata/TestData3.1.json \
    -f $APPDIR/metadata/URLWatcher.json \
    -f $APPDIR/metadata/SSCWeb-chunk-ltfloats-parallel.json \
    -f $APPDIR/metadata/Example0.json \
    -f $APPDIR/metadata/Example2.json \
    -f $APPDIR/metadata/CAIO.json \        
    2>&1
