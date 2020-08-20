Creates the file `SSCWeb-catalog.json`, which contains an up-to-date list of satellites, ephemeris cadence, and start/stop times of available data. The format of `SSCWeb-catalog.json` is a combination of the `/catalog` and `/info` HAPI response described at [https://github.com/hapi-server/server-nodejs](https://github.com/hapi-server/server-nodejs). 

Some of the metadata in `SSCWeb-catalog.json` is from `SSCWeb-parameters.txt`, which was hand-created based on information available at [https://sscweb.sci.gsfc.nasa.gov](https://sscweb.sci.gsfc.nasa.gov) and sample output files are located in `notes/`.

To install and execute:

```
npm install
node SSCWeb2HAPI.js
```

Note that if `npm install` was executed in the directory of `server.js`, this install command is not needed. All of the dependencies of `SSCWeb2HAPI.js` are available as a part of that install.