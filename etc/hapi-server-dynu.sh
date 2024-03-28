#!/bin/bash

USER=/Users/weigel
APPDIR=$USER/git/hapi/server-nodejs

source ~/opt/anaconda3/etc/profile.d/conda.sh; conda activate
conda activate base

$USER/.nvm/versions/node/v16.20.0/bin/node \
    --max-old-space-size=512 \
    $APPDIR/server.js \
    --port 8999 --ignore \
    --server-ui-include https://hapi-server.org/all_.txt \
    --proxy-whitelist etc/proxy-whitelist.txt \
    -f $APPDIR/metadata/TestData2.0.json  \
    -f $APPDIR/metadata/TestData2.1.json  \
    -f $APPDIR/metadata/TestData3.0.json  \
    -f $APPDIR/metadata/TestData3.1.json  \
    -f $APPDIR/metadata/TestData3.2.json  \
    -f $APPDIR/metadata/URLWatcher.json   \
    -f $APPDIR/metadata/SSCWeb-chunk-ltfloats-parallel.json \
    -f $APPDIR/metadata/Example0.json \
    -f $APPDIR/metadata/Example2.json 
    2>&1
