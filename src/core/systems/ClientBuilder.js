import moment from 'moment'
import * as THREE from '../extras/three'
import { cloneDeep, isBoolean } from 'lodash-es'

import { System } from './System'

import { hashFile } from '../utils-client'
import { hasRole, uuid } from '../utils'
import { ControlPriorities } from '../extras/ControlPriorities'
import { importApp } from '../extras/appTools'
import { DEG2RAD, RAD2DEG } from '../extras/general'

const FORWARD = new THREE.Vector3(0, 0, -1)
const SNAP_DISTANCE = 1
const SNAP_DEGREES = 5
const PROJECT_SPEED = 10
const PROJECT_MIN = 3
const PROJECT_MAX = 50

const v1 = new THREE.Vector3()
const q1 = new THREE.Quaternion()
const e1 = new THREE.Euler()

/**
 * Builder System
 *
 * - runs on the client
 * - listens for files being drag and dropped onto the window and handles them
 * - handles build mode
 *
 */
export class ClientBuilder extends System {
  constructor(world) {
    super(world)
    this.enabled = false

    this.selected = null
    this.target = new THREE.Object3D()
    this.target.rotation.reorder('YXZ')
    this.lastMoveSendTime = 0

    this.undos = []

    this.dropTarget = null
    this.file = null
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.viewport.addEventListener('dragover', this.onDragOver)
    this.viewport.addEventListener('dragenter', this.onDragEnter)
    this.viewport.addEventListener('dragleave', this.onDragLeave)
    this.viewport.addEventListener('drop', this.onDrop)
    this.world.on('player', this.onLocalPlayer)
  }

  start() {
    this.control = this.world.controls.bind({ priority: ControlPriorities.BUILDER })
    this.control.mouseLeft.onPress = () => {
      // pointer lock requires user-gesture in safari
      // so this can't be done during update cycle
      if (!this.control.pointer.locked) {
        this.control.pointer.lock()
        this.justPointerLocked = true
        return true // capture
      }
    }
    this.updateActions()
  }

  onLocalPlayer = () => {
    this.updateActions()
  }

  canBuild() {
    return hasRole(this.world.entities.player?.data.roles, 'admin', 'builder')
  }

  updateActions() {
    const actions = []
    if (!this.enabled) {
      if (this.canBuild()) {
        actions.push({ type: 'tab', label: 'Build Mode' })
      }
    }
    if (this.enabled && !this.selected) {
      actions.push({ type: 'mouseLeft', label: 'Grab' })
      actions.push({ type: 'mouseRight', label: 'Duplicate' })
      actions.push({ type: 'keyR', label: 'Inspect' })
      actions.push({ type: 'keyP', label: 'Pin' })
      actions.push({ type: 'keyX', label: 'Destroy' })
      actions.push({ type: 'space', label: 'Jump / Fly (Double-Tap)' })
      actions.push({ type: 'tab', label: 'Exit Build Mode' })
    }
    if (this.enabled && this.selected) {
      actions.push({ type: 'mouseLeft', label: 'Place' })
      actions.push({ type: 'mouseWheel', label: 'Rotate' })
      actions.push({ type: 'mouseRight', label: 'Duplicate' })
      actions.push({ type: 'keyF', label: 'Push' })
      actions.push({ type: 'keyC', label: 'Pull' })
      actions.push({ type: 'keyX', label: 'Destroy' })
      actions.push({ type: 'controlLeft', label: 'No Snap (Hold)' })
      actions.push({ type: 'space', label: 'Jump / Fly (Double-Tap)' })
      actions.push({ type: 'tab', label: 'Exit Build Mode' })
    }
    this.control.setActions(actions)
  }

