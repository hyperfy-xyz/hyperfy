import moment from 'moment'
import type { World } from '../../types'
import { emoteUrls } from '../extras/playerEmotes'
import { readPacket, writePacket } from '../packets'
import { storage } from '../storage'
import { uuid } from '../utils'
import { hashFile } from '../utils-client'
import { System } from './System'

/**
 * Client Network System
 *
 * - runs on the client
 * - provides abstract network methods matching ServerNetwork
 *
 */
export class ClientNetwork extends System {
  ids: number
  ws: WebSocket | null
  apiUrl: string | null
  id: string | null
  isClient: boolean
  queue: Array<[string, any]>
  serverTimeOffset: number
  maxUploadSize: number
  
  constructor(world: World) {
    super(world)
    this.ids = -1
    this.ws = null
    this.apiUrl = null
    this.id = null
    this.isClient = true
    this.queue = []
    this.serverTimeOffset = 0
    this.maxUploadSize = 0
  }

  async init(options: any): Promise<void> {
    const { wsUrl, name, avatar } = options
    const authToken = storage?.get('authToken') || ''
    let url = `${wsUrl}?authToken=${authToken}`
    if (name) url += `&name=${encodeURIComponent(name)}`
    if (avatar) url += `&avatar=${encodeURIComponent(avatar)}`
    this.ws = new WebSocket(url)
    this.ws.binaryType = 'arraybuffer'
    this.ws.addEventListener('message', this.onPacket)
    this.ws.addEventListener('close', this.onClose)
  }

  preFixedUpdate() {
    this.flush()
  }

  send(name: string, data?: any) {
    // console.log('->', name, data)
    const packet = writePacket(name, data)
    this.ws?.send(packet)
  }

  async upload(file: File) {
    {
      // first check if we even need to upload it
      const hash = await hashFile(file)
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const filename = `${hash}.${ext}`
      const url = `${this.apiUrl}/upload-check?filename=${filename}`
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.exists) return // console.log('already uploaded:', filename)
    }
    // then upload it
    const form = new FormData()
    form.append('file', file)
    const url = `${this.apiUrl}/upload`
    await fetch(url, {
      method: 'POST',
      body: form,
    })
  }

  enqueue(method: string, data: any) {
    this.queue.push([method, data])
  }

  flush() {
    while (this.queue.length) {
      try {
        const [method, data] = this.queue.shift()!
        ;(this as any)[method]?.(data)
      } catch (err) {
        console.error(err)
      }
    }
  }

  getTime() {
    return (performance.now() + this.serverTimeOffset) / 1000 // seconds
  }

  onPacket = (e: MessageEvent) => {
    const result = readPacket(e.data)
    if (result && result[0]) {
      const [method, data] = result
      this.enqueue(method, data)
    }
    // console.log('<-', method, data)
  }

  onSnapshot(data: any) {
    this.id = data.id
    this.serverTimeOffset = data.serverTime - performance.now()
    this.apiUrl = data.apiUrl
    this.maxUploadSize = data.maxUploadSize
    this.world.assetsUrl = data.assetsUrl

    const loader = this.world.loader
    if (loader && typeof loader.preload === 'function' && typeof loader.execPreload === 'function') {
      // preload environment model and avatar
      if (data.settings.model) {
        loader.preload('model', data.settings.model.url)
      } else if ((this.world as any).environment?.base) {
        loader.preload('model', (this.world as any).environment.base.model)
      }
      if (data.settings.avatar) {
        loader.preload('avatar', data.settings.avatar.url)
      }
      // preload some blueprints
      for (const item of data.blueprints) {
        if (item.preload) {
          if (item.model) {
            const type = item.model.endsWith('.vrm') ? 'avatar' : 'model'
            loader.preload(type, item.model)
          }
          if (item.script) {
            loader.preload('script', item.script)
          }
          for (const value of Object.values(item.props || {})) {
            if (value === undefined || value === null || !(value as any)?.url || !(value as any)?.type) continue
            loader.preload((value as any).type, (value as any).url)
          }
        }
      }
      // preload emotes
      for (const url of emoteUrls) {
        loader.preload('emote', url as string)
      }
      // preload local player avatar
      for (const item of data.entities) {
        if (item.type === 'player' && item.owner === this.id) {
          const url = item.sessionAvatar || item.avatar
          loader.preload('avatar', url)
        }
      }
      loader.execPreload()
    }

    ;(this.world.collections as any).deserialize(data.collections)
    ;(this.world.settings as any).deserialize(data.settings)
    ;(this.world.chat as any).deserialize(data.chat)
    ;(this.world.blueprints as any).deserialize(data.blueprints)
    ;(this.world.entities as any).deserialize(data.entities)
    ;(this.world as any).livekit?.deserialize(data.livekit)
    storage?.set('authToken', data.authToken)
  }

  onSettingsModified = (data: any) => {
    this.world.settings.set(data.key, data.value)
  }

  onChatAdded = (msg: any) => {
    ;(this.world.chat as any).add(msg, false)
  }

  onChatCleared = () => {
    ;(this.world.chat as any).clear()
  }

  onBlueprintAdded = (blueprint: any) => {
    ;(this.world.blueprints as any).add(blueprint)
  }

  onBlueprintModified = (change: any) => {
    ;(this.world.blueprints as any).modify(change)
  }

  onEntityAdded = (data: any) => {
    ;(this.world.entities as any).add(data)
  }

  onEntityModified = (data: any) => {
    const entity = this.world.entities.get(data.id)
    if (!entity) return console.error('onEntityModified: no entity found', data)
    ;(entity as any).modify(data)
  }

  onEntityEvent = (event: any) => {
    const [id, version, name, data] = event
    const entity = this.world.entities.get(id)
    ;(entity as any)?.onEvent(version, name, data)
  }

  onEntityRemoved = (id: string) => {
    ;(this.world.entities as any).remove(id)
  }

  onPlayerTeleport = (data: any) => {
    ;(this.world.entities as any).player?.teleport(data)
  }

  onPlayerPush = (data: any) => {
    ;(this.world.entities as any).player?.push(data.force)
  }

  onPlayerSessionAvatar = (data: any) => {
    ;(this.world.entities as any).player?.setSessionAvatar(data.avatar)
  }

  onPong = (time: number) => {
    ;(this.world as any).stats?.onPong(time)
  }

  onKick = (code: string) => {
    this.world.emit?.('kick', code)
  }

  onClose = (code: CloseEvent) => {
    ;(this.world.chat as any).add({
      id: uuid(),
      from: null,
      fromId: null,
      body: `You have been disconnected.`,
      createdAt: moment().toISOString(),
    })
    this.world.emit?.('disconnect', code || true)
    console.log('disconnect', code)
  }

  destroy() {
    if (this.ws) {
      this.ws.removeEventListener('message', this.onPacket)
      this.ws.removeEventListener('close', this.onClose)
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
  }
}
