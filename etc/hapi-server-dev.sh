#!/bin/bash

APPDIR=.

source /home/ubuntu/.nvm/nvm.sh && nvm use 18

node \
  --max-old-space-size=256 \
  $APPDIR/server.js \
  --port 8998 \
  --ignore \
  --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/dev.txt  \
  --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/all_.txt \
  --proxy-whitelist $APPDIR/etc/proxy-whitelist.txt \
  -f $APPDIR/metadata/TestData2.0.json  \
  -f $APPDIR/metadata/TestData2.1.json  \
  -f $APPDIR/metadata/TestData3.0.json  \
  -f $APPDIR/metadata/TestData3.1.json  \
  -f $APPDIR/metadata/URLWatcher.json   \
  -f $APPDIR/metadata/SSCWeb-chunk-ltfloats-parallel.json \
  -f $APPDIR/metadata/Example0.json \
  -f $APPDIR/metadata/Example2.json 
  2>&1
