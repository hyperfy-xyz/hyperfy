import { bindRotations } from '../extras/bindRotations'
import * as THREE from '../extras/three'
import { System } from './System'
import { cloneDeep } from 'lodash-es'
import { uuid } from '../utils'
import moment from 'moment'
import { HyperFone } from '../nodes/HyperFone'
import { createNode } from '../extras/createNode'

const LMB = 1 // bitmask
const RMB = 2 // bitmask
const MMB = 4 // bitmask
const LMB_CODE = 'MouseLeft'
const RMB_CODE = 'MouseRight'
const MMB_CODE = 'MouseMiddle'

/**
 * Control System
 *
 * - runs on the client
 * - provides a layered priority control system for both input and output
 *
 */
export class ClientControls extends System {
  constructor(world) {
    super(world)
    this.controls = []
    this.isUserGesture = false
    this.pointer = {
      locked: false,
      shouldLock: false,
      coords: new THREE.Vector3(), // [0,0] to [1,1]
      position: new THREE.Vector3(), // [0,0] to [viewportWidth,viewportHeight]
      delta: new THREE.Vector3(), // position delta (pixels)
    }
    this.touches = new Map() // id -> { id, position, delta, prevPosition }
    this.screen = {
      width: 0,
      height: 0,
    }
    this.scroll = {
      delta: 0,
    }
    this.buildMode = {
      active: false,
      selectedEntity: null,
      transformMode: null,
      snapToGrid: true,
      gridSize: 1,
      hoveredEntity: null,
      transform: null
    }
    this.hyperFone = null
    this.hyperFoneActive = false
    this.tabletModel = null
  }

  preFixedUpdate() {
    // pointer
    for (const control of this.controls) {
      control.api.pointer.coords.copy(this.pointer.coords)
      control.api.pointer.position.copy(this.pointer.position)
      control.api.pointer.delta.copy(this.pointer.delta)
      control.api.pointer.locked = this.pointer.locked
      const consume = control.options.onPointer?.()
      if (consume) break
    }
    // scroll
    for (const control of this.controls) {
      control.api.scroll.delta = this.scroll.delta
      const consume = control.options.onScroll?.()
      if (consume) break
    }
    // screen
    for (const control of this.controls) {
      control.api.screen.width = this.viewport.offsetWidth
      control.api.screen.height = this.viewport.offsetHeight
    }
  }

  postLateUpdate() {
    // clear pointer delta
    this.pointer.delta.set(0, 0, 0)
    // clear scroll delta
    this.scroll.delta = 0
    for (const control of this.controls) {
      // clear buttons
      control.api.pressed = {}
      control.api.released = {}
      // update camera
      if (control.api.camera.claimed) {
        this.world.rig.position.copy(control.api.camera.position)
        this.world.rig.quaternion.copy(control.api.camera.quaternion)
        this.world.camera.position.z = control.api.camera.zoom
        break
      }
    }
    // clear touch deltas
    for (const [id, info] of this.touches) {
      info.delta.set(0, 0, 0)
    }
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.screen.width = this.viewport.offsetWidth
    this.screen.height = this.viewport.offsetHeight
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    this.viewport.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    this.viewport.addEventListener('touchstart', this.onTouchStart)
    this.viewport.addEventListener('touchmove', this.onTouchMove)
    this.viewport.addEventListener('touchend', this.onTouchEnd)
    this.viewport.addEventListener('touchcancel', this.onTouchEnd)
    this.viewport.addEventListener('pointerup', this.onPointerUp)
    this.viewport.addEventListener('wheel', this.onScroll, { passive: false }) // prettier-ignore
    this.viewport.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('resize', this.onResize)
    window.addEventListener('blur', this.onBlur)
  }

