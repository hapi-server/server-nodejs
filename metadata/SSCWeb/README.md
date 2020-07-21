Creates the file `SSCWeb-catalog.json`, which contains an up-to-date list of satellites, ephemeris cadence, and start/stop times of available data. The format of `SSCWeb-catalog.json` is a combination of the `/catalog` and `/info` HAPI response described at [https://github.com/hapi-server/server-nodejs](https://github.com/hapi-server/server-nodejs). 

Some of the metadata in `SSCWeb-catalog.json` is from `SSCWeb-parameters.txt`, which was hand-created based on information available at [https://sscweb.sci.gsfc.nasa.gov](https://sscweb.sci.gsfc.nasa.gov).

To install and execute:

```
npm install
node SSCWeb2HAPI.js
```