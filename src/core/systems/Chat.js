import moment from 'moment'
import { uuid } from '../utils'
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
    this.commands = {} // cmd -> Function
  }

  add(msg, broadcast) {
    if (!msg.id) msg.id = uuid()
    if (!msg.createdAt) moment().toISOString()
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
    const cmd = text.slice(1).split(' ')[0] // "/foo bar" -> "foo"
    const value = text.slice(1 + cmd.length + 1) // "/foo bar" -> "bar"
    const args = text // "/foo bar" -> ["foo", "bar"]
      .slice(1)
      .split(' ')
      .map(str => str.trim())
      .filter(str => !!str)
    const callback = this.commands[cmd]
    if (callback) {
      return callback({ playerId, cmd, value, args })
    }

    if (args[0] === 'streaks') {
      this.world.network.streaks = !this.world.network.streaks
      this.world.network.cb1.call()
      return
    }
    if (args[0] === 'm3u8') {
      this.world.network.m3u8 = args[1]
      this.world.network.cb2.call()
      return
    }
    if (args[0] === 'fly') {
      this.world.flying = !this.world.flying
      return
    }

    if (cmd !== 'admin') {
      this.world.events.emit('command', { playerId, cmd, value, args })
    }
    this.world.network.send('command', { cmd, value, args })
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

  send(text) {
    // only available as a client
    if (!this.world.network.isClient) return
    const player = this.world.entities.player
    const data = {
      id: uuid(),
      from: player.data.name,
      fromId: player.data.id,
      body: text,
      createdAt: moment().toISOString(),
    }
    this.add(data, true)
    return data
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

  bindCommand(cmd, callback) {
    this.commands[cmd] = callback
  }

  destroy() {
    this.msgs = []
    this.listeners.clear()
  }
}
