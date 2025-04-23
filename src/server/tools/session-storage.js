// import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { EventEmitter } from 'node:events'

// type SessionEvents = {
//   connected: [string];
//   terminated: [string];
//   error: [unknown];
// };

export class Sessions extends EventEmitter {
  // private readonly sessions: Map<string, SSEServerTransport>;
  // private readonly playerSessions: Map<string, Set<string>>;

  constructor() {
    super({ captureRejections: true })
    this.sessions = new Map()
    // Map of player IDs to session IDs
    this.playerSessions = new Map()
  }

  add = (id, transport, playerId = null) => {
    if (this.sessions.has(id)) {
      throw new Error('Session already exists')
    }

    this.sessions.set(id, transport)
    
    // If a player ID is provided, associate this session with the player
    if (playerId) {
      if (!this.playerSessions.has(playerId)) {
        this.playerSessions.set(playerId, new Set())
      }
      this.playerSessions.get(playerId).add(id)
    }
    
    this.emit('connected', id, playerId)
  }

  remove = id => {
    // Find and remove any player associations
    for (const [playerId, sessionIds] of this.playerSessions.entries()) {
      if (sessionIds.has(id)) {
        sessionIds.delete(id)
        // Clean up empty player entries
        if (sessionIds.size === 0) {
          this.playerSessions.delete(playerId)
        }
        break
      }
    }
    
    this.sessions.delete(id)
    this.emit('terminated', id)
  }

  get = id => {
    return this.sessions.get(id)
  }
  
  // Get all sessions for a specific player
  getByPlayer = playerId => {
    if (!playerId || !this.playerSessions.has(playerId)) {
      return []
    }
    
    return Array.from(this.playerSessions.get(playerId))
      .map(sessionId => this.sessions.get(sessionId))
      .filter(Boolean)
  }
  
  // Associate an existing session with a player
  associateWithPlayer = (sessionId, playerId) => {
    if (!this.sessions.has(sessionId)) {
      return false
    }
    
    if (!this.playerSessions.has(playerId)) {
      this.playerSessions.set(playerId, new Set())
    }
    
    this.playerSessions.get(playerId).add(sessionId)
    return true
  }

  get count() {
    return this.sessions.size
  }
  
  get playerCount() {
    return this.playerSessions.size
  }

  [Symbol.iterator]() {
    return this.sessions.values()
  }
}
