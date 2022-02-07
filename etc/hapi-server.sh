!#/usr/bin/env sh

# Initially used because if "| logger -t" in .service, it gets passed
# as argument to server.js. However, systemd implements its own logging,
# so logger -t is not actually needed (and would do nothing).

/home/ubuntu/.nvm/versions/node/v8.17.0/bin/node \
    --max-old-space-size=256 \
    /home/ubuntu/server-nodejs/server.js \
    --port 8999 --ignore \
    --proxy-whitelist /home/ubuntu/server-nodejs-dev/public/meta/all.txt \
    -f /home/ubuntu/server-nodejs/metadata/TestData2.0.json \
    -f /home/ubuntu/server-nodejs/metadata/TestData2.1.json \
    -f /home/ubuntu/server-nodejs/metadata/TestData3.0.json \
    -f /home/ubuntu/server-nodejs/metadata/TestData3.1.json \
    -f /home/ubuntu/server-nodejs/metadata/SSCWeb.json
    2>&1
