import moment from 'moment'
import { writePacket } from '../packets'
import { Socket } from '../Socket'
import { uuid } from '../utils'
import { System } from './System'
import { createJWT, readJWT } from '../utils-server'
import { cloneDeep, isNumber } from 'lodash-es'
import * as THREE from '../extras/three'
import { Ranks } from '../extras/ranks'
import { getBillingStatus, isBillingEnabled, startUserTrial, BillingPlans, SubscriptionStatuses } from '../billing'
import {
  getProgressionStatus,
  claimMission,
  equipCosmetic,
  recordMissionActivity,
  MissionActivities,
  COSMETIC_ITEMS,
  DEFAULT_UNLOCKED_COSMETICS,
  formatHighIntensityEvent,
  parseJSONField,
  STORYLINE,
} from '../progression'
import { Emotes } from '../extras/playerEmotes'

const SAVE_INTERVAL = parseInt(process.env.SAVE_INTERVAL || '60') // seconds
const PING_RATE = 10 // seconds
const defaultSpawn = '{ "position": [0, 0, 0], "quaternion": [0, 0, 0, 1] }'

const HEALTH_MAX = 100

// Billing (trial + Architect Pro) only gates building when BILLING_ENABLED=true
const BILLING_ENABLED = isBillingEnabled()

// Mission tracking
const PLAYER_MODE_RUN = 2 // matches Modes.RUN in PlayerLocal
const PLAYER_MODE_JUMP = 3 // matches Modes.JUMP in PlayerLocal
const MAX_TRACKED_STEP = 25 // metres per update; bigger jumps are teleports/respawns and don't count
const PROGRESS_PUSH_MS = 3000 // min gap between live mission progress pushes
const APP_BUILDER_FIELDS = ['position', 'quaternion', 'scale', 'blueprint', 'mover', 'uploader', 'pinned']

function isAppReleaseOnly(data) {
  // releasing a grab/upload (mover/uploader -> null) is always allowed so apps never get stuck
  return Object.keys(data).every(key => key === 'id' || ((key === 'mover' || key === 'uploader') && data[key] === null))
}

/**
 * Server Network System
 *
 * - runs on the server
 * - provides abstract network methods matching ClientNetwork
 *
 */
export class ServerNetwork extends System {
  constructor(world) {
    super(world)
    this.id = 0
    this.ids = -1
    this.sockets = new Map()
    this.socketIntervalId = setInterval(() => this.checkSockets(), PING_RATE * 1000)
    this.saveTimerId = null
    this.dirtyBlueprints = new Set()
    this.dirtyApps = new Set()
    this.dirtyUsers = new Set()
    this.isServer = true
    this.queue = []
  }

  init({ db }) {
    this.db = db
  }

