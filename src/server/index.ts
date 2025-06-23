import 'ses'
import '../core/lockdown'
import './bootstrap'

import dotenv from 'dotenv'

dotenv.config()
import fs from 'fs-extra'
import path from 'path'
import { pipeline } from 'stream/promises'
import Fastify from 'fastify'
import ws from '@fastify/websocket'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import statics from '@fastify/static'
import multipart from '@fastify/multipart'

import { createServerWorld } from '../core/createServerWorld'
import { createRPGServerWorld } from '../core/createRPGServerWorld'
import { hashFile } from '../core/utils-server'
import { getDB } from './db'
import { Storage } from './Storage'
import { initCollections } from './collections'

const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, process.env['WORLD'] as string)
const assetsDir = path.join(worldDir, '/assets')
const collectionsDir = path.join(worldDir, '/collections')
const port = parseInt(process.env['PORT'] as string, 10)

// create world folders if needed
await fs.ensureDir(worldDir)
await fs.ensureDir(assetsDir)
await fs.ensureDir(collectionsDir)

// copy over built-in assets and collections
await fs.copy(path.join(rootDir, 'src/world/assets'), path.join(assetsDir))
await fs.copy(path.join(rootDir, 'src/world/collections'), path.join(collectionsDir))

// init collections
const collections = await initCollections({ collectionsDir, assetsDir })

// init db
const db = await getDB(path.join(worldDir, '/db.sqlite'))

// init storage
const storage = new Storage(path.join(worldDir, '/storage.json'))

// create world - use RPG world if configured
const enableRPG = process.env['ENABLE_RPG'] === 'true'
const world = enableRPG ? createRPGServerWorld() : createServerWorld()
if (enableRPG) {
  console.log('RPG systems enabled')
}
  world.assetsUrl = process.env['PUBLIC_ASSETS_URL'] || '/assets/'
  
  // Ensure assetsUrl ends with slash for proper URL resolution
  if (!world.assetsUrl.endsWith('/')) {
    world.assetsUrl += '/'
  }
  
// Set up default environment if no settings exist
if (!(world.settings as any).model) {
  // Set default environment model in settings for ServerEnvironment system
  ;(world.settings as any).model = {
    url: 'asset://base-environment.glb'
  }
}

// Also configure for client preloading
if (!(world as any).environment?.base) {
  (world as any).environment = {
    base: {
      model: 'asset://base-environment.glb'
    }
  }
}

;(world.collections as any).deserialize(collections)
;(world as any).init({ db, storage, assetsDir })

const fastify = Fastify({ logger: { level: 'error' } })

fastify.register(cors)
fastify.register(compress)
fastify.get('/', async (_req: any, reply: any) => {
  const title = (world.settings as any).title || 'World'
  const desc = (world.settings as any).desc || ''
  const image = world.resolveURL((world.settings as any).image?.url) || ''
  const url = process.env['PUBLIC_ASSETS_URL']
  const filePath = path.join(__dirname, 'public', 'index.html')
  let html = fs.readFileSync(filePath, 'utf-8')
  html = html.replace(/\{url\}/g, url || '')
  html = html.replace(/\{title\}/g, title)
  html = html.replace(/\{desc\}/g, desc)
  html = html.replace(/\{image\}/g, image)
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

const publicEnvs: Record<string, string> = {}
for (const key in process.env) {
  if (key.startsWith('PUBLIC_')) {
    const value = process.env[key]
    if (value) {
      publicEnvs[key] = value
    }
  }
}
const envsCode = `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`
fastify.get('/env.js', async (_req, reply) => {
  reply.type('application/javascript').send(envsCode)
})

fastify.post('/api/upload', async (req, _reply) => {
  // console.log('DEBUG: slow uploads')
  // await new Promise(resolve => setTimeout(resolve, 2000))
  const file = await req.file()
  if (!file) {
    throw new Error('No file uploaded')
  }
  const ext = file.filename.split('.').pop()?.toLowerCase()
  if (!ext) {
    throw new Error('Invalid filename')
  }
  // create temp buffer to store contents
  const chunks: Buffer[] = []
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

fastify.get('/api/upload-check', async (req: any, _reply) => {
  const filename = req.query.filename as string
  const filePath = path.join(assetsDir, filename)
  const exists = await fs.exists(filePath)
  return { exists }
})

fastify.get('/health', async (_request, reply) => {
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

fastify.get('/status', async (_request, reply) => {
  try {
    const status = {
      uptime: Math.round(world.time),
      protected: process.env['ADMIN_CODE'] !== undefined ? true : false,
      connectedUsers: [] as Array<{
        id: any;
        position: any;
        name: any;
      }>,
      commitHash: process.env['COMMIT_HASH'],
    }
    for (const socket of (world as any).network.sockets.values()) {
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

fastify.setErrorHandler((err, _req, reply) => {
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

async function worldNetwork(fastify: any) {
  fastify.get('/ws', { websocket: true }, (ws: any, req: any) => {
    ;(world as any).network.onConnection(ws, req.query)
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
