#!/bin/bash
source ~/.nvm/nvm.sh && nvm use 8

if [ "$1" = "devel" ]; then
	nodemon -i public/meta server.js -- --port 9998 --ignore \
		-f metadata/TestData2.0.json \
		-f metadata/TestData2.1.json \
		-f metadata/TestData3.0.json \
		--plotserver http://localhost:5000 \
		--verifier http://localhost:9999
else
	nohup forever server.js --port 9998 --ignore \
	-f metadata/TestData2.0.json \
	-f metadata/TestData2.1.json \
	-f metadata/TestData3.0.json \
	-f metadata/SSCWeb.json \
	2>&1 &
	tail -f nohup.out
fi
