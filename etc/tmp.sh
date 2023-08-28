#!/bin/sh


~/.nvm/versions/node/v8.16.0/bin/node \
    --max-old-space-size=256 \
    ~/git/hapi/server-nodejs/server.js \
    --port 8998 --ignore \
    -f ~/git/hapi/server-nodejs/metadata/SSCWeb.json \
    -f ~/git/hapi/server-nodejs/metadata/SSCWeb-ltfloats.json \
    2>&1
