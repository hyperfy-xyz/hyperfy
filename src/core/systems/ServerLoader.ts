import fs from 'fs-extra'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFLoader } from '../libs/gltfloader/GLTFLoader.js'
// import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { createEmoteFactory } from '../extras/createEmoteFactory'
import { createNode } from '../extras/createNode'
import { glbToNodes } from '../extras/glbToNodes'
import { System } from './System'

/**
 * Server Loader System
 *
 * - Runs on the server
 * - Basic file loader for many different formats, cached.
 *
 */
export class ServerLoader extends System {
  private promises: Map<string, Promise<any>>
  private results: Map<string, any>
  private rgbeLoader: RGBELoader
  private gltfLoader: GLTFLoader
  private preloadItems: Array<{type: string, url: string}>
  private preloader: Promise<void> | null = null
  
  constructor(world: any) {
    super(world)
    this.promises = new Map()
    this.results = new Map()
    this.rgbeLoader = new RGBELoader()
    this.gltfLoader = new GLTFLoader()
    this.preloadItems = []
    // this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))

    // mock globals to allow gltf loader to work in nodejs
    ;(globalThis as any).self = { URL }
    ;(globalThis as any).window = {}
    ;(globalThis as any).document = {
      createElementNS: () => ({ style: {} }),
    }
  }

  start() {
    // ...
  }

  has(type: string, url: string) {
    const key = `${type}/${url}`
    return this.promises.has(key)
  }

  get(type: string, url: string) {
    const key = `${type}/${url}`
    return this.results.get(key)
  }

  preload(type: string, url: string) {
    this.preloadItems.push({ type, url })
  }

  execPreload() {
    const promises = this.preloadItems.map(item => this.load(item.type, item.url))
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null
    })
  }

  async fetchArrayBuffer(url: string) {
    const isRemote = url.startsWith('http://') || url.startsWith('https://')
    if (isRemote) {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      return arrayBuffer
    } else {
      const buffer = await fs.readFile(url)
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      return arrayBuffer
    }
  }

  async fetchText(url: string) {
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

  load(type: string, url: string) {
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
          this.gltfLoader.parse(arrayBuffer, '', (glb: any) => {
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
          this.gltfLoader.parse(arrayBuffer, '', (glb: any) => {
            const factory = createEmoteFactory(glb, url)
            const emote = {
              toClip(options: any) {
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
          let node: any
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
          const scripts = this.world.scripts as any
          const script = scripts.evaluate ? scripts.evaluate(code) : null
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
    if (promise) {
      this.promises.set(key, promise)
    }
    return promise
  }

  destroy() {
    this.promises.clear()
    this.results.clear()
    this.preloadItems = []
  }
}
