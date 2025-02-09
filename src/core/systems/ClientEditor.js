import * as THREE from '../extras/three'

import { System } from './System'

import { hashFile } from '../utils-client'
import { hasRole, uuid } from '../utils'
import { ControlPriorities } from '../extras/ControlPriorities'
import { CopyIcon, EyeIcon, HandIcon, Trash2Icon, UnlinkIcon } from 'lucide-react'
import { cloneDeep } from 'lodash-es'
import moment from 'moment'
import { importApp } from '../extras/appTools'

contextBreakers = ['MouseLeft', 'Escape']

const MAX_UPLOAD_SIZE = parseInt(process.env.PUBLIC_MAX_UPLOAD_SIZE || '100')

/**
 * Editor System
 *
 * - runs on the client
 * - listens for files being drag and dropped onto the window and handles them
 * - handles editing apps
 *
 */
export class ClientEditor extends System {
  constructor(world) {
    super(world)
    this.target = null
    this.file = null
    this.contextTracker = {
      downAt: null,
      movement: new THREE.Vector3(),
    }
  }

  async init({ viewport }) {
    viewport.addEventListener('dragover', this.onDragOver)
    viewport.addEventListener('dragenter', this.onDragEnter)
    viewport.addEventListener('dragleave', this.onDragLeave)
    viewport.addEventListener('drop', this.onDrop)
  }

  start() {
    this.control = this.world.controls.bind({
      priority: ControlPriorities.EDITOR,
      onPress: code => {
        if (code === 'MouseRight') {
          this.contextTracker.downAt = performance.now()
          this.contextTracker.movement.set(0, 0, 0)
        }
      },
      onRelease: code => {
        if (code === 'MouseRight') {
          const elapsed = performance.now() - this.contextTracker.downAt
          const distance = this.contextTracker.movement.length()
          if (elapsed < 300 && distance < 30) {
            this.tryContext()
          }
        }
        if (this.context && contextBreakers.includes(code)) {
          this.setContext(null)
        }
      },
    })
  }

  update(delta) {
    if (this.control.buttons.MouseRight) {
      this.contextTracker.movement.add(this.control.pointer.delta)
    }
  }

