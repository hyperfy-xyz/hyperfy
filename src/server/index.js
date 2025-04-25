import 'ses'
import '../core/lockdown'
import './bootstrap'

import fs from 'fs-extra'
import path from 'path'
import { pipeline } from 'stream/promises'
import Fastify from 'fastify'
import ws from '@fastify/websocket'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import statics from '@fastify/static'
import multipart from '@fastify/multipart'

import { loadPhysX } from './physx/loadPhysX'

import { createServerWorld } from '../core/createServerWorld'
import { hashFile } from '../core/utils-server'
import { getDB } from './db'
import { Storage } from './Storage'

// Import MCP dependencies
import { fileURLToPath } from 'url'
import { registerMCPServer } from './tools/registerMCPServer.js'
import { McpClient } from './tools/mcp-client.js'
import { readJWT } from '../core/utils-server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fastifyMCPSSE } from './tools/mcp-sse-plugin.js'

const mcpClient = new McpClient()

// Get current file's directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, process.env.WORLD)
const assetsDir = path.join(worldDir, '/assets')
const port = process.env.PORT

await fs.ensureDir(worldDir)
await fs.ensureDir(assetsDir)

// copy core assets
await fs.copy(path.join(rootDir, 'src/core/assets'), path.join(assetsDir))

const db = await getDB(path.join(worldDir, '/db.sqlite'))

const storage = new Storage(path.join(worldDir, '/storage.json'))
const world = createServerWorld()

const fastify = Fastify({ logger: { level: 'error' } })

const appServer = new McpServer({
  name: 'hyperfy-app-mcp-server',
  version: '0.0.1',
})

// Register MCP SSE plugin with our auth handler
fastify.register(fastifyMCPSSE, {
  server: appServer,
  sseEndpoint: '/apps/sse',
  messagesEndpoint: '/apps/messages',
})

world.init({ db, storage, loadPhysX, mcp: appServer })

fastify.register(cors)
fastify.register(compress)
fastify.get('/', async (req, reply) => {
  const title = world.settings.title || 'World'
  const desc = world.settings.desc || ''
  const filePath = path.join(__dirname, 'public', 'index.html')
  let html = fs.readFileSync(filePath, 'utf-8')
  html = html.replaceAll('{title}', title)
  html = html.replaceAll('{desc}', desc)
  reply.type('text/html').send(html)
})
fastify.register(statics, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
  decorateReply: false,
  setHeaders: res => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  },
})
fastify.register(statics, {
  root: assetsDir,
  prefix: '/assets/',
  decorateReply: false,
  setHeaders: res => {
    // all assets are hashed & immutable so we can use aggressive caching
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()) // older browsers
  },
})
fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
})
fastify.register(ws)
fastify.register(worldNetwork)

const publicEnvs = {}
for (const key in process.env) {
  if (key.startsWith('PUBLIC_')) {
    const value = process.env[key]
    publicEnvs[key] = value
  }
}
const envsCode = `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`
fastify.get('/env.js', async (req, reply) => {
  reply.type('application/javascript').send(envsCode)
})

fastify.post('/api/upload', async (req, reply) => {
  // console.log('DEBUG: slow uploads')
  // await new Promise(resolve => setTimeout(resolve, 2000))
  const file = await req.file()
  const ext = file.filename.split('.').pop().toLowerCase()
  // create temp buffer to store contents
  const chunks = []
  for await (const chunk of file.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  // hash from buffer
  const hash = await hashFile(buffer)
  const filename = `${hash}.${ext}`
  // save to fs
  const filePath = path.join(assetsDir, filename)
  const exists = await fs.exists(filePath)
  if (!exists) {
    await fs.writeFile(filePath, buffer)
  }
})

fastify.get('/api/upload-check', async (req, reply) => {
  const filename = req.query.filename
  const filePath = path.join(assetsDir, filename)
  const exists = await fs.exists(filePath)
  return { exists }
})

fastify.get('/health', async (request, reply) => {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }

    return reply.code(200).send(health)
  } catch (error) {
    console.error('Health check failed:', error)
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    })
  }
})

fastify.get('/status', async (request, reply) => {
  try {
    const status = {
      uptime: Math.round(world.time),
      protected: process.env.ADMIN_CODE !== undefined ? true : false,
      connectedUsers: [],
      commitHash: process.env.COMMIT_HASH,
    }
    for (const socket of world.network.sockets.values()) {
      status.connectedUsers.push({
        id: socket.player.data.userId,
        position: socket.player.position.current.toArray(),
        name: socket.player.data.name,
      })
    }

    return reply.code(200).send(status)
  } catch (error) {
    console.error('Status failed:', error)
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    })
  }
})

fastify.setErrorHandler((err, req, reply) => {
  console.error(err)
  reply.status(500).send()
})

