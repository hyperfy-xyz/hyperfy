import * as THREE from '../extras/three'
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAPreset,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SelectiveBloomEffect,
  BlendFunction,
  Selection,
} from 'postprocessing'

import { System } from './System'

const v1 = new THREE.Vector3()

let renderer
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      // logarithmicDepthBuffer: true,
      // reverseDepthBuffer: true,
    })
  }
  return renderer
}

/**
 * Graphics System
 *
 * - Runs on the client
 * - Supports renderer, shadows, postprocessing, etc
 * - Renders to the viewport
 *
 */
export class ClientGraphics extends System {
  constructor(world) {
    super(world)
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.width = this.viewport.offsetWidth
    this.height = this.viewport.offsetHeight
    this.aspect = this.width / this.height
    this.renderer = getRenderer()
    this.renderer.setSize(this.width, this.height)
    this.renderer.setClearColor(0xffffff, 0)
    this.renderer.setPixelRatio(this.world.prefs.dpr)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.xr.enabled = true
    this.renderer.xr.setReferenceSpaceType('local-floor')
    this.renderer.xr.setFoveation(1)
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()
    THREE.Texture.DEFAULT_ANISOTROPY = this.maxAnisotropy
    this.usePostprocessing = this.world.prefs.postprocessing
    const context = this.renderer.getContext()
    const maxMultisampling = context.getParameter(context.MAX_SAMPLES)
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: Math.min(8, maxMultisampling),
    })
    this.renderPass = new RenderPass(this.world.stage.scene, this.world.camera)
    this.composer.addPass(this.renderPass)
    this.bloom = new SelectiveBloomEffect(this.world.stage.scene, this.world.camera, {
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      luminanceThreshold: 1,
      luminanceSmoothing: 0.3,
      intensity: 0.5,
      radius: 0.8,
    })
    this.bloom.inverted = true
    this.bloom.selection.layer = 14 // NO_BLOOM layer
    this.bloomPass = new EffectPass(this.world.camera, this.bloom)
    this.bloomPass.enabled = this.world.prefs.bloom
    this.composer.addPass(this.bloomPass)
    this.effectPass = new EffectPass(
      this.world.camera,
      new SMAAEffect({
        preset: SMAAPreset.ULTRA,
      }),
      new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC,
      })
    )
    this.composer.addPass(this.effectPass)
    this.world.prefs.on('change', this.onPrefsChange)
    this.resizer = new ResizeObserver(() => {
      this.resize(this.viewport.offsetWidth, this.viewport.offsetHeight)
    })
    this.viewport.appendChild(this.renderer.domElement)
    this.resizer.observe(this.viewport)

    this.xrWidth = null
    this.xrHeight = null
    this.xrDimensionsNeeded = false
  }

  start() {
    this.world.on('xrSession', this.onXRSession)
  }

  resize(width, height) {
    this.width = width
    this.height = height
    this.aspect = this.width / this.height
    this.world.camera.aspect = this.aspect
    this.world.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
    this.composer.setSize(this.width, this.height)
    this.emit('resize')
    this.render()
  }

  render() {
    if (this.renderer.xr.isPresenting || !this.usePostprocessing) {
      this.renderer.render(this.world.stage.scene, this.world.camera)
    } else {
      this.composer.render()
    }
    if (this.xrDimensionsNeeded) {
      this.checkXRDimensions()
    }
  }

  commit() {
    this.render()
  }

  preTick() {
    // calc world to screen factor
    const camera = this.world.camera
    const fovRadians = camera.fov * (Math.PI / 180)
    const rendererHeight = this.xrHeight || this.height
    this.worldToScreenFactor = (Math.tan(fovRadians / 2) * 2) / rendererHeight
  }

  scaleUI(object3d, heightPx, pxToMeters) {
    const camera = this.world.camera
    const vFov = (camera.fov * Math.PI) / 180 // Convert vertical FOV from degrees to radians
    const screenHeight = this.height // Get the actual screen height in pixels
    const distance = object3d.position.distanceTo(v1.setFromMatrixPosition(camera.matrixWorld)) // Calculate distance from camera to object
    const heightAtDistance = 2 * Math.tan(vFov / 2) * distance // Calculate the visible height at the distance of the object
    const worldUnitsPerPixel = heightAtDistance / screenHeight // Calculate world units per screen pixel vertically
    const desiredWorldHeight = heightPx * worldUnitsPerPixel // Desired world height for 'height' pixels
    const scale = desiredWorldHeight / (heightPx * pxToMeters) // Calculate the scaling factor based on the original height in meters
    object3d.scale.setScalar(scale)
  }

  onPrefsChange = changes => {
    // pixel ratio
    if (changes.dpr) {
      this.renderer.setPixelRatio(changes.dpr.value)
      this.resize(this.width, this.height)
    }
    // postprocessing
    if (changes.postprocessing) {
      this.usePostprocessing = changes.postprocessing.value
    }
    // bloom
    if (changes.bloom) {
      this.bloomPass.enabled = changes.bloom.value
    }
  }

  onXRSession = session => {
    if (session) {
      this.xrSession = session
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = true
    } else {
      this.xrSession = null
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = false
    }
  }

  checkXRDimensions = () => {
    // Get the current XR reference space
    const referenceSpace = this.renderer.xr.getReferenceSpace()
    // Get frame information
    const frame = this.renderer.xr.getFrame()
    if (frame && referenceSpace) {
      // Get view information which contains projection matrices
      const views = frame.getViewerPose(referenceSpace)?.views
      if (views && views.length > 0) {
        // Use the first view's projection matrix
        const projectionMatrix = views[0].projectionMatrix
        // Extract the relevant factors from the projection matrix
        // This is a simplified approach
        const fovFactor = projectionMatrix[5] // Approximation of FOV scale
        // You might need to consider the XR display's physical properties
        // which can be accessed via session.renderState
        const renderState = this.xrSession.renderState
        const baseLayer = renderState.baseLayer
        if (baseLayer) {
          // Get the actual resolution being used for rendering
          this.xrWidth = baseLayer.framebufferWidth
          this.xrHeight = baseLayer.framebufferHeight
          this.xrDimensionsNeeded = false
          console.log({ xrWidth: this.xrWidth, xrHeight: this.xrHeight })
        }
      }
    }
  }

  destroy() {
    this.resizer.disconnect()
  }
}
