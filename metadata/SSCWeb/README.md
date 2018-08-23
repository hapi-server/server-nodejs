Creates the file `SSCWeb-info.json`, which contains an up-to-date list of satellites, ephemeris cadence, and start/stop times of available data. The format of `SSCWeb-info.json` is a combination of the `/catalog` and `/info` HAPI response described at [https://github.com/hapi-server/server-nodejs](https://github.com/hapi-server/server-nodejs). 

The file SSCWeb-parameters.txt was hand-created based on information available at [https://sscweb.sci.gsfc.nasa.gov](https://sscweb.sci.gsfc.nasa.gov) and is used by `SSCWeb-info.json`

To install and execute:

```
npm install
node SSCWeb2HAPI.js
```