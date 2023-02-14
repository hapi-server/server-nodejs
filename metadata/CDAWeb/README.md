# Motivation

This code was developed to improve the HAPI metadata served at https://cdaweb.gsfc.nasa.gov/hapi by using the CDAS REST service https://cdaweb.gsfc.nasa.gov/WebServices/REST/.

# Use

Requires [`Node.js`](https://nodejs.org/en/)

Execute `make all` to 

1. Create a HAPI all.json catalog based on

   https://spdf.gsfc.nasa.gov/pub/catalogs/all.xml
   
   and queries to

   https://cdaweb.gsfc.nasa.gov/WebServices/REST/

2. Create a HAPI all.json using queries to HAPI server

   https://cdaweb.gsfc.nasa.gov/hapi

# To Do

1. Develop a method for visualizing diff of `all-cdas.json` and `all-hapi.json`.
1. Handle non-string `DEPEND_1`
1. Validate using hapi-server.org/verify