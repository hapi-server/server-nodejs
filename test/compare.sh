#!/bin/bash
# For comparing results of two servers

TMP=/tmp/hapi-debug
mkdir -p $TMP
rm -f $TMP/*

NEW=http://localhost:11110
OLD=http://localhost:11111
#OLD=http://hapi-server.org/servers

SERVER=TestData2.0
DATASET=dataset1
PARAMETERS=scalar
START=1970-01-01T00:00:00Z
STOP=1970-01-02T01:00:00Z

# Use TIME=time to show timing information.
TIME=""
TIME=time

######
com="$TIME curl -s -o $TMP/new.bin \"$NEW/$SERVER/hapi/data?id=$DATASET&parameters=$PARAMETERS&time.min=$START&time.max=$STOP&format=binary\""
echo $com
eval $com

com="$TIME curl -s -o $TMP/old.bin \"$OLD/$SERVER/hapi/data?id=$DATASET&parameters=$PARAMETERS&time.min=$START&time.max=$STOP&format=binary\""
echo $com
eval $com

com="diff $TMP/old.bin $TMP/new.bin"
eval $com
status=$?
######

######
od -t a $TMP/old.bin > $TMP/old.od
od -t a $TMP/new.bin > $TMP/new.od
com="diff $TMP/old.od $TMP/new.od"
echo $com
eval $com
status=$status$?
######

######
com="$TIME curl -s -o $TMP/new.csv \"$NEW/$SERVER/hapi/data?id=$DATASET&parameters=$PARAMETERS&time.min=$START&time.max=$STOP&format=csv\"";
echo $com
eval $com

com="$TIME curl -s -o $TMP/old.csv \"$OLD/$SERVER/hapi/data?id=$DATASET&parameters=$PARAMETERS&time.min=$START&time.max=$STOP&format=csv\""
echo $com
eval $com

com="diff $TMP/old.csv $TMP/new.csv"
echo $com
eval $com
status=$status$?
######

if [[ "$status" != *"0"* ]]; then
    echo "test.sh: All tests passed in test suite. Exiting with status 0."
    exit 0
else
    echo "test.sh: Not all tests passed in test suite. Exiting with status 1."
    exit 1
fi