  tryContext() {
    const hits = this.world.stage.raycastPointer(this.world.controls.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    if (!entity) return
    const context = {
      id: uuid(),
      x: this.world.controls.pointer.position.x,
      y: this.world.controls.pointer.position.y,
      actions: [],
    }
    if (entity.isPlayer) {
      context.actions.push({
        label: 'Inspect',
        icon: EyeIcon,
        visible: true,
        disabled: false,
        onClick: () => {
          this.setContext(null)
        },
      })
    }
    if (entity.isApp) {
      const roles = this.world.entities.player.data.user.roles
      const isAdmin = hasRole(roles, 'admin')
      const isBuilder = hasRole(roles, 'builder')
      const isPublic = entity.blueprint.public
      context.actions.push({
        label: 'Inspect',
        icon: EyeIcon,
        visible: isAdmin || isBuilder || isPublic,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          this.world.emit('inspect', entity)
        },
      })
      context.actions.push({
        label: 'Move',
        icon: HandIcon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          entity.move()
        },
      })
      context.actions.push({
        label: 'Duplicate',
        icon: CopyIcon,
        visible: isAdmin || isBuilder,
        disabled: !!entity.data.uploader, // must be uploaded
        onClick: () => {
          this.setContext(null)
          const data = {
            id: uuid(),
            type: 'app',
            blueprint: entity.data.blueprint,
            position: entity.data.position,
            quaternion: entity.data.quaternion,
            mover: this.world.network.id,
            uploader: null,
            state: {},
          }
          this.world.entities.add(data, true)
        },
      })
      context.actions.push({
        label: 'Unlink',
        icon: UnlinkIcon,
        visible: isAdmin || isBuilder,
        disabled: !!entity.data.uploader, // must be uploaded
        onClick: () => {
          this.setContext(null)
          // duplicate the blueprint
          const blueprint = {
            id: uuid(),
            version: 0,
            name: entity.blueprint.name,
            image: entity.blueprint.image,
            author: entity.blueprint.author,
            url: entity.blueprint.url,
            desc: entity.blueprint.desc,
            model: entity.blueprint.model,
            script: entity.blueprint.script,
            props: cloneDeep(entity.blueprint.props),
            preload: entity.blueprint.preload,
            public: entity.blueprint.public,
            locked: entity.blueprint.locked,
            frozen: entity.blueprint.frozen,
          }
          this.world.blueprints.add(blueprint, true)
          // assign new blueprint
          entity.modify({ blueprint: blueprint.id })
          this.world.network.send('entityModified', { id: entity.data.id, blueprint: blueprint.id })
        },
      })
      context.actions.push({
        label: 'Destroy',
        icon: Trash2Icon,
        visible: isAdmin || isBuilder,
        disabled: false,
        onClick: () => {
          this.setContext(null)
          entity.destroy(true)
        },
      })
    }
    const hasActions = context.actions.find(action => action.visible)
    if (hasActions) {
      this.setContext(context)
    }
  }

  setContext(value) {
    this.context = value
    this.world.emit('context', value)
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragEnter = e => {
    this.target = e.target
    this.dropping = true
    this.file = null
  }

  onDragLeave = e => {
    if (e.target === this.target) {
      this.dropping = false
    }
  }

  onDrop = async e => {
    e.preventDefault()
    this.dropping = false
    // ensure we have admin/builder role
    const roles = this.world.entities.player.data.user.roles
    const canDrop = hasRole(roles, 'admin', 'builder')
    if (!canDrop) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `You don't have permission to do that.`,
        createdAt: moment().toISOString(),
      })
      return
    }
    // handle drop
    let file
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0]
      if (item.kind === 'file') {
        file = item.getAsFile()
      }
      // Handle multiple MIME types for URLs
      if (item.type === 'text/uri-list' || item.type === 'text/plain' || item.type === 'text/html') {
        const text = await getAsString(item)
        // Extract URL from the text (especially important for text/html type)
        const url = text.trim().split('\n')[0] // Take first line in case of multiple
        if (url.startsWith('http')) { // Basic URL validation
          const resp = await fetch(url)
          const blob = await resp.blob()
          file = new File([blob], new URL(url).pathname.split('/').pop(), { type: resp.headers.get('content-type') })
        }
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0]
    }
    if (!file) return
    const maxSize = MAX_UPLOAD_SIZE * 1024 * 1024
    if (file.size > maxSize) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `File size too large (>${MAX_UPLOAD_SIZE}mb)`,
        createdAt: moment().toISOString(),
      })
      console.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
      return
    }
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'hyp') {
      this.addApp(file)
    }
    if (ext === 'glb') {
      this.addModel(file)
    }
    if (ext === 'vrm') {
      this.addAvatar(file)
    }
  }

  async addApp(file) {
    const info = await importApp(file)
    for (const asset of info.assets) {
      this.world.loader.insert(asset.type, asset.url, asset.file)
    }
    const blueprint = {
      id: uuid(),
      version: 0,
      name: info.blueprint.name,
      image: info.blueprint.image,
      author: info.blueprint.author,
      url: info.blueprint.url,
      desc: info.blueprint.desc,
      model: info.blueprint.model,
      script: info.blueprint.script,
      props: info.blueprint.props,
      preload: info.blueprint.preload,
      public: info.blueprint.public,
      locked: info.blueprint.locked,
      frozen: info.blueprint.frozen,
    }
    this.world.blueprints.add(blueprint, true)
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position,
      quaternion: [0, 0, 0, 1],
      mover: this.world.network.id,
      uploader: this.world.network.id,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    const promises = info.assets.map(asset => {
      return this.world.network.upload(asset.file)
    })
    try {
      await Promise.all(promises)
      app.onUploaded()
    } catch (err) {
      console.error('failed to upload .hyp assets')
      console.error(err)
      app.destroy()
    }
  }

  async addModel(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.glb`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('model', url, file)
    // make blueprint
    const blueprint = {
      id: uuid(),
      version: 0,
      name: null,
      image: null,
      author: null,
      url: null,
      desc: null,
      model: url,
      script: null,
      props: {},
      preload: false,
      public: false,
      locked: false,
    }
    // register blueprint
    this.world.blueprints.add(blueprint, true)
    // get spawn point
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    // spawn the app moving
    // - mover: follows this clients cursor until placed
    // - uploader: other clients see a loading indicator until its fully uploaded
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position,
      quaternion: [0, 0, 0, 1],
      mover: this.world.network.id,
      uploader: this.world.network.id,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    // upload the glb
    await this.world.network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }

  async addAvatar(file) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as vrm filename
    const filename = `${hash}.vrm`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('avatar', url, file)
    this.world.emit('avatar', {
      file,
      url,
      hash,
      onPlace: async () => {
        // close pane
        this.world.emit('avatar', null)
        // make blueprint
        const blueprint = {
          id: uuid(),
          version: 0,
          name: null,
          image: null,
          author: null,
          url: null,
          desc: null,
          model: url,
          script: null,
          props: {},
          preload: false,
          public: false,
          locked: false,
        }
        // register blueprint
        this.world.blueprints.add(blueprint, true)
        // get spawn point
        const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
        const position = hit ? hit.point.toArray() : [0, 0, 0]
        // spawn the app moving
        // - mover: follows this clients cursor until placed
        // - uploader: other clients see a loading indicator until its fully uploaded
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprint.id,
          position,
          quaternion: [0, 0, 0, 1],
          mover: this.world.network.id,
          uploader: this.world.network.id,
          state: {},
        }
        const app = this.world.entities.add(data, true)
        // upload the glb
        await this.world.network.upload(file)
        // mark as uploaded so other clients can load it in
        app.onUploaded()
      },
      onEquip: async () => {
        // close pane
        this.world.emit('avatar', null)
        // prep new user data
        const player = this.world.entities.player
        const prevUser = player.data.user
        const newUser = cloneDeep(player.data.user)
        newUser.avatar = url
        // update locally
        player.modify({ user: newUser })
        // upload
        try {
          await this.world.network.upload(file)
        } catch (err) {
          console.error(err)
          // revert
          player.modify({ user: prevUser })
          return
        }
        // update for everyone
        this.world.network.send('entityModified', {
          id: player.data.id,
          user: newUser,
        })
      },
    })
  }
}

function getAsString(item) {
  return new Promise(resolve => {
    item.getAsString(resolve)
  })
}