  async start() {
    // get spawn
    const spawnRow = await this.db('config').where('key', 'spawn').first()
    this.spawn = JSON.parse(spawnRow?.value || defaultSpawn)
    // hydrate blueprints
    const blueprints = await this.db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      this.world.blueprints.add(data, true)
    }
    // hydrate entities
    const entities = await this.db('entities')
    for (const entity of entities) {
      const data = JSON.parse(entity.data)
      data.state = {}
      this.world.entities.add(data, true)
    }
    // hydrate settings
    let settingsRow = await this.db('config').where('key', 'settings').first()
    try {
      const settings = JSON.parse(settingsRow?.value || '{}')
      this.world.settings.deserialize(settings)
      this.world.settings.setHasAdminCode(!!process.env.ADMIN_CODE)
    } catch (err) {
      console.error(err)
    }
    // watch settings changes
    this.world.settings.on('change', this.saveSettings)
    // queue first save
    if (SAVE_INTERVAL) {
      this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000)
    }
  }

  preFixedUpdate() {
    this.flush()
  }

  send(name, data, ignoreSocketId) {
    // console.log('->>>', name, data)
    const packet = writePacket(name, data)
    this.sockets.forEach(socket => {
      if (socket.id === ignoreSocketId) return
      socket.sendPacket(packet)
    })
  }

  sendTo(socketId, name, data) {
    const socket = this.sockets.get(socketId)
    socket?.send(name, data)
  }

  checkSockets() {
    // see: https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections
    const dead = []
    this.sockets.forEach(socket => {
      if (!socket.alive) {
        dead.push(socket)
      } else {
        socket.ping()
      }
    })
    dead.forEach(socket => socket.disconnect())
  }

  enqueue(socket, method, data) {
    this.queue.push([socket, method, data])
  }

  flush() {
    while (this.queue.length) {
      try {
        const [socket, method, data] = this.queue.shift()
        this[method]?.(socket, data)
      } catch (err) {
        console.error(err)
      }
    }
  }

  getTime() {
    return performance.now() / 1000 // seconds
  }

  save = async () => {
    const counts = {
      upsertedBlueprints: 0,
      upsertedApps: 0,
      deletedApps: 0,
    }
    const now = moment().toISOString()
    // blueprints
    for (const id of this.dirtyBlueprints) {
      const blueprint = this.world.blueprints.get(id)
      try {
        const record = {
          id: blueprint.id,
          data: JSON.stringify(blueprint),
        }
        await this.db('blueprints')
          .insert({ ...record, createdAt: now, updatedAt: now })
          .onConflict('id')
          .merge({ ...record, updatedAt: now })
        counts.upsertedBlueprints++
        this.dirtyBlueprints.delete(id)
      } catch (err) {
        console.log(`error saving blueprint: ${blueprint.id}`)
        console.error(err)
      }
    }
    // app entities
    for (const id of this.dirtyApps) {
      const entity = this.world.entities.get(id)
      if (entity) {
        // it needs creating/updating
        if (entity.data.uploader || entity.data.mover) {
          continue // ignore while uploading or moving
        }
        try {
          const data = cloneDeep(entity.data)
          data.state = null
          const record = {
            id: entity.data.id,
            data: JSON.stringify(entity.data),
          }
          await this.db('entities')
            .insert({ ...record, createdAt: now, updatedAt: now })
            .onConflict('id')
            .merge({ ...record, updatedAt: now })
          counts.upsertedApps++
          this.dirtyApps.delete(id)
        } catch (err) {
          console.log(`error saving entity: ${entity.data.id}`)
          console.error(err)
        }
      } else {
        // it was removed
        await this.db('entities').where('id', id).delete()
        counts.deletedApps++
        this.dirtyApps.delete(id)
      }
    }
    // player progression (mission progress is tracked in memory between saves)
    for (const userId of Array.from(this.dirtyUsers)) {
      const user = this.getLiveUser(userId)
      if (user) {
        await this.persistProgression(user)
      } else {
        this.dirtyUsers.delete(userId)
      }
    }
    // log
    const didSave = counts.upsertedBlueprints > 0 || counts.upsertedApps > 0 || counts.deletedApps > 0
    if (didSave) {
      console.log(
        `world saved (${counts.upsertedBlueprints} blueprints, ${counts.upsertedApps} apps, ${counts.deletedApps} apps removed)`
      )
    }
    // queue again
    this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000)
  }

  saveSettings = async () => {
    const data = this.world.settings.serialize()
    const value = JSON.stringify(data)
    await this.db('config')
      .insert({
        key: 'settings',
        value,
      })
      .onConflict('key')
      .merge({
        value,
      })
  }

  async onConnection(ws, params) {
    try {
      // check player limit
      const playerLimit = this.world.settings.playerLimit
      if (isNumber(playerLimit) && playerLimit > 0 && this.sockets.size >= playerLimit) {
        const packet = writePacket('kick', 'player_limit')
        ws.send(packet)
        ws.close()
        return
      }

      // check connection params
      let authToken = params.authToken
      let name = params.name
      let avatar = params.avatar

      // get or create user
      let user
      if (authToken) {
        try {
          const { userId } = await readJWT(authToken)
          user = await this.db('users').where('id', userId).first()
        } catch (err) {
          console.error('failed to read authToken:', authToken)
        }
      }
      if (user) {
        user.plan = user.plan || BillingPlans.FREE
        user.subscriptionStatus = user.subscriptionStatus || SubscriptionStatuses.INACTIVE
        user.xp = user.xp || 0
        user.tier = user.tier || 1
        user.unlockedCosmetics = user.unlockedCosmetics || JSON.stringify(DEFAULT_UNLOCKED_COSMETICS)
        user.missionProgress = user.missionProgress || JSON.stringify({})
      }
      if (!user) {
        user = {
          id: uuid(),
          name: 'Anonymous',
          avatar: null,
          rank: 0,
          plan: BillingPlans.FREE,
          trialStartedAt: null,
          trialEndsAt: null,
          subscriptionStatus: SubscriptionStatuses.INACTIVE,
          subscriptionPlan: null,
          xp: 0,
          tier: 1,
          unlockedCosmetics: JSON.stringify(DEFAULT_UNLOCKED_COSMETICS),
          missionProgress: JSON.stringify({}),
          storylineSeen: false,
          createdAt: moment().toISOString(),
        }
        await this.db('users').insert(user)
        authToken = await createJWT({ userId: user.id })
      }

      // disconnect if user already in this world
      if (this.sockets.has(user.id)) {
        const packet = writePacket('kick', 'duplicate_user')
        ws.send(packet)
        ws.close()
        return
      }

      // livekit options
      const livekit = await this.world.livekit.serialize(user.id)

      // create socket
      const socket = new Socket({ id: user.id, ws, network: this })
      socket.user = user

      // spawn player
      socket.player = this.world.entities.add(
        {
          id: user.id,
          type: 'player',
          position: this.spawn.position.slice(),
          quaternion: this.spawn.quaternion.slice(),
          owner: socket.id, // deprecated, same as userId
          userId: user.id, // deprecated, same as userId
          name: name || user.name,
          health: HEALTH_MAX,
          avatar: user.avatar || this.world.settings.avatar?.url || 'asset://avatar.vrm',
          sessionAvatar: avatar || null,
          rank: user.rank,
          enteredAt: Date.now(),
        },
        true
      )

      // send snapshot
      socket.send('snapshot', {
        id: socket.id,
        serverTime: performance.now(),
        assetsUrl: process.env.ASSETS_BASE_URL,
        apiUrl: process.env.PUBLIC_API_URL,
        maxUploadSize: process.env.PUBLIC_MAX_UPLOAD_SIZE,
        collections: this.world.collections.serialize(),
        settings: this.world.settings.serialize(),
        chat: this.world.chat.serialize(),
        ai: this.world.ai.serialize(),
        blueprints: this.world.blueprints.serialize(),
        entities: this.world.entities.serialize(),
        livekit,
        authToken,
        hasAdminCode: !!process.env.ADMIN_CODE,
        billing: this.billingStatus(user),
        progression: getProgressionStatus(user),
        storyline: STORYLINE,
      })

      this.sockets.set(socket.id, socket)

      // enter events on the server are sent after the snapshot.
      // on the client these are sent during PlayerRemote.js entity instantiation!
      this.world.events.emit('enter', { playerId: socket.player.data.id })
    } catch (err) {
      console.error(err)
    }
  }

  onChatAdded = async (socket, msg) => {
    if (!msg || typeof msg.body !== 'string') return
    // the server decides who a message is from (clients could otherwise impersonate others)
    msg.fromId = socket.player.data.id
    msg.from = socket.player.data.name
    this.world.chat.add(msg, false)
    this.send('chatAdded', msg, socket.id)
    if (msg.body.trim() && !msg.body.startsWith('/')) {
      this.trackActivity(socket, MissionActivities.CHAT, 1)
    }
  }

  onCommand = async (socket, data) => {
    const { args } = data
    // handle slash commands
    const player = socket.player
    const playerId = player.data.id
    const [cmd, arg1, arg2] = args
    // become admin command
    if (cmd === 'admin') {
      const code = arg1
      if (process.env.ADMIN_CODE && process.env.ADMIN_CODE === code) {
        const id = player.data.id
        const userId = player.data.userId
        const granted = !player.isAdmin()
        let rank
        if (granted) {
          rank = Ranks.ADMIN
        } else {
          rank = Ranks.VISITOR
        }
        player.modify({ rank })
        this.send('entityModified', { id, rank })
        socket.send('chatAdded', {
          id: uuid(),
          from: null,
          fromId: null,
          body: granted ? 'Admin granted!' : 'Admin revoked!',
          createdAt: moment().toISOString(),
        })
        await this.db('users').where('id', userId).update({ rank })
      }
    }
    if (cmd === 'name') {
      const name = arg1
      if (name) {
        const id = player.data.id
        const userId = player.data.userId
        player.data.name = name
        player.modify({ name })
        this.send('entityModified', { id, name })
        socket.send('chatAdded', {
          id: uuid(),
          from: null,
          fromId: null,
          body: `Name set to ${name}!`,
          createdAt: moment().toISOString(),
        })
        await this.db('users').where('id', userId).update({ name })
      }
    }
    if (cmd === 'spawn') {
      const op = arg1
      this.onSpawnModified(socket, op)
    }
    if (cmd === 'flip' || cmd === 'emote') {
      // play a short emote on the player's own client; their client reports it back (counts for missions)
      socket.send('entityModified', { id: playerId, ef: { emote: Emotes.FLIP, duration: 1.2 } })
    }
    if (cmd === 'chat') {
      const op = arg1
      if (op === 'clear' && socket.player.isBuilder()) {
        this.world.chat.clear(true)
      }
    }
    if (cmd === 'server') {
      const op = arg1
      if (op === 'stats') {
        function send(body) {
          socket.send('chatAdded', {
            id: uuid(),
            from: null,
            fromId: null,
            body,
            createdAt: moment().toISOString(),
          })
        }
        const stats = await this.world.monitor.getStats()
        send(`CPU: ${stats.currentCPU.toFixed(3)}%`)
        send(
          `Memory: ${stats.currentMemory} / ${stats.maxMemory} MB (${((stats.currentMemory / stats.maxMemory) * 100).toFixed(1)}%)`
        )
      }
    }
    // emit event for all except admin
    if (cmd !== 'admin') {
      this.world.events.emit('command', { playerId, args })
    }
  }

  onModifyRank = async (socket, data) => {
    if (!socket.player.isAdmin()) return
    const { playerId, rank } = data
    if (!playerId) return
    if (!isNumber(rank)) return
    const player = this.world.entities.get(playerId)
    if (!player || !player.isPlayer) return
    player.modify({ rank })
    this.send('entityModified', { id: playerId, rank })
    await this.db('users').where('id', playerId).update({ rank })
  }

  onKick = (socket, playerId) => {
    const player = this.world.entities.get(playerId)
    if (!player) return
    // admins can kick builders + visitors
    // builders can kick visitors
    // visitors cannot kick anyone
    if (socket.player.data.rank <= player.data.rank) return
    const tSocket = this.sockets.get(playerId)
    tSocket.send('kick', 'moderation')
    tSocket.disconnect()
  }

  onMute = (socket, data) => {
    const player = this.world.entities.get(data.playerId)
    if (!player) return
    // admins can mute builders + visitors
    // builders can mute visitors
    // visitors cannot mute anyone
    if (socket.player.data.rank <= player.data.rank) return
    this.world.livekit.setMuted(data.playerId, data.muted)
  }

  checkBuilderEntitlement = async socket => {
    if (!BILLING_ENABLED) return true // ranks alone decide who can build
    const user = socket.user
    if (!user) return false
    const billing = this.billingStatus(user)
    if (billing.canBuildAndHost) return true

    // Free user starting builder mode for the first time: automatically activate 14-day trial
    if (user.plan === BillingPlans.FREE && !user.trialStartedAt) {
      const trial = startUserTrial(user)
      Object.assign(user, trial)
      await this.db('users').where('id', user.id).update({
        plan: trial.plan,
        trialStartedAt: trial.trialStartedAt,
        trialEndsAt: trial.trialEndsAt,
      })
      socket.send('billingStatus', this.billingStatus(user))
      this.sendSystemChat(socket, '⚡ 14-Day Architect Trial activated! Builder tools unlocked.')
      return true
    }

    // Trial expired and not subscribed: reject!
    socket.send('billingBlocked', {
      action: 'builder',
      reason: 'trial_expired',
      message: 'Your Architect Trial has ended. Upgrade to Architect Pro to keep building.',
      billing,
    })
    return false
  }

  onBlueprintAdded = async (socket, blueprint) => {
    if (!socket.player.isBuilder()) {
      return console.error('player attempted to add blueprint without builder permission')
    }
    if (!(await this.checkBuilderEntitlement(socket))) return
    this.world.blueprints.add(blueprint)
    this.send('blueprintAdded', blueprint, socket.id)
    this.dirtyBlueprints.add(blueprint.id)
  }

  onBlueprintModified = async (socket, data) => {
    if (!socket.player.isBuilder()) {
      return console.error('player attempted to modify blueprint without builder permission')
    }
    if (!(await this.checkBuilderEntitlement(socket))) return
    const blueprint = this.world.blueprints.get(data.id)
    // if new version is greater than current version, allow it
    if (data.version > blueprint.version) {
      this.world.blueprints.modify(data)
      this.send('blueprintModified', data, socket.id)
      this.dirtyBlueprints.add(data.id)
    }
    // otherwise, send a revert back to client, because someone else modified before them
    else {
      socket.send('blueprintModified', blueprint)
    }
  }

  onEntityAdded = async (socket, data) => {
    if (!socket.player.isBuilder()) {
      return console.error('player attempted to add entity without builder permission')
    }
    if (!(await this.checkBuilderEntitlement(socket))) return
    const entity = this.world.entities.add(data)
    this.send('entityAdded', data, socket.id)
    if (entity.isApp) {
      this.dirtyApps.add(entity.data.id)
      this.trackBuild(socket)
    }
  }

  onEntityModified = async (socket, data) => {
    const entity = this.world.entities.get(data.id)
    if (!entity) return console.error('onEntityModified: no entity found', data)
    const isOwnPlayer = entity.isPlayer && entity.data.id === socket.player.data.id
    if (entity.isPlayer && !isOwnPlayer && !socket.player.isAdmin()) {
      return console.error('player attempted to modify another player')
    }
    const isBuilderEdit = entity.isApp && APP_BUILDER_FIELDS.some(key => data.hasOwnProperty(key))
    if (isBuilderEdit && !isAppReleaseOnly(data)) {
      if (!socket.player.isBuilder()) {
        return console.error('player attempted to modify app without builder permission')
      }
      if (!(await this.checkBuilderEntitlement(socket))) return
    }
    if (isOwnPlayer) this.trackPlayerMotion(socket, data)
    entity.modify(data)
    this.send('entityModified', data, socket.id)
    if (entity.isApp) {
      // mark for saving
      this.dirtyApps.add(entity.data.id)
      if (isBuilderEdit && (data.position || data.quaternion || data.scale)) this.trackBuild(socket)
    }
    if (entity.isPlayer) {
      // persist player name and avatar changes
      const changes = {}
      let changed
      if (data.hasOwnProperty('name')) {
        changes.name = data.name
        changed = true
      }
      if (data.hasOwnProperty('avatar')) {
        changes.avatar = data.avatar
        changed = true
      }
      if (changed) {
        await this.db('users').where('id', entity.data.userId).update(changes)
      }
    }
  }

  onEntityEvent = (socket, event) => {
    const [id, version, name, data] = event
    const entity = this.world.entities.get(id)
    entity?.onEvent(version, name, data, socket.id)
    if (entity?.isApp) {
      const now = Date.now()
      if (!socket.lastInteractAt || now - socket.lastInteractAt > 2000) {
        socket.lastInteractAt = now
        this.trackActivity(socket, MissionActivities.INTERACT, 1)
      }
    }
  }

  onEntityRemoved = async (socket, id) => {
    if (!socket.player.isBuilder()) return console.error('player attempted to remove entity without builder permission')
    if (!(await this.checkBuilderEntitlement(socket))) return
    const entity = this.world.entities.get(id)
    if (!entity) return
    this.world.entities.remove(id)
    this.send('entityRemoved', id, socket.id)
    if (entity.isApp) {
      this.dirtyApps.add(id)
      this.trackBuild(socket)
    }
  }

  onSettingsModified = async (socket, data) => {
    if (!socket.player.isBuilder())
      return console.error('player attempted to modify settings without builder permission')
    if (!(await this.checkBuilderEntitlement(socket))) return
    this.world.settings.set(data.key, data.value)
    this.send('settingsModified', data, socket.id)
  }

  onSpawnModified = async (socket, op) => {
    if (!socket.player.isBuilder()) {
      return console.error('player attempted to modify spawn without builder permission')
    }
    if (!(await this.checkBuilderEntitlement(socket))) return
    const player = socket.player
    if (op === 'set') {
      this.spawn = { position: player.data.position.slice(), quaternion: player.data.quaternion.slice() }
    } else if (op === 'clear') {
      this.spawn = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    } else {
      return
    }
    const data = JSON.stringify(this.spawn)
    await this.db('config')
      .insert({
        key: 'spawn',
        value: data,
      })
      .onConflict('key')
      .merge({
        value: data,
      })
    socket.send('chatAdded', {
      id: uuid(),
      from: null,
      fromId: null,
      body: op === 'set' ? 'Spawn updated' : 'Spawn cleared',
      createdAt: moment().toISOString(),
    })
  }

  onPlayerTeleport = (socket, data) => {
    this.sendTo(data.networkId, 'playerTeleport', data)
  }

  onPlayerPush = (socket, data) => {
    this.sendTo(data.networkId, 'playerPush', data)
  }

  onPlayerSessionAvatar = (socket, data) => {
    this.sendTo(data.networkId, 'playerSessionAvatar', data.avatar)
  }

  onAi = async (socket, action) => {
    if (!socket.player.isBuilder()) {
      return console.error('player attempted to use ai but they are not a builder')
    }
    if (!(await this.checkBuilderEntitlement(socket))) return
    this.world.ai.onAction(action)
  }

  // Pro is granted only by verified Stripe webhooks (see src/server/stripe.js).
  // The client starts checkout over HTTPS; this packet just re-syncs billing state.
  onBillingUpgrade = async socket => {
    if (!socket.user) return
    socket.send('billingStatus', this.billingStatus(socket.user))
  }

  onStartTrial = async socket => {
    const user = socket.user
    if (!user || !BILLING_ENABLED) return
    if (user.trialStartedAt) {
      socket.send('billingStatus', this.billingStatus(user))
      return
    }
    const trial = startUserTrial(user)
    Object.assign(user, trial)
    await this.db('users').where('id', user.id).update({
      plan: trial.plan,
      trialStartedAt: trial.trialStartedAt,
      trialEndsAt: trial.trialEndsAt,
    })
    socket.send('billingStatus', this.billingStatus(user))
    this.sendSystemChat(socket, '⚡ 14-Day Architect Trial activated! Builder tools unlocked.')
  }

  onClaimMission = async (socket, missionId) => {
    const user = socket.user
    if (!user) return
    const result = claimMission(user, missionId)
    if (!result.success) {
      socket.send('progressionUpdate', getProgressionStatus(user))
      return this.sendSystemChat(socket, `⚠️ ${result.reason}`)
    }
    Object.assign(user, result.updates)
    await this.persistProgression(user)
    socket.send('progressionUpdate', getProgressionStatus(user))
    this.sendSystemChat(socket, formatHighIntensityEvent('mission_claimed', { title: result.mission.title }))
    this.sendSystemChat(socket, formatHighIntensityEvent('xp_gain', { amount: result.xpAdded }))
    if (result.tieredUp) {
      this.sendSystemChat(
        socket,
        formatHighIntensityEvent('tier_up', { title: result.tierInfo.title, tier: result.tierInfo.tier })
      )
    }
    for (const id of result.newlyUnlocked) {
      const item = COSMETIC_ITEMS.find(c => c.id === id)
      if (item) this.sendSystemChat(socket, formatHighIntensityEvent('cosmetic_unlocked', { name: item.name }))
    }
    for (const mission of result.completedNow) {
      this.sendSystemChat(socket, `✨ MISSION READY: [${mission.title}] complete. Open Missions to claim it!`)
    }
  }

  onEquipCosmetic = async (socket, cosmeticId) => {
    const user = socket.user
    if (!user) return
    const result = equipCosmetic(user, cosmeticId)
    if (!result.success) return this.sendSystemChat(socket, `⚠️ ${result.reason}`)
    await this.applyEquip(user, result)
  }

  // ---- billing / progression helpers (also used by the HTTP routes) ----

  billingStatus(user) {
    return getBillingStatus(user, { enabled: BILLING_ENABLED })
  }

  getLiveUser(userId) {
    return this.sockets.get(userId)?.user || null
  }

  sendSystemChat(socket, body) {
    socket.send('chatAdded', {
      id: uuid(),
      from: null,
      fromId: null,
      body,
      createdAt: moment().toISOString(),
    })
  }

  async persistProgression(user) {
    this.dirtyUsers.delete(user.id)
    try {
      await this.db('users')
        .where('id', user.id)
        .update({
          xp: Math.max(0, Number(user.xp) || 0),
          tier: Number(user.tier) || 1,
          unlockedCosmetics: JSON.stringify(parseJSONField(user.unlockedCosmetics, DEFAULT_UNLOCKED_COSMETICS)),
          missionProgress: JSON.stringify(parseJSONField(user.missionProgress, {})),
        })
    } catch (err) {
      console.error(`error saving progression for user: ${user.id}`)
      console.error(err)
    }
  }

  async applyEquip(user, result) {
    Object.assign(user, result.updates)
    await this.db('users')
      .where('id', user.id)
      .update({ avatar: user.avatar, equippedCosmetics: JSON.stringify(user.equippedCosmetics) })
    const socket = this.sockets.get(user.id)
    if (!socket) return
    if (result.updates.avatar) {
      socket.player.modify({ avatar: result.updates.avatar })
      this.send('entityModified', { id: socket.player.data.id, avatar: result.updates.avatar })
    }
    socket.send('progressionUpdate', getProgressionStatus(user))
    this.sendSystemChat(socket, `✨ Equipped [${result.item.name}]!`)
  }

  // called after a verified Stripe webhook or a trial start over HTTP
  onUserBillingUpdated = updated => {
    const socket = this.sockets.get(updated.id)
    if (!socket?.user) return
    const wasPaid = this.billingStatus(socket.user).isPaid
    for (const key of [
      'plan',
      'subscriptionStatus',
      'subscriptionPlan',
      'trialStartedAt',
      'trialEndsAt',
      'stripeCustomerId',
      'stripeSubscriptionId',
      'currentPeriodEnd',
    ]) {
      if (updated.hasOwnProperty(key)) socket.user[key] = updated[key]
    }
    const billing = this.billingStatus(socket.user)
    socket.send('billingStatus', billing)
    if (!wasPaid && billing.isPaid) {
      this.sendSystemChat(
        socket,
        '⭐ ARCHITECT PRO ACTIVATED! Builder access unlocked. Thank you for supporting HyperCore.'
      )
    }
  }

  onUserProgressionUpdated = userId => {
    const socket = this.sockets.get(userId)
    if (socket?.user) socket.send('progressionUpdate', getProgressionStatus(socket.user))
  }

  trackBuild(socket) {
    const now = Date.now()
    if (socket.lastBuildAt && now - socket.lastBuildAt < 2000) return
    socket.lastBuildAt = now
    this.trackActivity(socket, MissionActivities.BUILD, 1)
  }

  trackPlayerMotion(socket, data) {
    const now = Date.now()
    if (!socket.motion)
      socket.motion = { lastPos: null, lastMode: null, lastJumpAt: 0, lastEmote: null, lastEmoteAt: 0, pending: 0 }
    const motion = socket.motion
    if (Array.isArray(data.p)) {
      const [x, y, z] = data.p
      if (motion.lastPos) {
        const step = Math.hypot(x - motion.lastPos[0], z - motion.lastPos[2])
        if (step > 0 && step <= MAX_TRACKED_STEP) motion.pending += step
      }
      motion.lastPos = [x, y, z]
      if (motion.pending >= 1) {
        const whole = Math.floor(motion.pending)
        motion.pending -= whole
        this.trackActivity(socket, MissionActivities.DISTANCE, whole)
      }
    }
    if (data.hasOwnProperty('m')) {
      if (data.m === PLAYER_MODE_JUMP && motion.lastMode === PLAYER_MODE_RUN && now - motion.lastJumpAt > 400) {
        motion.lastJumpAt = now
        this.trackActivity(socket, MissionActivities.SPRINT_JUMP, 1)
      }
      motion.lastMode = data.m
    }
    if (data.hasOwnProperty('e')) {
      if (data.e && data.e !== motion.lastEmote && now - motion.lastEmoteAt > 1000) {
        motion.lastEmoteAt = now
        this.trackActivity(socket, MissionActivities.EMOTE, 1)
      }
      motion.lastEmote = data.e
    }
  }

  trackActivity(socket, activity, amount = 1) {
    const user = socket.user
    if (!user || !(amount > 0)) return
    const { missionProgress, changed, completedNow } = recordMissionActivity(user.missionProgress, activity, amount)
    if (!changed) return
    user.missionProgress = missionProgress
    this.dirtyUsers.add(user.id)
    const push = () => {
      socket.progressPushTimer = null
      socket.lastProgressPush = Date.now()
      if (this.sockets.get(socket.id) === socket) socket.send('progressionUpdate', getProgressionStatus(socket.user))
    }
    if (completedNow.length) {
      for (const mission of completedNow) {
        this.sendSystemChat(socket, `✨ MISSION READY: [${mission.title}] complete. Open Missions to claim it!`)
      }
      this.persistProgression(user)
      clearTimeout(socket.progressPushTimer)
      push()
    } else if (!socket.progressPushTimer) {
      const wait = Math.max(0, PROGRESS_PUSH_MS - (Date.now() - (socket.lastProgressPush || 0)))
      socket.progressPushTimer = setTimeout(push, wait)
    }
  }

  onPing = (socket, time) => {
    socket.send('pong', time)
  }

  onDisconnect = (socket, code) => {
    clearTimeout(socket.progressPushTimer)
    if (socket.user && this.dirtyUsers.has(socket.user.id)) this.persistProgression(socket.user)
    this.world.livekit.clearModifiers(socket.id)
    socket.player.destroy(true)
    this.sockets.delete(socket.id)
  }
}
