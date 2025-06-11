import * as THREE from '../extras/three'
import { N8AOPostPass } from 'n8ao'
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAPreset,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SelectiveBloomEffect,
  BlendFunction,
  Selection,
  BloomEffect,
  KernelSize,
  DepthPass,
  Pass,
  DepthEffect,
} from 'postprocessing'

import { System } from './System'
import { WebGLRenderer } from '../libs/WebGLRenderer'

const v1 = new THREE.Vector3()

let renderer
function getRenderer() {
  if (!renderer) {
    renderer = new WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: false,
      // logarithmicDepthBuffer: true,
      // reverseDepthBuffer: true,
    })
  }
  return renderer
}

/**
 * Graphics System
 *
 * - Runs on the client
 * - Supports renderer, shadows, postprocessing, etc
 * - Renders to the viewport
 *
 */
export class ClientGraphics extends System {
  constructor(world) {
    super(world)
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.width = this.viewport.offsetWidth
    this.height = this.viewport.offsetHeight
    this.aspect = this.width / this.height
    this.renderer = getRenderer()
    this.patchRenderPipelineB()
    this.patchShadowPipeline()
    this.renderer.setSize(this.width, this.height)
    this.renderer.setClearColor(0xffffff, 0)
    this.renderer.setPixelRatio(this.world.prefs.dpr)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.xr.enabled = true
    this.renderer.xr.setReferenceSpaceType('local-floor')
    this.renderer.xr.setFoveation(1)
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()
    THREE.Texture.DEFAULT_ANISOTROPY = this.maxAnisotropy
    this.usePostprocessing = this.world.prefs.postprocessing
    const context = this.renderer.getContext()
    const maxMultisampling = context.getParameter(context.MAX_SAMPLES)
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
      // multisampling: Math.min(8, maxMultisampling),
    })
    this.renderPass = new RenderPass(this.world.stage.scene, this.world.camera)
    this.composer.addPass(this.renderPass)
    this.aoPass = new N8AOPostPass(this.world.stage.scene, this.world.camera, this.width, this.height)
    this.aoPass.enabled = this.world.settings.ao && this.world.prefs.ao
    // we can't use this as it traverses the scene, but half our objects are in the octree
    this.aoPass.autoDetectTransparency = false
    // full res is pretty expensive
    this.aoPass.configuration.halfRes = true
    // look 1:
    // this.aoPass.configuration.aoRadius = 0.2
    // this.aoPass.configuration.distanceFalloff = 1
    // this.aoPass.configuration.intensity = 2
    // look 2:
    // this.aoPass.configuration.aoRadius = 0.5
    // this.aoPass.configuration.distanceFalloff = 1
    // this.aoPass.configuration.intensity = 2
    // look 3:
    this.aoPass.configuration.screenSpaceRadius = true
    this.aoPass.configuration.aoRadius = 32
    this.aoPass.configuration.distanceFalloff = 1
    this.aoPass.configuration.intensity = 2
    this.composer.addPass(this.aoPass)
    this.bloom = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      luminanceThreshold: 1,
      luminanceSmoothing: 0.3,
      intensity: 0.5,
      radius: 0.8,
    })
    this.bloomEnabled = this.world.prefs.bloom
    this.smaa = new SMAAEffect({
      preset: SMAAPreset.HIGH,
    })
    this.tonemapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    })
    this.effectPass = new EffectPass(this.world.camera)
    this.updatePostProcessingEffects()
    this.composer.addPass(this.effectPass)
    this.world.prefs.on('change', this.onPrefsChange)
    this.resizer = new ResizeObserver(() => {
      this.resize(this.viewport.offsetWidth, this.viewport.offsetHeight)
    })
    this.viewport.appendChild(this.renderer.domElement)
    this.resizer.observe(this.viewport)

    this.xrWidth = null
    this.xrHeight = null
    this.xrDimensionsNeeded = false
  }

  start() {
    this.world.on('xrSession', this.onXRSession)
    this.world.settings.on('change', this.onSettingsChange)
  }

  resize(width, height) {
    this.width = width
    this.height = height
    this.aspect = this.width / this.height
    this.world.camera.aspect = this.aspect
    this.world.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
    this.composer.setSize(this.width, this.height)
    this.emit('resize')
    this.render()
  }

  render() {
    if (this.renderer.xr.isPresenting || !this.usePostprocessing) {
      this.renderer.render(this.world.stage.scene, this.world.camera)
    } else {
      this.composer.render()
    }
    if (this.xrDimensionsNeeded) {
      this.checkXRDimensions()
    }
  }

  commit() {
    console.log('---')
    this.render()
  }

  preTick() {
    // calc world to screen factor
    const camera = this.world.camera
    const fovRadians = camera.fov * (Math.PI / 180)
    const rendererHeight = this.xrHeight || this.height
    this.worldToScreenFactor = (Math.tan(fovRadians / 2) * 2) / rendererHeight
  }

  onPrefsChange = changes => {
    // pixel ratio
    if (changes.dpr) {
      this.renderer.setPixelRatio(changes.dpr.value)
      this.resize(this.width, this.height)
    }
    // postprocessing
    if (changes.postprocessing) {
      this.usePostprocessing = changes.postprocessing.value
    }
    // bloom
    if (changes.bloom) {
      this.bloomEnabled = changes.bloom.value
      this.updatePostProcessingEffects()
    }
    // ao
    if (changes.ao) {
      this.aoPass.enabled = changes.ao.value && this.world.settings.ao
    }
  }

  onXRSession = session => {
    if (session) {
      this.xrSession = session
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = true
    } else {
      this.xrSession = null
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = false
    }
  }

  checkXRDimensions = () => {
    // Get the current XR reference space
    const referenceSpace = this.renderer.xr.getReferenceSpace()
    // Get frame information
    const frame = this.renderer.xr.getFrame()
    if (frame && referenceSpace) {
      // Get view information which contains projection matrices
      const views = frame.getViewerPose(referenceSpace)?.views
      if (views && views.length > 0) {
        // Use the first view's projection matrix
        const projectionMatrix = views[0].projectionMatrix
        // Extract the relevant factors from the projection matrix
        // This is a simplified approach
        const fovFactor = projectionMatrix[5] // Approximation of FOV scale
        // You might need to consider the XR display's physical properties
        // which can be accessed via session.renderState
        const renderState = this.xrSession.renderState
        const baseLayer = renderState.baseLayer
        if (baseLayer) {
          // Get the actual resolution being used for rendering
          this.xrWidth = baseLayer.framebufferWidth
          this.xrHeight = baseLayer.framebufferHeight
          this.xrDimensionsNeeded = false
          console.log({ xrWidth: this.xrWidth, xrHeight: this.xrHeight })
        }
      }
    }
  }

  onSettingsChange = changes => {
    if (changes.ao) {
      this.aoPass.enabled = changes.ao.value && this.world.prefs.ao
      console.log(this.aoPass.enabled)
    }
  }

  updatePostProcessingEffects() {
    const effects = []
    if (this.bloomEnabled) {
      effects.push(this.bloom)
    }
    effects.push(this.smaa)
    effects.push(this.tonemapping)
    this.effectPass.setEffects(effects)
    this.effectPass.recompile()
  }

  destroy() {
    this.resizer.disconnect()
    this.viewport.removeChild(this.renderer.domElement)
  }

  patchRenderPipelineB() {
    const self = this
    const vec4 = new THREE.Vector4()
    const octree = this.world.stage.octree
    const renderer = this.renderer
    const stats = {}
    const gl = this.renderer.getContext()
    let frame = 0
    let scene
    let camera
    let cameraPos = new THREE.Vector3()
    let frustum = new THREE.Frustum()
    let objects
    let sortObjects
    let currentRenderList
    let currentRenderState
    let projScreenMatrix = new THREE.Matrix4()
    // const ctx = {
    //   scene: null,
    //   camera: null,
    //   cameraPos: new THREE.Vector3(),
    //   frustum: new THREE.Frustum(),
    //   objects: null,
    //   sortObjects: null,
    //   currentRenderList: null,
    //   currentRenderState: null,
    //   _projScreenMatrix: new THREE.Matrix4(),
    // }
    const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: true })
    const occluderMat = new THREE.ShaderMaterial({
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          // Completely empty - only depth buffer writes occur
        }
      `,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide, // Match your geometry needs
    })
    renderer.projectSpatial = (
      _scene,
      _camera,
      _frustum,
      _objects,
      _sortObjects,
      _currentRenderList,
      _currentRenderState,
      _projScreenMatrix
    ) => {
      scene = _scene
      camera = _camera
      cameraPos.setFromMatrixPosition(camera.matrixWorld)
      frustum = _frustum
      objects = _objects
      sortObjects = _sortObjects
      currentRenderList = _currentRenderList
      currentRenderState = _currentRenderState
      projScreenMatrix = _projScreenMatrix
      frame++
      stats.nodes = 0
      stats.queries = 0
      stats.skipRenderSubtreeNoCount = 0
      stats.occluders = 0
      stats.draws = 0
      renderer.clearDepth()
      gl.colorMask(false, false, false, false)
      // console.time('traverse')
      traverse(octree.root)
      // console.timeEnd('traverse')
      gl.colorMask(true, true, true, true)
      gl.depthMask(true)
      renderer.clearDepth()
      // console.log('queries', stats.queries)
      // console.log('nodes', stats.nodes)
      // console.log('occluders', stats.occluders)
      // console.log('draws', stats.draws)
    }
    function traverse(node) {
      stats.nodes++
      // initialize
      if (!node.oc) {
        initNode(node)
      }
      // if node is outside frustum, skip all descendants
      if (!frustum.intersectsBox(node.outer)) {
        return
      }
      // if node encapsulates frustum, render items without query (this node only) and recurse fresh
      if (node.outer.containsPoint(cameraPos)) {
        renderItems(node.items)
        for (const child of sortNodes(node.children)) {
          traverse(child)
        }
        return
      }
      // allow visible nodes to skip frames and reduce query workload
      if (node.oc.visible && node.oc.skips) {
        node.oc.skips--
        renderItems(node.items)
        for (const child of sortNodes(node.children)) {
          traverse(child)
        }
        return
      }
      // no pending queries? issue one!
      if (!node.oc.pending) {
        issueOcclusionQuery(node)
        // return
      }
      // if query is pending check for result (important: we use else here so we dont read immediately after issue)
      else if (node.oc.pending) {
        if (hasQueryResult(node)) {
          const visible = getQueryResult(node)
          if (visible) {
            node.oc.visible = true
            node.oc.skips = 5
          } else {
            node.oc.visible = false
            // hideSubtree(node)
            return
          }
        }
      }
      // not visible? skip entire tree
      if (!node.oc.visible) {
        // hideSubtree(node)
        return
      }
      // don't recurse into tiny nodes, just force visible
      if (node.size < 4) {
        renderSubtree(node)
        return
      }
      // render items
      renderItems(node.items)
      // continue traversal into children
      for (const child of sortNodes(node.children)) {
        traverse(child)
      }
    }
    function renderItems(items) {
      for (const item of items) {
        const object = item._mesh
        if (object) {
          // TODO: instead, update matrixWorld only when changed, deep inside stage etc
          object.matrixWorld.copy(item.matrix)
          renderObject(object)
        }
      }
    }
    function renderSubtree(node) {
      // if this node and all descendant have no objects, we can just skip it all
      if (!node.count) {
        stats.skipRenderSubtreeNoCount++
        return
      }
      if (!node.oc) {
        initNode(node)
      }
      renderItems(node.items)
      node.oc.visible = true
      for (const child of node.children) {
        renderSubtree(child)
      }
    }
    function hideSubtree(node) {
      if (!node.oc) {
        initNode(node)
      }
      node.oc.visible = false
      for (const child of node.children) {
        hideSubtree(child)
      }
    }
    function initNode(node) {
      const geometry = new THREE.BoxGeometry(node.size * 2, node.size * 2, node.size * 2)
      const proxy = new THREE.Mesh(geometry, proxyMat)
      proxy.position.copy(node.center)
      proxy.matrixWorld.compose(proxy.position, proxy.quaternion, proxy.scale)
      proxy.matrix.copy(proxy.matrixWorld)
      proxy.matrixAutoUpdate = false
      proxy.matrixWorldAutoUpdate = false
      proxy.castShadow = false
      proxy.receiveShadow = false
      proxy.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, proxy.matrixWorld)
      proxy.normalMatrix.getNormalMatrix(proxy.modelViewMatrix)
      node.oc = {
        proxy,
        query: gl.createQuery(),
        visible: false,
        skips: 0,
      }
    }
    function hasQueryResult(node) {
      return gl.getQueryParameter(node.oc.query, gl.QUERY_RESULT_AVAILABLE)
    }
    function getQueryResult(node) {
      const result = gl.getQueryParameter(node.oc.query, gl.QUERY_RESULT)
      node.oc.pending = false
      return result > 0
    }
    function issueOcclusionQuery(node) {
      node.oc.pending = true
      stats.queries++
      const proxy = node.oc.proxy
      const geometry = objects.update(proxy)
      const material = proxy.material
      // gl.colorMask(false, false, false, false)
      // gl.depthMask(false)
      gl.beginQuery(gl.ANY_SAMPLES_PASSED, node.oc.query)
      proxy.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, proxy.matrixWorld)
      // proxy.normalMatrix.getNormalMatrix(proxy.modelViewMatrix)
      renderer.renderBufferDirect(
        camera, // camera
        null, // scene (null for direct rendering)
        geometry, // geometry
        proxyMat, // depthOnlyMat, /// material, // material (our proxyMat)
        proxy, // object
        null // group
      )
      gl.endQuery(gl.ANY_SAMPLES_PASSED)
      // gl.colorMask(true, true, true, true)
      // gl.depthMask(true)
    }
    function sortNodes(nodes) {
      // todo: avoid slice :/
      return nodes.slice().sort((a, b) => {
        const distA = getNodeDistance(a)
        const distB = getNodeDistance(b)
        return distA - distB
      })
    }
    function getNodeDistance(node) {
      return node.center.distanceToSquared(cameraPos)
    }
    function renderObject(object, depth = true) {
      // don't try to render more than once per frame (eg from query result changes)
      if (object._frame === frame) return
      object._frame = frame

      if (!object.visible) return // for brevity, can probs remove?
      const visible = object.layers.test(camera.layers)
      if (!visible) return // for brevity, can probs remove?

      if (object.isMesh || object.isLine || object.isPoints) {
        stats.draws++
        const geometry = objects.update(object)
        const material = object.material
        if (depth && isOccluderSized(object, geometry)) {
          stats.occluders++
          // gl.colorMask(false, false, false, false)
          // gl.depthMask(true)
          object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld)
          // object.normalMatrix.getNormalMatrix(object.modelViewMatrix)
          renderer.renderBufferDirect(
            camera,
            null, // scene (null for direct rendering)
            geometry,
            occluderMat,
            object,
            null // group
          )
          // gl.colorMask(true, true, true, true)
          // gl.depthMask(true)
        }
        // TODO: do we even need this sortObjects fluff? whats it for
        if (sortObjects) {
          if (object.boundingSphere !== undefined) {
            if (object.boundingSphere === null) object.computeBoundingSphere()
            vec4.copy(object.boundingSphere.center)
          } else {
            if (geometry.boundingSphere === null) geometry.computeBoundingSphere()
            vec4.copy(geometry.boundingSphere.center)
          }
          vec4.applyMatrix4(object.matrixWorld).applyMatrix4(projScreenMatrix)
        }
        let groupOrder = 0
        if (Array.isArray(material)) {
          const groups = geometry.groups
          for (let i = 0, l = groups.length; i < l; i++) {
            const group = groups[i]
            const groupMaterial = material[group.materialIndex]
            if (groupMaterial && groupMaterial.visible) {
              // TODO: dafuq is groupOrder for in this new occlusion culling universe
              currentRenderList.push(object, geometry, groupMaterial, groupOrder, vec4.z, group)
            }
          }
        } else if (material.visible) {
          // TODO: dafuq is groupOrder for in this new occlusion culling universe
          currentRenderList.push(object, geometry, material, groupOrder, vec4.z, null)
        }
      }
    }
    function isOccluderSized(object, geometry) {
      // Get bounding sphere - prefer object's cached one
      let boundingSphere = object.boundingSphere
      if (!boundingSphere) {
        if (!geometry.boundingSphere) {
          geometry.computeBoundingSphere()
        }
        boundingSphere = geometry.boundingSphere
      }
      if (!boundingSphere) return false
      // Transform bounding sphere center to world space
      const worldCenter = v1.copy(boundingSphere.center).applyMatrix4(object.matrixWorld)
      // Calculate distance from camera to object
      const distance = cameraPos.distanceTo(worldCenter)
      // Get the world-space radius (accounting for object scaling)
      const worldRadius = boundingSphere.radius * object.scale.length() // rough approximation
      // Calculate projected size in pixels
      const fovRadians = camera.fov * (Math.PI / 180)
      const projectedRadius = (worldRadius / distance) * (1 / Math.tan(fovRadians / 2)) * (self.height / 2)
      // Only render as occluder if projected size is above threshold
      const minOccluderSizePixels = 64 // Adjust this threshold as needed
      return projectedRadius >= minOccluderSizePixels
    }
  }

  patchRenderPipelineC() {
    const self = this
    let frame = 0
    let queries = 0
    const _vec4 = new THREE.Vector4()
    const octree = this.world.stage.octree
    const renderer = this.renderer
    const ctx = {
      scene: null,
      camera: null,
      cameraPos: new THREE.Vector3(),
      frustum: new THREE.Frustum(),
      objects: null,
      sortObjects: null,
      currentRenderList: null,
      currentRenderState: null,
      _projScreenMatrix: new THREE.Matrix4(),
    }
    // const traversalQueue = []
    const traversalQueue = new PriorityQueue()
    const queryQueue = []
    const gl = this.renderer.getContext()
    // const proxyMat = new THREE.MeshDepthMaterial({ colorWrite: false, depthWrite: false })
    // const occluderMat = new THREE.MeshDepthMaterial({ colorWrite: false })
    const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: true }) // only reads
    const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true })
    // const depthOnlyMat = new THREE.ShaderMaterial({
    //   vertexShader: `
    //     void main() {
    //       gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    //     }
    //   `,
    //   fragmentShader: `
    //     void main() {
    //       // no color output
    //     }
    //   `,
    //   depthWrite: false,
    //   depthTest: true,
    //   colorWrite: false,
    // })
    renderer.projectSpatial = (
      scene,
      camera,
      frustum,
      objects,
      sortObjects,
      currentRenderList,
      currentRenderState,
      _projScreenMatrix
    ) => {
      // traversalQueue.length = 0
      // queryQueue.length = 0

      // ctx.camera = this.world.camera
      // ctx.cameraPos.setFromMatrixPosition(ctx.camera.matrixWorld)

      // ctx._projScreenMatrix.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse)
      // ctx.frustum.setFromProjectionMatrix(ctx._projScreenMatrix)

      ctx.scene = scene
      ctx.camera = camera
      ctx.cameraPos.setFromMatrixPosition(camera.matrixWorld)
      ctx.frustum = frustum
      ctx.objects = objects
      ctx.sortObjects = sortObjects
      ctx.currentRenderList = currentRenderList
      ctx.currentRenderState = currentRenderState
      ctx._projScreenMatrix = _projScreenMatrix
      frame++
      renderer.clearDepth()
      // renderer.clear(true, true, true)
      // gl.enable(gl.DEPTH_TEST)
      // gl.depthFunc(gl.LEQUAL)

      queries = 0

      traversalQueue.enqueue(octree.root, 0)
      while (!traversalQueue.isEmpty() || queryQueue.length) {
        while (queryQueue.length && (hasQueryResult(queryQueue[0]) || traversalQueue.isEmpty())) {
          // while (queryQueue.length && hasQueryResult(queryQueue[0])) {
          const node = queryQueue.shift()
          const visible = !hasQueryResult(node) ? false : getQueryResult(node)
          // const visible = getQueryResult(node)

          // if (visible) console.log('HOLY MOLY VISIBLE')
          // console.log(visible)

          // console.log(traversalQueue.isEmpty())

          // debug
          if (!visible) {
            // node.oc.debug.material.color.set(visible ? 'green' : 'red')
            // node.oc.debug.material.needsUpdate = true
            // renderObject(node.oc.debug, false)
          }

          if (visible) {
            pullUpVisibility(node)
            traverseNode(node)
          }
        }
        // if (traversalQueue.isEmpty() && (!queryQueue.length || !hasQueryResult(queryQueue[0]))) {
        //   break
        // }
        if (!traversalQueue.isEmpty()) {
          const node = traversalQueue.dequeue()
          const inFrustm = ctx.frustum.intersectsBox(node.outer)
          if (!node.oc) initNode(node)

          if (inFrustm) {
            // if (!node.oc) initNode(node)
            // near-plane check (eg cover frustum near wont render any depth)
            if (node.outer.containsPoint(ctx.cameraPos)) {
              node.oc.visible = true
              node.oc.lastVisited = frame
              traverseNode(node)
              continue
            }
            // identify previously visible nodes
            const wasVisible = node.oc.visible && node.oc.lastVisited === frame - 1
            // identify nodes that we cannot skip queries for
            // const leafOrWasInvisible = !wasVisible || isLeaf(node)
            const shouldQuery = !wasVisible || isInterior(node)
            // const shouldQuery = !wasVisible || (isInterior(node) && node.size >= 10)
            // const shouldQuery = !wasVisible || (isInterior(node) && projectedHalfHeightPx(node) > 32)
            // reset node's visibility classification
            // node.oc.visible = false
            // update node's visited flag
            node.oc.lastVisited = frame
            // skip testing previously visible interior nodes
            // if (leafOrWasInvisible) {
            if (shouldQuery) {
              issueOcclusionQuery(node)
              queryQueue.push(node)
            }
            // always traverse a node if it was visible
            if (wasVisible) {
              traverseNode(node)
            }
          }
        }
      }
      renderer.clearDepth()
      // renderer.clear()
      console.log('queries', queries)
    }
    function initNode(node) {
      const geometry = new THREE.BoxGeometry(node.size * 2, node.size * 2, node.size * 2)
      const proxy = new THREE.Mesh(geometry, proxyMat)
      proxy.position.copy(node.center)
      proxy.matrixWorld.compose(proxy.position, proxy.quaternion, proxy.scale)
      proxy.matrix.copy(proxy.matrixWorld)
      proxy.matrixAutoUpdate = false
      proxy.matrixWorldAutoUpdate = false
      proxy.castShadow = false
      proxy.receiveShadow = false
      proxy.modelViewMatrix.multiplyMatrices(ctx.camera.matrixWorldInverse, proxy.matrixWorld)
      proxy.normalMatrix.getNormalMatrix(proxy.modelViewMatrix)

      // debug mesh
      const debug = new THREE.LineSegments(
        new THREE.BoxGeometry(node.size * 2, node.size * 2, node.size * 2),
        new THREE.LineBasicMaterial({ color: 'red', depthWrite: false })
      )
      debug.position.copy(node.center)
      debug.matrixWorld.compose(debug.position, debug.quaternion, debug.scale)
      debug.matrixAutoUpdate = false
      debug.matrixWorldAutoUpdate = false
      debug.castShadow = false
      debug.receiveShadow = false

      node.oc = {
        debug,
        proxy,
        query: gl.createQuery(),
        visible: false,
        lastVisited: -999,
      }
    }
    function hasQueryResult(node) {
      return gl.getQueryParameter(node.oc.query, gl.QUERY_RESULT_AVAILABLE)
    }
    function getQueryResult(node) {
      const result = gl.getQueryParameter(node.oc.query, gl.QUERY_RESULT)
      node.oc.pending = false
      if (!result) {
        node.oc.visible = false
        // node.oc.lastVisited = frame
      }
      // console.log(result > 0)
      return result > 0
    }
    function issueOcclusionQuery(node) {
      if (node.oc.pending) return
      node.oc.pending = true
      queries++
      const proxy = node.oc.proxy
      const geometry = ctx.objects.update(proxy)
      const material = proxy.material
      // gl.enable(gl.DEPTH_TEST)
      // gl.depthFunc(gl.LEQUAL)
      gl.colorMask(false, false, false, false)
      gl.depthMask(false)
      gl.beginQuery(gl.ANY_SAMPLES_PASSED, node.oc.query)
      proxy.modelViewMatrix.multiplyMatrices(ctx.camera.matrixWorldInverse, proxy.matrixWorld)
      proxy.normalMatrix.getNormalMatrix(proxy.modelViewMatrix)
      renderer.renderBufferDirect(
        ctx.camera, // camera
        null, // scene (null for direct rendering)
        geometry, // geometry
        proxyMat, // depthOnlyMat, /// material, // material (our proxyMat)
        proxy, // object
        null // group
      )
      gl.endQuery(gl.ANY_SAMPLES_PASSED)
      // gl.finish()
      gl.colorMask(true, true, true, true)
      gl.depthMask(true)
      // const visible = Boolean(gl.getQueryParameter(node.oc.query, gl.QUERY_RESULT))
      // console.log('occlusion result:', visible) // you should now see `true` for un-occluded boxes
    }
    function isLeaf(node) {
      return node.children.length === 0
      // return node.items.length > 0
    }
    function isInterior(node) {
      return node.children.length > 0
    }

    function pullUpVisibility(node) {
      while (!node.oc.visible) {
        node.oc.visible = true
        node = node.parent
      }
    }
    function traverseNode(node) {
      for (const item of node.items) {
        const object = item._mesh
        if (object) {
          // TODO: instead, update matrixWorld only when changed, deep inside stage etc
          object.matrixWorld.copy(item.matrix)
          renderObject(object)
        }
      }
      for (const child of node.children) {
        traversalQueue.enqueue(child, getNodeDistance(child))
      }
      // for (const child of sortNodes(node.children)) {
      //   traversalQueue.push(child)
      // }
    }
    function sortNodes(nodes) {
      // todo: avoid slice :/
      return nodes.slice().sort((a, b) => {
        const distA = getNodeDistance(a)
        const distB = getNodeDistance(b)
        return distA - distB
      })
    }
    function projectedHalfHeightPx(node) {
      // 1. Get node’s center in world space
      // v1.setFromMatrixPosition(node.center)

      // 2. Compute distance along the view (use straight euclidean for simplicity)
      const distance = ctx.camera.position.distanceTo(node.center)

      // 3. Convert vertical FOV to radians
      const fovRadians = ctx.camera.fov * (Math.PI / 180)

      // 4. The focal “scale” is 1 / tan(fov/2)
      const focalScale = 1 / Math.tan(fovRadians / 2)

      // 5. projectedHalfHeight in NDC is (node.size / distance) * focalScale
      //    NDC y ∈ [−1,1] maps to ±renderer.height/2 in pixels
      return (node.size / distance) * focalScale * (self.height / 2)
    }
    function getNodeDistance(node) {
      return node.center.distanceToSquared(ctx.cameraPos)
    }
    function renderObject(object, depth = true) {
      // don't try to render more than once per frame (eg from query result changes)
      if (object._frame === frame) return
      object._frame = frame

      if (!object.visible) return // for brevity, can probs remove?
      const visible = object.layers.test(ctx.camera.layers)
      if (!visible) return // for brevity, can probs remove?

      if (object.isMesh || object.isLine || object.isPoints) {
        const geometry = ctx.objects.update(object)
        const material = object.material
        if (depth) {
          gl.colorMask(false, false, false, false)
          gl.depthMask(true)
          object.modelViewMatrix.multiplyMatrices(ctx.camera.matrixWorldInverse, object.matrixWorld)
          object.normalMatrix.getNormalMatrix(object.modelViewMatrix)
          renderer.renderBufferDirect(
            ctx.camera, // camera
            null, // scene (null for direct rendering)
            geometry, // geometry
            occluderMat, // material
            object, // object
            null // group
          )
          gl.colorMask(true, true, true, true)
          // gl.depthMask(true)
        }

        // TODO: do we even need this sortObjects fluff? whats it for
        if (ctx.sortObjects) {
          if (object.boundingSphere !== undefined) {
            if (object.boundingSphere === null) object.computeBoundingSphere()
            _vec4.copy(object.boundingSphere.center)
          } else {
            if (geometry.boundingSphere === null) geometry.computeBoundingSphere()
            _vec4.copy(geometry.boundingSphere.center)
          }
          _vec4.applyMatrix4(object.matrixWorld).applyMatrix4(ctx._projScreenMatrix)
        }
        if (Array.isArray(material)) {
          const groups = geometry.groups
          for (let i = 0, l = groups.length; i < l; i++) {
            const group = groups[i]
            const groupMaterial = material[group.materialIndex]
            if (groupMaterial && groupMaterial.visible) {
              // TODO: dafuq is groupOrder for in this new occlusion culling universe
              ctx.currentRenderList.push(object, geometry, groupMaterial, ctx.groupOrder, _vec4.z, group)
            }
          }
        } else if (material.visible) {
          // TODO: dafuq is groupOrder for in this new occlusion culling universe
          ctx.currentRenderList.push(object, geometry, material, ctx.groupOrder, _vec4.z, null)
        }
      }
    }
  }

  patchShadowPipeline() {
    const self = this
    const octree = this.world.stage.octree
    const ctx = {
      scene: null,
      camera: null,
      shadowCamera: null,
      shadowCameraPos: new THREE.Vector3(),
      light: null,
      type: null,
      frustum: null,
      objects: null,
      renderer: null,
      getDepthMaterial: null,
    }
    this.renderer.shadowMap.renderSpatial = function (
      scene,
      camera,
      shadowCamera,
      light,
      type,
      frustum,
      objects,
      renderer,
      getDepthMaterial
    ) {
      ctx.scene = scene
      ctx.camera = camera
      ctx.shadowCamera = shadowCamera
      ctx.shadowCameraPos.setFromMatrixPosition(shadowCamera.matrixWorld)
      ctx.light = light
      ctx.type = type
      ctx.frustum = frustum
      ctx.objects = objects
      ctx.renderer = renderer
      ctx.getDepthMaterial = getDepthMaterial
      traverse(octree.root, ctx)
    }
    function traverse(node, ctx) {
      if (!ctx.frustum.intersectsBox(node.outer)) {
        return
      }
      for (const item of node.items) {
        renderObject(
          item,
          ctx.camera,
          ctx.shadowCamera,
          ctx.light,
          ctx.type,
          ctx.objects,
          ctx.renderer,
          ctx.getDepthMaterial
        )
      }
      for (const child of sortNodes(node.children)) {
        traverse(child, ctx)
      }
    }
    function renderObject(item, camera, shadowCamera, light, type, objects, renderer, getDepthMaterial) {
      const object = item._mesh
      if (!object) return
      if (!object.visible) return
      const visible = object.layers.test(camera.layers)
      if (!visible) return
      if (object.castShadow || (object.receiveShadow && type === THREE.VSMShadowMap)) {
        object.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, object.matrixWorld)
        const geometry = objects.update(object)
        const material = object.material
        if (Array.isArray(material)) {
          const groups = geometry.groups
          for (let k = 0, kl = groups.length; k < kl; k++) {
            const group = groups[k]
            const groupMaterial = material[group.materialIndex]
            if (groupMaterial && groupMaterial.visible) {
              const depthMaterial = getDepthMaterial(object, groupMaterial, light, type)
              object.onBeforeShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, group)
              renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, group)
              object.onAfterShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, group)
            }
          }
        } else if (material.visible) {
          const depthMaterial = getDepthMaterial(object, material, light, type)
          object.onBeforeShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, null)
          renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, null)
          object.onAfterShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, null)
        }
      }
    }
    function sortNodes(nodes) {
      // todo: avoid slice :/
      return nodes.slice().sort((a, b) => {
        const distA = getNodeDistance(a)
        const distB = getNodeDistance(b)
        return distA - distB
      })
    }
    function getNodeDistance(node) {
      return node.center.distanceToSquared(ctx.shadowCameraPos)
    }
  }
}

