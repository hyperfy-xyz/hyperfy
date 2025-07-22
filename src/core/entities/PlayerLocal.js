import { Entity } from './Entity'
import { clamp, hasRole } from '../utils'
import * as THREE from '../extras/three'
import { Layers } from '../extras/Layers'
import { DEG2RAD, RAD2DEG } from '../extras/general'
import { createNode } from '../extras/createNode'
import { bindRotations } from '../extras/bindRotations'
import { simpleCamLerp } from '../extras/simpleCamLerp'
import { Emotes } from '../extras/playerEmotes'
import { ControlPriorities } from '../extras/ControlPriorities'
import { isNumber } from 'lodash-es'

const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
const FORWARD = new THREE.Vector3(0, 0, -1)
const BACKWARD = new THREE.Vector3(0, 0, 1)
const SCALE_IDENTITY = new THREE.Vector3(1, 1, 1)
const POINTER_LOOK_SPEED = 0.1
const PAN_LOOK_SPEED = 0.4
const ZOOM_SPEED = 2
const MIN_ZOOM = 0
const MAX_ZOOM = 8
const STICK_OUTER_RADIUS = 50
const STICK_INNER_RADIUS = 25
const DEFAULT_CAM_HEIGHT = 1.2

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const v3 = new THREE.Vector3()
const v4 = new THREE.Vector3()
const v5 = new THREE.Vector3()
const v6 = new THREE.Vector3()
const e1 = new THREE.Euler(0, 0, 0, 'YXZ')
const q1 = new THREE.Quaternion()
const q2 = new THREE.Quaternion()
const q3 = new THREE.Quaternion()
const q4 = new THREE.Quaternion()
const m1 = new THREE.Matrix4()
const m2 = new THREE.Matrix4()
const m3 = new THREE.Matrix4()

const gazeTiltAngle = 10 * DEG2RAD
const gazeTiltAxis = new THREE.Vector3(1, 0, 0) // X-axis for pitch

// TODO: de-dup createVRMFactory.js has a copy
const Modes = {
  IDLE: 0,
  WALK: 1,
  RUN: 2,
  JUMP: 3,
  FALL: 4,
  FLY: 5,
  TALK: 6,
}

export class PlayerLocal extends Entity {
  constructor(world, data, local) {
    super(world, data, local)
    this.isPlayer = true
    this.init()
  }

  async init() {
    this.mass = 1
    this.gravity = 20
    this.effectiveGravity = this.gravity * this.mass
    this.jumpHeight = 1.5

    this.capsuleRadius = 0.3
    this.capsuleHeight = 1.6

    this.grounded = false
    this.groundAngle = 0
    this.groundNormal = new THREE.Vector3().copy(UP)
    this.groundSweepRadius = this.capsuleRadius - 0.01 // slighty smaller than player
    this.groundSweepGeometry = new PHYSX.PxSphereGeometry(this.groundSweepRadius)

    this.pushForce = null
    this.pushForceInit = false

    this.slipping = false

    this.jumped = false
    this.jumping = false
    this.justLeftGround = false

    this.fallTimer = 0
    this.falling = false

    this.moveDir = new THREE.Vector3()
    this.moving = false

    this.firstPerson = false

    this.lastJumpAt = 0
    this.flying = false
    this.flyForce = 100
    this.flyDrag = 300
    this.flyDir = new THREE.Vector3()

    this.platform = {
      actor: null,
      prevTransform: new THREE.Matrix4(),
    }

    this.mode = Modes.IDLE
    this.axis = new THREE.Vector3()
    this.gaze = new THREE.Vector3()

    this.speaking = false

    this.lastSendAt = 0

    this.base = createNode('group')
    this.base.position.fromArray(this.data.position)
    this.base.quaternion.fromArray(this.data.quaternion)

    this.aura = createNode('group')

    this.nametag = createNode('nametag', { label: '', health: this.data.health, active: false })
    this.aura.add(this.nametag)

    this.bubble = createNode('ui', {
      id: 'bubble',
      // space: 'screen',
      width: 300,
      height: 512,
      // size: 0.01,
      pivot: 'bottom-center',
      // pivot: 'top-left',
      billboard: 'full',
      scaler: [3, 30],
      justifyContent: 'flex-end',
      alignItems: 'center',
      active: false,
    })
    this.bubbleBox = createNode('uiview', {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 10,
      padding: 10,
    })
    this.bubbleText = createNode('uitext', {
      color: 'white',
      fontWeight: 100,
      lineHeight: 1.4,
      fontSize: 16,
    })
    this.bubble.add(this.bubbleBox)
    this.bubbleBox.add(this.bubbleText)
    this.aura.add(this.bubble)

    this.aura.activate({ world: this.world, entity: this })
    this.base.activate({ world: this.world, entity: this })

    this.camHeight = DEFAULT_CAM_HEIGHT

    this.cam = {}
    this.cam.position = new THREE.Vector3().copy(this.base.position)
    this.cam.position.y += this.camHeight
    this.cam.quaternion = new THREE.Quaternion()
    this.cam.rotation = new THREE.Euler(0, 0, 0, 'YXZ')
    bindRotations(this.cam.quaternion, this.cam.rotation)
    this.cam.quaternion.copy(this.base.quaternion)
    this.cam.rotation.x += -15 * DEG2RAD
    this.cam.zoom = 1.5

    if (this.world.loader?.preloader) {
      await this.world.loader.preloader
    }

    this.applyAvatar()
    this.initCapsule()
    this.initControl()

    this.world.setHot(this, true)
    this.world.emit('ready', true)
  }

