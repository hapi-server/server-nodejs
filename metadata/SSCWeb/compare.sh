mkdir -p compare;

SAT=ace
SAT=akebono
SAT=goes7

URLa="http://hapi-server.org/servers/SSCWeb/hapi/data"
URLb="http://localhost:8999/SSCWeb-chunk-ltfloats-parallel/hapi/data"

echo -n "Test 1 "
a=compare/a1.txt
b=compare/b1.txt
rm -f $a $b
curl -s "$URLa?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-08T00:00:00.000Z" > $a
curl -s "$URLb?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-08T00:00:00.000Z" > $b
diff $a $b && echo "PASS" || echo "FAIL"

echo -n "Test 2 "
a=compare/a2.txt
b=compare/b2.txt
rm -f $a $b
curl -s "$URLa?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-09T00:00:00.000Z" > $a
curl -s "$URLb?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-09T00:00:00.000Z" > $b
diff $a $b && echo "PASS" || echo "FAIL"

echo -n "Test 3 "
a=compare/a3.txt
b=compare/b3.txt
rm -f $a $b
curl -s "$URLa?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-10T00:00:00.000Z" > $a
curl -s "$URLb?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-10T00:00:00.000Z" > $b
diff $a $b && echo "PASS" || echo "FAIL"

echo -n "Test 4 "
a=compare/a4.txt
b=compare/b4.txt
rm -f $a $b
curl -s "$URLa?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:00.000Z" > $a
curl -s "$URLb?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:00.000Z" > $b
diff $a $b && echo "PASS" || echo "FAIL"

echo -n "Test 5 "
a=compare/a5.txt
b=compare/b5.txt
rm -f $a $b
curl -s "$URLa?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:12.000Z" > $a
curl -s "$URLb?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:12.000Z" > $b
diff $a $b && echo "PASS" || echo "FAIL"

echo -n "Test 6 "
a=compare/a6.txt
b=compare/b6.txt
rm -f $a $b
curl -s "$URLa?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-30T00:00:12.000Z" > $a
curl -s "$URLb?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-30T00:00:12.000Z" > $b
diff $a $b && echo "PASS" || echo "FAIL"
