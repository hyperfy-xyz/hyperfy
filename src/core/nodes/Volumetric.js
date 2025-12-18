import * as THREE from '../extras/three'
import { Node } from './Node'

export class Volumetric extends Node {
  constructor(data = {}) {
    console.log("[VOLUMETRIC] Constructor data:", data)
    super(data)
    this.name = 'volumetric'
    this.videoUrl = data.videoUrl
    this.dataUrl = data.dataUrl
    this.loop = data.loop !== undefined ? data.loop : true
    this.autoplay = data.autoplay !== undefined ? data.autoplay : true
    this.volume = data.volume !== undefined ? data.volume : 0
    
    
    this._mesh = null
    this._geometry = null
    this._material = null
    this._texture = null
    this._ryskObj = null
    this._isPlaying = false
    this._animationFrameId = null
  }

  async mount() {
    console.log('[VOLUMETRIC] Mounting volumetric node...')
    
    if (this.ctx.world.network.isServer) {
      console.log('[VOLUMETRIC] Server side, skipping')
      return
    }
    
    if (!this.videoUrl || !this.dataUrl) {
      console.error('[VOLUMETRIC] Missing videoUrl or dataUrl')
      return
    }
    
    try {
      // Import MantisVision
      const { URLMesh } = await import('@mantisvision/rysk')
      const { RyskEvents } = await import('@mantisvision/utils')
      
      console.log('[VOLUMETRIC] Creating URLMesh...')
      this._ryskObj = new URLMesh(this.videoUrl, this.dataUrl, 50)
      this._ryskObj.loop = this.loop
      
      // Set up event handler for when data is decoded
      this._ryskObj.on(RyskEvents.dataDecoded, (data) => {
        if (data.frameNo % 30 === 0) {
          console.log('[VOLUMETRIC] 📊 Frame:', data.frameNo)
        }
        this.updateGeometry(data)
      })
      
      this._ryskObj.on(RyskEvents.error, (error) => {
        console.error('[VOLUMETRIC] RYSK error:', error)
      })
      
      // Initialize
      console.log('[VOLUMETRIC] Initializing URLMesh...')
      const result = await this._ryskObj.init()
      console.log('[VOLUMETRIC] ✅ URLMesh initialized!')
      
      // Create empty buffer geometry
      this._geometry = new THREE.BufferGeometry()
      
      // Create texture from video
      this._texture = new THREE.VideoTexture(result.video)
      this._texture.flipY = false
      this._texture.minFilter = THREE.LinearFilter
      this._texture.magFilter = THREE.LinearFilter
      this._texture.colorSpace = THREE.SRGBColorSpace
      
      // Create material
      this._material = new THREE.MeshBasicMaterial({
        map: this._texture,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: true,
        depthTest: true
      })
      
      // Create mesh - position relative to the node, not world
      this._mesh = new THREE.Mesh(this._geometry, this._material)
      // Mesh position is (0,0,0) relative to this node
      this._mesh.position.set(0, 0, 0)
      this._mesh.rotation.y = Math.PI
      
      // Scale the mesh down from huge volumetric size (base scale)
      this._mesh.matrixAutoUpdate = false
      this._mesh.matrixWorldAutoUpdate = false
      this._mesh.scale.set(0.0025, 0.0025, 0.0025)
      
      
      // Don't cull
      this._mesh.frustumCulled = false
      
      // Dont auto-update matrix - well handle it manually
      
      // Don't auto-update matrix - we'll handle it manually
      
      
      // Copy initial transform
      this._mesh.matrixWorld.copy(this.matrixWorld)

      // Add to scene
      this.ctx.world.stage.scene.add(this._mesh)
      
      // Set volume
      this._ryskObj.setVolume(this.volume)
      
      // Start update loop - CRITICAL!
      this.startUpdateLoop()
      
      console.log('[VOLUMETRIC] ✅ Volumetric node mounted!')
      
      // FORCE PLAY
      console.log('[VOLUMETRIC] 🎬 Starting playback in 1.5s...')
      setTimeout(async () => {
        try {
          await this._ryskObj.play()
          this._isPlaying = true
          console.log('[VOLUMETRIC] ▶️ PLAYING!')
        } catch (error) {
          console.error('[VOLUMETRIC] ❌ Play failed:', error)
        }
      }, 1500)
      
    } catch (error) {
      console.error('[VOLUMETRIC] ❌ Mount failed:', error.message)
      console.error('[VOLUMETRIC] Stack:', error.stack)
    }
  }

