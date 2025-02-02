import * as THREE from '../extras/three'
import { System } from './System'
import { ControlPriorities } from '../extras/ControlPriorities'

const MIN_CAMERA_SPEED = 1
const MAX_CAMERA_SPEED = 50
const ROTATION_SPEED = 2 // Fixed rotation speed
const SPEED_ADJUST_FACTOR = 1.2
const DAMPING = 0.9 // Damping factor (0 = full stop, 1 = no damping)
const MAX_VELOCITY = 2 // Maximum velocity for any direction
const ACCELERATION = 8 // How quickly we reach max speed
const SCALE_ADJUST_FACTOR = 1.1 // Adjust this value to control scaling sensitivity

export class BuildMode extends System {
	constructor(world) {
		super(world)
		this.active = false
		this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

		// Initialize speeds
		this.moveSpeed = 10
		this.rotateSpeed = ROTATION_SPEED

		// Add movement velocity tracking
		this.velocity = new THREE.Vector3()
		this.targetVelocity = new THREE.Vector3()

		// Add smooth camera rotation
		this.targetRotation = new THREE.Euler(0, 0, 0, 'YXZ')
		this.currentRotation = new THREE.Euler(0, 0, 0, 'YXZ')
		this.lastMousePosition = new THREE.Vector2()
		this.isMouseDown = false

		// Store original states
		this.originalCameraPosition = new THREE.Vector3()
		this.originalCameraQuaternion = new THREE.Quaternion()
		this.originalPlayerVelocity = new THREE.Vector3()

		// Add scale tracking for selected object
		this.selectedObject = null
		this.transformMode = 'translate' // 'translate', 'rotate', 'scale'
		this.originalScale = new THREE.Vector3()

		// Bind methods
		this.onMouseMove = this.onMouseMove.bind(this)
		this.onMouseDown = this.onMouseDown.bind(this)
		this.onMouseUp = this.onMouseUp.bind(this)
	}

	start() {
		this.control = this.world.controls.bind({
			priority: ControlPriorities.EDITOR,
			onPress: code => {
				if (code === 'KeyB') {
					this.toggleBuildMode()
				}
				if (code === 'KeyR' && this.active) {
					this.transformMode = 'rotate'
				}
				if (code === 'KeyS' && this.active) {
					this.transformMode = 'scale'
				}
				if (code === 'KeyT' && this.active) {
					this.transformMode = 'translate'
				}
				if ((code === 'ShiftLeft' || code === 'ShiftRight') && this.active) {
					document.body.style.cursor = 'none'
				}
			},
			onRelease: code => {
				if ((code === 'ShiftLeft' || code === 'ShiftRight') && this.active) {
					document.body.style.cursor = 'default'
				}
			},
			onScroll: () => {
				if (!this.active) return false
				const delta = this.control.scroll.delta

				// Handle object transformation based on mode
				if (this.selectedObject) {
					if (this.transformMode === 'scale') {
						const scaleFactor = delta < 0 ? SCALE_ADJUST_FACTOR : 1 / SCALE_ADJUST_FACTOR
						this.selectedObject.scale.multiplyScalar(scaleFactor)
						return true
					} else if (this.transformMode === 'rotate') {
						// Handle rotation
						const rotationAmount = delta < 0 ? Math.PI / 16 : -Math.PI / 16
						this.selectedObject.rotation.y += rotationAmount
						return true
					}
				}

				// Default camera speed adjustment
				if (delta < 0) {
					this.moveSpeed = Math.min(MAX_CAMERA_SPEED, this.moveSpeed * SPEED_ADJUST_FACTOR)
				} else if (delta > 0) {
					this.moveSpeed = Math.max(MIN_CAMERA_SPEED, this.moveSpeed / SPEED_ADJUST_FACTOR)
				}
				return true
			}
		})

		window.addEventListener('resize', this.onResize)
		this.onResize()
	}

	onResize = () => {
		this.camera.aspect = window.innerWidth / window.innerHeight
		this.camera.updateProjectionMatrix()
	}

