import { isBoolean } from 'lodash-es'
import { System } from './System'

export class Settings extends System {
  constructor(world) {
    super(world)

    this.title = null
    this.desc = null
    this.image = null
    this.avatar = null
    this.public = null
    this.playerLimit = null
    this.ao = null
    this.fov = null

    this.changes = null
  }

  deserialize(data) {
    this.title = data.title
    this.desc = data.desc
    this.image = data.image
    this.avatar = data.avatar
    this.public = data.public
    this.playerLimit = data.playerLimit
    this.ao = isBoolean(data.ao) ? data.ao : true // default true
    this.fov = data.fov || 70 // default 70 degrees

    // Update camera FOV when settings are loaded
    if (this.world.camera) {
      console.log('Settings: Setting camera FOV to:', this.fov)
      this.world.camera.fov = this.fov
      this.world.camera.updateProjectionMatrix()
    }

    this.emit('change', {
      title: { value: this.title },
      desc: { value: this.desc },
      image: { value: this.image },
      avatar: { value: this.avatar },
      public: { value: this.public },
      playerLimit: { value: this.playerLimit },
      ao: { value: this.ao },
      fov: { value: this.fov },
    })

    // Force apply settings to camera after a short delay to ensure everything is initialized
    setTimeout(() => {
      this.forceApplyToCamera()
    }, 100)
  }

  serialize() {
    return {
      desc: this.desc,
      title: this.title,
      image: this.image,
      avatar: this.avatar,
      public: this.public,
      playerLimit: this.playerLimit,
      ao: this.ao,
      fov: this.fov,
    }
  }

  preFixedUpdate() {
    if (!this.changes) return
    this.emit('change', this.changes)
    this.changes = null
  }

  modify(key, value) {
    if (this[key] === value) return
    const prev = this[key]
    this[key] = value
    if (!this.changes) this.changes = {}
    if (!this.changes[key]) this.changes[key] = { prev, value: null }
    this.changes[key].value = value
  }

  set(key, value, broadcast) {
    this.modify(key, value)

    // Immediately apply FOV changes to camera
    if (key === 'fov' && this.world.camera) {
      console.log('Settings: Applying FOV change to camera:', value)
      this.world.camera.fov = value
      this.world.camera.updateProjectionMatrix()
      // Also update the graphics system if available
      if (this.world.graphics) {
        this.world.graphics.preTick()
      }
    }

    if (broadcast) {
      this.world.network.send('settingsModified', { key, value })
    }
  }

  syncCameraFOV() {
    if (this.world.camera) {
      // If settings FOV is not set, use current camera FOV
      if (!this.fov) {
        console.log('Settings: Syncing settings FOV from camera:', this.world.camera.fov)
        this.fov = this.world.camera.fov
        this.emit('change', { fov: { value: this.fov } })
      } else if (this.world.camera.fov !== this.fov) {
        // If settings FOV is set but different from camera, update camera
        console.log('Settings: Updating camera FOV from settings:', this.fov)
        this.world.camera.fov = this.fov
        this.world.camera.updateProjectionMatrix()
      }
    }
  }

  start() {
    // Initialize camera FOV from settings if available
    if (this.fov && this.world.camera) {
      console.log('Settings: Initializing camera FOV to:', this.fov)
      this.world.camera.fov = this.fov
      this.world.camera.updateProjectionMatrix()
    } else if (this.world.camera && !this.fov) {
      // If no FOV setting but camera exists, sync current camera FOV to settings
      console.log('Settings: Syncing settings FOV from camera:', this.world.camera.fov)
      this.fov = this.world.camera.fov
      this.emit('change', { fov: { value: this.fov } })
    }
  }

  // Method to force apply settings to camera
  forceApplyToCamera() {
    if (this.world.camera) {
      console.log('Settings: Force applying FOV to camera:', this.fov)
      this.world.camera.fov = this.fov
      this.world.camera.updateProjectionMatrix()
      // Also update the graphics system if available
      if (this.world.graphics) {
        this.world.graphics.preTick()
      }
    }
  }

  // Method to ensure settings are properly synchronized with camera
  ensureFOVSync() {
    if (this.world.camera) {
      if (!this.fov) {
        // If no FOV setting, use current camera FOV
        console.log('Settings: Syncing settings FOV from camera:', this.world.camera.fov)
        this.fov = this.world.camera.fov
        this.emit('change', { fov: { value: this.fov } })
      } else if (this.world.camera.fov !== this.fov) {
        // If settings FOV is set but different from camera, update camera
        console.log('Settings: Updating camera FOV from settings:', this.fov)
        this.world.camera.fov = this.fov
        this.world.camera.updateProjectionMatrix()
      }
    }
  }
}