  startUpdateLoop() {
    console.log('[VOLUMETRIC] 🔄 Starting update loop...')
    
    const animate = () => {
      // Update RYSK object - CRITICAL!
      if (this._ryskObj) {
        this._ryskObj.update()
      }
      
      // Update texture
      if (this._texture) {
        this._texture.needsUpdate = true
      }
      
      // Update mesh matrix to follow this node's position
      if (this._mesh) {
        this._mesh.matrixWorld.copy(this.matrixWorld)
      }
      
      // Continue loop
      this._animationFrameId = requestAnimationFrame(animate)
    }
    
    animate()
    console.log('[VOLUMETRIC] ✅ Update loop started!')
  }

  updateGeometry(data) {
    if (!this._geometry || !this._mesh) return
    
    const { uvs, indices, vertices } = data
    
    try {
      if (!vertices || vertices.length === 0) return
      if (!uvs || uvs.length === 0) return
      if (!indices || indices.length === 0) return
      
      const posAttr = this._geometry.getAttribute("position")
      const uvAttr = this._geometry.getAttribute("uv")
      const indexAttr = this._geometry.getIndex()
      
      const needsResize = !posAttr || 
                          posAttr.count !== vertices.length / 3 || 
                          !uvAttr ||
                          uvAttr.count !== uvs.length / 2 ||
                          !indexAttr ||
                          indexAttr.count !== indices.length
      
      if (needsResize) {
        const posBuffer = new THREE.Float32BufferAttribute(vertices, 3)
        const uvBuffer = new THREE.Float32BufferAttribute(uvs, 2)
        const indexBuffer = new THREE.Uint16BufferAttribute(indices, 1)
        
        posBuffer.setUsage(THREE.DynamicDrawUsage)
        uvBuffer.setUsage(THREE.DynamicDrawUsage)
        indexBuffer.setUsage(THREE.DynamicDrawUsage)
        
        this._geometry.setAttribute("position", posBuffer)
        this._geometry.setAttribute("uv", uvBuffer)
        this._geometry.setIndex(indexBuffer)
        this._geometry.computeBoundingSphere()
      } else {
        posAttr.array.set(vertices)
        uvAttr.array.set(uvs)
        indexAttr.array.set(indices)
        
        posAttr.needsUpdate = true
        uvAttr.needsUpdate = true
        indexAttr.needsUpdate = true
      }
      
      if (this._texture) {
        this._texture.needsUpdate = true
      }
      
    } catch (error) {
      console.error("[VOLUMETRIC] Error updating geometry:", error)
    }
  }

  commit() {
    console.log("[VOLUMETRIC] Node scale:", this.scale.x, this.scale.y, this.scale.z)
    // Sync node transform to mesh
    if (this._mesh) {
      this._mesh.matrixWorld.copy(this.matrixWorld)
    }
  }

  unmount() {
    console.log('[VOLUMETRIC] Unmounting volumetric node...')
    
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId)
      this._animationFrameId = null
    }
    
    if (this._ryskObj) {
      this._ryskObj.dispose()
      this._ryskObj = null
    }
    
    if (this._mesh && this.ctx && this.ctx.world) {
      this.ctx.world.stage.scene.remove(this._mesh)
    }
    
    if (this._texture) {
      this._texture.dispose()
    }
    
    if (this._geometry) {
      this._geometry.dispose()
    }
    
    if (this._material) {
      this._material.dispose()
    }
    
    this._mesh = null
    this._geometry = null
    this._material = null
    this._texture = null
  }

  async play() {
    if (this._ryskObj) {
      try {
        await this._ryskObj.play()
        this._isPlaying = true
        console.log('[VOLUMETRIC] ▶️ Playing')
      } catch (error) {
        console.error('[VOLUMETRIC] ❌ Play failed:', error)
      }
    }
  }

  pause() {
    if (this._ryskObj) {
      this._ryskObj.pause()
      this._isPlaying = false
      console.log('[VOLUMETRIC] ⏸️ Paused')
    }
  }

  setVolume(volume) {
    this.volume = volume
    if (this._ryskObj) {
      this._ryskObj.setVolume(volume)
    }
  }

  getProxy() {
    const self = this
    if (!this.proxy) {
      let proxy = {
        get playing() {
          return self._isPlaying
        },
        play() {
          return self.play()
        },
        pause() {
          self.pause()
        },
        get volume() {
          return self.volume
        },
        set volume(value) {
          self.setVolume(value)
        }
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy()))
      this.proxy = proxy
    }
    return this.proxy
  }
}
