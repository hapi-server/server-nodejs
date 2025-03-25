const fs = require('fs')
const http = require('http')
const WebSocket = require('ws')
const path = require('path')

// Create an HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/websockets.html') {
    fs.readFile(path.join(__dirname, 'websockets.html'), (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error\n')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(data)
    })
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found\n')
  }
})

// Create a WebSocket server
const wss = new WebSocket.Server({ server })

// Watch for changes in the file
const filePath = 'websockets.txt'
fs.watch(filePath, (eventType, filename) => {
  if (filename && eventType === 'change') {
    console.log(`${filename} file Changed`)
    // Read the updated content of the file
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      const lines = data.split('\n')

      // Send the new lines to all connected WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          const linesSent = client.linesSent || 0
          const newLines = lines.slice(linesSent)
          client.linesSent = lines.length

          if (newLines.length > 0) {
            const message = newLines.join('\n')
            client.send(message)
          }
        }
      })
    })
  }
})

wss.on('connection', (ws) => {
  console.log('Client connected')
  ws.linesSent = 0 // Initialize linesSent for the new client

  // Send the existing file content to the new client
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(err)
      return
    }
    ws.send(data)
    ws.linesSent = data.split('\n').length
  })

  ws.on('close', () => {
    console.log('Client disconnected')
  })
})

// Start the HTTP server
const PORT = 8080
server.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`)
})