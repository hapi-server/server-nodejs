!#/usr/bin/env sh

# Initially used because if "| logger -t" in .service, it gets passed
# as argument to server.js. However, systemd implements its own logging,
# so logger -t is not actually needed (and would do nothing).

/home/ubuntu/.nvm/versions/node/v8.17.0/bin/node \
    /home/ubuntu/server-nodejs-dev/server.js \
    --port 8998 --ignore --proxy true \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData2.0.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData2.1.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData3.0.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/TestData3.1.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/INTERMAGNET.json \
    -f /home/ubuntu/server-nodejs-dev/metadata/CAIO.json \        
    2>&1
