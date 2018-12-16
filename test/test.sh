#!/usr/bin/bash

fail="0"
for file in metadata/*.json
do
	name=${file##*/}
	base=${name%.json}
	com="node server.js --catalog ${base} --test --force"
	echo "--------------------------------"
	echo "test.sh: Running: "$com
	echo "--------------------------------"
	$com
	fail=$?
	if [[ $fail == "1" ]]; then
		echo "--------------------------------"
		echo "test.sh: Failed: "$com
		echo "--------------------------------"
		exit 1
	else
		echo "--------------------------------"
		echo "test.sh: Passed: "$com
		echo "--------------------------------"
	fi
done

if [[ $fail == "0" ]]; then
	echo "test.sh: All tests passed in test suite. Exiting with code 0."
	exit 0
else
	echo "test.sh: Not all tests passed in test suite.  Exiting with code 1."
	exit 1
fi