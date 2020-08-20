#!/bin/bash
source ~/.nvm/nvm.sh && nvm use 6

if [ "$1" = "dev-test" ]; then
    #nodemon -i public/meta server.js -- --port 8998 --ignore \
    node server.js --port 8998 --ignore \
	-f metadata/TestData2.0.json \
	-f metadata/TestData2.1.json \
	-f metadata/TestData3.0.json \
	-f metadata/SSCWeb.json      \
    	-f metadata/INTERMAGNET.json
elif [ "$1" = "test" ]; then
    forever -m 1 server.js --port 8998 --ignore \
	-f metadata/TestData2.0.json \
	-f metadata/TestData2.1.json \
	-f metadata/TestData3.0.json \
	-f metadata/SSCWeb.json
else
    nohup forever server.js --port 9998 --ignore \
	-f metadata/TestData2.0.json \
	-f metadata/TestData2.1.json \
	-f metadata/TestData3.0.json \
	-f metadata/SSCWeb.json      \
	2>&1 &
	sleep 1
	tail -f nohup.out &
fi
