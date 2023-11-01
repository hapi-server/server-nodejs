#!/bin/bash

APPDIR=.

source /home/ubuntu/.nvm/nvm.sh && nvm use 8

node \
  --max-old-space-size=256 \
  $APPDIR/server.js \
  --port 8998 \
  --ignore \
  --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/dev.txt  \
  --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/all_.txt \
  --proxy-whitelist $APPDIR/etc/proxy-whitelist.txt \
  -f $APPDIR/metadata/TestData3.0.json   \
  2>&1
