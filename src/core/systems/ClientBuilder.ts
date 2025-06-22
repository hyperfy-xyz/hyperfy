import * as THREE from 'three'
import { cloneDeep, isBoolean } from 'lodash-es'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

import { System } from './System'
import type { World, WorldOptions } from '../../types'

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

const modeLabels: Record<string, string> = {
  grab: 'Grab',
  translate: 'Translate',
  rotate: 'Rotate',
  scale: 'Scale',
}

interface AppEntity {
  isApp: boolean;
  data: any;
  root: THREE.Object3D;
  blueprint: any;
  destroyed?: boolean;
  snaps?: THREE.Vector3[];
  modify?: (data: any) => void;
  destroy?: (local?: boolean) => void;
  build?: () => void;
}

interface TargetObject extends THREE.Object3D {
  limit?: number;
}

/**
 * Builder System
 *
 * - runs on the client
 * - listens for files being drag and dropped onto the window and handles them
 * - handles build mode
 *
 */
export class ClientBuilder extends System {
  enabled: boolean;
  selected: AppEntity | null;
  mode: 'grab' | 'translate' | 'rotate' | 'scale';
  localSpace: boolean;
  target: TargetObject;
  lastMoveSendTime: number;
  undos: any[];
  dropTarget: any;
  file: any;
  viewport!: HTMLElement;
  control: any;
  justPointerLocked: boolean = false;
  gizmo!: TransformControls;
  gizmoTarget!: THREE.Object3D;
  gizmoActive: boolean = false;

  constructor(world: World) {
    super(world)
    this.enabled = false
    this.selected = null
    this.mode = 'grab'
    this.localSpace = false
    this.target = new THREE.Object3D() as TargetObject
    this.target.rotation.reorder('YXZ')
    this.lastMoveSendTime = 0

    this.undos = []

    this.dropTarget = null
    this.file = null
  }

  async init(options: WorldOptions & { viewport?: HTMLElement }) {
    if (!options.viewport) {
      console.warn('ClientBuilder: No viewport provided')
      return
    }
    this.viewport = options.viewport
    this.viewport.addEventListener('dragover', this.onDragOver)
    this.viewport.addEventListener('dragenter', this.onDragEnter)
    this.viewport.addEventListener('dragleave', this.onDragLeave)
    this.viewport.addEventListener('drop', this.onDrop)
    if (this.world.on) {
    this.world.on('player', this.onLocalPlayer)
    }
  }

  start() {
    this.control = (this.world as any).controls.bind({ priority: ControlPriorities.BUILDER })
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
    return (this.world.settings as any).public || hasRole((this.world.entities as any).player?.data.roles, 'admin')
  }

  updateActions() {
    const actions: any[] = []
    if (!this.enabled) {
      if (this.canBuild()) {
        // actions.push({ type: 'tab', label: 'Build Mode' })
      }
    }
    if (this.enabled && !this.selected) {
      actions.push({ type: 'mouseLeft', label: modeLabels[this.mode] })
      actions.push({ type: 'mouseRight', label: 'Inspect' })
      actions.push({ type: 'custom', btn: '1234', label: 'Grab / Translate / Rotate / Scale' })
      actions.push({ type: 'keyR', label: 'Duplicate' })
      actions.push({ type: 'keyP', label: 'Pin' })
      actions.push({ type: 'keyX', label: 'Destroy' })
      actions.push({ type: 'space', label: 'Jump / Fly (Double-Tap)' })
      // actions.push({ type: 'tab', label: 'Exit Build Mode' })
    }
    if (this.enabled && this.selected && this.mode === 'grab') {
      actions.push({ type: 'mouseLeft', label: 'Place' })
      actions.push({ type: 'mouseWheel', label: 'Rotate' })
      actions.push({ type: 'mouseRight', label: 'Inspect' })
      actions.push({ type: 'custom', btn: '1234', label: 'Grab / Translate / Rotate / Scale' })
      actions.push({ type: 'keyF', label: 'Push' })
      actions.push({ type: 'keyC', label: 'Pull' })
      actions.push({ type: 'keyX', label: 'Destroy' })
      actions.push({ type: 'controlLeft', label: 'No Snap (Hold)' })
      actions.push({ type: 'space', label: 'Jump / Fly (Double-Tap)' })
      // actions.push({ type: 'tab', label: 'Exit Build Mode' })
    }
    if (
      this.enabled &&
      this.selected &&
      (this.mode === 'translate' || this.mode === 'rotate' || this.mode === 'scale')
    ) {
      actions.push({ type: 'mouseLeft', label: 'Select / Transform' })
      actions.push({ type: 'mouseRight', label: 'Inspect' })
      actions.push({ type: 'custom', btn: '1234', label: 'Grab / Translate / Rotate / Scale' })
      actions.push({ type: 'keyT', label: this.localSpace ? 'World Space' : 'Local Space' })
      actions.push({ type: 'keyX', label: 'Destroy' })
      actions.push({ type: 'controlLeft', label: 'No Snap (Hold)' })
      actions.push({ type: 'space', label: 'Jump / Fly (Double-Tap)' })
      // actions.push({ type: 'tab', label: 'Exit Build Mode' })
    }
    this.control.setActions(actions)
  }

