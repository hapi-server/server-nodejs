#!/bin/sh

~/.nvm/versions/node/v16.20.0/bin/node \
  --max-old-space-size=256 \
  server.js \
  --port 8999 --ignore \
  --server-ui-include https://hapi-server.org/all_.txt \
  --proxy-whitelist etc/proxy-whitelist.txt \
  -f metadata/TestData2.0.json \
  -f metadata/TestData2.1.json \
  -f metadata/TestData3.0.json \
  -f metadata/TestData3.1.json \
  -f metadata/TestData3.2.json \
  -f metadata/TestData3.3.json \
  -f metadata/URLWatcher.json \
  -f metadata/SSCWeb-chunk.json
  2>&1
