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
    const isCmd = msg.body.startsWith('/')
    if (!isCmd) {
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
    }
    if (broadcast) {
      this.world.network.send('chatAdded', msg)
    }
    const readOnly = Object.freeze({ ...msg })
    this.world.events.emit('chat', readOnly)
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
