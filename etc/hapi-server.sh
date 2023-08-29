#!/bin/sh

~/.nvm/versions/node/v8.17.0/bin/node \
  --max-old-space-size=256 \
  server.js \
  --port 8999 --ignore \
  --server-ui-include https://raw.githubusercontent.com/hapi-server/servers/master/all_.txt \
  -f metadata/TestData2.0.json \
  -f metadata/TestData2.1.json \
  -f metadata/TestData3.0.json \
  -f metadata/TestData3.1.json \
  -f metadata/SSCWeb.json
  2>&1