  bind(options = {}) {
    const control = {
      options,
      api: {
        buttons: {},
        pressed: {},
        released: {},
        pointer: {
          coords: new THREE.Vector3(), // [0,0] to [1,1]
          position: new THREE.Vector3(), // [0,0] to [viewportWidth,viewportHeight]
          delta: new THREE.Vector3(), // position delta (pixels)
          locked: false,
          lock: () => {
            this.lockPointer()
          },
          unlock: () => {
            this.unlockPointer()
          },
        },
        scroll: {
          delta: 0,
        },
        camera: {
          position: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
          rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
          zoom: 0,
          claimed: false,
          claim: () => {
            control.api.camera.claimed = true
          },
          unclaim: () => {
            control.api.camera.claimed = false
          },
        },
        screen: {
          width: 0,
          height: 0,
        },
        release: () => {
          const idx = this.controls.indexOf(control)
          if (idx === -1) return
          this.controls.splice(idx, 1)
          control.options.onRelease?.()
        },
      },
    }
    bindRotations(control.api.camera.quaternion, control.api.camera.rotation)
    // insert at correct priority level
    // - 0 is lowest priority generally for player controls
    // - apps use higher priority
    // - global systems use highest priority over everything
    const idx = this.controls.findIndex(c => c.options.priority < options.priority)
    if (idx === -1) {
      this.controls.push(control)
    } else {
      this.controls.splice(idx, 0, control)
    }
    return control.api
  }

  releaseAllButtons() {
    // release all down buttons because they can get stuck
    for (const control of this.controls) {
      Object.keys(control.api.buttons).forEach(code => {
        control.api.buttons[code] = false
        control.api.released[code] = true
        control.options.onRelease?.(code)
      })
    }
  }

  onKeyDown = e => {
    if (this.isInputFocused()) return
    
    // Only allow editor shortcuts in build mode
    if ((e.ctrlKey || e.metaKey) && this.buildMode.active) {
        switch (e.key.toLowerCase()) {
            case 'c': // Copy
                if (this.buildMode.hoveredEntity?.isApp) {
                    e.preventDefault()
                    this.copyEntity(this.buildMode.hoveredEntity)
                }
                break

            case 'x': // Cut
                if (this.buildMode.hoveredEntity?.isApp) {
                    e.preventDefault()
                    this.copyEntity(this.buildMode.hoveredEntity)
                    this.buildMode.hoveredEntity.destroy(true)
                    this.buildMode.hoveredEntity = null
                }
                break

            case 'v': // Paste
                e.preventDefault()
                this.pasteEntity()
                break
        }
        return
    }

    // Single key shortcuts - only in build mode
    if (this.buildMode.active) {
        switch (e.key.toLowerCase()) {
            case 'delete':
            case 'backspace':
                if (this.buildMode.hoveredEntity?.isApp) {
                    e.preventDefault()
                    this.buildMode.hoveredEntity.destroy(true)
                    this.buildMode.hoveredEntity = null
                    this.buildMode.selectedEntity = null
                }
                break

            case 'g': // Grab/Move
                if (this.buildMode.hoveredEntity?.isApp) {
                    e.preventDefault()
                    this.buildMode.selectedEntity = this.buildMode.hoveredEntity
                    this.buildMode.transformMode = 'translate'
                    this.startTransform()
                }
                break

            case 'r': // Rotate
                if (this.buildMode.hoveredEntity?.isApp) {
                    e.preventDefault()
                    this.buildMode.selectedEntity = this.buildMode.hoveredEntity
                    this.buildMode.transformMode = 'rotate'
                    this.startTransform()
                }
                break

            case 's': // Scale
                if (this.buildMode.hoveredEntity?.isApp) {
                    e.preventDefault()
                    this.buildMode.selectedEntity = this.buildMode.hoveredEntity
                    this.buildMode.transformMode = 'scale'
                    this.startTransform()
                }
                break

            case 'escape':
                if (this.buildMode.transformMode) {
                    this.cancelTransform()
                }
                this.buildMode.selectedEntity = null
                break
        }
    }

    // VRM avatar swap - available at all times
    if (e.key.toLowerCase() === 't') {
        const hits = this.world.stage.raycastPointer(this.pointer.position)
        let entity = null
        for (const hit of hits) {
            entity = hit.getEntity?.()
            if (entity && entity.isApp) break
        }
        
        if (entity?.isApp) {
            const blueprint = this.world.blueprints.get(entity.data.blueprint)
            const isVrm = blueprint?.model?.toLowerCase().endsWith('.vrm')
            
            if (isVrm) {
                e.preventDefault()
                this.handleVrmSwap(entity, blueprint)
            }
        }
    }

    // Add HyperFone toggle
    if (e.code === 'KeyP') {
        this.toggleHyperFone()
    }

    // Handle existing key events
    if (e.repeat) return
    const code = e.code
    for (const control of this.controls) {
        control.api.buttons[code] = true
        control.api.pressed[code] = true
        const consume = control.options.onPress?.(code)
        if (consume) break
    }
  }

