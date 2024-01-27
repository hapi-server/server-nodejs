#!/bin/bash

USER=/Users/weigel
APPDIR=$USER/git/hapi/server-nodejs

source ~/opt/anaconda3/etc/profile.d/conda.sh; conda activate
conda activate base

$USER/.nvm/versions/node/v12.22.12/bin/node \
    --max-old-space-size=512 \
    $APPDIR/server.js \
    --port 8999 --ignore \
    --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/all_.txt \
    -f $APPDIR/metadata/TestData2.0.json \
    -f $APPDIR/metadata/TestData2.1.json \
    -f $APPDIR/metadata/TestData3.0.json \
    -f $APPDIR/metadata/TestData3.1.json \
    -f $APPDIR/metadata/SSCWeb-chunk-ltfloats-parallel.json     \
    2>&1
