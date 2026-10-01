import { isBoolean, isNumber, isString } from 'lodash-es'
import * as THREE from '@hyperfy/core/extras/three'
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'

import { Node } from '@hyperfy/core/nodes/Node'

const defaults = {
  src: null,
  width: 1,
  height: 1,
  factor: 100,
  doubleside: false,
  space: 'world',
}

const v1 = new THREE.Vector3()

export class WebView extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'webview'

    this.src = data.src
    this.width = data.width
    this.height = data.height
    this.factor = data.factor
    this.doubleside = data.doubleside
    this.space = data.space
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._src = source._src
    this._width = source._width
    this._height = source._height
    this._factor = source._factor
    this._doubleside = source._doubleside
    this._space = source._space
    return this
  }

  mount() {
    this.build()
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.build()
      return
    }
    if (didMove) {
      if (this.mesh) {
        this.matrixWorld.decompose(this.mesh.position, this.mesh.quaternion, this.mesh.scale)
        this.matrixWorld.decompose(this.objectCSS.position, this.objectCSS.quaternion, this.objectCSS.scale)
      }
      if (this.sItem) {
        this.ctx.world.stage.octree.move(this.sItem)
      }
    }
  }

  unmount() {
    this.unbuild()
  }

  build() {
    this.needsRebuild = false
    if (this.ctx.world.network.isServer) return
    this.unbuild()

    if (this._space === 'screen') {
      this.buildScreen()
    } else {
      this.buildWorld()
    }
  }

  buildWorld() {
    const hasContent = this._src

    // Create the black mesh (cutout)
    const geometry = new THREE.PlaneGeometry(this._width, this._height)
    const material = new THREE.MeshBasicMaterial({
      opacity: 0,
      color: new THREE.Color('black'),
      blending: hasContent ? THREE.NoBlending : THREE.NormalBlending,
      side: this._doubleside ? THREE.DoubleSide : THREE.FrontSide,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.matrixWorld.decompose(this.mesh.position, this.mesh.quaternion, this.mesh.scale)
    this.ctx.world.stage.scene.add(this.mesh)

    // Add to octree for raycasting
    this.sItem = {
      matrix: this.matrixWorld,
      geometry,
      material,
      getEntity: () => this.ctx.entity,
      node: this,
    }
    this.ctx.world.stage.octree.insert(this.sItem)

    // Create the CSS3D iframe (only if we have content)
    if (hasContent) {
      const widthPx = `${this._width * this._factor}px`
      const heightPx = `${this._height * this._factor}px`

      // Container
      const container = document.createElement('div')
      container.style.width = widthPx
      container.style.height = heightPx

      // Inner wrapper (for mouse events)
      const inner = document.createElement('div')
      inner.style.width = widthPx
      inner.style.height = heightPx
      inner.style.backgroundColor = '#000'

      // Iframe
      const iframe = document.createElement('iframe')
      iframe.frameBorder = '0'
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      iframe.allowFullscreen = true
      iframe.style.width = widthPx
      iframe.style.height = heightPx
      iframe.style.border = '0px'
      iframe.style.pointerEvents = 'none'
      iframe.src = this._src

      container.appendChild(inner)
      inner.appendChild(iframe)

      // Create CSS3DObject
      this.objectCSS = new CSS3DObject(container)
      this.objectCSS.target = this.mesh // important: the mesh to follow
      this.matrixWorld.decompose(this.objectCSS.position, this.objectCSS.quaternion, this.objectCSS.scale)
      this.objectCSS.scale.multiplyScalar(1 / this._factor)

      // Store references
      this.iframe = iframe
      this.inner = inner

      // IFrame Pointer Events Handling
      // Chrome has a bug where iframe receiving pointer-events breaks drag-and-drop.
      // To fix: only enable pointer-events when mouse enters the iframe wrapper.
      // For non-desktop, just enable pointer-events always.

      // Interaction Stabilization
      // When standing still, camera moves slightly with head idle animation.
      // This movement causes CSS3DRenderer to constantly move iframes slightly,
      // but browsers don't like this resulting in some click events not registering.
      // To solve: stop rendering CSS3D when interacting with any iframe.

      const isDesktop =
        !this.ctx.world.network.isServer &&
        this.ctx.world.controls &&
        !/iPhone|iPad|iPod|Android/i.test(globalThis.navigator?.userAgent || '')

      if (!isDesktop) {
        iframe.style.pointerEvents = 'auto'
      }

      inner.addEventListener('mouseenter', () => {
        if (isDesktop) {
          this.objectCSS.interacting = true
          iframe.style.pointerEvents = 'auto'
        }
      })

      inner.addEventListener('mouseleave', () => {
        if (isDesktop) {
          this.objectCSS.interacting = false
          iframe.style.pointerEvents = 'none'
        }
      })

      // Add to CSS system
      this.ctx.world.css?.add(this.objectCSS)
    }
  }

  buildScreen() {
    const hasContent = this._src
    if (!hasContent) return

    // For screen space, width/height are in pixels
    const widthPx = this._width
    const heightPx = this._height

    // Container
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.width = `${widthPx}px`
    container.style.height = `${heightPx}px`
    container.style.pointerEvents = 'auto'

    // Position using percentage + transform offset
    // position.x/y are percentages (0-1), position.z is z-index
    // Use transform to offset by element size for proper corner positioning
    container.style.left = `${this.position.x * 100}%`
    container.style.top = `${this.position.y * 100}%`
    container.style.transform = `translate(-${this.position.x * 100}%, -${this.position.y * 100}%)`
    container.style.zIndex = String(Math.floor(this.position.z || 0))

    // Iframe
    const iframe = document.createElement('iframe')
    iframe.frameBorder = '0'
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    iframe.allowFullscreen = true
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = '0px'
    iframe.src = this._src

    container.appendChild(iframe)

    // Store references
    this.container = container
    this.iframe = iframe

    // Add to UI container
    if (this.ctx.world.pointer?.ui) {
      this.ctx.world.pointer.ui.prepend(container)
    }
  }

  unbuild() {
    // World space cleanup
    if (this.mesh) {
      this.ctx.world.stage.scene.remove(this.mesh)
      this.mesh.geometry.dispose()
      this.mesh.material.dispose()
      this.mesh = null
    }
    if (this.sItem) {
      this.ctx.world.stage.octree.remove(this.sItem)
      this.sItem = null
    }
    if (this.objectCSS) {
      this.ctx.world.css?.remove(this.objectCSS)
      this.objectCSS = null
    }
    // Screen space cleanup
    if (this.container) {
      this.container.remove()
      this.container = null
    }
    this.iframe = null
    this.inner = null
  }

  // Pointer down handler - unlocks pointer so user can interact with iframe
  onPointerDown(e) {
    if (this._onPointerDown) {
      this._onPointerDown(e)
      if (e.defaultPrevented) return
    }
    // Don't unlock pointer in build mode - user needs to manipulate the node
    if (this.ctx.world.builder?.enabled) return
    // Unlock pointer so user can interact with the iframe
    if (this.ctx.world.controls?.pointer?.locked) {
      this.ctx.world.controls.unlockPointer()
    }
  }

  get src() {
    return this._src
  }

  set src(value = defaults.src) {
    if (value !== null && !isString(value)) {
      throw new Error('[webview] src not null or string')
    }
    if (this._src === value) return
    this._src = value
    this.needsRebuild = true
    this.setDirty()
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (!isNumber(value)) {
      throw new Error('[webview] width not a number')
    }
    if (this._width === value) return
    this._width = value
    this.needsRebuild = true
    this.setDirty()
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (!isNumber(value)) {
      throw new Error('[webview] height not a number')
    }
    if (this._height === value) return
    this._height = value
    this.needsRebuild = true
    this.setDirty()
  }

  get factor() {
    return this._factor
  }

  set factor(value = defaults.factor) {
    if (!isNumber(value)) {
      throw new Error('[webview] factor not a number')
    }
    if (this._factor === value) return
    this._factor = value
    this.needsRebuild = true
    this.setDirty()
  }

  get doubleside() {
    return this._doubleside
  }

  set doubleside(value = defaults.doubleside) {
    if (!isBoolean(value)) {
      throw new Error('[webview] doubleside not a boolean')
    }
    if (this._doubleside === value) return
    this._doubleside = value
    this.needsRebuild = true
    this.setDirty()
  }

  get space() {
    return this._space
  }

  set space(value = defaults.space) {
    if (value !== 'world' && value !== 'screen') {
      throw new Error('[webview] space must be "world" or "screen"')
    }
    if (this._space === value) return
    this._space = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
        },
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get factor() {
          return self.factor
        },
        set factor(value) {
          self.factor = value
        },
        get doubleside() {
          return self.doubleside
        },
        set doubleside(value) {
          self.doubleside = value
        },
        get space() {
          return self.space
        },
        set space(value) {
          self.space = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy()))
      this.proxy = proxy
    }
    return this.proxy
  }
}