  update(delta) {
    // toggle build
    if (this.control.tab.pressed) {
      this.toggle()
    }
    // deselect if dead
    if (this.selected?.destroyed) {
      this.select(null)
    }
    // deselect if stolen
    if (this.selected && this.selected?.data.mover !== this.world.network.id) {
      this.select(null)
    }
    // stop here if build mode not enabled
    if (!this.enabled) {
      return
    }
    // inspect in pointer-lock
    if (!this.selected && this.control.keyR.pressed) {
      const entity = this.getEntityAtReticle()
      if (entity) {
        this.select(null)
        this.control.pointer.unlock()
        this.world.emit('inspect', entity)
      }
    }
    // inspect out of pointer-lock
    if (!this.selected && !this.control.pointer.locked && this.control.mouseRight.pressed) {
      const entity = this.getEntityAtPointer()
      if (entity) {
        this.select(null)
        this.control.pointer.unlock()
        this.world.emit('inspect', entity)
      }
    }
    // unlink
    if (this.control.keyU.pressed) {
      const entity = this.getEntityAtReticle()
      if (entity?.isApp) {
        this.select(null)
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
          unique: entity.blueprint.unique,
        }
        this.world.blueprints.add(blueprint, true)
        // assign new blueprint
        entity.modify({ blueprint: blueprint.id })
        this.world.network.send('entityModified', { id: entity.data.id, blueprint: blueprint.id })
        // toast
        this.world.emit('toast', 'Unlinked')
      }
    }
    // pin/unpin
    if (!this.selected && this.control.keyP.pressed) {
      const entity = this.getEntityAtReticle()
      if (entity?.isApp) {
        entity.data.pinned = !entity.data.pinned
        this.world.network.send('entityModified', {
          id: entity.data.id,
          pinned: entity.data.pinned,
        })
        this.world.emit('toast', entity.data.pinned ? 'Pinned' : 'Un-pinned')
      }
    }
    // grab
    if (!this.justPointerLocked && this.control.pointer.locked && this.control.mouseLeft.pressed && !this.selected) {
      const entity = this.getEntityAtReticle()
      if (entity?.isApp && !entity.data.pinned) {
        this.addUndo({
          name: 'move-entity',
          entityId: entity.data.id,
          position: entity.data.position.slice(),
        })
        this.select(entity)
      }
    }
    // place
    else if (
      (!this.control.pointer.locked && this.selected) ||
      (this.control.pointer.locked && this.control.mouseLeft.pressed && this.selected)
    ) {
      this.select(null)
    }
    // duplicate
    if (!this.justPointerLocked && this.control.pointer.locked && this.control.mouseRight.pressed) {
      const entity = this.selected || this.getEntityAtReticle()
      if (entity?.isApp) {
        let blueprintId = entity.data.blueprint
        // if unique, we also duplicate the blueprint
        if (entity.blueprint.unique) {
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
            unique: entity.blueprint.unique,
          }
          this.world.blueprints.add(blueprint, true)
          blueprintId = blueprint.id
        }
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprintId,
          position: entity.root.position.toArray(),
          quaternion: entity.root.quaternion.toArray(),
          mover: this.world.network.id,
          uploader: null,
          pinned: false,
          state: {},
        }
        const dup = this.world.entities.add(data, true)
        this.select(dup)
        this.addUndo({
          name: 'remove-entity',
          entityId: data.id,
        })
      }
    }
    // destroy
    if (this.control.keyX.pressed) {
      const entity = this.selected || this.getEntityAtReticle()
      if (entity?.isApp && !entity.data.pinned) {
        this.select(null)
        this.addUndo({
          name: 'add-entity',
          data: cloneDeep(entity.data),
        })
        entity?.destroy(true)
      }
    }
    // undo
    if (this.control.keyZ.pressed && (this.control.metaLeft.down || this.control.controlLeft.down)) {
      this.undo()
    }
    // TODO: move up/down
    // this.selected.position.y -= this.control.pointer.delta.y * delta * 0.5
    if (this.selected) {
      const app = this.selected
      const hit = this.getHitAtReticle(app, true)
      // place at distance
      const camPos = this.world.rig.position
      const camDir = v1.copy(FORWARD).applyQuaternion(this.world.rig.quaternion)
      const hitDistance = hit ? hit.point.distanceTo(camPos) : 0
      if (hit && hitDistance < this.target.limit) {
        // within range, use hit point
        this.target.position.copy(hit.point)
      } else {
        // no hit, project to limit
        this.target.position.copy(camPos).add(camDir.multiplyScalar(this.target.limit))
      }
      // if holding F/C then push or pull
      let project = this.control.keyF.down ? 1 : this.control.keyC.down ? -1 : null
      if (project) {
        const multiplier = this.control.shiftLeft.down ? 4 : 1
        this.target.limit += project * PROJECT_SPEED * delta * multiplier
        if (this.target.limit < PROJECT_MIN) this.target.limit = PROJECT_MIN
        if (hitDistance && this.target.limit > hitDistance) this.target.limit = hitDistance
      }
      // if not holding shift, mouse wheel rotates
      this.target.rotation.y += this.control.scrollDelta.value * 0.1 * delta
      // apply movement
      app.root.position.copy(this.target.position)
      app.root.quaternion.copy(this.target.quaternion)
      // snap rotation to degrees
      if (!this.control.controlLeft.down) {
        const newY = this.target.rotation.y
        const degrees = newY / DEG2RAD
        const snappedDegrees = Math.round(degrees / SNAP_DEGREES) * SNAP_DEGREES
        app.root.rotation.y = snappedDegrees * DEG2RAD
      }
      // update matrix
      app.root.clean()
      // and snap to any nearby points
      if (!this.control.controlLeft.down) {
        for (const pos of app.snaps) {
          const result = this.world.snaps.octree.query(pos, SNAP_DISTANCE)[0]
          if (result) {
            const offset = v1.copy(result.position).sub(pos)
            app.root.position.add(offset)
            break
          }
        }
      }

      // periodically send updates
      this.lastMoveSendTime += delta
      if (this.lastMoveSendTime > this.world.networkRate) {
        this.world.network.send('entityModified', {
          id: app.data.id,
          position: app.root.position.toArray(),
          quaternion: app.root.quaternion.toArray(),
        })
        this.lastMoveSendTime = 0
      }
    }

    if (this.justPointerLocked) {
      this.justPointerLocked = false
    }
  }

  addUndo(action) {
    this.undos.push(action)
    if (this.undos.length > 50) {
      this.undos.shift()
    }
  }

  undo() {
    const undo = this.undos.pop()
    if (!undo) return
    if (this.selected) this.select(null)
    if (undo.name === 'add-entity') {
      this.world.entities.add(undo.data, true)
      return
    }
    if (undo.name === 'move-entity') {
      const entity = this.world.entities.get(undo.entityId)
      if (!entity) return
      entity.data.position = undo.position
      this.world.network.send('entityModified', {
        id: undo.entityId,
        position: entity.data.position,
      })
      entity.build()
      return
    }
    if (undo.name === 'remove-entity') {
      const entity = this.world.entities.get(undo.entityId)
      if (!entity) return
      entity.destroy(true)
      return
    }
  }

  toggle(enabled) {
    if (!this.canBuild()) return
    enabled = isBoolean(enabled) ? enabled : !this.enabled
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (!this.enabled) this.select(null)
    this.updateActions()
    this.world.emit('build-mode', enabled)
  }

  select(app) {
    // do nothing if not changed
    if (this.selected === app) return
    // deselect existing
    if (this.selected) {
      if (!this.selected.dead && this.selected.data.mover === this.world.network.id) {
        const app = this.selected
        app.data.mover = null
        app.data.position = app.root.position.toArray()
        app.data.quaternion = app.root.quaternion.toArray()
        app.data.state = {}
        this.world.network.send('entityModified', {
          id: app.data.id,
          mover: null,
          position: app.data.position,
          quaternion: app.data.quaternion,
          state: app.data.state,
        })
        app.build()
      }
      this.selected = null
      this.control.keyC.capture = false
      this.control.scrollDelta.capture = false
    }
    // select new (if any)
    if (app) {
      if (app.data.mover !== this.world.network.id) {
        app.data.mover = this.world.network.id
        app.build()
        this.world.network.send('entityModified', { id: app.data.id, mover: app.data.mover })
      }
      this.selected = app
      this.control.keyC.capture = true
      this.control.scrollDelta.capture = true
      this.target.position.copy(app.root.position)
      this.target.quaternion.copy(app.root.quaternion)
      this.target.limit = PROJECT_MAX
    }
    // update actions
    this.updateActions()
  }

  getEntityAtReticle() {
    const hits = this.world.stage.raycastReticle()
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    return entity
  }

  getEntityAtPointer() {
    const hits = this.world.stage.raycastPointer(this.control.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    return entity
  }

  getHitAtReticle(ignoreEntity, ignorePlayers) {
    const hits = this.world.stage.raycastReticle()
    let hit
    for (const _hit of hits) {
      const entity = _hit.getEntity?.()
      if (entity === ignoreEntity || (entity?.isPlayer && ignorePlayers)) continue
      hit = _hit
      break
    }
    return hit
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragEnter = e => {
    this.dropTarget = e.target
    this.dropping = true
    this.file = null
  }

  onDragLeave = e => {
    if (e.target === this.dropTarget) {
      this.dropping = false
    }
  }

  onDrop = async e => {
    e.preventDefault()
    this.dropping = false
    // ensure we have admin/builder role
    if (!this.canBuild()) {
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
        if (url.startsWith('http')) {
          // Basic URL validation
          const resp = await fetch(url)
          const blob = await resp.blob()
          file = new File([blob], new URL(url).pathname.split('/').pop(), { type: resp.headers.get('content-type') })
        }
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0]
    }
    if (!file) return
    // slight delay to ensure we get updated pointer position from window focus
    await new Promise(resolve => setTimeout(resolve, 100))
    // ensure we in build mode
    this.toggle(true)
    // add it!
    const maxSize = this.world.network.maxUploadSize * 1024 * 1024
    if (file.size > maxSize) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `File size too large (>${this.world.network.maxUploadSize}mb)`,
        createdAt: moment().toISOString(),
      })
      console.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
      return
    }
    const transform = this.getSpawnTransform()
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'hyp') {
      this.addApp(file, transform)
    }
    if (ext === 'glb') {
      this.addModel(file, transform)
    }
    if (ext === 'vrm') {
      this.addAvatar(file, transform)
    }
  }

  async addApp(file, transform) {
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
      unique: info.blueprint.unique,
    }
    this.world.blueprints.add(blueprint, true)
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      mover: null,
      uploader: this.world.network.id,
      pinned: false,
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

  async addModel(file, transform) {
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
      name: file.name.split('.')[0],
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
      unique: false,
    }
    // register blueprint
    this.world.blueprints.add(blueprint, true)
    // spawn the app moving
    // - mover: follows this clients cursor until placed
    // - uploader: other clients see a loading indicator until its fully uploaded
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      mover: null,
      uploader: this.world.network.id,
      pinned: false,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    // upload the glb
    await this.world.network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }

  async addAvatar(file, transform) {
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
          name: file.name,
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
          unique: false,
        }
        // register blueprint
        this.world.blueprints.add(blueprint, true)
        // spawn the app moving
        // - mover: follows this clients cursor until placed
        // - uploader: other clients see a loading indicator until its fully uploaded
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprint.id,
          position: transform.position,
          quaternion: transform.quaternion,
          mover: null,
          uploader: this.world.network.id,
          pinned: false,
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
        const prevUrl = player.data.avatar
        // update locally
        player.modify({ avatar: url, sessionAvatar: null })
        // upload
        try {
          await this.world.network.upload(file)
        } catch (err) {
          console.error(err)
          // revert
          player.modify({ avatar: prevUrl })
          return
        }
        // update for everyone
        this.world.network.send('entityModified', {
          id: player.data.id,
          avatar: url,
        })
      },
    })
  }

  getSpawnTransform() {
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    let quaternion
    if (hit) {
      e1.copy(this.world.rig.rotation).reorder('YXZ')
      e1.x = 0
      e1.z = 0
      const degrees = e1.y * RAD2DEG
      const snappedDegrees = Math.round(degrees / SNAP_DEGREES) * SNAP_DEGREES
      e1.y = snappedDegrees * DEG2RAD
      q1.setFromEuler(e1)
      quaternion = q1.toArray()
    } else {
      quaternion = [0, 0, 0, 1]
    }
    return { position, quaternion }
  }
}

function getAsString(item) {
  return new Promise(resolve => {
    item.getAsString(resolve)
  })
}