class PriorityQueue {
  constructor() {
    this._heap = []
  }
  get size() {
    return this._heap.length
  }
  isEmpty() {
    return this.size === 0
  }

  enqueue(node, priority) {
    // store both the node and its priority
    this._heap.push({ node, priority })
    this._siftUp()
  }

  dequeue() {
    if (this.isEmpty()) return null
    const top = this._heap[0].node
    const last = this._heap.pop()
    if (!this.isEmpty()) {
      this._heap[0] = last
      this._siftDown()
    }
    return top
  }

  _siftUp() {
    let idx = this._heap.length - 1
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2)
      if (this._heap[parent].priority <= this._heap[idx].priority) break
      ;[this._heap[parent], this._heap[idx]] = [this._heap[idx], this._heap[parent]]
      idx = parent
    }
  }

  _siftDown() {
    let idx = 0,
      left,
      right,
      smallest
    const n = this._heap.length
    while ((left = 2 * idx + 1) < n) {
      right = left + 1
      smallest = left
      if (right < n && this._heap[right].priority < this._heap[left].priority) {
        smallest = right
      }
      if (this._heap[smallest].priority >= this._heap[idx].priority) break
      ;[this._heap[idx], this._heap[smallest]] = [this._heap[smallest], this._heap[idx]]
      idx = smallest
    }
  }
}
