import 'ses'
import '../core/lockdown'
import './bootstrap'

import fs from 'fs-extra'
import path from 'path'
import Fastify from 'fastify'
import ws from '@fastify/websocket'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import statics from '@fastify/static'
import multipart from '@fastify/multipart'

import { createServerWorld } from '../core/createServerWorld'
import { hashFile } from '../core/utils-server'
import { getDB } from './db'
import { StorageManager } from './storage/StorageManager'
import { initCollections } from './storage/collectionsManager'

const port = process.env.PORT

// Initialize storage manager
const storageManager = new StorageManager()
await storageManager.initialize()

// init collections
const collections = await initCollections({ storageManager })

// init db
const dbPath = storageManager.getDbPath()
const db = await getDB(dbPath)

// create world
const world = createServerWorld()
world.assetsUrl = storageManager.getAssetsUrl()
world.collections.deserialize(collections)

const paths = storageManager.getPaths()
world.init({ 
  db, 
  storage: storageManager,
  assetsDir: paths?.assetsDir || null, 
  storageManager 
})

const fastify = Fastify({ logger: { level: 'error' } })

fastify.register(cors)
fastify.register(compress)
fastify.get('/', async (req, reply) => {
  const title = world.settings.title || 'World'
  const desc = world.settings.desc || ''
  const image = world.resolveURL(world.settings.image?.url) || ''
  const url = storageManager.getAssetsUrl()
  const filePath = path.join(__dirname, 'public', 'index.html')
  let html = fs.readFileSync(filePath, 'utf-8')
  html = html.replaceAll('{url}', url)
  html = html.replaceAll('{title}', title)
  html = html.replaceAll('{desc}', desc)
  html = html.replaceAll('{image}', image)
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

// Configure static file serving through StorageManager
storageManager.configureStaticServing(fastify, statics)

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

  try {
    const exists = await storageManager.fileExists(filename)
    if (!exists) {
      const contentType = file.mimetype || 'application/octet-stream'
      const url = await storageManager.uploadFile(filename, buffer, contentType)
      console.log(`File uploaded: ${filename}`)
    } else {
      console.log(`File already exists: ${filename}`)
    }
    
    return reply.code(200).send({ 
      success: true, 
      filename,
      url: storageManager.getPublicUrl(filename)
    })
  } catch (error) {
    console.error('Upload error:', error)
    return reply.code(500).send({ 
      success: false, 
      error: 'Failed to upload file' 
    })
  }
})

fastify.get('/api/upload-check', async (req, reply) => {
  const filename = req.query.filename
  
  try {
    const exists = await storageManager.fileExists(filename)
    return { exists, url: exists ? storageManager.getPublicUrl(filename) : null }
  } catch (error) {
    console.error('Upload check error:', error)
    return reply.code(500).send({ error: 'Failed to check file' })
  }
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

try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  console.error(`failed to launch on port ${port}`)
  process.exit(1)
}

async function worldNetwork(fastify) {
  fastify.get('/ws', { websocket: true }, (ws, req) => {
    world.network.onConnection(ws, req.query)
  })
}

console.log(`running on port ${port}`)

// Graceful shutdown
process.on('SIGINT', async () => {
  await fastify.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await fastify.close()
  process.exit(0)
})