  onKeyUp = e => {
    if (e.repeat) return
    if (this.isInputFocused()) return
    const code = e.code
    if (code === 'MetaLeft' || code === 'MetaRight') {
      // releasing a meta key while another key is down causes browsers not to ever
      // trigger onKeyUp, so we just have to force all keys up
      return this.releaseAllButtons()
    }
    for (const control of this.controls) {
      control.api.buttons[code] = false
      control.api.released[code] = true
      const consume = control.options.onRelease?.(code)
      if (consume) break
    }
  }

  onPointerDown = e => {
    if (this.isInputFocused()) return

    // Update pointer state
    const code = e.button === 0 ? LMB_CODE : 
                e.button === 1 ? MMB_CODE :
                e.button === 2 ? RMB_CODE : null
    
    if (code) {
        // Handle middle click grab with optional duplication - only in build mode
        if (code === MMB_CODE && this.buildMode.active && this.buildMode.hoveredEntity?.isApp) {
            e.preventDefault()
            
            // If Ctrl is held, duplicate the entity first
            if (e.ctrlKey) {
                const entity = this.buildMode.hoveredEntity
                const data = {
                    id: uuid(),
                    type: 'app',
                    blueprint: entity.data.blueprint,
                    position: entity.data.position,
                    quaternion: entity.data.quaternion,
                    scale: entity.data.scale,
                    mover: this.world.network.id,
                    uploader: null,
                    state: {},
                }
                // Create the duplicate and set it as the moving entity
                const duplicate = this.world.entities.add(data, true)
                duplicate.modify({ 
                    mover: this.world.network.id 
                })
            } else {
                // Regular move without duplication
                const entity = this.buildMode.hoveredEntity
                entity.modify({ 
                    mover: this.world.network.id 
                })
            }
        }

        // Regular button handling
        for (const control of this.controls) {
            control.api.buttons[code] = true
            control.api.pressed[code] = true
            const consume = control.options.onPress?.(code)
            if (consume) break
        }
    }

    // Handle build mode selection - only in build mode
    if (this.buildMode.active && e.button === 0) { // Left click
        if (this.buildMode.hoveredEntity) {
            this.buildMode.selectedEntity = this.buildMode.hoveredEntity
        } else {
            this.buildMode.selectedEntity = null
        }
    }

    // Prevent default right-click menu
    if (e.button === 2) {
        e.preventDefault()
    }
  }

  onPointerMove = e => {
    if (this.pointer.locked) {
    this.pointer.delta.x += e.movementX
    this.pointer.delta.y += e.movementY
    } else {
      const rect = this.viewport.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.pointer.delta.x = x - this.pointer.position.x
      this.pointer.delta.y = y - this.pointer.position.y
      this.pointer.position.x = x
      this.pointer.position.y = y
      this.pointer.coords.x = x / rect.width
      this.pointer.coords.y = y / rect.height
    }

    // Update controls
    for (const control of this.controls) {
      const consume = control.options.onPointer?.()
      if (consume) break
    }
  }

  onPointerUp = e => {
    if (this.isInputFocused()) return

    const code = e.button === 0 ? LMB_CODE :
                e.button === 1 ? MMB_CODE :
                e.button === 2 ? RMB_CODE : null
                
    if (code) {
        // Handle middle click release
        if (code === MMB_CODE) {
            // Find any entity being moved by this client and stop moving it
            Object.values(this.world.entities.list).forEach(entity => {
                if (entity.data.mover === this.world.network.id) {
                    entity.modify({ mover: null })
                }
            })
        }

        for (const control of this.controls) {
            control.api.buttons[code] = false
            control.api.released[code] = true
            const consume = control.options.onRelease?.(code)
            if (consume) break
        }
    }
  }

