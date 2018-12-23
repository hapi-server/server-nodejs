#!/usr/bin/bash

status="0"
fail="0"
for file in metadata/Example*.json
do
	name=${file##*/}
	base=${name%.json}
	com="node server.js --file ${file} --test --ignore"
	echo "--------------------------------"
	echo "test.sh: Running: "$com
	echo "--------------------------------"
	$com
	status=$?
	if [[ $status == "1" ]]; then
		echo "--------------------------------"
		echo "test.sh: Failed: "$com
		echo "--------------------------------"
		fail="1"
	else
		echo "--------------------------------"
		echo "test.sh: Passed: "$com
		echo "--------------------------------"
	fi
done

if [[ $fail == "0" ]]; then
	echo "test.sh: All tests passed in test suite. Exiting with status 0."
	exit 0
else
	echo "test.sh: Not all tests passed in test suite.  Exiting with status 1."
	exit 1
fi