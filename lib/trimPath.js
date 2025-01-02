const path = require('path')
module.exports = trimPath

function trimPath (fullPath, basePath) {
  if (!basePath) {
    basePath = __dirname
  }
  if (!basePath.endsWith('/')) {
    basePath = path.join(basePath, '/')
  }
  return path.normalize(fullPath).replace(basePath, '')
}
