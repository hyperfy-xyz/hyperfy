import fs from 'fs-extra'
import path from 'path'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFLoader } from '../libs/gltfloader/GLTFLoader.js'
// import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { System } from './System'
import { createVRMFactory } from '../extras/createVRMFactory'
import { glbToNodes } from '../extras/glbToNodes'
import { createNode } from '../extras/createNode'
import { createEmoteFactory } from '../extras/createEmoteFactory'

/**
 * Server Loader System
 *
 * - Runs on the server
 * - Basic file loader for many different formats, cached.
 *
 */
export class ServerLoader extends System {
  constructor(world) {
    super(world)
    this.promises = new Map()
    this.results = new Map()
    this.rgbeLoader = new RGBELoader()
    this.gltfLoader = new GLTFLoader()
    this.preloadItems = []
    // this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))

    // mock globals to allow gltf loader to work in nodejs
    globalThis.self = { URL }
    globalThis.window = {}
    globalThis.document = {
      createElementNS: () => ({ style: {} }),
    }
  }

  start() {
    // ...
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
    const promises = this.preloadItems.map(item => this.load(item.type, item.url))
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null
    })
  }

  async fetchArrayBuffer(url) {
    const isRemote = url.startsWith('http://') || url.startsWith('https://')
    
    if (isRemote) {
      try {
      const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`)
        }
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
          const text = await response.text()
          console.error(`Received XML response instead of binary file for ${url}:`, text.substring(0, 200))
          throw new Error(`File not found or access denied: ${url}`)
        }
      const arrayBuffer = await response.arrayBuffer()
        
      return arrayBuffer
      } catch (error) {
        console.error(`Error fetching ${url}:`, error.message)
        
        throw error
      }
    } else {
      // Local file access
      try {
        const filePath = url.startsWith('file://') ? url.slice(7) : url
        
        const buffer = await fs.readFile(filePath)
        return buffer.buffer
      } catch (error) {
        console.error(`Error reading local file ${url}:`, error.message)        
        throw error
      }
    }
  }

  async fetchText(url) {
    const isRemote = url.startsWith('http://') || url.startsWith('https://')
    if (isRemote) {
      const response = await fetch(url)
      const text = await response.text()
      return text
    } else {
      const text = await fs.readFile(url, { encoding: 'utf8' })
      return text
    }
  }

  async loadModel(url) {
    const resolvedUrl = this.world.resolveURL(url, true)
    console.log(`[ServerLoader] Loading model: ${url} -> ${resolvedUrl}`)    
    console.log(`[ServerLoader] Fetching model from: ${resolvedUrl}`)
    
    try {
      const arrayBuffer = await this.fetchArrayBuffer(resolvedUrl)      
      const loader = new THREE.GLTFLoader()
      
      const gltf = await new Promise((resolve, reject) => {
        loader.parse(arrayBuffer, '', resolve, reject)
      })
      
      return gltf
      
    } catch (error) {
      console.error(`[ServerLoader] Error loading model ${url}:`, error.message)
      
      // FALLBACK: If it's a hasheaded asset that failed, try to find a built-in equivalent
      if (resolvedUrl.includes('.glb') && error.message.includes('404') || error.message.includes('403')) {
        const fallbackUrl = this.tryGetBuiltInFallback(url, resolvedUrl)
        if (fallbackUrl && fallbackUrl !== resolvedUrl) {
          console.log(`[ServerLoader] Trying fallback for ${url}: ${fallbackUrl}`)
          try {
            const fallbackBuffer = await this.fetchArrayBuffer(fallbackUrl)
            const loader = new THREE.GLTFLoader()
            const gltf = await new Promise((resolve, reject) => {
              loader.parse(fallbackBuffer, '', resolve, reject)
            })
            console.log(`[ServerLoader] Fallback successful for ${url}`)
            return gltf
          } catch (fallbackError) {
            console.error(`[ServerLoader] Fallback also failed for ${url}:`, fallbackError.message)
          }
        }
      }
      
      throw error
    }
  }

  /**
   * Try to find a built-in asset fallback for a failed hasheaded asset
   */
  tryGetBuiltInFallback(originalUrl, resolvedUrl) {
    // If it's already a built-in asset (not hasheaded), don't try fallback
    if (!resolvedUrl.match(/[a-f0-9]{64}\.glb/)) {
      return null
    }
    
    // Common built-in assets that might be used as fallbacks
    const builtInAssets = [
      'crash-block.glb',
      'emote-idle.glb', 
      'emote-walk.glb',
      'emote-run.glb',
      'emote-jump.glb',
      'emote-fall.glb',
      'emote-flip.glb',
      'emote-float.glb',
      'emote-talk.glb'
    ]
    
    // For emote-related assets, try to match by name
    for (const builtIn of builtInAssets) {
      if (originalUrl.includes('emote') && builtIn.includes('emote-idle')) {
        // Default emote fallback
        return this.world.resolveURL(`asset://${builtIn}`, true)
      }
    }
    
    // Generic fallback for any .glb - use crash-block as a placeholder
    return this.world.resolveURL('asset://crash-block.glb', true)
  }

  load(type, url) {
    const key = `${type}/${url}`
    if (this.promises.has(key)) {
      return this.promises.get(key)
    }
    url = this.world.resolveURL(url, true)

    let promise
    if (type === 'hdr') {
      // promise = this.rgbeLoader.loadAsync(url).then(texture => {
      //   return texture
      // })
    }
    if (type === 'image') {
      // ...
    }
    if (type === 'texture') {
      // ...
    }
    if (type === 'model') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const arrayBuffer = await this.fetchArrayBuffer(url)
          this.gltfLoader.parse(arrayBuffer, '', glb => {
            const node = glbToNodes(glb, this.world)
            const model = {
              toNodes() {
                return node.clone(true)
              },
            }
            this.results.set(key, model)
            resolve(model)
          })
        } catch (err) {
          reject(err)
        }
      })
    }
    if (type === 'emote') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const arrayBuffer = await this.fetchArrayBuffer(url)
          this.gltfLoader.parse(arrayBuffer, '', glb => {
            const factory = createEmoteFactory(glb, url)
            const emote = {
              toClip(options) {
                return factory.toClip(options)
              },
            }
            this.results.set(key, emote)
            resolve(emote)
          })
        } catch (err) {
          reject(err)
        }
      })
    }
    if (type === 'avatar') {
      promise = new Promise(async (resolve, reject) => {
        try {
          // NOTE: we can't load vrms on the server yet but we don't need 'em anyway
          let node
          const glb = {
            toNodes: () => {
              if (!node) {
                node = createNode('group')
                const node2 = createNode('avatar', { id: 'avatar', factory: null })
                node.add(node2)
              }
              return node.clone(true)
            },
          }
          this.results.set(key, glb)
          resolve(glb)
        } catch (err) {
          reject(err)
        }
      })
    }
    if (type === 'script') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const code = await this.fetchText(url)
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
        reject(null)
      })
    }
    this.promises.set(key, promise)
    return promise
  }

  destroy() {
    this.promises.clear()
    this.results.clear()
    this.preloadItems = []
  }
}
