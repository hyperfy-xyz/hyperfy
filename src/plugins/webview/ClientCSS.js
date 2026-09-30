import * as THREE from '@hyperfy/core/extras/three'
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'

import { System } from '@hyperfy/core/systems/System'

/**
 * ClientCSS System
 *
 * - Runs on the client
 * - Manages CSS3D rendering for WebView nodes (iframes in 3D space)
 * - Renders behind the WebGL canvas to create the cutout effect
 *
 */
export class ClientCSS extends System {
  constructor(world) {
    super(world)
    this.scene = new THREE.Scene()
    this.renderer = null
    this.elem = null
  }

  async init({ cssLayer }) {
    if (!cssLayer) return
    this.elem = cssLayer
    this.renderer = new CSS3DRenderer({ element: this.elem })
  }

  start() {
    if (!this.elem) return
    this.world.graphics.on('resize', this.onResize)
    this.world.graphics.on('render', this.onRender)
    this.resize(this.world.graphics.width, this.world.graphics.height)
  }

  onResize = () => {
    this.resize(this.world.graphics.width, this.world.graphics.height)
  }

  onRender = () => {
    this.render()
  }

  resize(width, height) {
    if (!this.renderer) return
    this.renderer.setSize(width, height)
  }

  add(object3d) {
    this.scene.add(object3d)
  }

  remove(object3d) {
    this.scene.remove(object3d)
  }

  render() {
    if (!this.renderer) return
    this.renderer.render(this.scene, this.world.camera)
  }

  destroy() {
    if (this.elem) {
      this.world.graphics.off('resize', this.onResize)
      this.world.graphics.off('render', this.onRender)
    }
  }
}
