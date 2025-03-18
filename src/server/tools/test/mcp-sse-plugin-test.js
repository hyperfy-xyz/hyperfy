// import { Server } from '@modelcontextprotocol/sdk/server/index.js'
// import fastify from 'fastify'
// import { randomUUID } from 'node:crypto'
// import { Readable } from 'node:stream'
// import { setImmediate } from 'node:timers/promises'
// import { fastifyMCPSSE } from './mcp-sse-plugin'
// import { Sessions } from './session-storage'

// describe(fastifyMCPSSE.name, () => {
//   it('should handle SSE connections successfully', async () => {
//     const app = fastify()
//     const mcpServer = new Server({
//       name: 'test',
//       version: '1.0.0',
//     })

//     app.register(fastifyMCPSSE, {
//       server: mcpServer,
//     })

//     const response = await app.inject({
//       method: 'GET',
//       url: '/sse',
//       payloadAsStream: true,
//     })

//     expect(response.statusCode).toBe(200)
//     expect(response.headers['content-type']).toBe('text/event-stream')
//     expect(response.headers['cache-control']).toBe('no-cache')
//     expect(response.headers['connection']).toBe('keep-alive')

//     const lines = response.stream().read().toString('utf-8').split('\n')
//     expect(lines.length).toBe(4)
//     expect(lines[0]).toEqual('event: endpoint')
//     expect(lines[1]).toMatch(/data: \/messages\?sessionId=.+$/)
//     expect(lines[2]).toEqual('')
//     expect(lines[3]).toEqual('')
//   })

//   it('should handle messages successfully', async () => {
//     const app = fastify({})
//     const mcpServer = new Server({
//       name: 'test',
//       version: '1.0.0',
//     })

//     app.register(fastifyMCPSSE, {
//       server: mcpServer,
//     })

//     const { stream } = await app.inject({
//       method: 'GET',
//       url: '/sse',
//       payloadAsStream: true,
//     })

//     const lines = await readLines(stream())
//     expect(lines[0]).toEqual('event: endpoint')
//     expect(lines[1]).toMatch(/data: \/messages\?sessionId=.+$/)

//     const sessionId = lines[1].split('=')[1]
//     expect(sessionId).toBeDefined()

//     const res = await app.inject({
//       method: 'POST',
//       url: '/messages',
//       headers: { 'content-type': 'application/json' },
//       query: { sessionId },
//       body: JSON.stringify({
//         jsonrpc: '2.0',
//         id: randomUUID(),
//         method: 'ping',
//       }),
//     })

//     expect(res.statusCode).toBe(202)
//     expect(res.body).toBe('Accepted')
//   })

//   it('should remove sessions when the connection is closed', async () => {
//     const app = fastify({})
//     const mcpServer = new Server({
//       name: 'test',
//       version: '1.0.0',
//     })

//     const sessions = new Sessions()
//     app.register(fastifyMCPSSE, {
//       server: mcpServer,
//       sessions,
//     })

//     expect(sessions.count).toBe(0)

//     const {
//       raw: { res },
//     } = await app.inject({
//       method: 'GET',
//       url: '/sse',
//       payloadAsStream: true,
//     })

//     expect(sessions.count).toBe(1)

//     res.end()

//     await setImmediate()

//     expect(sessions.count).toBe(0)
//   })
// })

// async function readLines(stream) {
//   const [chunk] = await stream.take(1).toArray()
//   return chunk.toString('utf-8').split('\n')
// }
