import { createServer } from 'http'
import { Server } from 'socket.io'
import { Database } from 'bun:sqlite'
import path from 'path'

const PORT = 3001
const DB_PATH = path.resolve(process.cwd(), '..', 'db', 'custom.db')

// Read-only connection to the Next.js app's SQLite database (best-effort)
let db: Database | null = null
try {
  db = new Database(DB_PATH, { readonly: true })
  console.log(`[kantinku-ws] connected to DB at ${DB_PATH}`)
} catch (e) {
  console.warn(`[kantinku-ws] could not open DB at ${DB_PATH}:`, e instanceof Error ? e.message : e)
}

const httpServer = createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'kantinku-ws', port: PORT }))
    return
  }

  // POST /emit - broadcast an event to all connected clients
  if (req.method === 'POST' && req.url === '/emit') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { event, payload } = JSON.parse(body || '{}')
        if (event && typeof event === 'string') {
          io.emit(event, payload || {})
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, emitted: event }))
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'event required' }))
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid json' }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
})

io.on('connection', (socket) => {
  console.log(`[kantinku-ws] client connected: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`[kantinku-ws] client disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[kantinku-ws] listening on http://localhost:${PORT}`)
})

// Optional: read-only DB stats endpoint for debugging (not used by app)
httpServer.on('error', (e) => {
  console.error('[kantinku-ws] server error', e)
})

// Keep db reference (suppress unused warning)
void db