  update(delta: number) {
    // toggle build
    if (this.control.tab.pressed) {
      this.toggle()
    }
    // deselect if dead
    if (this.selected?.destroyed) {
      this.select(null)
    }
    // deselect if stolen
    if (this.selected && this.selected?.data.mover !== (this.world as any).network.id) {
      this.select(null)
    }
    // stop here if build mode not enabled
    if (!this.enabled) {
      return
    }
    // inspect in pointer-lock
    if (this.control.mouseRight.pressed && this.control.pointer.locked) {
      const entity = this.getEntityAtReticle()
      if (entity?.isApp) {
        this.select(null)
        this.control.pointer.unlock()
        ;(this.world as any).ui.setApp(entity)
      }
    }
    // inspect out of pointer-lock
    else if (!this.selected && !this.control.pointer.locked && this.control.mouseRight.pressed) {
      const entity = this.getEntityAtPointer()
      if (entity?.isApp) {
        this.select(null)
        this.control.pointer.unlock()
        ;(this.world as any).ui.setApp(entity)
      }
    }
    // unlink
    if (this.control.keyU.pressed && this.control.pointer.locked) {
      const entity = this.selected || this.getEntityAtReticle()
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
          disabled: entity.blueprint.disabled,
        }
        ;(this.world.blueprints as any).add(blueprint, true)
        // assign new blueprint
        entity.modify({ blueprint: blueprint.id })
        ;(this.world as any).network.send('entityModified', { id: entity.data.id, blueprint: blueprint.id })
        // toast
        if (this.world.emit) {
        this.world.emit('toast', 'Unlinked')
        }
      }
    }
    // pin/unpin
    if (this.control.keyP.pressed && this.control.pointer.locked) {
      const entity = this.selected || this.getEntityAtReticle()
      if (entity?.isApp) {
        entity.data.pinned = !entity.data.pinned
        ;(this.world as any).network.send('entityModified', {
          id: entity.data.id,
          pinned: entity.data.pinned,
        })
        if (this.world.emit) {
        this.world.emit('toast', entity.data.pinned ? 'Pinned' : 'Un-pinned')
        }
        this.select(null)
      }
    }
    // gizmo local/world toggle
    if (this.control.keyT.pressed && (this.mode === 'translate' || this.mode === 'rotate' || this.mode === 'scale')) {
      this.localSpace = !this.localSpace
      this.gizmo.space = this.localSpace ? 'local' : 'world'
      this.updateActions()
    }
    // grab mode
    if (this.control.digit1.pressed) {
      this.setMode('grab')
    }
    // translate mode
    if (this.control.digit2.pressed) {
      this.setMode('translate')
    }
    // rotate mode
    if (this.control.digit3.pressed) {
      this.setMode('rotate')
    }
    // scale mode
    if (this.control.digit4.pressed) {
      this.setMode('scale')
    }
    // left-click place/select/reselect/deselect
    if (!this.justPointerLocked && this.control.pointer.locked && this.control.mouseLeft.pressed) {
      // if nothing selected, attempt to select
      if (!this.selected) {
        const entity = this.getEntityAtReticle()
        if (entity?.isApp && !entity.data.pinned) this.select(entity)
      }
      // if selected in grab mode, place
      else if (this.selected && this.mode === 'grab') {
        this.select(null)
      }
      // if selected in translate/rotate/scale mode, re-select/deselect
      else if (
        this.selected &&
        (this.mode === 'translate' || this.mode === 'rotate' || this.mode === 'scale') &&
        !this.gizmoActive
      ) {
        const entity = this.getEntityAtReticle()
        if (entity?.isApp) this.select(entity)
        else this.select(null)
      }
    }
    // deselect on pointer unlock
    if (this.selected && !this.control.pointer.locked) {
      this.select(null)
    }
    // duplicate
    if (
      !this.justPointerLocked &&
      this.control.pointer.locked &&
      this.control.keyR.pressed &&
      !this.control.metaLeft.down &&
      !this.control.controlLeft.down
    ) {
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
            disabled: entity.blueprint.disabled,
          }
          ;(this.world.blueprints as any).add(blueprint, true)
          blueprintId = blueprint.id
        }
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprintId,
          position: entity.root.position.toArray(),
          quaternion: entity.root.quaternion.toArray(),
          scale: entity.root.scale.toArray(),
          mover: (this.world as any).network.id,
          uploader: null,
          pinned: false,
          state: {},
        }
        const dup = (this.world.entities as any).add(data, true)
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
    if (
      this.control.keyZ.pressed &&
      !this.control.shiftLeft.down &&
      (this.control.metaLeft.down || this.control.controlLeft.down)
    ) {
      console.log('undo', {
        shiftLeft: this.control.shiftLeft.down,
        metaLeft: this.control.metaLeft.down,
        controlLeft: this.control.controlLeft.down,
      })
      this.undo()
    }
    // translate updates
    if (this.selected && this.mode === 'translate' && this.gizmoActive) {
      const app = this.selected
      app.root.position.copy(this.gizmoTarget.position)
      app.root.quaternion.copy(this.gizmoTarget.quaternion)
      app.root.scale.copy(this.gizmoTarget.scale)
    }
    // rotate updates
    if (this.selected && this.mode === 'rotate' && this.control.controlLeft.pressed) {
      this.gizmo.rotationSnap = null
    }
    if (this.selected && this.mode === 'rotate' && this.control.controlLeft.released) {
      this.gizmo.rotationSnap = SNAP_DEGREES * DEG2RAD
    }
    if (this.selected && this.mode === 'rotate' && this.gizmoActive) {
      const app = this.selected
      app.root.position.copy(this.gizmoTarget.position)
      app.root.quaternion.copy(this.gizmoTarget.quaternion)
      app.root.scale.copy(this.gizmoTarget.scale)
    }
    // scale updates
    if (this.selected && this.mode === 'scale' && this.gizmoActive) {
      const app = this.selected
      app.root.scale.copy(this.gizmoTarget.scale)
    }
    // grab updates
    if (this.selected && this.mode === 'grab') {
      const app = this.selected
      const hit = this.getHitAtReticle(app, true)
      // place at distance
      const camPos = this.world.rig.position
      const camDir = v1.copy(FORWARD).applyQuaternion(this.world.rig.quaternion)
      const hitDistance = hit ? hit.point.distanceTo(camPos) : 0
      if (hit && hitDistance < this.target.limit!) {
        // within range, use hit point
        this.target.position.copy(hit.point)
      } else {
        // no hit, project to limit
        this.target.position.copy(camPos).add(camDir.multiplyScalar(this.target.limit!))
      }
      // if holding F/C then push or pull
      let project = this.control.keyF.down ? 1 : this.control.keyC.down ? -1 : null
      if (project) {
        const multiplier = this.control.shiftLeft.down ? 4 : 1
        this.target.limit! += project * PROJECT_SPEED * delta * multiplier
        if (this.target.limit! < PROJECT_MIN) this.target.limit = PROJECT_MIN
        if (hitDistance && this.target.limit! > hitDistance) this.target.limit = hitDistance
      }
      // shift + mouse wheel scales
      if (this.control.shiftLeft.down) {
        const scaleFactor = 1 + this.control.scrollDelta.value * 0.1 * delta
        this.target.scale.multiplyScalar(scaleFactor)
      }
      // !shift + mouse wheel rotates
      else {
        this.target.rotation.y += this.control.scrollDelta.value * 0.1 * delta
      }
      // apply movement
      app.root.position.copy(this.target.position)
      app.root.quaternion.copy(this.target.quaternion)
      app.root.scale.copy(this.target.scale)
      // snap rotation to degrees
      if (!this.control.controlLeft.down) {
        const newY = this.target.rotation.y
        const degrees = newY / DEG2RAD
        const snappedDegrees = Math.round(degrees / SNAP_DEGREES) * SNAP_DEGREES
        app.root.rotation.y = snappedDegrees * DEG2RAD
      }
      // update matrix
      ;(app.root as any).clean()
      // and snap to any nearby points
      if (!this.control.controlLeft.down && app.snaps) {
        for (const pos of app.snaps) {
          const result = (this.world as any).snaps.octree.query(pos, SNAP_DISTANCE)[0]
          if (result) {
            const offset = v1.copy(result.position).sub(pos)
            app.root.position.add(offset)
            break
          }
        }
      }
    }
    // send selected updates
    if (this.selected) {
      this.lastMoveSendTime += delta
      if (this.lastMoveSendTime > this.world.networkRate) {
        const app = this.selected
        ;(this.world as any).network.send('entityModified', {
          id: app.data.id,
          position: app.root.position.toArray(),
          quaternion: app.root.quaternion.toArray(),
          scale: app.root.scale.toArray(),
        })
        this.lastMoveSendTime = 0
      }
    }

    if (this.justPointerLocked) {
      this.justPointerLocked = false
    }
  }

  addUndo(action: any) {
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
      (this.world.entities as any).add(undo.data, true)
      return
    }
    if (undo.name === 'move-entity') {
      const entity = (this.world.entities as any).get(undo.entityId)
      if (!entity) return
      entity.data.position = undo.position
      entity.data.quaternion = undo.quaternion
      ;(this.world as any).network.send('entityModified', {
        id: undo.entityId,
        position: entity.data.position,
        quaternion: entity.data.quaternion,
        scale: entity.data.scale,
      })
      if (entity.build) {
      entity.build()
      }
      return
    }
    if (undo.name === 'remove-entity') {
      const entity = (this.world.entities as any).get(undo.entityId)
      if (!entity) return
      entity.destroy(true)
      return
    }
  }

  toggle(enabled?: boolean) {
    if (!this.canBuild()) return
    const isEnabled = isBoolean(enabled) ? enabled : !this.enabled
    if (this.enabled === isEnabled) return
    this.enabled = isEnabled
    if (!this.enabled) this.select(null)
    this.updateActions()
    if (this.world.emit) {
      this.world.emit('build-mode', isEnabled)
    }
  }

  setMode(mode: 'grab' | 'translate' | 'rotate' | 'scale') {
    // cleanup
    if (this.selected) {
      if (this.mode === 'grab') {
        this.control.keyC.capture = false
        this.control.scrollDelta.capture = false
      }
      if (this.mode === 'translate' || this.mode === 'rotate' || this.mode === 'scale') {
        this.detachGizmo()
      }
    }
    // change
    this.mode = mode
    if (this.mode === 'grab') {
      if (this.selected) {
        const app = this.selected
        this.control.keyC.capture = true
        this.control.scrollDelta.capture = true
        this.target.position.copy(app.root.position)
        this.target.quaternion.copy(app.root.quaternion)
        this.target.scale.copy(app.root.scale)
        this.target.limit = PROJECT_MAX
      }
    }
    if (this.mode === 'translate' || this.mode === 'rotate' || this.mode === 'scale') {
      if (this.selected) {
        this.attachGizmo(this.selected, this.mode)
      }
    }
    this.updateActions()
  }

  select(app: AppEntity | null) {
    // do nothing if unchanged
    if (this.selected === app) return
    // deselect existing
    if (this.selected && this.selected !== app) {
      if (!this.selected.destroyed && this.selected.data.mover === (this.world as any).network.id) {
        const prevApp = this.selected
        prevApp.data.mover = null
        prevApp.data.position = prevApp.root.position.toArray()
        prevApp.data.quaternion = prevApp.root.quaternion.toArray()
        prevApp.data.scale = prevApp.root.scale.toArray()
        prevApp.data.state = {}
        ;(this.world as any).network.send('entityModified', {
          id: prevApp.data.id,
          mover: null,
          position: prevApp.data.position,
          quaternion: prevApp.data.quaternion,
          scale: prevApp.data.scale,
          state: {},
        })
      }
      if (this.mode === 'translate' || this.mode === 'rotate' || this.mode === 'scale') {
        this.detachGizmo()
      }
    }
    // select
    if (app && this.mode !== 'grab') {
      this.attachGizmo(app, this.mode)
    }
    // grab is special
    else if (app && this.mode === 'grab') {
      this.addUndo({
        name: 'move-entity',
        entityId: app.data.id,
        position: app.data.position.slice(),
        quaternion: app.data.quaternion.slice(),
        scale: app.data.scale.slice(),
      })
      if (app.data.mover !== (this.world as any).network.id) {
        app.data.mover = (this.world as any).network.id
        if (app.build) {
        app.build()
        }
        ;(this.world as any).network.send('entityModified', { id: app.data.id, mover: app.data.mover })
      }
      this.selected = app
      this.control.keyF.capture = true
        this.control.keyC.capture = true
        this.control.scrollDelta.capture = true
        this.target.position.copy(app.root.position)
        this.target.quaternion.copy(app.root.quaternion)
        this.target.scale.copy(app.root.scale)
      this.target.rotation.setFromQuaternion(this.target.quaternion, 'YXZ')
        this.target.limit = PROJECT_MAX
      }
    this.selected = app
    this.updateActions()
  }

  attachGizmo(app: AppEntity, mode: 'grab' | 'translate' | 'rotate' | 'scale') {
    if (this.gizmo) this.detachGizmo()
    // create gizmo
    this.gizmo = new TransformControls(this.world.camera, (this.world as any).graphics.renderer.domElement)
    this.gizmo.setMode(mode === 'grab' ? 'translate' : mode)
    this.gizmo.setSpace(this.localSpace ? 'local' : 'world')
    this.gizmo.setSize(0.85)
    if (mode === 'rotate') {
      this.gizmo.rotationSnap = this.control.controlLeft.down ? null : SNAP_DEGREES * DEG2RAD
    }
    const gizmoInternal = (this.gizmo as any)._gizmo
    gizmoInternal.traverse((child: any) => {
      if ((child as any).isLine) child.layers.set(2)
      if ((child as any).isMesh) child.layers.set(2)
    })
    // add gizmo to stage
    this.world.stage.scene.add(this.gizmo)
    // create object to proxy control
    this.gizmoTarget = new THREE.Object3D() as any
    this.gizmoTarget.position.copy(app.root.position)
    this.gizmoTarget.quaternion.copy(app.root.quaternion)
    this.gizmoTarget.scale.copy(app.root.scale)
    this.gizmo.attach(this.gizmoTarget as any)
    this.world.stage.scene.add(this.gizmoTarget)
    ;(this as any).gizmoHelper = this.gizmo
    this.gizmo.addEventListener('dragging-changed', (event: any) => {
      this.gizmoActive = event.value
      this.control.pointer.capture = event.value
    })
  }

  detachGizmo() {
    if (!this.gizmo) return
    this.world.stage.scene.remove(this.gizmoTarget)
    this.world.stage.scene.remove((this as any).gizmoHelper)
    this.gizmo.detach()
    ;(this.gizmo as any).disconnect()
    this.gizmo.dispose()
    ;(this.gizmo as any) = null
  }

  getEntityAtReticle() {
    const hits = (this.world.stage as any).raycastReticle()
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    return entity
  }

  getEntityAtPointer() {
    const hits = (this.world.stage as any).raycastPointer(this.control.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    return entity
  }

  getHitAtReticle(ignoreEntity: AppEntity | null, ignorePlayers: boolean) {
    const hits = (this.world.stage as any).raycastReticle()
    let hit
    for (const _hit of hits) {
      const entity = _hit.getEntity?.()
      if (entity === ignoreEntity || (entity?.isPlayer && ignorePlayers)) continue
      hit = _hit
      break
    }
    return hit
  }

  onDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  onDragEnter = (e: DragEvent) => {
    this.dropTarget = e.target
    ;(this as any).dropping = true
    this.file = null
  }

  onDragLeave = (e: DragEvent) => {
    if (e.target === this.dropTarget) {
      ;(this as any).dropping = false
    }
  }

  onDrop = async (e: DragEvent) => {
    e.preventDefault()
    ;(this as any).dropping = false
    // ensure we have admin/builder role
    if (!this.canBuild()) {
      ;(this.world as any).chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `You don't have permission to do that.`,
        createdAt: new Date().toISOString(),
      })
      return
    }
    // handle drop
    let file
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0]
      if (item.kind === 'file') {
        file = item.getAsFile()
      }
      // Handle multiple MIME types for URLs
      if (item.type === 'text/uri-list' || item.type === 'text/plain' || item.type === 'text/html') {
        const text = await getAsString(item as any)
        // Extract URL from the text (especially important for text/html type)
        const url = text.trim().split('\n')[0] // Take first line in case of multiple
        if (url.startsWith('http')) {
          // Basic URL validation
          const resp = await fetch(url)
          const blob = await resp.blob()
          file = new File([blob], new URL(url).pathname.split('/').pop() || 'file', { type: resp.headers.get('content-type') || 'application/octet-stream' })
        }
      }
    } else if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0]
    }
    if (!file) return
    // slight delay to ensure we get updated pointer position from window focus
    await new Promise(resolve => setTimeout(resolve, 100))
    // ensure we in build mode
    this.toggle(true)
    // add it!
    const maxSize = (this.world as any).network.maxUploadSize * 1024 * 1024
    if (file.size > maxSize) {
      ;(this.world as any).chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `File size too large (>${(this.world as any).network.maxUploadSize}mb)`,
        createdAt: new Date().toISOString(),
      })
      console.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
      return
    }
    const transform = this.getSpawnTransform(false)
    const ext = file.name.split('.').pop()?.toLowerCase()
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

  async addApp(file: File, transform: { position: number[]; quaternion: number[] }) {
    const info = await importApp(file)
    const assets: any[] = info.assets || []
    for (const asset of assets) {
      ;(this.world as any).loader.insert(asset.type, asset.url, asset.file)
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
      disabled: info.blueprint.disabled,
    }
    ;(this.world.blueprints as any).add(blueprint, true)
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      scale: [1, 1, 1],
      mover: null,
      uploader: (this.world as any).network.id,
      pinned: false,
      state: {},
    }
    const app = (this.world.entities as any).add(data, true)
    const promises = assets.map((asset: any) => {
      return (this.world as any).network.upload(asset.file)
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

  async addModel(file: File, transform: { position: number[]; quaternion: number[] }) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.glb`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    ;(this.world as any).loader.insert('model', url, file)
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
      disabled: false,
    }
    // register blueprint
    ;(this.world.blueprints as any).add(blueprint, true)
    // spawn the app moving
    // - mover: follows this clients cursor until placed
    // - uploader: other clients see a loading indicator until its fully uploaded
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      scale: [1, 1, 1],
      mover: null,
      uploader: (this.world as any).network.id,
      pinned: false,
      state: {},
    }
    const app = (this.world.entities as any).add(data, true)
    // upload the glb
    await (this.world as any).network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }

  async addAvatar(file: File, transform: { position: number[]; quaternion: number[] }) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as vrm filename
    const filename = `${hash}.vrm`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    ;(this.world as any).loader.insert('avatar', url, file)
    if (this.world.emit) {
      this.world.emit('avatar', {
        file,
        url,
        hash,
        onPlace: async () => {
          // close pane
          if (this.world.emit) {
            this.world.emit('avatar', null)
          }
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
            disabled: false,
          }
          // register blueprint
          ;(this.world.blueprints as any).add(blueprint, true)
          // spawn the app moving
          // - mover: follows this clients cursor until placed
          // - uploader: other clients see a loading indicator until its fully uploaded
          const data = {
            id: uuid(),
            type: 'app',
            blueprint: blueprint.id,
            position: transform.position,
            quaternion: transform.quaternion,
            scale: [1, 1, 1],
            mover: null,
            uploader: (this.world as any).network.id,
            pinned: false,
            state: {},
          }
          const app = (this.world.entities as any).add(data, true)
          // upload the glb
          await (this.world as any).network.upload(file)
          // mark as uploaded so other clients can load it in
          app.onUploaded()
        },
        onEquip: async () => {
          // close pane
          if (this.world.emit) {
            this.world.emit('avatar', null)
          }
          // prep new user data
          const player = this.world.entities.player
          if (!player) return
          const prevUrl = (player as any).data.avatar
          // update locally
          if ((player as any).modify) {
            (player as any).modify({ avatar: url, sessionAvatar: null })
          }
          // upload
          try {
            await (this.world as any).network.upload(file)
          } catch (err) {
            console.error(err)
            // revert
            if ((player as any).modify) {
              (player as any).modify({ avatar: prevUrl })
            }
            return
          }
          if ((player as any).data.avatar !== url) {
            return // player equipped a new vrm while this one was uploading >.>
          }
          // update for everyone
          ;(this.world as any).network.send('entityModified', {
            id: (player as any).data.id,
            avatar: url,
          })
        },
      })
    }
  }

  getSpawnTransform(atReticle: boolean) {
    const hit = atReticle
      ? (this.world.stage as any).raycastReticle()[0]
      : (this.world.stage as any).raycastPointer(this.control.pointer.position)[0]
    const camPos = this.world.rig.position
    const camDir = v1.copy(FORWARD).applyQuaternion(this.world.rig.quaternion)
    const position = [0, 0, 0]
    const quaternion = [0, 0, 0, 1]
    if (hit) {
      position[0] = hit.point.x
      position[1] = hit.point.y
      position[2] = hit.point.z
    } else {
      const projected = camPos.clone().add(camDir.multiplyScalar(5))
      position[0] = projected.x
      position[1] = projected.y
      position[2] = projected.z
    }
    q1.setFromUnitVectors(FORWARD as any, camDir.multiplyScalar(-1).normalize())
    e1.setFromQuaternion(q1, 'YXZ')
    e1.x = 0
    e1.z = 0
    q1.setFromEuler(e1)
    quaternion[0] = q1.x
    quaternion[1] = q1.y
    quaternion[2] = q1.z
    quaternion[3] = q1.w
    return { position, quaternion }
  }

  destroy() {
    this.viewport?.removeEventListener('dragover', this.onDragOver)
    this.viewport?.removeEventListener('dragenter', this.onDragEnter)
    this.viewport?.removeEventListener('dragleave', this.onDragLeave)
    this.viewport?.removeEventListener('drop', this.onDrop)
    if (this.world.off) {
      this.world.off('player', this.onLocalPlayer)
    }
  }
}

function getAsString(item: DataTransferItem) {
  return new Promise<string>((resolve) => {
    item.getAsString(resolve)
  })
}
