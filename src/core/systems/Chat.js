import { System } from './System'

/**
 * Chat System
 *
 * - Runs on both the server and client.
 * - Stores and handles chat messages
 * - Provides subscribe hooks for client UI
 *
 */

const CHAT_MAX_MESSAGES = 50

export class Chat extends System {
  constructor(world) {
    super(world)
    this.msgs = []
    this.listeners = new Set()
  }

  add(msg, broadcast) {
    // add to chat messages
    this.msgs = [...this.msgs, msg]
    if (this.msgs.length > CHAT_MAX_MESSAGES) {
      this.msgs.shift()
    }
    for (const callback of this.listeners) {
      callback(this.msgs)
    }
    if (msg.fromId) {
      const player = this.world.entities.getPlayer(msg.fromId)
      player?.chat(msg.body)
    }
    // emit chat event
    const readOnly = Object.freeze({ ...msg })
    this.world.events.emit('chat', readOnly)
    // maybe broadcast
    if (broadcast) {
      this.world.network.send('chatAdded', msg)
    }
  }

  command(text) {
    if (this.world.network.isServer) return
    const playerId = this.world.network.id
    const args = text
      .slice(1)
      .split(' ')
      .map(str => str.trim())
      .filter(str => !!str)
    const isAdminCommand = args[0] === 'admin'
    if (args[0] === 'stats') {
      this.world.prefs.setStats(!this.world.prefs.stats)
    }
    if (!isAdminCommand) {
      this.world.events.emit('command', { playerId, args })
    }
    this.world.network.send('command', args)
  }

  clear(broadcast) {
    this.msgs = []
    for (const callback of this.listeners) {
      callback(this.msgs)
    }
    if (broadcast) {
      this.world.network.send('chatCleared')
    }
  }

  serialize() {
    return this.msgs
  }

  deserialize(msgs) {
    this.msgs = msgs
    for (const callback of this.listeners) {
      callback(msgs)
    }
  }

  subscribe(callback) {
    this.listeners.add(callback)
    callback(this.msgs)
    return () => {
      this.listeners.delete(callback)
    }
  }
}
