mkdir -p $ODIR

node ../server.js --port 7998 -f ../metadata/TestData2.0.json -f ../metadata/TestData2.0-proxy.json &
CMD=$!
sleep 2


curl $BASE'&time.max='$STOP1'&format=csv' > $ODIR/data1.csv
curl $BASE'&time.max='$STOP1'&format=binary' > $ODIR/data1.bin

curl $BASE'&time.max='$STOP1'&format=csv&include=header' > $ODIR/data1-include.csv
curl $BASE'&time.max='$STOP1'&format=binary&include=header' > $ODIR/data1-include.bin

curl $BASE'&time.max='$STOP2'&format=csv' > $ODIR/data2.csv
curl $BASE'&time.max='$STOP2'&format=binary' > $ODIR/data2.bin

curl $BASE'&time.max='$STOP2'&format=csv&include=header' > $ODIR/data2-include.csv
curl $BASE'&time.max='$STOP2'&format=binary&include=header' > $ODIR/data2-include.bin

kill -9 $CMD