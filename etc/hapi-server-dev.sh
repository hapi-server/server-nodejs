#!/bin/bash

APPDIR=.

#source /home/ubuntu/.nvm/nvm.sh && nvm use 12.22.12

~/.nvm/versions/node/v16.20.0/bin/node \
  --max-old-space-size=256 \
  $APPDIR/server.js \
  --port 8998 \
  --ignore \
  --server-ui-include https://hapi-server.org/dev.txt \
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
