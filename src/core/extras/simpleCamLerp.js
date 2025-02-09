import * as THREE from './three'
import { Layers } from './Layers'

const BACKWARD = new THREE.Vector3(0, 0, 1)

const v1 = new THREE.Vector3()

let sweepGeometry

const smoothing = 20
const MAX_CAM_DISTANCE = 0.4

export function simpleCamLerp(world, camera, target, delta) {
  // interpolate camera rotation
  const alpha = 1.0 - Math.exp(-smoothing * delta)
  camera.quaternion.slerp(target.quaternion, alpha)

  // interpolate camera position
  // camera.position.lerp(target.position, alpha)
  // const distToTarget = camera.position.distanceTo(target.position)
  // if (distToTarget > MAX_CAM_DISTANCE) {
  //   // Pull the camera closer so it's exactly MAX_CAM_DISTANCE away
  //   const direction = v1.copy(camera.position).sub(target.position).normalize()
  //   camera.position.copy(target.position).addScaledVector(direction, MAX_CAM_DISTANCE)
  // }

  // EXPERIMENTAL: snap camera position instead
  camera.position.copy(target.position)

  // raycast backward to check for zoom collision
  if (!sweepGeometry) sweepGeometry = new PHYSX.PxSphereGeometry(0.2)
  const origin = camera.position
  const direction = v1.copy(BACKWARD).applyQuaternion(camera.quaternion)
  const layerMask = Layers.camera.mask // hit everything the camera should hit
  const hit = world.physics.sweep(sweepGeometry, origin, direction, 200, layerMask)

  // lerp to target zoom distance
  let distance = target.zoom
  // but if we hit something snap it in so we don't end up in the wall
  if (hit && hit.distance < distance) {
    camera.zoom = hit.distance
  } else {
    const alpha = 6 * delta
    camera.zoom += (distance - camera.zoom) * alpha // regular lerp
  }
}
