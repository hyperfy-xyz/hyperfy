import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import Hls from 'hls.js/dist/hls.js'
import { TextureLoader } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { createEmoteFactory } from '../extras/createEmoteFactory'
import { createNode } from '../extras/createNode'
import { createVRMFactory } from '../extras/createVRMFactory'
import { glbToNodes } from '../extras/glbToNodes'
import * as THREE from '../extras/three'
import { System } from './System'

// THREE.Cache.enabled = true

/**
 * Client Loader System
 *
 * - Runs on the client
 * - Basic file loader for many different formats, cached.
 *
 */
export class ClientLoader extends System {
  files: Map<any, any>
  promises: Map<any, any>
  results: Map<any, any>
  rgbeLoader: RGBELoader
  texLoader: THREE.TextureLoader
  gltfLoader: GLTFLoader
  preloadItems: Array<{ type: any; url: any }> = []
  vrmHooks?: { camera: any; scene: any; octree: any; setupMaterial: (material: any) => void; loader: any }
  preloader?: Promise<void> | null
  constructor(world) {
    super(world)
    this.files = new Map()
    this.promises = new Map()
    this.results = new Map()
    this.rgbeLoader = new RGBELoader()
    this.texLoader = new TextureLoader()
    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))
  }

  start() {
    this.vrmHooks = {
      camera: this.world.camera,
      scene: this.world.stage.scene,
      octree: this.world.stage.octree,
      setupMaterial: this.world.setupMaterial,
      loader: this.world.loader,
    }
  }

  has(type, url) {
    const key = `${type}/${url}`
    return this.promises.has(key)
  }

  get(type, url) {
    const key = `${type}/${url}`
    return this.results.get(key)
  }

  preload(type, url) {
    this.preloadItems.push({ type, url })
  }

  execPreload() {
    if (this.preloadItems.length === 0) {
      console.log('[ClientLoader] No items to preload')
      this.world.emit?.('progress', 100)
      return
    }
    
    let loadedItems = 0
    let totalItems = this.preloadItems.length
    let progress = 0
    console.log('[ClientLoader] Starting preload of', totalItems, 'items:', this.preloadItems)
    
    const promises = this.preloadItems.map(item => {
      return this.load(item.type, item.url)
        .then(() => {
          loadedItems++
          progress = (loadedItems / totalItems) * 100
          console.log(`[ClientLoader] Loaded ${item.type}: ${item.url} (${loadedItems}/${totalItems})`)
          this.world.emit?.('progress', progress)
        })
        .catch(error => {
          console.error(`[ClientLoader] Failed to load ${item.type}: ${item.url}`, error)
          throw error // Re-throw to be caught by allSettled
        })
    })
    
    this.preloader = Promise.allSettled(promises).then((results) => {
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        console.error('[ClientLoader] Some assets failed to load:', failed)
      }
      console.log('[ClientLoader] Preload complete')
      this.preloader = null
      // Don't emit ready here - let PlayerLocal do it after it's initialized
      // this.world.emit?.('ready', true)
    })
  }

  setFile(url, file) {
    this.files.set(url, file)
  }

  getFile(url, name) {
    url = this.world.resolveURL(url)
    if (name) {
      const file = this.files.get(url)
      return new File([file], name, {
        type: file.type, // Preserve the MIME type
        lastModified: file.lastModified, // Preserve the last modified timestamp
      })
    }
    return this.files.get(url)
  }

  loadFile = async url => {
    url = this.world.resolveURL(url)
    if (this.files.has(url)) {
      return this.files.get(url)
    }
    
    try {
      console.log('[ClientLoader] Fetching file:', url)
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`)
      }
      const blob = await resp.blob()
      const file = new File([blob], url.split('/').pop(), { type: blob.type })
      this.files.set(url, file)
      console.log('[ClientLoader] File loaded successfully:', url, 'size:', file.size)
      return file
    } catch (error) {
      console.error('[ClientLoader] Failed to fetch file:', url, error)
      throw error
    }
  }

  async load(type, url) {
    if (this.preloader) {
      await this.preloader
    }
    const key = `${type}/${url}`
    if (this.promises.has(key)) {
      return this.promises.get(key)
    }
    if (type === 'video') {
      const promise = new Promise(resolve => {
        url = this.world.resolveURL(url)
        const factory = createVideoFactory(this.world, url)
        resolve(factory)
      })
      this.promises.set(key, promise)
      return promise
    }
    const promise = this.loadFile(url).then(async file => {
      if (type === 'hdr') {
        const buffer = await file.arrayBuffer()
        const result = this.rgbeLoader.parse(buffer)
        // we just mimicing what rgbeLoader.load() does behind the scenes
        const texture = new THREE.DataTexture(result.data, result.width, result.height)
        texture.colorSpace = THREE.LinearSRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = false
        texture.flipY = true
        texture.type = result.type
        texture.needsUpdate = true
        this.results.set(key, texture)
        return texture
      }
      if (type === 'image') {
        return new Promise(resolve => {
          const img = new Image()
          img.onload = () => {
            this.results.set(key, img)
            resolve(img)
            // URL.revokeObjectURL(img.src)
          }
          img.src = URL.createObjectURL(file)
        })
      }
      if (type === 'texture') {
        return new Promise(resolve => {
          const img = new Image()
          img.onload = () => {
            const texture = this.texLoader.load(img.src)
            this.results.set(key, texture)
            resolve(texture)
            URL.revokeObjectURL(img.src)
          }
          img.src = URL.createObjectURL(file)
        })
      }
      if (type === 'model') {
        const buffer = await file.arrayBuffer()
        const glb = await this.gltfLoader.parseAsync(buffer, '')
        const node = glbToNodes(glb, this.world)
        const model = {
          toNodes() {
            return node.clone(true)
          },
          getStats() {
            const stats = node.getStats(true)
            // append file size
            stats.fileBytes = file.size
            return stats
          },
        }
        this.results.set(key, model)
        return model
      }
      if (type === 'emote') {
        const buffer = await file.arrayBuffer()
        const glb = await this.gltfLoader.parseAsync(buffer, '')
        const factory = createEmoteFactory(glb, url)
        const emote = {
          toClip(options) {
            return factory.toClip(options)
          },
        }
        this.results.set(key, emote)
        return emote
      }
      if (type === 'avatar') {
        const buffer = await file.arrayBuffer()
        const glb = await this.gltfLoader.parseAsync(buffer, '')
        const factory = createVRMFactory(glb, this.world.setupMaterial)
        const hooks = this.vrmHooks
        const node = createNode('group', { id: '$root' })
        const node2 = createNode('avatar', { id: 'avatar', factory, hooks })
        node.add(node2)
        const avatar = {
          factory,
          hooks,
          toNodes(customHooks) {
            const clone = node.clone(true)
            if (customHooks) {
              clone.get('avatar').hooks = customHooks
            }
            return clone
          },
          getStats() {
            const stats = node.getStats(true)
            // append file size
            stats.fileBytes = file.size
            return stats
          },
        }
        this.results.set(key, avatar)
        return avatar
      }
      if (type === 'script') {
        const code = await file.text()
        const script = this.world.scripts.evaluate(code)
        this.results.set(key, script)
        return script
      }
      if (type === 'audio') {
        const buffer = await file.arrayBuffer()
        const audioBuffer = await this.world.audio.ctx.decodeAudioData(buffer)
        this.results.set(key, audioBuffer)
        return audioBuffer
      }
    })
    this.promises.set(key, promise)
    return promise
  }

  insert(type, url, file) {
    const key = `${type}/${url}`
    const localUrl = URL.createObjectURL(file)
    let promise
    if (type === 'hdr') {
      promise = this.rgbeLoader.loadAsync(localUrl).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'image') {
      promise = new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          this.results.set(key, img)
          resolve(img)
        }
        img.src = localUrl
      })
    }
    if (type === 'video') {
      promise = new Promise(resolve => {
        const factory = createVideoFactory(this.world, localUrl)
        resolve(factory)
      })
    }
    if (type === 'texture') {
      promise = this.texLoader.loadAsync(localUrl).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'model') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const node = glbToNodes(glb, this.world)
        const model = {
          toNodes() {
            return node.clone(true)
          },
          getStats() {
            const stats = node.getStats(true)
            // append file size
            stats.fileBytes = file.size
            return stats
          },
        }
        this.results.set(key, model)
        return model
      })
    }
    if (type === 'emote') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const factory = createEmoteFactory(glb, url)
        const emote = {
          toClip(options) {
            return factory.toClip(options)
          },
        }
        this.results.set(key, emote)
        return emote
      })
    }
    if (type === 'avatar') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const factory = createVRMFactory(glb, this.world.setupMaterial)
        const hooks = this.vrmHooks
        const node = createNode('group', { id: '$root' })
        const node2 = createNode('avatar', { id: 'avatar', factory, hooks })
        node.add(node2)
        const avatar = {
          factory,
          hooks,
          toNodes(customHooks) {
            const clone = node.clone(true)
            if (customHooks) {
              clone.get('avatar').hooks = customHooks
            }
            return clone
          },
          getStats() {
            const stats = node.getStats(true)
            // append file size
            stats.fileBytes = file.size
            return stats
          },
        }
        this.results.set(key, avatar)
        return avatar
      })
    }
    if (type === 'script') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const code = await file.text()
          const script = this.world.scripts.evaluate(code)
          this.results.set(key, script)
          resolve(script)
        } catch (err) {
          reject(err)
        }
      })
    }
    if (type === 'audio') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const audioBuffer = await this.world.audio.ctx.decodeAudioData(arrayBuffer)
          this.results.set(key, audioBuffer)
          resolve(audioBuffer)
        } catch (err) {
          reject(err)
        }
      })
    }
    this.promises.set(key, promise)
  }

  destroy() {
    this.files.clear()
    this.promises.clear()
    this.results.clear()
    this.preloadItems = []
  }
}

function createVideoFactory(world, url) {
  const isHLS = url?.endsWith('.m3u8')
  const sources = {}
  let width
  let height
  let duration
  let ready = false
  let prepare
  function createSource(key) {
    const elem = document.createElement('video')
    elem.crossOrigin = 'anonymous'
    elem.playsInline = true
    elem.loop = false
    elem.muted = true
    elem.style.width = '1px'
    elem.style.height = '1px'
    elem.style.position = 'absolute'
    elem.style.opacity = '0'
    elem.style.zIndex = '-1000'
    elem.style.pointerEvents = 'none'
    elem.style.overflow = 'hidden'
    const needsPolyfill = isHLS && !elem.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()
    if (needsPolyfill) {
      const hls = new Hls()
      hls.loadSource(url)
      hls.attachMedia(elem)
    } else {
      elem.src = url
    }
    const audio = world.audio.ctx.createMediaElementSource(elem)
    let n = 0
    let dead
    world.audio.ready(() => {
      if (dead) return
      elem.muted = false
    })
    // set linked=false to have a separate source (and texture)
    const texture = new THREE.VideoTexture(elem)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = world.graphics.maxAnisotropy
    if (!prepare) {
      prepare = (function () {
        /**
         *
         * A regular video will load data automatically BUT a stream
         * needs to hit play() before it gets that data.
         *
         * The following code handles this for us, and when streaming
         * will hit play just until we get the data needed, then pause.
         */
        return new Promise<void>(async resolve => {
          let playing = false
          let data = false
          elem.addEventListener(
            'loadeddata',
            async () => {
              // if we needed to hit play to fetch data then revert back to paused
              // console.log('[video] loadeddata', { playing })
              if (playing) elem.pause()
              data = true
              // await new Promise(resolve => setTimeout(resolve, 2000))
              width = elem.videoWidth
              height = elem.videoHeight
              duration = elem.duration
              ready = true
              resolve()
            },
            { once: true }
          )
          elem.addEventListener(
            'loadedmetadata',
            async () => {
              // we need a gesture before we can potentially hit play
              // console.log('[video] ready')
              // await this.engine.driver.gesture
              // if we already have data do nothing, we're done!
              // console.log('[video] gesture', { data })
              if (data) return
              // otherwise hit play to force data loading for streams
              elem.play()
              playing = true
            },
            { once: true }
          )
        })
      })()
    }
    function isPlaying() {
      return elem.currentTime > 0 && !elem.paused && !elem.ended && elem.readyState > 2
    }
    function play(restartIfPlaying = false) {
      if (restartIfPlaying) elem.currentTime = 0
      elem.play()
    }
    function pause() {
      elem.pause()
    }
    function stop() {
      elem.currentTime = 0
      elem.pause()
    }
    function release() {
      n--
      if (n === 0) {
        stop()
        audio.disconnect()
        texture.dispose()
        document.body.removeChild(elem)
        delete sources[key]
        // help to prevent chrome memory leaks
        // see: https://github.com/facebook/react/issues/15583#issuecomment-490912533
        elem.src = ''
        elem.load()
      }
    }
    const handle = {
      elem,
      audio,
      texture,
      prepare,
      get ready() {
        return ready
      },
      get width() {
        return width
      },
      get height() {
        return height
      },
      get duration() {
        return duration
      },
      get loop() {
        return elem.loop
      },
      set loop(value) {
        elem.loop = value
      },
      get isPlaying() {
        return isPlaying()
      },
      get currentTime() {
        return elem.currentTime
      },
      set currentTime(value) {
        elem.currentTime = value
      },
      play,
      pause,
      stop,
      release,
    }
    return {
      createHandle() {
        n++
        if (n === 1) {
          document.body.appendChild(elem)
        }
        return handle
      },
    }
  }
  return {
    get(key) {
      let source = sources[key]
      if (!source) {
        source = createSource(key)
        sources[key] = source
      }
      return source.createHandle()
    },
  }
}
