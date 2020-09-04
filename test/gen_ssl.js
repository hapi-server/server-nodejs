//This file will generate the ssl certificates in the ssl folder.
const { exec } = require('child_process');

var gen_ssl = (function(callback) {
  //The gen.sh script generates the SSL certificates.
var yourscript = exec('sh ./ssl/gen.sh',
        (error, stdout, stderr) => {
            if (error !== null) {
                console.log(`exec error: ${error}`);
            }

callback();
        });
      })


gen_ssl(certGenerated);

 function certGenerated() {
console.log("SSL Certificates are generated succesfully");
      }
