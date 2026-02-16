// TODO: Integrate into csvTo.js
const { parse } = require('csv-parse/sync')

tests()

function csv2json (size, csv, type) {
  const lines = csv.trim().split('\n')
  const result = []

  if (!size) {
    size = [1]
  }

  // Copy size array
  size = [...size]

  // Remove trailing 1s from size
  while (size.length > 0 && size[size.length - 1] === 1) {
    size.pop()
  }
  if (size.length === 0) {
    size = [1]
  }

  // Calculate expected column count: product of size elements + 1 for timestamp
  const expectedColumns = size.reduce((a, b) => a * b, 1) + 1

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

    // Reshape values according to size array
    const shaped = reshapeArray(values, size)

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

function tests () {
  function test (size, csv, type, reference, result) {
    const pass = JSON.stringify(reference) === JSON.stringify(result)
    console.log(pass ? 'PASS' : 'FAIL')
    console.log('  Size:', size)
    console.log('  Type:', type)
    console.log('  CSV:\n             ' + csv.replace(/\n/g, '\n             '))
    console.log('  Reference:', JSON.stringify(reference))
    console.log('  Result:   ', JSON.stringify(result))
    return pass
  }

  const testArray = [
    {
      size: undefined,
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0',
      expected: [['2017-11-13T12:34:56.789Z', [0.0]]]
    },
    {
      size: null,
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0',
      expected: [['2017-11-13T12:34:56.789Z', [0.0]]]
    },
    {
      size: [1],
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0',
      expected: [['2017-11-13T12:34:56.789Z', [0.0]]]
    },
    {
      size: [1],
      type: 'double',
      csv: '2017-11-13T12:34:56.789Z, 0.0',
      expected: [['2017-11-13T12:34:56.789Z', [0.0]]]
    },
    {
      size: [1],
      type: 'string',
      csv: '"2017-11-13T12:34:56.789Z", A',
      expected: [['2017-11-13T12:34:56.789Z', ['A']]]
    },
    {
      size: [1],
      type: 'string',
      csv: '"2017-11-13T12:34:56.789Z", 2017-11-13T12:34:56.789Z',
      expected: [['2017-11-13T12:34:56.789Z', ['2017-11-13T12:34:56.789Z']]]
    },
    {
      size: [1, 1],
      type: 'string',
      csv: '"2017-11-13T12:34:56.789Z", 2017-11-13T12:34:56.789Z',
      expected: [['2017-11-13T12:34:56.789Z', ['2017-11-13T12:34:56.789Z']]]
    },
    {
      size: [2],
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0, 1.0',
      expected: [['2017-11-13T12:34:56.789Z', [0.0, 1.0]]]
    },
    {
      size: [2, 1],
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0, 1.0',
      expected: [['2017-11-13T12:34:56.789Z', [0.0, 1.0]]]
    },
    {
      size: [2, 1, 1],
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0, 1.0',
      expected: [['2017-11-13T12:34:56.789Z', [0.0, 1.0]]]
    },
    {
      size: [1, 2],
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0, 1.0',
      expected: [['2017-11-13T12:34:56.789Z', [[0.0, 1.0]]]]
    },
    {
      size: [2, 5],
      type: 'double',
      csv: '"2017-11-13T12:34:56.789Z", 0.0, 1.1, 2.2, 3.3, 4.4, 5.0, 6.0, 7.0, 8.0, 9.0\n"2017-11-13T12:34:56.789Z", 0.0, 1.11, 2.22, 3.33, 4.44, 5.01, 6.01, 7.01, 8.01, 9.01',
      expected: [
        ['2017-11-13T12:34:56.789Z', [[0.0, 1.1, 2.2, 3.3, 4.4], [5.0, 6.0, 7.0, 8.0, 9.0]]],
        ['2017-11-13T12:34:56.789Z', [[0.0, 1.11, 2.22, 3.33, 4.44], [5.01, 6.01, 7.01, 8.01, 9.01]]]
      ]
    }
  ]

  let pass = true
  for (const { size, csv, type, expected } of testArray) {
    const result = csv2json(size, csv, type)
    pass = pass && test(size, csv, type, expected, result)
  }
  if (pass) {
    console.log('\nAll tests passed.')
  } else {
    console.log('\nSome tests failed.')
  }
}
