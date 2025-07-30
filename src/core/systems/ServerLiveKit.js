import { AccessToken, TrackSource } from 'livekit-server-sdk'

import { System } from './System'
import { uuid } from '../utils'

const levels = ['disabled', 'spatial', 'global']
const levelPriorities = {
  disabled: 1,
  spatial: 2,
  global: 3,
}

export class ServerLiveKit extends System {
  constructor(world) {
    super(world)
    this.roomId = uuid()
    this.wsUrl = process.env.LIVEKIT_WS_URL
    this.apiKey = process.env.LIVEKIT_API_KEY
    this.apiSecret = process.env.LIVEKIT_API_SECRET
    this.enabled = this.wsUrl && this.apiKey && this.apiSecret
    this.modifiers = {} // [playerId] => Set({ level })
    this.levels = {} // [playerId] => level (disabled, spatial, global)
    this.muted = new Set()
  }

  async serialize(playerId) {
    if (!this.enabled) return null
    const data = {}
    data.wsUrl = this.wsUrl
    data.levels = this.levels
    data.muted = this.muted
    // generate voice access token for the player
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: playerId,
    })
    const videoGrant = {
      room: this.roomId,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
      canUpdateOwnMetadata: true,
    }
    at.addGrant(videoGrant)
    data.token = await at.toJwt()
    return data
  }

  setMuted(playerId, muted) {
    if (muted && !this.muted.has(playerId)) {
      this.muted.add(playerId)
      this.world.network.send('mute', { playerId, muted })
      return
    }
    if (!muted && this.muted.has(playerId)) {
      this.muted.delete(playerId)
      this.world.network.send('mute', { playerId, muted })
      return
    }
  }

  addModifier(playerId, level) {
    if (!levels.includes(level)) return console.error(`[livekit] invalid level: ${level}`)
    let modifiers = this.modifiers[playerId]
    if (!modifiers) {
      modifiers = new Set()
      this.modifiers[playerId] = modifiers
    }
    const mod = { playerId, level }
    modifiers.add(mod)
    this.checkLevel(playerId)
    return mod
  }

  updateModifier(mod, level) {
    if (!levels.includes(level)) return console.error(`[livekit] invalid level: ${level}`)
    const playerId = mod.playerId
    const modifiers = this.modifiers[playerId]
    if (!modifiers) return
    if (!modifiers.has(mod)) return console.error('updateModifier: mod not found')
    mod.level = level
    this.checkLevel(playerId)
    return mod
  }

  removeModifier(mod) {
    const playerId = mod.playerId
    const modifiers = this.modifiers[playerId]
    if (!modifiers) return
    modifiers.delete(mod)
    this.checkLevel(playerId)
    return null
  }

  clearModifiers(playerId) {
    delete this.modifiers[playerId]
    this.checkLevel(playerId)
  }

  checkLevel(playerId) {
    const modifiers = this.modifiers[playerId]
    let level = null
    if (modifiers) {
      for (const mod of modifiers) {
        const currPriority = levelPriorities[level] || 0
        const modPriority = levelPriorities[mod.level]
        if (modPriority > currPriority) {
          level = mod.level
        }
      }
    }
    if (this.levels[playerId] === level) {
      return // no change
    }
    this.levels[playerId] = level
    this.world.network.send('liveKitLevel', { playerId, level })
  }
}