  checkPointerChanges(e) {
    const lmb = !!(e.buttons & LMB)
    // left mouse down
    if (!this.lmbDown && lmb) {
      this.lmbDown = true
      for (const control of this.controls) {
        control.api.buttons[LMB_CODE] = true
        control.api.pressed[LMB_CODE] = true
        const consume = control.options.onPress?.(LMB_CODE)
        if (consume) break
      }
    }
    // left mouse up
    if (this.lmbDown && !lmb) {
      this.lmbDown = false
      for (const control of this.controls) {
        control.api.buttons[LMB_CODE] = false
        control.api.released[LMB_CODE] = true
        const consume = control.options.onRelease?.(LMB_CODE)
        if (consume) break
      }
    }
    const rmb = !!(e.buttons & RMB)
    // right mouse down
    if (!this.rmbDown && rmb) {
      this.rmbDown = true
      for (const control of this.controls) {
        control.api.buttons[RMB_CODE] = true
        control.api.pressed[RMB_CODE] = true
        const consume = control.options.onPress?.(RMB_CODE)
        if (consume) break
      }
    }
    // right mouse up
    if (this.rmbDown && !rmb) {
      this.rmbDown = false
      for (const control of this.controls) {
        control.api.buttons[RMB_CODE] = false
        control.api.released[RMB_CODE] = true
        const consume = control.options.onRelease?.(RMB_CODE)
        if (consume) break
      }
    }
    const mmb = !!(e.buttons & MMB)
    // middle mouse down
    if (!this.mmbDown && mmb) {
        this.mmbDown = true
        for (const control of this.controls) {
            control.api.buttons[MMB_CODE] = true
            control.api.pressed[MMB_CODE] = true
            const consume = control.options.onPress?.(MMB_CODE)
            if (consume) break
        }
    }
    // middle mouse up
    if (this.mmbDown && !mmb) {
        this.mmbDown = false
        for (const control of this.controls) {
            control.api.buttons[MMB_CODE] = false
            control.api.released[MMB_CODE] = true
            const consume = control.options.onRelease?.(MMB_CODE)
            if (consume) break
        }
    }
  }

  async lockPointer() {
    if (!this.isPointerLocked()) {
    this.pointer.shouldLock = true
      this.viewport.requestPointerLock()
    }
  }

  unlockPointer() {
    if (this.isPointerLocked()) {
      document.exitPointerLock()
    }
    this.pointer.shouldLock = false
  }

  onPointerLockChange = () => {
    this.pointer.locked = this.isPointerLocked()
    if (!this.pointer.locked) {
      this.pointer.shouldLock = false
    }
  }

  onScroll = e => {
    e.preventDefault()
    const delta = e.shiftKey ? e.deltaX : e.deltaY
    this.scroll.delta += delta
  }

  onContextMenu = e => {
    e.preventDefault()
  }