	onMouseDown(event) {
		if (!this.active || event.button !== 0) return
		if (!this.control.buttons.ShiftLeft && !this.control.buttons.ShiftRight) return
		
		this.isMouseDown = true
		this.lastMousePosition.set(event.clientX, event.clientY)
	}

	onMouseUp(event) {
		if (event.button === 0) {
			this.isMouseDown = false
		}
	}

	onMouseMove(event) {
		if (!this.active || !this.isMouseDown) return
		if (!this.control.buttons.ShiftLeft && !this.control.buttons.ShiftRight) return

		const deltaX = event.clientX - this.lastMousePosition.x
		const deltaY = event.clientY - this.lastMousePosition.y

		// Update target rotation with scaled deltas
		this.targetRotation.y -= deltaX * 0.002 * this.rotateSpeed
		this.targetRotation.x -= deltaY * 0.002 * this.rotateSpeed

		// Clamp vertical rotation
		this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x))

		// Update last position
		this.lastMousePosition.set(event.clientX, event.clientY)
	}

	toggleBuildMode() {
		this.active = !this.active
		const player = this.world.entities.player

		// Update ClientControls build mode state
		this.world.controls.buildMode.active = this.active

		if (this.active) {
			// Enter build mode
			document.addEventListener('mousemove', this.onMouseMove)
			document.addEventListener('mousedown', this.onMouseDown)
			document.addEventListener('mouseup', this.onMouseUp)
			document.body.style.cursor = 'default'

			// Store current camera state
			this.originalCameraPosition.copy(this.world.camera.position)
			this.originalCameraQuaternion.copy(this.world.camera.quaternion)

			// Initialize rotations
			this.currentRotation.setFromQuaternion(this.world.camera.quaternion)
			this.targetRotation.copy(this.currentRotation)

			// Position camera above player
			const playerPosition = player.base.position.clone()
			this.camera.position.copy(playerPosition).add(new THREE.Vector3(0, 5, 0))
			this.camera.lookAt(playerPosition)

			// Take control of the camera
			this.control.camera.claim()

			// Disable player movement and camera control
			player.control.camera.unclaim()
			player.control.priority = -1

			// Store and zero out player velocity
			this.originalPlayerVelocity.copy(player.capsule.getLinearVelocity())
			player.capsule.setLinearVelocity({ x: 0, y: 0, z: 0 })

			// Lock the player in place
			player.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)

			// Completely freeze player state
			player.moving = false
			player.running = false
			player.jumping = false
			player.falling = false
			player.sliding = false
			player.crouching = false
			player.sprinting = false
			player.swimming = false
			player.flying = false
			player.emote = null

			// Completely freeze the player model
			if (player.avatar) {
				// Store original visibility
				this.originalAvatarVisible = player.avatar.visible
				// Hide the avatar
				player.avatar.visible = false
				// Stop all animations
				if (player.avatar.mixer) {
					player.avatar.mixer.stopAllAction()
				}
			}

			// Hide the player model if it exists
			if (player.base) {
				this.originalBaseVisible = player.base.visible
				player.base.visible = false
			}

			// Disable player update loop
			this.originalUpdate = player.update
			player.update = () => { }

		} else {
			// Exit build mode
			document.removeEventListener('mousemove', this.onMouseMove)
			document.removeEventListener('mousedown', this.onMouseDown)
			document.removeEventListener('mouseup', this.onMouseUp)
			document.body.style.cursor = 'default'
			this.isMouseDown = false

			// Clear build mode state in ClientControls
			this.world.controls.buildMode.hoveredEntity = null
			this.world.controls.buildMode.selectedEntity = null
			this.world.controls.buildMode.transformMode = null

			// Return control and restore original camera
			this.control.camera.unclaim()
			this.world.camera.position.copy(this.originalCameraPosition)
			this.world.camera.quaternion.copy(this.originalCameraQuaternion)

			// Re-enable player movement and camera control
			player.control.camera.claim()
			player.control.priority = ControlPriorities.PLAYER

			// Unlock the player and restore velocity
			player.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, false)
			player.capsule.setLinearVelocity(this.originalPlayerVelocity)

			// Restore player model visibility
			if (player.avatar) {
				player.avatar.visible = this.originalAvatarVisible
				if (player.avatar.mixer) {
					// Reset the mixer and start idle animation
					player.avatar.mixer.stopAllAction()
					player.emote = 'idle'
				}
			}

			if (player.base) {
				player.base.visible = this.originalBaseVisible
			}

			// Restore player update loop
			if (this.originalUpdate) {
				player.update = this.originalUpdate
			}
		}
	}

	update(delta) {
		if (!this.active) return

		// Update camera rotation regardless of shift state
		const rotationLerp = 1 - Math.pow(0.001, delta)
		this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * rotationLerp
		this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * rotationLerp
		this.camera.quaternion.setFromEuler(this.currentRotation)

		// Reset target velocity
		this.targetVelocity.set(0, 0, 0)

		// Calculate target velocity based on input
		if (this.control.buttons.KeyW) this.targetVelocity.z = -1
		if (this.control.buttons.KeyS) this.targetVelocity.z = 1
		if (this.control.buttons.KeyA) this.targetVelocity.x = -1
		if (this.control.buttons.KeyD) this.targetVelocity.x = 1
		if (this.control.buttons.Space) this.targetVelocity.y = 1
		if (this.control.buttons.KeyC) this.targetVelocity.y = -1

		// Normalize target velocity if moving diagonally
		if (this.targetVelocity.lengthSq() > 0) {
			this.targetVelocity.normalize()
			// Scale by move speed
			this.targetVelocity.multiplyScalar(this.moveSpeed * MAX_VELOCITY)
		}

		// Apply acceleration and damping
		const accelFactor = 1 - Math.pow(0.01, delta * ACCELERATION)
		const dampingFactor = Math.pow(DAMPING, delta * 60) // Frame rate independent damping

		// Interpolate current velocity towards target
		this.velocity.lerp(this.targetVelocity, accelFactor)

		// Apply damping when no input
		if (this.targetVelocity.lengthSq() === 0) {
			this.velocity.multiplyScalar(dampingFactor)
		}

		// Apply velocity to movement
		if (this.velocity.lengthSq() > 0.0001) { // Only move if velocity is significant
			// Handle forward/backward movement
			if (this.velocity.z !== 0) {
				const direction = new THREE.Vector3(0, 0, Math.sign(this.velocity.z))
				direction.applyQuaternion(this.camera.quaternion)
				direction.y = 0 // Keep horizontal movement level
				direction.normalize()
				this.camera.position.addScaledVector(direction, Math.abs(this.velocity.z) * delta)
			}

			// Handle left/right movement
			if (this.velocity.x !== 0) {
				const direction = new THREE.Vector3(Math.sign(this.velocity.x), 0, 0)
				direction.applyQuaternion(this.camera.quaternion)
				direction.y = 0 // Keep horizontal movement level
				direction.normalize()
				this.camera.position.addScaledVector(direction, Math.abs(this.velocity.x) * delta)
			}

			// Handle vertical movement
			if (this.velocity.y !== 0) {
				this.camera.position.y += this.velocity.y * delta
			}
		}

		// Update the control camera
		this.control.camera.position.copy(this.camera.position)
		this.control.camera.quaternion.copy(this.camera.quaternion)
	}

	moveForward(distance) { }
	moveBackward(distance) { }
	moveLeft(distance) { }
	moveRight(distance) { }
	moveUp(distance) { }
	moveDown(distance) { }

	// Add method to select an object
	selectObject(object) {
		this.selectedObject = object
		if (object) {
			this.originalScale.copy(object.scale)
			this.transformMode = 'translate'
		}
	}

	// Add method to deselect object
	deselectObject() {
		this.selectedObject = null
		this.originalScale.set(1, 1, 1)
		this.transformMode = 'translate'
	}

	destroy() {
		window.removeEventListener('resize', this.onResize)
		document.removeEventListener('mousemove', this.onMouseMove)
		document.removeEventListener('mousedown', this.onMouseDown)
		document.removeEventListener('mouseup', this.onMouseUp)
		document.body.style.cursor = 'default'
		if (this.active) {
			this.toggleBuildMode()
		}
	}
}