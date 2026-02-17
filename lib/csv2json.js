// TODO: Integrate into csvTo.js
const { parse } = require('csv-parse/sync')

csv2jsonTest()

function csv2json (csv, size, type) {
  const lines = csv.trim().split('\n')
  const result = []

  // Track if size was not provided (for scalar values)
  const isScalar = !size || size.length === 0

  if (!size) {
    size = []
  } else {
    // Copy size array
    size = [...size]
  }

  // Calculate expected column count: product of size elements + 1 for timestamp
  const expectedColumns = (size.length === 0 ? 1 : size.reduce((a, b) => a * b, 1)) + 1

  for (const line of lines) {
    if (!line.trim()) continue

    // Parse CSV line (split by comma and trim each part)
    const parts = parse(line, { trim: true, relax_column_count: true })[0]

    // Check column count
    if (parts.length !== expectedColumns) {
      throw new Error(`Expected ${expectedColumns} columns but found ${parts.length} in line: ${line}`)
    }

    // First element is timestamp (no need to remove quotes, csv-parse does it)
    const timestamp = parts[0]

    // Remaining elements are numeric values
    let values
    if (type === 'double') {
      values = parts.slice(1).map(v => parseFloat(v))
    } else if (type === 'integer') {
      values = parts.slice(1).map(v => parseInt(v))
    } else if (type === 'string' || type === 'isotime') {
      values = parts.slice(1)
    } else {
      throw new Error(`Unsupported type: ${type}`)
    }

    // For scalar values, return the single value directly, not in an array
    let shaped
    if (isScalar) {
      shaped = values[0]
    } else {
      // Reshape values according to size array
      shaped = reshapeArray(values, size)
    }

    result.push([timestamp, shaped])
  }

  return result
}

function reshapeArray (values, size) {
  // Single dimension or empty size
  if (size.length === 0) {
    return values
  }

  if (size.length === 1) {
    return values.slice(0, size[0])
  }

  // Calculate the size of each chunk for the first dimension
  const chunkSize = size.slice(1).reduce((a, b) => a * b, 1)

  const result = []
  for (let i = 0; i < size[0]; i++) {
    const start = i * chunkSize
    const chunk = values.slice(start, start + chunkSize)
    result.push(reshapeArray(chunk, size.slice(1)))
  }

  return result
}

function csv2jsonTest () {
  const fs = require('fs')
  const logFile = 'csv2json.tests.log'
  const logStream = fs.createWriteStream(logFile, { flags: 'w' })
  process.on('exit', () => logStream.end())

  function test (i, testElement, result) {
    const size = testElement.size
    const csv = testElement.csv
    const type = testElement.type
    const reference = testElement.expected
    const error = testElement.error

    let pass
    if (error) {
      pass = result instanceof Error
      if (pass) {
        result = 'Error, which was expected'
      } else {
        result = 'No error, but expected error'
      }
    } else {
      if (result instanceof Error) {
        pass = false
        result = `Error: ${result.message}`
      } else {
        pass = JSON.stringify(reference) === JSON.stringify(result)
      }
    }

    const status = pass ? `${i}. PASS` : `${i}. FAIL`
    const output = [
      status,
      '  Size: ' + JSON.stringify(size),
      '  Type: ' + type,
      '  CSV:\n             ' + csv.replace(/\n/g, '\n             '),
      '  Reference: ' + JSON.stringify(reference),
      '  Result:    ' + JSON.stringify(result)
    ].join('\n')

    console.log(output)
    logStream.write(output + '\n')

    return pass
  }

  const testArray = require('./csv2json.tests.json')

  let nPass = 0
  let i = 1
  for (const testElement of testArray) {
    let result
    try {
      result = csv2json(testElement.csv, testElement.size, testElement.type)
    } catch (err) {
      result = err
    }
    nPass += test(i, testElement, result) ? 1 : 0
    i++
  }

  if (nPass === testArray.length) {
    console.log('\nAll tests passed.')
  } else {
    console.log(`\n${nPass} out of ${testArray.length} tests passed.`)
  }
}
