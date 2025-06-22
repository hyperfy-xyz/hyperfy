import * as THREE from '../extras/three'
import { System } from './System'

import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'

/**
 * XR System
 *
 * - Runs on the client.
 * - Keeps track of XR sessions
 *
 */
export class XR extends System {
  session: XRSession | null
  camera: THREE.Camera | null
  controller1Model: THREE.Object3D | null
  controller2Model: THREE.Object3D | null
  supportsVR: boolean
  supportsAR: boolean
  controllerModelFactory: XRControllerModelFactory

  constructor(world: any) {
    super(world)
    this.session = null
    this.camera = null
    this.controller1Model = null
    this.controller2Model = null
    this.supportsVR = false
    this.supportsAR = false
    this.controllerModelFactory = new XRControllerModelFactory()
  }

  override async init() {
    if (typeof navigator !== 'undefined' && navigator.xr) {
      this.supportsVR = await navigator.xr.isSessionSupported?.('immersive-vr')
      this.supportsAR = await navigator.xr.isSessionSupported?.('immersive-ar')
    } else {
      this.supportsVR = false
      this.supportsAR = false
    }
  }

  async enter() {
    if (typeof navigator === 'undefined' || !navigator.xr) {
      console.warn('XR.enter() called in an environment without navigator.xr support.')
      return
    }
    const session = await navigator.xr.requestSession?.('immersive-vr', {
      requiredFeatures: ['local-floor'],
    })
    try {
      session.updateTargetFrameRate(72)
    } catch (err) {
      console.error(err)
      console.error('xr session.updateTargetFrameRate(72) failed')
    }
    // Get the local player
    const localPlayer = this.world.entities.getLocalPlayer()
    if (localPlayer?.avatar) {
      localPlayer.avatar.unmount()
    }
    if (this.world.graphics?.renderer) {
      this.world.graphics.renderer.xr.setSession(session)
      this.camera = this.world.graphics.renderer.xr.getCamera()
      
      const grip1 = this.world.graphics.renderer.xr.getControllerGrip(0)
      if (grip1) {
        this.controller1Model = grip1 as THREE.Object3D
        const model1 = this.controllerModelFactory.createControllerModel(grip1 as any)
        if (model1) {
          this.controller1Model.add(model1)
        }
        this.world.rig.add(this.controller1Model)
      }

      const grip2 = this.world.graphics.renderer.xr.getControllerGrip(1)
      if (grip2) {
        this.controller2Model = grip2 as THREE.Object3D
        const model2 = this.controllerModelFactory.createControllerModel(grip2 as any)
        if (model2) {
          this.controller2Model.add(model2)
        }
        this.world.rig.add(this.controller2Model)
      }
    }
    session.addEventListener('end', this.onSessionEnd)
    this.session = session
    this.world.emit?.('xrSession', session)
  }

  onSessionEnd = () => {
    // Get the local player
    const localPlayer = this.world.entities.getLocalPlayer()
    if (localPlayer?.avatar) {
      localPlayer.avatar.mount()
    }
    this.world.camera.position.set(0, 0, 0)
    this.world.camera.rotation.set(0, 0, 0)
    this.world.rig.remove(this.controller1Model!)
    this.world.rig.remove(this.controller2Model!)
    this.session = null
    this.camera = null
    this.controller1Model = null
    this.controller2Model = null
    this.world.emit?.('xrSession', null)
  }
}
