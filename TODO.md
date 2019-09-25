= TODO =

0. HAPI version should be specified in input metadata. Will need to switch API based on HAPI version.
0. Response from http://hapi-server.org/servers/x is Invalid URL, see http://hapi-server.org/. This should be http://hapi-server.org/servers. Similar issue with http://hapi-server.org/servers/TestData/x - points to http://hapi-server.org/TestData/hapi. Only way to fix this is to have a configuration that lets server know what root path is (in this case "/servers")
1. Refuse to start if contact is not given (unless --force)?
2. Interface for running in Docker: https://www.totaljs.com/code/ and https://www.totaljs.com/superadmin/


TestData

1. Add parameter with a name that needs to be escaped
2. Add parameter with non-uniform cadence
3. Add parameters with non-uniform bin centers and/or gaps in bin ranges