async function worldNetwork(fastify) {
  fastify.get('/ws', { websocket: true }, (ws, req) => {
    world.network.onConnection(ws, req.query.authToken)
  })
}

if (process.env.MCP_SERVER === 'true') {
  // Create the MCP server instance
  const mcpServer = registerMCPServer(world, fastify)

  // Create an auth handler function to validate tokens and return player IDs
  const authHandler = async (authToken) => {
    try {
      const { userId } = await readJWT(authToken)
      return userId
    } catch (err) {
      console.error('Error validating auth token for MCP:', err)
      return null
    }
  }

  // Register MCP SSE plugin with our auth handler
  fastify.register(fastifyMCPSSE, {
    server: mcpServer.server,
    authHandler
  })

  // Add new SSE endpoint for streaming AI responses
  fastify.get('/mcp/stream', async (req, reply) => {
    try {
      // Get auth token from query parameter or header
      const authToken = req.query.authToken || req.headers.authorization?.replace('Bearer ', '')

      if (!authToken) {
        reply.code(401).send({ error: 'Authentication required' })
        return
      }

      // Validate token and get user
      let userId = null

      try {
        // Verify JWT token
        const { userId: tokenUserId } = await readJWT(authToken)
        userId = tokenUserId

        // Get player from world entities
        const player = world.entities.getPlayer(userId)

        if (!player) {
          reply.code(403).send({ error: 'Player not found' })
          return
        }

        // Check if user has admin permissions using ServerNetwork's isAdmin method
        if (!world.network.isAdmin(player) && !world.settings.public) {
          reply.code(403).send({ error: 'Unauthorized' })
          return
        }

      } catch (err) {
        console.error('Failed to authenticate user for MCP stream:', err)
        reply.code(401).send({ error: 'Invalid authentication token' })
        return
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      })

      const sendEvent = (event, data) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      }

      // Set up event handlers for this request - only process events for this user
      const onStart = (data) => {
        if (data.userId === userId || !data.userId) {
          sendEvent('start', data)
        }
      }

      const onStatus = (data) => {
        if (data.userId === userId || !data.userId) {
          sendEvent('status', data)
        }
      }

      const onText = (data) => {
        if (data.userId === userId || !data.userId) {
          sendEvent('text', data)
        }
      }

      const onToolStart = (data) => {
        if (data.userId === userId || !data.userId) {
          sendEvent('tool_start', data)
        }
      }

      const onToolResult = (data) => {
        if (data.userId === userId || !data.userId) {
          sendEvent('tool_result', data)
        }
      }

      const onToolError = (data) => {
        if (data.userId === userId || !data.userId) {
          sendEvent('tool_error', data)
        }
      }

      const onComplete = (data) => {
        if (data.userId === userId || !data.userId) {
          sendEvent('complete', data)
          reply.raw.end()

          // Clean up event listeners
          mcpClient.removeListener('start', onStart)
          mcpClient.removeListener('status', onStatus)
          mcpClient.removeListener('text', onText)
          mcpClient.removeListener('tool_start', onToolStart)
          mcpClient.removeListener('tool_result', onToolResult)
          mcpClient.removeListener('tool_error', onToolError)
          mcpClient.removeListener('complete', onComplete)
        }
      }

      // Register event listeners
      mcpClient.on('start', onStart)
      mcpClient.on('status', onStatus)
      mcpClient.on('text', onText)
      mcpClient.on('tool_start', onToolStart)
      mcpClient.on('tool_result', onToolResult)
      mcpClient.on('tool_error', onToolError)
      mcpClient.on('complete', onComplete)

      // Handle client disconnect
      req.raw.on('close', () => {
        mcpClient.removeListener('start', onStart)
        mcpClient.removeListener('status', onStatus)
        mcpClient.removeListener('text', onText)
        mcpClient.removeListener('tool_start', onToolStart)
        mcpClient.removeListener('tool_result', onToolResult)
        mcpClient.removeListener('tool_error', onToolError)
        mcpClient.removeListener('complete', onComplete)
      })

      // Process the query from the URL parameter
      const query = req.query.query
      if (query) {
        // Add user context to the query processing
        mcpClient.processQueryStream(query, userId).catch(error => {
          sendEvent('error', { error: error.message })
          reply.raw.end()
        })
      } else {
        sendEvent('error', { error: 'Missing query parameter' })
        reply.raw.end()
      }
    } catch (err) {
      console.error('Error in MCP stream endpoint:', err)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })
}

// Start the server
try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  console.error(`failed to launch on port ${port}`)
  process.exit(1)
}

console.log(`running on port ${port}`)

mcpClient.connectToServer('http://localhost:3000/sse')


// Graceful shutdown
process.on('SIGINT', async () => {
  await fastify.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await fastify.close()
  process.exit(0)
})
