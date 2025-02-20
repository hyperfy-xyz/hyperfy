import { getRef } from '../nodes/Node'
import * as THREE from './three'

export function createPlayerProxy(player) {
  const world = player.world
  const position = new THREE.Vector3()
  const rotation = new THREE.Euler()
  const quaternion = new THREE.Quaternion()
  return {
    get networkId() {
      return player.data.owner
    },
    get entityId() {
      return player.data.id
    },
    get id() {
      return player.data.user.id
    },
    get name() {
      return player.data.user.name
    },
    get position() {
      return position.copy(player.base.position)
    },
    get rotation() {
      return rotation.copy(player.base.rotation)
    },
    get quaternion() {
      return quaternion.copy(player.base.quaternion)
    },
    teleport(position, rotationY) {
      if (player.data.owner === world.network.id) {
        // if player is local we can set directly
        world.network.enqueue('onPlayerTeleport', { position: position.toArray(), rotationY })
      } else if (world.network.isClient) {
        // if we're a client we need to notify server
        world.network.send('playerTeleport', { networkId: player.data.owner, position: position.toArray(), rotationY })
      } else {
        // if we're the server we need to notify the player
        world.network.sendTo(player.data.owner, 'playerTeleport', { position: position.toArray(), rotationY })
      }
    },
    hasEffect() {
      return !!player.effect
    },
    setEffect(effect) {
      if (effect?.anchor) {
        effect.anchorId = effect.anchor.anchorId
        delete effect.anchor
      }
      if (effect?.cancellable) {
        delete effect.freeze // not applicable
      }
      if (player.data.owner === world.network.id) {
        // if player is local we can set directly
        world.network.enqueue('onPlayerEffect', { effect })
      } else if (world.network.isClient) {
        // if we're a client we need to notify server
        world.network.send('playerEffect', { networkId: player.data.owner, effect })
      } else {
        // if we're the server we need to notify the player
        world.network.sendTo(player.data.owner, 'playerEffect', { effect })
      }
    },
    getBoneTransform(boneName) {
      return player.avatar?.getBoneTransform?.(boneName)
    },
  }
}
