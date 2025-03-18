// import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { EventEmitter } from 'node:events'

// type SessionEvents = {
//   connected: [string];
//   terminated: [string];
//   error: [unknown];
// };

export class Sessions extends EventEmitter {
  // private readonly sessions: Map<string, SSEServerTransport>;

  constructor() {
    super({ captureRejections: true })
    this.sessions = new Map()
  }

  add = (id, transport) => {
    if (this.sessions.has(id)) {
      throw new Error('Session already exists')
    }

    this.sessions.set(id, transport)
    this.emit('connected', id)
  }

  remove = id => {
    this.sessions.delete(id)
    this.emit('terminated', id)
  }

  get = id => {
    return this.sessions.get(id)
  }

  get count() {
    return this.sessions.size
  }
}
