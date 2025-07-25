import { System } from './System'
import * as THREE from '../extras/three'
import { XRControllerModelFactory } from 'three/addons'

const UP = new THREE.Vector3(0, 1, 0)

const v1 = new THREE.Vector3()
const e1 = new THREE.Euler(0, 0, 0, 'YXZ')

/**
 * XR System
 *
 * - Runs on the client.
 * - Keeps track of XR sessions
 *
 */
export class XR extends System {
  constructor(world) {
    super(world)
    this.session = null
    this.camera = null
    this.controller1Model = null
    this.controller2Model = null
    this.supportsVR = false
    this.supportsAR = false
    this.controllerModelFactory = new XRControllerModelFactory()
  }

  async init() {
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
    this.world.graphics.renderer.xr.setSession(session)
    session.addEventListener('end', this.onSessionEnd)
    this.session = session
    this.camera = this.world.graphics.renderer.xr.getCamera()
    this.world.emit('xrSession', session)

    this.controller1Model = this.world.graphics.renderer.xr.getControllerGrip(0)
    this.controller1Model.add(this.controllerModelFactory.createControllerModel(this.controller1Model))
    this.world.rig.add(this.controller1Model)

    this.controller2Model = this.world.graphics.renderer.xr.getControllerGrip(1)
    this.controller2Model.add(this.controllerModelFactory.createControllerModel(this.controller2Model))
    this.world.rig.add(this.controller2Model)
  }

  onSessionEnd = () => {
    this.world.camera.position.set(0, 0, 0)
    this.world.camera.rotation.set(0, 0, 0)
    this.world.rig.remove(this.controller1Model)
    this.world.rig.remove(this.controller2Model)
    this.session = null
    this.camera = null
    this.controller1Model = null
    this.controller2Model = null
    this.world.emit('xrSession', null)
  }
}
