SAT=ace
SAT=akebono
SAT=goes7

curl -s "http://hapi-server.org/servers/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-08T00:00:00.000Z" > orig.txt
curl -s          "http://localhost:8999/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-08T00:00:00.000Z" > curr.txt
echo "1"
diff orig.txt curr.txt

curl -s "http://hapi-server.org/servers/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-09T00:00:00.000Z" > orig.txt
curl -s          "http://localhost:8999/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-09T00:00:00.000Z" > curr.txt
echo "2"
diff orig.txt curr.txt

curl -s "http://hapi-server.org/servers/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-10T00:00:00.000Z" > orig.txt
curl -s          "http://localhost:8999/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-10T00:00:00.000Z" > curr.txt
echo "3"
diff orig.txt curr.txt

curl -s "http://hapi-server.org/servers/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:00.000Z" > orig.txt
curl -s          "http://localhost:8999/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:00.000Z" > curr.txt
echo "4"
diff orig.txt curr.txt

curl -s "http://hapi-server.org/servers/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:12.000Z" > orig.txt
curl -s          "http://localhost:8999/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-09-11T00:00:12.000Z" > curr.txt
echo "5"
diff orig.txt curr.txt

curl -s "http://hapi-server.org/servers/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-10-30T00:00:12.000Z" > orig.txt
curl -s          "http://localhost:8999/SSCWeb/hapi/data?id=$SAT&parameters=X_TOD&time.min=1997-09-01T00:00:00.000Z&time.max=1997-10-30T00:00:12.000Z" > curr.txt
echo "6"
diff orig.txt curr.txt