  getAvatarUrl() {
    return this.data.sessionAvatar || this.data.avatar || 'asset://avatar.vrm'
  }

  applyAvatar() {
    const avatarUrl = this.getAvatarUrl()
    if (this.avatarUrl === avatarUrl) return
    this.world.loader
      .load('avatar', avatarUrl)
      .then(src => {
        if (this.avatar) this.avatar.deactivate()
        this.avatar = src.toNodes().get('avatar')
        this.avatar.disableRateCheck() // max fps for local player
        this.base.add(this.avatar)
        this.nametag.position.y = this.avatar.getHeadToHeight() + 0.2
        this.bubble.position.y = this.avatar.getHeadToHeight() + 0.2
        if (!this.bubble.active) {
          this.nametag.active = true
        }
        this.avatarUrl = avatarUrl
        this.camHeight = this.avatar.height * 0.9
      })
      .catch(err => {
        console.error(err)
      })
  }

  initCapsule() {
    const radius = this.capsuleRadius
    const height = this.capsuleHeight
    const halfHeight = (height - radius - radius) / 2
    const geometry = new PHYSX.PxCapsuleGeometry(radius, halfHeight)
    // frictionless material (the combine mode ensures we always use out min=0 instead of avging)
    // we use eMIN when in the air so that we don't stick to walls etc
    // and eMAX on the ground so that we don't constantly slip off physics objects we're pushing
    this.material = this.world.physics.physics.createMaterial(0, 0, 0)
    // material.setFrictionCombineMode(PHYSX.PxCombineModeEnum.eMIN)
    // material.setRestitutionCombineMode(PHYSX.PxCombineModeEnum.eMIN)
    const flags = new PHYSX.PxShapeFlags(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE) // prettier-ignore
    const shape = this.world.physics.physics.createShape(geometry, this.material, true, flags)
    const localPose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    // rotate to stand up
    q1.set(0, 0, 0).setFromAxisAngle(BACKWARD, Math.PI / 2)
    q1.toPxTransform(localPose)
    // move capsule up so its base is at 0,0,0
    v1.set(0, halfHeight + radius, 0)
    v1.toPxTransform(localPose)
    shape.setLocalPose(localPose)
    const filterData = new PHYSX.PxFilterData(
      Layers.player.group,
      Layers.player.mask,
      PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND |
        PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST |
        PHYSX.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS |
        PHYSX.PxPairFlagEnum.eDETECT_CCD_CONTACT |
        PHYSX.PxPairFlagEnum.eSOLVE_CONTACT |
        PHYSX.PxPairFlagEnum.eDETECT_DISCRETE_CONTACT,
      0
    )
    shape.setContactOffset(0.08) // just enough to fire contacts (because we muck with velocity sometimes standing on a thing doesn't contact)
    // shape.setFlag(PHYSX.PxShapeFlagEnum.eUSE_SWEPT_BOUNDS, true)
    shape.setQueryFilterData(filterData)
    shape.setSimulationFilterData(filterData)
    const transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    v1.copy(this.base.position).toPxTransform(transform)
    q1.set(0, 0, 0, 1).toPxTransform(transform)
    this.capsule = this.world.physics.physics.createRigidDynamic(transform)
    this.capsule.setMass(this.mass)
    // this.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, false)
    this.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eENABLE_CCD, true)
    this.capsule.setRigidDynamicLockFlag(PHYSX.PxRigidDynamicLockFlagEnum.eLOCK_ANGULAR_X, true)
    // this.capsule.setRigidDynamicLockFlag(PHYSX.PxRigidDynamicLockFlagEnum.eLOCK_ANGULAR_Y, true)
    this.capsule.setRigidDynamicLockFlag(PHYSX.PxRigidDynamicLockFlagEnum.eLOCK_ANGULAR_Z, true)
    // disable gravity we'll add it ourselves
    this.capsule.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_GRAVITY, true)
    this.capsule.attachShape(shape)
    // There's a weird issue where running directly at a wall the capsule won't generate contacts and instead
    // go straight through it. It has to be almost perfectly head on, a slight angle and everything works fine.
    // I spent days trying to figure out why, it's not CCD, it's not contact offsets, its just straight up bugged.
    // For now the best solution is to just add a sphere right in the center of our capsule to keep that problem at bay.
    let shape2
    {
      // const geometry = new PHYSX.PxSphereGeometry(radius)
      // shape2 = this.world.physics.physics.createShape(geometry, this.material, true, flags)
      // shape2.setQueryFilterData(filterData)
      // shape2.setSimulationFilterData(filterData)
      // const pose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
      // v1.set(0, halfHeight + radius, 0).toPxTransform(pose)
      // shape2.setLocalPose(pose)
      // this.capsule.attachShape(shape2)
    }
    this.capsuleHandle = this.world.physics.addActor(this.capsule, {
      tag: null,
      playerId: this.data.id,
      onInterpolate: position => {
        this.base.position.copy(position)
      },
    })
  }

  initControl() {
    this.control = this.world.controls.bind({
      priority: ControlPriorities.PLAYER,
      onTouch: touch => {
        if (!this.stick && touch.position.x < this.control.screen.width / 2) {
          this.stick = {
            center: touch.position.clone(),
            active: false,
            touch,
          }
        } else if (!this.pan) {
          this.pan = touch
        }
      },
      onTouchEnd: touch => {
        if (this.stick?.touch === touch) {
          this.stick = null
          this.world.emit('stick', null)
        }
        if (this.pan === touch) {
          this.pan = null
        }
      },
    })
    this.control.camera.write = true
    this.control.camera.position.copy(this.cam.position)
    this.control.camera.quaternion.copy(this.cam.quaternion)
    this.control.camera.zoom = this.cam.zoom
    // this.control.setActions([{ type: 'space', label: 'Jump / Double-Jump' }])
    // this.control.setActions([{ type: 'escape', label: 'Menu' }])
  }

  toggleFlying() {
    const canFly = this.world.settings.public || hasRole(this.data.roles, 'admin')
    if (!canFly) return
    this.flying = !this.flying
    if (this.flying) {
      // zero out vertical velocity when entering fly mode
      const velocity = this.capsule.getLinearVelocity()
      velocity.y = 0
      this.capsule.setLinearVelocity(velocity)
    } else {
      // ...
    }
    this.lastJumpAt = -999
  }

  getAnchorMatrix() {
    if (this.data.effect?.anchorId) {
      return this.world.anchors.get(this.data.effect.anchorId)
    }
    return null
  }

  fixedUpdate(delta) {
    const freeze = this.data.effect?.freeze
    const anchor = this.getAnchorMatrix()
    const snare = this.data.effect?.snare || 0

    if (anchor && !this.capsuleDisabled) {
      this.capsule.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, true)
      this.capsuleDisabled = true
    }
    if (!anchor && this.capsuleDisabled) {
      this.capsule.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, false)
      this.capsuleDisabled = false
    }

    if (anchor) {
      /**
       *
       * ZERO MODE
       *
       */
    } else if (!this.flying) {
      /**
       *
       * STANDARD MODE
       *
       */

      // if grounded last update, check for moving platforms and move with them
      if (this.grounded) {
        // find any potentially moving platform
        const pose = this.capsule.getGlobalPose()
        const origin = v1.copy(pose.p)
        origin.y += 0.2
        const hitMask = Layers.environment.group | Layers.prop.group
        const hit = this.world.physics.raycast(origin, DOWN, 2, hitMask)
        let actor = hit?.handle?.actor || null
        // if we found a new platform, set it up for tracking
        if (this.platform.actor !== actor) {
          this.platform.actor = actor
          if (actor) {
            const platformPose = this.platform.actor.getGlobalPose()
            v1.copy(platformPose.p)
            q1.copy(platformPose.q)
            this.platform.prevTransform.compose(v1, q1, SCALE_IDENTITY)
          }
        }
        // move with platform
        if (this.platform.actor) {
          // get current platform transform
          const currTransform = m1
          const platformPose = this.platform.actor.getGlobalPose()
          v1.copy(platformPose.p)
          q1.copy(platformPose.q)
          currTransform.compose(v1, q1, SCALE_IDENTITY)
          // get delta transform
          const deltaTransform = m2.multiplyMatrices(currTransform, this.platform.prevTransform.clone().invert())
          // extract delta position and quaternion
          const deltaPosition = v2
          const deltaQuaternion = q2
          const deltaScale = v3
          deltaTransform.decompose(deltaPosition, deltaQuaternion, deltaScale)
          // apply delta to player
          const playerPose = this.capsule.getGlobalPose()
          v4.copy(playerPose.p)
          q3.copy(playerPose.q)
          const playerTransform = m3
          playerTransform.compose(v4, q3, SCALE_IDENTITY)
          playerTransform.premultiply(deltaTransform)
          const newPosition = v5
          const newQuaternion = q4
          playerTransform.decompose(newPosition, newQuaternion, v6)
          const newPose = this.capsule.getGlobalPose()
          newPosition.toPxTransform(newPose)
          // newQuaternion.toPxTransform(newPose) // capsule doesn't rotate
          this.capsule.setGlobalPose(newPose)
          // rotate ghost by Y only
          e1.setFromQuaternion(deltaQuaternion).reorder('YXZ')
          e1.x = 0
          e1.z = 0
          q1.setFromEuler(e1)
          this.base.quaternion.multiply(q1)
          this.base.updateTransform()
          // store current transform for next frame
          this.platform.prevTransform.copy(currTransform)
        }
      } else {
        this.platform.actor = null
      }

      // sweep down to see if we hit ground
      let sweepHit
      {
        const geometry = this.groundSweepGeometry
        const pose = this.capsule.getGlobalPose()
        const origin = v1.copy(pose.p /*this.ghost.position*/)
        origin.y += this.groundSweepRadius + 0.12 // move up inside player + a bit
        const direction = DOWN
        const maxDistance = 0.12 + 0.1 // outside player + a bit more
        const hitMask = Layers.environment.group | Layers.prop.group
        sweepHit = this.world.physics.sweep(geometry, origin, direction, maxDistance, hitMask)
      }

      // update grounded info
      if (sweepHit) {
        this.justLeftGround = false
        this.grounded = true
        this.groundNormal.copy(sweepHit.normal)
        this.groundAngle = UP.angleTo(this.groundNormal) * RAD2DEG
      } else {
        this.justLeftGround = !!this.grounded
        this.grounded = false
        this.groundNormal.copy(UP)
        this.groundAngle = 0
      }

      // if on a steep slope, unground and track slipping
      if (this.grounded && this.groundAngle > 60) {
        this.justLeftGround = false
        this.grounded = false
        this.groundNormal.copy(UP)
        this.groundAngle = 0
        this.slipping = true
      } else {
        this.slipping = false
      }

      // our capsule material has 0 friction
      // we use eMIN when in the air so that we don't stick to walls etc (zero friction)
      // and eMAX on the ground so that we don't constantly slip off physics objects we're pushing (absorb objects friction)
      if (this.grounded) {
        if (this.materialMax !== true) {
          this.material.setFrictionCombineMode(PHYSX.PxCombineModeEnum.eMAX)
          this.material.setRestitutionCombineMode(PHYSX.PxCombineModeEnum.eMAX)
          this.materialMax = true
        }
      } else {
        if (this.materialMax !== false) {
          this.material.setFrictionCombineMode(PHYSX.PxCombineModeEnum.eMIN)
          this.material.setRestitutionCombineMode(PHYSX.PxCombineModeEnum.eMIN)
          this.materialMax = false
        }
      }

      // if we jumped and have now left the ground, progress to jumping
      if (this.jumped && !this.grounded) {
        this.jumped = false
        this.jumping = true
      }

      // if not grounded and our velocity is downward, start timing our falling
      if (!this.grounded && this.capsule.getLinearVelocity().y < 0) {
        this.fallTimer += delta
      } else {
        this.fallTimer = 0
      }
      // if we've been falling for a bit then progress to actual falling
      // this is to prevent animation jitter when only falling for a very small amount of time
      if (this.fallTimer > 0.1 && !this.falling) {
        this.jumping = false
        this.airJumping = false
        this.falling = true
        this.fallStartY = this.base.position.y
      }

      // if falling track distance
      if (this.falling) {
        this.fallDistance = this.fallStartY - this.base.position.y
      }

      // if falling and we're now on the ground, clear it
      if (this.falling && this.grounded) {
        this.falling = false
      }

      // if jumping and we're now on the ground, clear it
      if (this.jumping && this.grounded) {
        this.jumping = false
      }

      // if airJumping and we're now on the ground, clear it
      if (this.airJumped && this.grounded) {
        this.airJumped = false
        this.airJumping = false
      }

      // if we're grounded we don't need gravity.
      // more importantly we disable it so that we don't slowly slide down ramps while standing still.
      // even more importantly, if the platform we are on is dynamic we apply a force to it to compensate for our gravity being off.
      // this allows things like see-saws to move down when we stand on them etc.
      if (this.grounded) {
        // gravity is disabled but we need to check our platform
        if (this.platform.actor) {
          const isStatic = this.platform.actor instanceof PHYSX.PxRigidStatic
          const isKinematic = this.platform.actor.getRigidBodyFlags?.().isSet(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC)
          // if its dynamic apply downward force!
          if (!isKinematic && !isStatic) {
            // this feels like the right amount of force but no idea why 0.2
            const amount = -9.81 * 0.2
            const force = v1.set(0, amount, 0)
            PHYSX.PxRigidBodyExt.prototype.addForceAtPos(
              this.platform.actor,
              force.toPxVec3(),
              this.capsule.getGlobalPose().p,
              PHYSX.PxForceModeEnum.eFORCE,
              true
            )
          }
        }
      } else {
        const force = v1.set(0, -this.effectiveGravity, 0)
        this.capsule.addForce(force.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
      }

      // update velocity
      const velocity = v1.copy(this.capsule.getLinearVelocity())
      // apply drag, orientated to ground normal
      // this prevents ice-skating & yeeting us upward when going up ramps
      const dragCoeff = 10 * delta
      let perpComponent = v2.copy(this.groundNormal).multiplyScalar(velocity.dot(this.groundNormal))
      let parallelComponent = v3.copy(velocity).sub(perpComponent)
      parallelComponent.multiplyScalar(1 - dragCoeff)
      velocity.copy(parallelComponent.add(perpComponent))
      // cancel out velocity in ground normal direction (up oriented to ground normal)
      // this helps us stick to elevators
      if (this.grounded && !this.jumping) {
        const projectedLength = velocity.dot(this.groundNormal)
        const projectedVector = v2.copy(this.groundNormal).multiplyScalar(projectedLength)
        velocity.sub(projectedVector)
      }
      // when walking off an edge or over the top of a ramp, attempt to snap down to a surface
      if (this.justLeftGround && !this.jumping) {
        velocity.y = -5
      }
      // if slipping ensure we can't gain upward velocity
      if (this.slipping) {
        // increase downward velocity to prevent sliding upward when walking at a slope
        velocity.y -= 0.5
      }

      // apply additional push force
      if (this.pushForce) {
        if (!this.pushForceInit) {
          this.pushForceInit = true
          // if we're pushing up, act like a jump so we don't stick to the ground
          if (this.pushForce.y) {
            this.jumped = true
            // ensure other stuff is reset
            this.jumping = false
            this.falling = false
            this.airJumped = false
            this.airJumping = false
          }
        }
        velocity.add(this.pushForce)
        const drag = 20
        const decayFactor = 1 - drag * delta
        if (decayFactor < 0) {
          // if drag * delta > 1, just set to zero
          this.pushForce.set(0, 0, 0)
        } else {
          this.pushForce.multiplyScalar(Math.max(decayFactor, 0))
        }
        if (this.pushForce.length() < 0.01) {
          this.pushForce = null
        }
      }

      this.capsule.setLinearVelocity(velocity.toPxVec3())

      // apply move force, projected onto ground normal
      if (this.moving) {
        let moveSpeed = (this.running ? 6 : 3) * this.mass // run
        moveSpeed *= 1 - snare
        const slopeRotation = q1.setFromUnitVectors(UP, this.groundNormal)
        const moveForce = v1.copy(this.moveDir).multiplyScalar(moveSpeed * 10).applyQuaternion(slopeRotation) // prettier-ignore
        this.capsule.addForce(moveForce.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
        // alternative (slightly different projection)
        // let moveSpeed = 10
        // const slopeMoveDir = v1.copy(this.moveDir).projectOnPlane(this.groundNormal).normalize()
        // const moveForce = v2.copy(slopeMoveDir).multiplyScalar(moveSpeed * 10)
        // this.capsule.addForce(moveForce.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
      }

      // ground/air jump
      const shouldJump =
        this.grounded && !this.jumping && this.jumpDown && !this.data.effect?.snare && !this.data.effect?.freeze
      const shouldAirJump =
        false && !this.grounded && !this.airJumped && this.jumpPressed && !this.world.builder?.enabled // temp: disabled
      if (shouldJump || shouldAirJump) {
        // calc velocity needed to reach jump height
        let jumpVelocity = Math.sqrt(2 * this.effectiveGravity * this.jumpHeight)
        jumpVelocity = jumpVelocity * (1 / Math.sqrt(this.mass))
        // update velocity
        const velocity = this.capsule.getLinearVelocity()
        velocity.y = jumpVelocity
        this.capsule.setLinearVelocity(velocity)
        // ground jump init (we haven't left the ground yet)
        if (shouldJump) {
          this.jumped = true
        }
        // air jump init
        if (shouldAirJump) {
          this.falling = false
          this.fallTimer = 0
          this.jumping = true
          this.airJumped = true
          this.airJumping = true
        }
      }
    } else {
      /**
       *
       * FLYING MODE
       *
       */

      // apply force in the direction we want to go
      if (this.moving || this.jumpDown || this.control.keyC.down) {
        const flySpeed = this.flyForce * (this.running ? 2 : 1)
        const force = v1.copy(this.flyDir).multiplyScalar(flySpeed)
        // handle vertical movement
        if (this.jumpDown) {
          force.y = flySpeed
        } else if (this.control.keyC.down) {
          force.y = -flySpeed
        }
        this.capsule.addForce(force.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
      }

      // add drag to prevent excessive speeds
      const velocity = v2.copy(this.capsule.getLinearVelocity())
      const dragForce = v3.copy(velocity).multiplyScalar(-this.flyDrag * delta)
      this.capsule.addForce(dragForce.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)

      // zero out any rotational velocity
      const zeroAngular = v4.set(0, 0, 0)
      this.capsule.setAngularVelocity(zeroAngular.toPxVec3())

      // if not in build mode, cancel flying
      if (!this.world.builder?.enabled) {
        this.toggleFlying()
      }
    }

    // double jump in build, mode toggle flying
    if (this.jumpPressed && this.world.builder?.enabled) {
      if (this.world.time - this.lastJumpAt < 0.4) {
        this.toggleFlying()
      }
      this.lastJumpAt = this.world.time
    }

    // consume jump press so we dont run it across multiple fixedUpdates in one frame
    this.jumpPressed = false
  }

  update(delta) {
    const isXR = this.world.xr?.session
    const freeze = this.data.effect?.freeze
    const anchor = this.getAnchorMatrix()

    // update cam look direction
    if (isXR) {
      // in xr clear camera rotation (handled internally)
      // in xr we only track turn here, which is added to the xr camera later on
      this.cam.rotation.x = 0
      this.cam.rotation.z = 0
      if (this.control.xrRightStick.value.x === 0 && this.didSnapTurn) {
        this.didSnapTurn = false
      } else if (this.control.xrRightStick.value.x > 0 && !this.didSnapTurn) {
        this.cam.rotation.y -= 45 * DEG2RAD
        this.didSnapTurn = true
      } else if (this.control.xrRightStick.value.x < 0 && !this.didSnapTurn) {
        this.cam.rotation.y += 45 * DEG2RAD
        this.didSnapTurn = true
      }
    } else if (this.control.pointer.locked) {
      // or pointer lock, rotate camera with pointer movement
      this.cam.rotation.x += -this.control.pointer.delta.y * POINTER_LOOK_SPEED * delta
      this.cam.rotation.y += -this.control.pointer.delta.x * POINTER_LOOK_SPEED * delta
      this.cam.rotation.z = 0
    } else if (this.pan) {
      // or when touch panning
      this.cam.rotation.x += -this.pan.delta.y * PAN_LOOK_SPEED * delta
      this.cam.rotation.y += -this.pan.delta.x * PAN_LOOK_SPEED * delta
      this.cam.rotation.z = 0
    }

    // ensure we can't look too far up/down
    if (!isXR) {
      this.cam.rotation.x = clamp(this.cam.rotation.x, -89 * DEG2RAD, 89 * DEG2RAD)
    }

    // zoom camera if scrolling wheel
    if (!isXR) {
      this.cam.zoom += -this.control.scrollDelta.value * ZOOM_SPEED * delta
      this.cam.zoom = clamp(this.cam.zoom, MIN_ZOOM, MAX_ZOOM)
    }

    // force zoom in xr to trigger first person (below)
    if (isXR && !this.xrActive) {
      this.cam.zoom = 0
      this.xrActive = true
    } else if (!isXR && this.xrActive) {
      this.cam.zoom = 1
      this.xrActive = false
    }

    // transition in and out of first person
    if (this.cam.zoom < 1 && !this.firstPerson) {
      this.cam.zoom = 0
      this.firstPerson = true
      this.avatar.visible = false
    } else if (this.cam.zoom > 0 && this.firstPerson) {
      this.cam.zoom = 1
      this.firstPerson = false
      this.avatar.visible = true
    }

    // stick movement threshold
    if (this.stick && !this.stick.active) {
      this.stick.active = this.stick.center.distanceTo(this.stick.touch.position) > 3
    }

    // watch jump presses to either fly or air-jump
    this.jumpDown = isXR ? this.control.xrRightBtn1.down : this.control.space.down || this.control.touchA.down
    if (isXR ? this.control.xrRightBtn1.pressed : this.control.space.pressed || this.control.touchA.pressed) {
      this.jumpPressed = true
    }

    // get our movement direction
    this.moveDir.set(0, 0, 0)
    if (isXR) {
      // in xr use controller input
      this.moveDir.x = this.control.xrLeftStick.value.x
      this.moveDir.z = this.control.xrLeftStick.value.z
    } else if (this.stick?.active) {
      // if we have a touch joystick use that
      const touchX = this.stick.touch.position.x
      const touchY = this.stick.touch.position.y
      const centerX = this.stick.center.x
      const centerY = this.stick.center.y
      const dx = centerX - touchX
      const dy = centerY - touchY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const moveRadius = STICK_OUTER_RADIUS - STICK_INNER_RADIUS
      if (distance > moveRadius) {
        this.stick.center.x = touchX + (moveRadius * dx) / distance
        this.stick.center.y = touchY + (moveRadius * dy) / distance
      }
      const stickX = (touchX - this.stick.center.x) / moveRadius
      const stickY = (touchY - this.stick.center.y) / moveRadius
      this.moveDir.x = stickX
      this.moveDir.z = stickY
      this.world.emit('stick', this.stick)
    } else {
      // otherwise use keyboard
      if (this.control.keyW.down || this.control.arrowUp.down) this.moveDir.z -= 1
      if (this.control.keyS.down || this.control.arrowDown.down) this.moveDir.z += 1
      if (this.control.keyA.down || this.control.arrowLeft.down) this.moveDir.x -= 1
      if (this.control.keyD.down || this.control.arrowRight.down) this.moveDir.x += 1
    }

    // we're moving if direction is set
    this.moving = this.moveDir.length() > 0

    // check effect cancel
    if (this.data.effect?.cancellable && (this.moving || this.jumpDown)) {
      this.setEffect(null)
    }

    if (freeze || anchor) {
      // cancel movement
      this.moveDir.set(0, 0, 0)
      this.moving = false
    }

    // determine if we're "running"
    if (this.stick?.active || isXR) {
      // touch/xr joysticks at full extent
      this.running = this.moving && this.moveDir.length() > 0.9
    } else {
      // or keyboard shift key
      this.running = this.moving && (this.control.shiftLeft.down || this.control.shiftRight.down)
    }

    // normalize direction (also prevents surfing)
    this.moveDir.normalize()

    // flying direction
    if (isXR) {
      this.flyDir.copy(this.moveDir)
      this.flyDir.applyQuaternion(this.world.xr.camera.quaternion)
    } else {
      this.flyDir.copy(this.moveDir)
      this.flyDir.applyQuaternion(this.cam.quaternion)
    }

    // store un-rotated move direction (axis)
    this.axis.copy(this.moveDir)

    // get un-rotated move direction in degrees
    // Octant ranges (8 directions)
    // Forward:         337.5° to 22.5° (or -22.5° to 22.5°)
    // Forward-Right:   22.5° to 67.5°
    // Right:           67.5° to 112.5°
    // Backward-Right:  112.5° to 157.5°
    // Backward:        157.5° to 202.5°
    // Backward-Left:   202.5° to 247.5°
    // Left:            247.5° to 292.5°
    // Forward-Left:    292.5° to 337.5°
    const moveRad = Math.atan2(this.axis.x, -this.axis.z)
    let moveDeg = moveRad * RAD2DEG
    if (moveDeg < 0) moveDeg += 360

    // rotate direction to face camera Y direction
    if (isXR) {
      e1.copy(this.world.xr.camera.rotation).reorder('YXZ')
      e1.y += this.cam.rotation.y
      const yQuaternion = q1.setFromAxisAngle(UP, e1.y)
      this.moveDir.applyQuaternion(yQuaternion)
    } else {
      const yQuaternion = q1.setFromAxisAngle(UP, this.cam.rotation.y)
      this.moveDir.applyQuaternion(yQuaternion)
    }

    // get initial facing angle matching camera
    let rotY = 0
    let applyRotY
    if (isXR) {
      e1.copy(this.world.xr.camera.rotation).reorder('YXZ')
      rotY = e1.y + this.cam.rotation.y
    } else {
      rotY = this.cam.rotation.y
    }
    if (this.data.effect?.turn) {
      applyRotY = true
    } else if (this.moving || this.firstPerson) {
      applyRotY = true
    }

    // when moving, or in first person or effect.turn, continually slerp to face that angle
    if (applyRotY) {
      e1.set(0, rotY, 0)
      q1.setFromEuler(e1)
      const alpha = 1 - Math.pow(0.00000001, delta)
      this.base.quaternion.slerp(q1, alpha)
    }

    // apply emote
    let emote
    if (this.data.effect?.emote) {
      emote = this.data.effect.emote
    }
    if (this.emote !== emote) {
      this.emote = emote
    }
    this.avatar?.setEmote(this.emote)

    // get locomotion mode
    let mode
    if (this.data.effect?.emote) {
      // emote = this.data.effect.emote
    } else if (this.flying) {
      mode = Modes.FLY
    } else if (this.airJumping) {
      mode = Modes.FLIP
    } else if (this.jumping) {
      mode = Modes.JUMP
    } else if (this.falling) {
      mode = this.fallDistance > 1.6 ? Modes.FALL : Modes.JUMP
    } else if (this.moving) {
      mode = this.running ? Modes.RUN : Modes.WALK
    } else if (this.speaking) {
      mode = Modes.TALK
    }
    if (!mode) mode = Modes.IDLE
    this.mode = mode

    // set gaze direction
    if (isXR) {
      this.gaze.copy(FORWARD).applyQuaternion(this.world.xr.camera.quaternion)
    } else {
      this.gaze.copy(FORWARD).applyQuaternion(this.cam.quaternion)
      if (!this.firstPerson) {
        // tilt slightly up in third person as people look from above
        v1.copy(gazeTiltAxis).applyQuaternion(this.cam.quaternion) // tilt in cam space
        this.gaze.applyAxisAngle(v1, gazeTiltAngle) // positive for upward tilt
      }
    }

    // apply locomotion
    this.avatar?.instance?.setLocomotion(this.mode, this.axis, this.gaze)

    // send network updates
    this.lastSendAt += delta
    if (this.lastSendAt >= this.world.networkRate) {
      if (!this.lastState) {
        this.lastState = {
          id: this.data.id,
          p: this.base.position.clone(),
          q: this.base.quaternion.clone(),
          m: this.mode,
          a: this.axis.clone(),
          g: this.gaze.clone(),
          e: null,
        }
      }
      const data = {
        id: this.data.id,
      }
      let hasChanges
      if (!this.lastState.p.equals(this.base.position)) {
        data.p = this.base.position.toArray()
        this.lastState.p.copy(this.base.position)
        hasChanges = true
      }
      if (!this.lastState.q.equals(this.base.quaternion)) {
        data.q = this.base.quaternion.toArray()
        this.lastState.q.copy(this.base.quaternion)
        hasChanges = true
      }
      if (this.lastState.m !== this.mode) {
        data.m = this.mode
        this.lastState.m = this.mode
        hasChanges = true
      }
      if (!this.lastState.a.equals(this.axis)) {
        data.a = this.axis.toArray()
        this.lastState.a.copy(this.axis)
        hasChanges = true
      }
      if (!this.lastState.g.equals(this.gaze)) {
        data.g = this.gaze.toArray()
        this.lastState.g.copy(this.gaze)
        hasChanges = true
      }
      if (this.lastState.e !== this.emote) {
        data.e = this.emote
        this.lastState.e = this.emote
        hasChanges = true
      }
      if (hasChanges) {
        this.world.network.send('entityModified', data)
      }
      this.lastSendAt = 0
    }

    // effect duration
    if (this.data.effect?.duration) {
      this.data.effect.duration -= delta
      if (this.data.effect.duration <= 0) {
        this.setEffect(null)
      }
    }
  }

  lateUpdate(delta) {
    const isXR = this.world.xr?.session
    const anchor = this.getAnchorMatrix()
    // if we're anchored, force into that pose
    if (anchor) {
      this.base.position.setFromMatrixPosition(anchor)
      this.base.quaternion.setFromRotationMatrix(anchor)
      const pose = this.capsule.getGlobalPose()
      this.base.position.toPxTransform(pose)
      this.capsuleHandle.snap(pose)
    }
    // make camera follow our position horizontally
    this.cam.position.copy(this.base.position)
    if (isXR) {
      // ...
    } else {
      // and vertically at our vrm model height
      this.cam.position.y += this.camHeight
      // and slightly to the right over the avatars shoulder, when not first person / xr
      if (!this.firstPerson) {
        const forward = v1.copy(FORWARD).applyQuaternion(this.cam.quaternion)
        const right = v2.crossVectors(forward, UP).normalize()
        this.cam.position.add(right.multiplyScalar(0.3))
      }
    }
    if (this.world.xr?.session) {
      // in vr snap camera
      this.control.camera.position.copy(this.cam.position)
      this.control.camera.quaternion.copy(this.cam.quaternion)
    } else {
      // otherwise interpolate camera towards target
      simpleCamLerp(this.world, this.control.camera, this.cam, delta)
    }
    if (this.avatar) {
      const matrix = this.avatar.getBoneTransform('head')
      if (matrix) this.aura.position.setFromMatrixPosition(matrix)
    }
  }

  teleport({ position, rotationY }) {
    position = position.isVector3 ? position : new THREE.Vector3().fromArray(position)
    const hasRotation = isNumber(rotationY)
    // snap to position
    const pose = this.capsule.getGlobalPose()
    position.toPxTransform(pose)
    this.capsuleHandle.snap(pose)
    this.base.position.copy(position)
    if (hasRotation) this.base.rotation.y = rotationY
    // send network update
    this.world.network.send('entityModified', {
      id: this.data.id,
      p: this.base.position.toArray(),
      q: this.base.quaternion.toArray(),
      t: true,
    })
    // snap camera
    this.cam.position.copy(this.base.position)
    this.cam.position.y += this.camHeight
    if (hasRotation) this.cam.rotation.y = rotationY
    this.control.camera.position.copy(this.cam.position)
    this.control.camera.quaternion.copy(this.cam.quaternion)
  }

  setEffect(effect, onEnd) {
    if (this.data.effect === effect) return
    if (this.data.effect) {
      this.data.effect = null
      this.onEffectEnd?.()
      this.onEffectEnd = null
    }
    this.data.effect = effect
    this.onEffectEnd = onEnd
    // send network update
    this.world.network.send('entityModified', {
      id: this.data.id,
      ef: effect,
    })
  }

  setSpeaking(speaking) {
    if (this.speaking === speaking) return
    this.speaking = speaking
  }

  push(force) {
    force = v1.fromArray(force)
    // squash vertical to emulate what our huge horizontal drag coefficient does
    // force.y *= 0.1
    // add to any existing push
    if (this.pushForce) {
      this.pushForce.add(force)
    }
    // otherwise start push
    else {
      this.pushForce = force.clone()
      this.pushForceInit = false
    }
  }

  setName(name) {
    this.modify({ name })
    this.world.network.send('entityModified', { id: this.data.id, name })
  }

  setSessionAvatar(avatar) {
    this.data.sessionAvatar = avatar
    this.applyAvatar()
    this.world.network.send('entityModified', {
      id: this.data.id,
      sessionAvatar: avatar,
    })
  }

  chat(msg) {
    this.nametag.active = false
    this.bubbleText.value = msg
    this.bubble.active = true
    clearTimeout(this.chatTimer)
    this.chatTimer = setTimeout(() => {
      this.bubble.active = false
      this.nametag.active = true
    }, 5000)
  }

  modify(data) {
    let avatarChanged
    let changed
    if (data.hasOwnProperty('name')) {
      this.data.name = data.name
      changed = true
    }
    if (data.hasOwnProperty('health')) {
      this.data.health = data.health
      this.nametag.health = data.health
      this.world.events.emit('health', { playerId: this.data.id, health: data.health })
      console.log('modify', data.health)
      // changed = true
    }
    if (data.hasOwnProperty('avatar')) {
      this.data.avatar = data.avatar
      avatarChanged = true
      changed = true
    }
    if (data.hasOwnProperty('sessionAvatar')) {
      this.data.sessionAvatar = data.sessionAvatar
      avatarChanged = true
    }
    if (data.hasOwnProperty('ef')) {
      if (this.data.effect) {
        this.data.effect = null
        this.onEffectEnd?.()
        this.onEffectEnd = null
      }
      this.data.effect = data.ef
    }
    if (data.hasOwnProperty('roles')) {
      this.data.roles = data.roles
      changed = true
    }
    if (avatarChanged) {
      this.applyAvatar()
    }
    if (changed) {
      this.world.emit('player', this)
    }
  }
}
