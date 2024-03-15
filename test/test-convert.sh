BASE='http://localhost:7998/TestData2.0/hapi/data?id=dataset1&parameters=Time&time.min=1971-01-01T00:00:00'
STOP1='1971-01-01T00:00:01'
STOP2='1971-01-01T12:00:00'
META=TestData2.0.json

BASE='http://localhost:7998/SSCWeb/hapi/data?id=active&parameters=X_TOD&time.min=1989-09-29T00:00:00.000Z'
STOP1='1989-09-30T00:00:00.000Z'
STOP2='1989-10-29T00:00:00.000Z'
META=SSCWeb-chunk.json

ODIR=tmp-noincremental
mkdir -p $ODIR

node ../server.js --port 7998 -f ../metadata/$META & 
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