  onTouchStart = e => {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = {
        id: touch.identifier,
        position: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        prevPosition: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        delta: new THREE.Vector3(),
      }
      this.touches.set(info.id, info)
      for (const control of this.controls) {
        const consume = control.options.onTouch?.(info)
        if (consume) break
      }
    }
  }

  onTouchMove = e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = this.touches.get(touch.identifier)
      const currentX = touch.clientX
      const currentY = touch.clientY
      info.delta.x += currentX - info.prevPosition.x
      info.delta.y += currentY - info.prevPosition.y
      info.position.x = currentX
      info.position.y = currentY
      info.prevPosition.x = currentX
      info.prevPosition.y = currentY
    }
  }

  onTouchEnd = e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = this.touches.get(touch.identifier)
      for (const control of this.controls) {
        const consume = control.options.onTouchEnd?.(info)
        if (consume) break
      }
      this.touches.delete(touch.identifier)
    }
  }

  onResize = () => {
    this.screen.width = this.viewport.offsetWidth
    this.screen.height = this.viewport.offsetHeight
  }

  onBlur = () => {
    this.releaseAllButtons()
  }

  isInputFocused() {
    return document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
  }

  async copyEntity(entity) {
    try {
      // Ensure we have clipboard permissions
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not available');
      }

      // Get the blueprint data
      const blueprint = this.world.blueprints.get(entity.data.blueprint);
      if (!blueprint) throw new Error('Blueprint not found');

      // Convert entity data to JSON string with full URLs
      const clipboardData = {
        type: 'hyperfy-entity',
        data: {
          ...entity.data,
          blueprint: {
            id: blueprint.id,
            model: blueprint.model ? this.assetToFullUrl(blueprint.model) : null,
            script: blueprint.script ? this.assetToFullUrl(blueprint.script) : null,
            config: blueprint.config || {},
            preload: blueprint.preload || false,
          },
        },
      };
      
      // Convert to string with pretty formatting
      const jsonStr = JSON.stringify(clipboardData, null, 2);

      try {
        // Try using the clipboard API
        await navigator.clipboard.writeText(jsonStr);
      } catch (clipboardErr) {
        // Fallback to execCommand for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = jsonStr;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch (execErr) {
          document.body.removeChild(textarea);
          throw execErr;
        }
      }

      // Show success message
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: 'Object copied to clipboard',
        createdAt: moment().toISOString(),
      });

      // Store in local memory as fallback
      this.lastCopiedEntity = clipboardData;

    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: 'Failed to copy object',
        createdAt: moment().toISOString(),
      });
    }
  }

  async pasteEntity() {
    try {
      let clipboardData;
      
      try {
        // Try to get data from clipboard
        const text = await navigator.clipboard.readText();
        if (text) {
          clipboardData = JSON.parse(text);
        }
      } catch (clipboardErr) {
        console.warn('Could not access clipboard:', clipboardErr);
        // Fall back to last copied entity
        if (this.lastCopiedEntity) {
          clipboardData = this.lastCopiedEntity;
        }
      }

      if (!clipboardData || clipboardData.type !== 'hyperfy-entity' || !clipboardData.data) {
        throw new Error('No valid entity data found in clipboard');
      }

      // Rest of the paste logic remains the same
      const hit = this.world.stage.raycastPointer(this.pointer.position)[0];
      const position = hit ? hit.point.toArray() : [0, 0, 0];
      
      const newData = cloneDeep(clipboardData.data);
      newData.id = uuid();
      newData.position = position;
      newData.mover = this.world.network.id;
      newData.uploader = this.world.network.id;

      if (newData.blueprint && typeof newData.blueprint === 'object') {
        const blueprintData = newData.blueprint;
        const blueprint = {
          id: uuid(),
          version: 0,
          model: blueprintData.model ? this.fullUrlToAsset(blueprintData.model) : null,
          script: blueprintData.script ? this.fullUrlToAsset(blueprintData.script) : null,
          config: blueprintData.config || {},
          preload: blueprintData.preload || false,
        };

        this.world.blueprints.add(blueprint, true);
        newData.blueprint = blueprint.id;
        const app = this.world.entities.add(newData, true);

        // Handle asset uploads
        if (blueprint.model) {
          await this.uploadAsset(blueprintData.model, 'model', blueprint.model);
        }
        if (blueprint.script) {
          await this.uploadAsset(blueprintData.script, 'script', blueprint.script);
        }
        
        app.onUploaded();
        this.buildMode.selectedEntity = app;
      }
    } catch (err) {
      console.error('Failed to paste:', err);
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `Failed to paste object: ${err.message}`,
        createdAt: moment().toISOString(),
      });
    }
  }

  async uploadAsset(sourceUrl, type, assetUrl) {
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`Failed to fetch ${type}`)
    const blob = await response.blob()
    const file = new File([blob], assetUrl.split('/').pop(), { 
      type: type === 'model' ? 'model/gltf-binary' : 'application/javascript' 
    })
    
    this.world.loader.insert(type, assetUrl, file)
    await this.world.network.upload(file)
  }

  startTransform() {
    if (!this.buildMode.selectedEntity) return
    
    const entity = this.buildMode.selectedEntity
    this.buildMode.transform = {
      startPos: [...entity.data.position],
      startRot: [...entity.data.quaternion],
      startScale: entity.data.scale ? [...entity.data.scale] : [1, 1, 1],
      startPointer: new THREE.Vector2(this.pointer.position.x, this.pointer.position.y),
      plane: this.createTransformPlane(entity)
    }
  }

  updateTransform(delta) {
    if (!this.buildMode.selectedEntity || !this.buildMode.transform) return

    const entity = this.buildMode.selectedEntity
    const transform = this.buildMode.transform
    const mode = this.buildMode.transformMode

    // Create raycaster for transform operations
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2(
        (this.pointer.position.x / this.screen.width) * 2 - 1,
        -(this.pointer.position.y / this.screen.height) * 2 + 1
    )
    raycaster.setFromCamera(pointer, this.world.camera)

    const intersection = raycaster.ray.intersectPlane(transform.plane, new THREE.Vector3())
    if (!intersection) return

    switch (mode) {
      case 'translate':
        const newPos = intersection.toArray()
        if (this.buildMode.snapToGrid) {
          newPos[0] = Math.round(newPos[0] / this.buildMode.gridSize) * this.buildMode.gridSize
          newPos[1] = Math.round(newPos[1] / this.buildMode.gridSize) * this.buildMode.gridSize
          newPos[2] = Math.round(newPos[2] / this.buildMode.gridSize) * this.buildMode.gridSize
        }
        entity.modify({ position: newPos })
        break

      case 'rotate':
        const center = new THREE.Vector3(...transform.startPos)
        const angle = Math.atan2(
          intersection.x - center.x,
          intersection.z - center.z
        )
        const quaternion = new THREE.Quaternion()
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)
        entity.modify({ quaternion: quaternion.toArray() })
        break

      case 'scale':
        const startDist = new THREE.Vector3(...transform.startPos).distanceTo(
          new THREE.Vector3(transform.startPointer.x, transform.startPointer.y, 0)
        )
        const currentDist = new THREE.Vector3(...transform.startPos).distanceTo(
          new THREE.Vector3(this.pointer.position.x, this.pointer.position.y, 0)
        )
        const scale = currentDist / startDist
        const newScale = [scale, scale, scale]
        entity.modify({ scale: newScale })
        break
    }
  }

  createTransformPlane(entity) {
    const normal = new THREE.Vector3(0, 1, 0)
    const point = new THREE.Vector3(...entity.data.position)
    return new THREE.Plane(normal, -point.dot(normal))
  }

  cancelTransform() {
    if (!this.buildMode.selectedEntity || !this.buildMode.transform) return
    
    const entity = this.buildMode.selectedEntity
    const transform = this.buildMode.transform
    
    // Reset to original transform
    entity.modify({
      position: transform.startPos,
      quaternion: transform.startRot,
      scale: transform.startScale
    })
    
    this.buildMode.transformMode = null
    this.buildMode.transform = null
  }

  // Helper methods for URL conversion
  assetToFullUrl(assetUrl) {
    if (!assetUrl || !assetUrl.startsWith('asset://')) return assetUrl
    return `${window.location.origin}/assets/${assetUrl.replace('asset://', '')}`
  }

  fullUrlToAsset(fullUrl) {
    if (!fullUrl) return fullUrl
    const match = fullUrl.match(/\/assets\/(.+)$/)
    if (!match) return fullUrl
    return `asset://${match[1]}`
  }

  update(delta) {
    // Update hovered entity only in build mode
    if (this.buildMode.active) {
        const hits = this.world.stage.raycastPointer(this.pointer.position)
        let entity = null
        for (const hit of hits) {
            entity = hit.getEntity?.()
            if (entity && entity.isApp) break
        }
        this.buildMode.hoveredEntity = entity

        // Handle moving entities
        if (this.mmbDown) {
            const hit = this.world.stage.raycastPointer(this.pointer.position)[0]
            if (hit) {
                Object.values(this.world.entities.list).forEach(entity => {
                    if (entity.data.mover === this.world.network.id) {
                        entity.modify({ 
                            position: hit.point.toArray() 
                        })
                    }
                })
            }
        }

        // Handle transform operations if active
        if (this.buildMode.transformMode && this.buildMode.selectedEntity) {
            this.updateTransform(delta)
        }
    } else {
        // Clear build mode state when not active
        this.buildMode.hoveredEntity = null
        this.buildMode.selectedEntity = null
        this.buildMode.transformMode = null
    }
  }

  isPointerLocked() {
    return document.pointerLockElement === this.viewport
  }

  async initHyperFone() {
    if (!this.hyperFone) {
      this.hyperFone = new HyperFone()
      this.hyperFone.position.set(0, 2.5, 0)
      this.world.entities.player?.base.add(this.hyperFone)
      
      // Load and setup tablet model
      if (!this.tabletModel) {
        const player = this.world.entities.player
        if (player && player.avatar) {
          // Create tablet node
          const tablet = createNode({
            name: 'mesh',
            type: 'model',
            model: 'asset://tablet.glb',
            active: false
          })
          
          // Find the hand bone to attach to
          const handBone = player.avatar.raw.humanoid.getRawBoneNode('rightHand')
          if (handBone) {
            handBone.add(tablet)
            // Position and rotate relative to hand
            tablet.position.set(0, 0, 0)
            tablet.rotation.set(0, 0, 0)
            tablet.scale.set(1, 1, 1)
          }
          
          this.tabletModel = tablet
        }
      }
    }
  }

  toggleHyperFone() {
    this.initHyperFone()
    this.hyperFoneActive = !this.hyperFoneActive
    this.hyperFone.active = this.hyperFoneActive

    // Toggle tablet visibility
    if (this.tabletModel) {
      this.tabletModel.active = this.hyperFoneActive
    }

    // Set player emote - now handled by PlayerLocal update
    const player = this.world.entities.player
    if (player) {
      player.setEmote(this.hyperFoneActive ? 'asset://emote-phone.glb' : 'asset://emote-idle.glb')
    }
  }

  // Add cleanup method
  cleanup() {
    if (this.tabletModel) {
      this.tabletModel.deactivate()
      this.tabletModel = null
    }
    if (this.hyperFone) {
      this.hyperFone.deactivate()
      this.hyperFone = null
    }
  }

  // Add this new method to handle VRM swapping
  async handleVrmSwap(targetEntity, blueprint) {
    try {
      // Get current player data
      const player = this.world.entities.player
      const prevUser = player.data.user
      const newUser = cloneDeep(prevUser)

      // Get the target VRM's position and rotation
      const targetPosition = [...targetEntity.data.position]
      const targetQuaternion = [...targetEntity.data.quaternion]

      // Only create old avatar entity if we have a previous VRM
      if (prevUser.avatar && prevUser.avatar.endsWith('.vrm')) {
        // Create blueprint for the old avatar
        const oldBlueprint = {
          id: uuid(),
          version: 0,
          model: prevUser.avatar,
          script: null,
          config: {},
          preload: false
        }
        
        // Register the blueprint
        this.world.blueprints.add(oldBlueprint, true)

        // Create entity from old avatar
        const oldAvatarData = {
          id: uuid(),
          type: 'app',
          blueprint: oldBlueprint.id,
          position: targetPosition,
          quaternion: targetQuaternion,
          mover: null,
          uploader: null,
          state: {}
        }

        // Add the old avatar as static model
        this.world.entities.add(oldAvatarData, true)

        // Show transfer effect
        this.world.chat.add({
          id: uuid(),
          from: null,
          fromId: null,
          body: '* Transferring consciousness to new avatar *',
          createdAt: moment().toISOString(),
        })
      }

      // Update to new avatar
      newUser.avatar = blueprint.model

      // Update locally
      player.modify({ 
        user: newUser
      })

      // Sync with network
      this.world.network.send('entityModified', {
        id: player.data.id,
        user: newUser
      })

      // Remove the target VRM
      targetEntity.destroy(true)

      // Show success message
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: '* Consciousness transfer complete *',
        createdAt: moment().toISOString(),
      })

    } catch (err) {
      console.error('Failed to transfer to new avatar:', err)
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: '* Consciousness transfer failed *',
        createdAt: moment().toISOString(),
      })
    }
  }
}
