import { System } from './System'
import * as THREE from '../extras/three'

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
    this.yOrientation = new THREE.Quaternion()
    this.supportsVR = false
    this.supportsAR = false
  }

  async init() {
    this.supportsVR = await navigator.xr.isSessionSupported('immersive-vr')
    this.supportsAR = await navigator.xr.isSessionSupported('immersive-ar')
  }

  lateUpdate() {
    if (!this.session) return
    const rotation = e1.setFromQuaternion(this.camera.quaternion)
    this.yOrientation.setFromAxisAngle(UP, rotation.y)
  }

  async enter() {
    const session = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
    })
    this.world.entities.player.avatar.unmount()
    this.world.graphics.renderer.xr.setSession(session)
    this.world.nametags.setOrientation(this.yOrientation)
    session.addEventListener('end', this.onSessionEnd)
    this.session = session
    this.camera = this.world.graphics.renderer.xr.getCamera()
    this.world.emit('xrSession', session)
  }

  onSessionEnd = () => {
    this.world.entities.player.avatar.mount()
    this.world.nametags.setOrientation(this.world.rig.quaternion)
    this.world.camera.position.set(0, 0, 0)
    this.world.camera.rotation.set(0, 0, 0)
    this.session = null
    this.camera = null
    this.world.emit('xrSession', null)
  }
}
