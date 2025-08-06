import { isBoolean } from 'lodash-es'
import { ControlPriorities } from '../extras/ControlPriorities'
import { System } from './System'
import { thickness } from 'three/src/nodes/TSL.js'

const appPanes = ['app', 'script', 'nodes', 'meta']

export class ClientUI extends System {
  constructor(world) {
    super(world)
    this.state = {
      visible: true,
      active: false,
      app: null,
      pane: null,
      reticleSuppressors: 0,
      reticleImage: null,
      reticleScale: 1,
    }
    this.reticleStack = [] // Array of { control, url, scale, timestamp }
    this.lastAppPane = 'app'
    this.control = null
  }

  start() {
    this.control = this.world.controls.bind({ priority: ControlPriorities.CORE_UI })
  }

  update() {
    if (this.control.escape.pressed) {
      if (this.state.pane) {
        this.state.pane = null
        this.broadcast()
      } else if (this.state.app) {
        this.state.app = null
        this.broadcast()
      }
    }
    if (
      this.control.keyZ.pressed &&
      !this.control.metaLeft.down &&
      !this.control.controlLeft.down &&
      !this.control.shiftLeft.down
    ) {
      this.state.visible = !this.state.visible
      this.broadcast()
    }
    if (this.control.pointer.locked && this.state.active) {
      this.state.active = false
      this.broadcast()
    }
    if (!this.control.pointer.locked && !this.state.active) {
      this.state.active = true
      this.broadcast()
    }
  }

  togglePane(pane) {
    if (pane === null || this.state.pane === pane) {
      this.state.pane = null
    } else {
      // if (appPanes.includes(this.state.pane) && !appPanes.includes(pane)) {
      //   this.state.app = null
      // }
      this.state.pane = pane
      if (appPanes.includes(pane)) {
        this.lastAppPane = pane
      }
    }
    this.broadcast()
  }

  toggleVisible(value) {
    value = isBoolean(value) ? value : !this.state.visible
    if (this.state.visible === value) return
    this.state.visible = value
    this.broadcast()
  }

  setApp(app) {
    this.state.app = app
    this.state.pane = app ? this.lastAppPane : null
    this.broadcast()
  }

  suppressReticle() {
    this.state.reticleSuppressors++
    let released
    this.broadcast()
    return () => {
      if (released) return
      this.state.reticleSuppressors--
      this.broadcast()
      released = true
    }
  }

  // Control-based reticle management
  setControlReticle(control, url, scale) {
    // Validate scale parameter - only accept numbers
    let validScale = 1
    if (scale !== undefined && typeof scale === 'number' && scale > 0) {
      validScale = scale
    } else if (scale !== undefined) {
      console.warn(`Invalid reticle scale value: ${scale}. Scale must be a positive number. Using default scale of 1.`)
    }
    
    // Remove any existing entry for this control
    this.reticleStack = this.reticleStack.filter(entry => entry.control !== control)
    
    // Add new entry if url is provided
    if (url !== null && url !== undefined) {
      const resolvedUrl = url ? this.world.resolveURL(url) : null
      this.reticleStack.push({
        control,
        url: resolvedUrl,
        scale: validScale,
        timestamp: Date.now()
      })
    }
    
    // Update the active reticle (most recent wins)
    this.updateActiveReticle()
  }
  
  removeControlReticle(control) {
    this.reticleStack = this.reticleStack.filter(entry => entry.control !== control)
    this.updateActiveReticle()
  }
  
  updateActiveReticle() {
    if (this.reticleStack.length === 0) {
      // Reset to default
      this.state.reticleImage = null
      this.state.reticleScale = 1
    } else {
      // Use the most recent reticle
      const mostRecent = this.reticleStack[this.reticleStack.length - 1]
      this.state.reticleImage = mostRecent.url
      this.state.reticleScale = mostRecent.scale
    }
    this.broadcast()
  }

  confirm(options) {
    const promise = new Promise(resolve => {
      options.confirm = () => {
        this.world.emit('confirm', null)
        resolve(true)
      }
      options.cancel = () => {
        this.world.emit('confirm', null)
        resolve(false)
      }
    })
    this.world.emit('confirm', options)
    return promise
  }

  broadcast() {
    this.world.emit('ui', { ...this.state })
  }

  destroy() {
    this.control?.release()
    this.control = null
  }
}
