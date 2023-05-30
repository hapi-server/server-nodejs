function verifier(dev) {
  if (verifier.dev == undefined) {
    verifier.dev = dev;
  }
  console.log(verifier.dev)
  if (dev) {
    const is = require('../../verifier-nodejs/is.js');
    return {
      "verify": require('../../verifier-nodejs/tests.js').run,
      "validHAPITime": is.HAPITime,
      "validHAPIJSON": is.HAPIJSON
    }
  }
  const is = require('hapi-server-verifier').is;
  return {
    "verify": require('hapi-server-verifier').tests.run,
    "validHAPITime": is.HAPITime,
    "validHAPIJSON": is.HAPIJSON
  }
}
module.exports.verifier = verifier;
