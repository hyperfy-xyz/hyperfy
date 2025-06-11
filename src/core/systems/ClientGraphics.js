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
import { looseOctreeTraverse } from '../extras/looseOctreeTraverse'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()

let renderer
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
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
    this.occlusion = this.world.settings.occlusion
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
    // console.log('---')
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
    if (changes.occlusion) {
      this.occlusion = changes.occlusion.value
    }
    if (changes.ao) {
      this.aoPass.enabled = changes.ao.value && this.world.prefs.ao
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
    const batches = new WeakMap() // renderable -> batch { renderable, items, count, pass } { imesh }
    const screenSpaceTester = createScreenSpaceTester()
    let pass = 0
    let scene
    let camera
    let cameraPos = new THREE.Vector3()
    let frustum = new THREE.Frustum()
    let objects
    let sortObjects
    let currentRenderList
    let currentRenderState
    let projScreenMatrix = new THREE.Matrix4()
    let active = []
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
    // const occlusionFBO = new THREE.WebGLRenderTarget(512, 512, {
    //   depthBuffer: true,
    //   depthTexture: new THREE.DepthTexture(512, 512, THREE.UnsignedShortType),
    // })
    // occlusionFBO.texture.minFilter = THREE.NearestFilter
    // occlusionFBO.texture.magFilter = THREE.NearestFilter
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
      // ignore if different scene, eg postprocessing etc
      if (_scene !== this.world.stage.scene) return

      scene = _scene
      camera = _camera
      cameraPos.setFromMatrixPosition(camera.matrixWorld)
      frustum = _frustum
      objects = _objects
      sortObjects = _sortObjects
      currentRenderList = _currentRenderList
      currentRenderState = _currentRenderState
      projScreenMatrix = _projScreenMatrix
      pass++
      active.length = 0
      stats.nodes = 0
      stats.queries = 0
      stats.skipRenderSubtreeNoCount = 0
      stats.occluders = 0
      stats.draws = 0
      stats.micro = 0

      screenSpaceTester.update(self.height, camera)

      // const prevRT = renderer.getRenderTarget()
      // const prevColorMask = gl.getParameter(gl.COLOR_WRITEMASK) // [r,g,b,a]
      // const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK) // Boolean
      // const prevDepthTest = gl.getParameter(gl.DEPTH_TEST) // Boolean
      // renderer.setRenderTarget(occlusionFBO)
      // renderer.clearDepth() // clear depth to “far”
      // gl.colorMask(false, false, false, false) // no color writes
      // gl.depthMask(false) // no depth writes
      // traverse(octree.root)
      // gl.colorMask(
      //   prevColorMask[0], // r
      //   prevColorMask[1], // g
      //   prevColorMask[2], // b
      //   prevColorMask[3] // a
      // )
      // gl.depthMask(prevDepthMask)
      // if (prevDepthTest) {
      //   gl.enable(gl.DEPTH_TEST)
      // } else {
      //   gl.disable(gl.DEPTH_TEST)
      // }
      // renderer.setRenderTarget(prevRT)

      // renderer.clearDepth()
      // const prevColorMask = gl.getParameter(gl.COLOR_WRITEMASK) // [r,g,b,a]
      // const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK) // Boolean
      // const prevDepthTest = gl.getParameter(gl.DEPTH_TEST) // Boolean
      // gl.colorMask(false, false, false, false) // no color writes
      // gl.depthMask(false) // no depth writes
      // traverse(octree.root)
      // gl.colorMask(
      //   prevColorMask[0], // r
      //   prevColorMask[1], // g
      //   prevColorMask[2], // b
      //   prevColorMask[3] // a
      // )
      // gl.depthMask(prevDepthMask)
      // if (prevDepthTest) {
      //   gl.enable(gl.DEPTH_TEST)
      // } else {
      //   gl.disable(gl.DEPTH_TEST)
      // }
      // renderer.clearDepth()

      renderer.clearDepth()
      gl.colorMask(false, false, false, false)
      // console.time('traverse')
      traverse(octree.root)
      // console.timeEnd('traverse')
      gl.colorMask(true, true, true, true)
      gl.depthMask(true)
      renderer.clearDepth()

      // let n = 0
      // for (const batch of active) {
      //   n += batch.items.length
      // }
      // console.log(n)

      // console.log(active.length)
      // console.log(stats.micro)

      // console.time('render')
      for (const batch of active) {
        // single objects
        if (batch.count === 1) {
          const mesh = batch.renderable.mesh
          mesh.matrixWorld.copy(batch.items[0].matrix)
          renderObject(mesh)
        }
        // instanced objects
        else {
          let imesh = batch.imesh
          const size = imesh ? imesh.instanceMatrix.array.length / 16 : -1
          const count = batch.count
          // if imesh isn't big enough, make it bigger
          if (size < count) {
            // free up instanceMatrix on GPU from any previous imesh
            imesh?.dispose()
            // create a new one
            const mesh = batch.renderable.mesh
            imesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, count)
            imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
            imesh.castShadow = mesh.castShadow
            imesh.receiveShadow = mesh.receiveShadow
            imesh.matrixAutoUpdate = false
            imesh.matrixWorldAutoUpdate = false
            imesh.frustumCulled = false
            batch.imesh = imesh
            batch.changed = true
          }
          // count can shrink without batch change
          imesh.count = count
          // if items changed since last time, repopulate!
          if (batch.changed) {
            for (let i = 0; i < count; i++) {
              imesh.setMatrixAt(i, batch.items[i].matrix)
            }
            imesh.instanceMatrix.needsUpdate = true
            //
            batch.changed = false
          }
          renderObject(imesh)
        }
      }
      // console.timeEnd('render')

      // console.log('queries', stats.queries)
      // console.log('nodes', stats.nodes)
      // console.log('occluders', stats.occluders)
      // console.log('draws', stats.draws)
    }
    function showNode(node) {
      const size = node.outer.getSize(new THREE.Vector3())
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
      const center = node.outer.getCenter(new THREE.Vector3())
      // console.log(size.x, size.y, size.z, node.size * 4)
      // console.log(center.toArray(), node.center.toArray())
      // const color = '#' + Math.floor(Math.random() * 16777215).toString(16)
      const color = 'red'
      const material = new THREE.MeshBasicMaterial({ wireframe: true, color })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(center)
      self.world.stage.scene.add(mesh)
    }
    function explain(top, node, msg) {
      for (const item of node.items) {
        if (item.node?.id === 'frills') {
          // console.log(msg)
          if (globalThis.foo) {
            showNode(top)
            globalThis.foo = false
          }
          // console.log(top.outer.containsPoint(cameraPos))
        }
      }
      for (const child of node.children) {
        explain(top, child, msg)
      }
    }
    function traverse(node) {
      stats.nodes++
      // initialize
      if (!node.oc) {
        initNode(node)
      }
      // if node is outside frustum, skip all descendants
      if (!frustum.intersectsBox(node.outer)) {
        // explain(node, node, 'outside frustum')
        return
      }
      if (self.occlusion) {
        // if node encapsulates frustum, render items without query (this node only) and recurse fresh
        // if (node.outer.containsPoint(cameraPos)) {
        // note: we have to do it like this because frustum is in front of cameraPos by camera.near amount!
        if (node.outer.distanceToPoint(cameraPos) <= camera.near) {
          node.oc.visible = true
          renderItems(node.items)
          looseOctreeTraverse(cameraPos, node, traverse)
          return
        }
        // allow visible nodes to skip frames and reduce query workload
        if (node.oc.visible && node.oc.skips) {
          node.oc.skips--
          renderItems(node.items)
          looseOctreeTraverse(cameraPos, node, traverse)
          return
        }
        // no pending queries? issue one!
        if (!node.oc.pending) {
          const exhausted = node.oc.visible ? stats.queries > 100 : false
          if (!exhausted) {
            issueOcclusionQuery(node)
          }
          // return
        }
        // if query is pending check for result (important: we use else here so we dont read immediately after issue)
        else if (node.oc.pending) {
          if (hasQueryResult(node)) {
            const visible = getQueryResult(node)
            if (visible) {
              node.oc.visible = true
              node.oc.skips = 5
              // mark tree visible + give skips
              // showSubtree(node)
            } else {
              node.oc.visible = false
            }
          }
        }
        // not visible? skip entire tree
        if (!node.oc.visible) {
          // explain(node, node, 'query result hidden 2')
          // hideSubtree(node)
          return
        }
        // don't recurse into tiny nodes, just force visible
        // if (node.size < 4) {
        //   renderSubtree(node)
        //   return
        // }
      }
      // render items
      renderItems(node.items)
      // continue traversal into children
      looseOctreeTraverse(cameraPos, node, traverse)
    }
    function renderItems(items) {
      for (const item of items) {
        renderItem(item)
        // const object = item._mesh
        // if (object) {
        //   // TODO: instead, update matrixWorld only when changed, deep inside stage etc
        //   object.matrixWorld.copy(item.matrix)
        //   renderObject(object)
        // }
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
    function showSubtree(node) {
      if (!node.oc) {
        initNode(node)
      }
      node.oc.visible = true
      node.oc.skips = 60
      for (const child of node.children) {
        showSubtree(child)
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
      const geometry = new THREE.BoxGeometry(node.size * 4, node.size * 4, node.size * 4) // outer
      const proxy = new THREE.Mesh(geometry, proxyMat)
      proxy.position.copy(node.center)
      proxy.matrixWorld.compose(proxy.position, proxy.quaternion, proxy.scale)
      proxy.matrix.copy(proxy.matrixWorld)
      proxy.matrixAutoUpdate = false
      proxy.matrixWorldAutoUpdate = false
      proxy.castShadow = false
      proxy.receiveShadow = false
      proxy.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, proxy.matrixWorld)
      // proxy.normalMatrix.getNormalMatrix(proxy.modelViewMatrix)
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
      return nodes.slice().sort(sortNodesFn)
    }
    function sortNodesFn(a, b) {
      return a.center.distanceToSquared(cameraPos) - b.center.distanceToSquared(cameraPos)
    }
    function renderItem(item) {
      // don't render more than once per pass
      if (item._renderPass === pass) return
      item._renderPass = pass

      const renderable = item.renderable
      if (renderable) {
        const mesh = renderable.mesh
        mesh.matrixWorld.copy(item.matrix)

        // calculateScreenSpace(mesh)

        // if (screenSpaceTester.test(item, mesh) < 5) {
        //   stats.micro++
        //   return
        // }

        // if (mesh.screenSpacePx < 15) {
        //   stats.micro++
        //   return
        // }

        // check if we should render depth as an occluder
        if (self.occlusion && isOccluder(item, mesh)) {
          const geometry = objects.update(mesh)
          stats.occluders++
          mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld)
          renderer.renderBufferDirect(
            camera,
            null, // scene (null for direct rendering)
            geometry,
            occluderMat,
            mesh,
            null // group
          )
        }

        // collect items in batches to render later
        let batch = batches.get(renderable)
        if (!batch) {
          batch = { renderable, items: [], count: 0, pass }
          batches.set(renderable, batch)
          active.push(batch)
        }
        if (batch.pass !== pass) {
          batch.pass = pass
          batch.count = 0
          active.push(batch)
        }
        if (batch.items[batch.count] !== item) {
          batch.items[batch.count] = item
          batch.changed = true
        }
        if (item.move !== item._renderMove) {
          item._renderMove = item.move
          batch.changed = true
        }
        batch.count++
      }
    }
    function renderObject(object) {
      // // don't try to render more than once per pass (eg from query result changes)
      // if (object._renderPass === pass) return
      // object._renderPass = pass

      // if (!object.visible) return // for brevity, can probs remove?
      // const visible = object.layers.test(camera.layers)
      // if (!visible) return // for brevity, can probs remove?

      if (object.isMesh || object.isLine || object.isPoints) {
        stats.draws++
        const geometry = objects.update(object)
        const material = object.material
        // object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld)

        // transparent objects need to be ordered back to front
        if (sortObjects && material.transparent) {
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
    function calculateScreenSpace(mesh) {
      let sphere = mesh.geometry.boundingSphere
      if (!sphere) {
        mesh.geometry.computeBoundingSphere()
        sphere = mesh.geometry.boundingSphere
      }
      const worldCenter = v1.copy(sphere.center).applyMatrix4(mesh.matrixWorld)
      const worldRadius = (sphere.radius * v2.setFromMatrixScale(mesh.matrixWorld).length()) / Math.sqrt(3)
      const toCenter = v2.subVectors(worldCenter, cameraPos)
      const dist = toCenter.length()
      if (dist <= 0) {
        mesh.screenSpacePx = 999 // this.width * this.height
        return
      } else {
        // angular radius (in radians) ≈ asin( radius / distance )
        const angularRadius = Math.asin(worldRadius / dist)
        // Now convert angular‐radius to screen‐space (in pixels):
        //   On a perspective camera, fov = vertical field of view (degrees)
        //   A point at angular offset θ from camera‐forward will land at
        //   y_ndc = tan(θ) / tan(fov/2), in normalized device coords (vertically).
        //
        // We can approximate the projected “screen‐radius” (in pixels) by:
        const fovInRadians = (camera.fov * Math.PI) / 180
        // If angularRadius is small, tan(angularRadius) ≈ angularRadius, so:
        const projectedRadiusNdc = Math.tan(angularRadius) / Math.tan(fovInRadians / 2)
        // NDC coordinates run from –1..+1 in y, so NDC→pixel: pixel_y = (NDC_y * 0.5 + 0.5) * window.innerHeight.
        // The factor “.5 * window.innerHeight” converts an NDC half‐height to actual pixel half‐height.
        const radiusPixels = projectedRadiusNdc * (self.height / 2)
        const diameterPixels = 2 * radiusPixels
        mesh.screenSpacePx = diameterPixels
        // For a (rough) pixel‐area, assume a circle:
        // const estimatedPixelArea = Math.PI * radiusPixels * radiusPixels
        // mesh.screenSpacePx = estimatedPixelArea
      }
      // // Get bounding sphere - prefer object's cached one
      // let boundingSphere = mesh.boundingSphere
      // if (!boundingSphere) {
      //   if (!mesh.geometry.boundingSphere) {
      //     mesh.geometry.computeBoundingSphere()
      //   }
      //   boundingSphere = mesh.geometry.boundingSphere
      // }
      // if (!boundingSphere) return false
      // // Transform bounding sphere center to world space
      // const worldCenter = v1.copy(boundingSphere.center).applyMatrix4(mesh.matrixWorld)
      // // Calculate distance from camera to mesh
      // const distance = cameraPos.distanceTo(worldCenter)
      // // Get the world-space radius (accounting for mesh scaling)
      // const worldRadius = boundingSphere.radius * v2.setFromMatrixScale(mesh.matrixWorld).length() // rough approximation
      // // Calculate projected size in pixels
      // const fovRadians = camera.fov * (Math.PI / 180)
      // const projectedRadius = (worldRadius / distance) * (1 / Math.tan(fovRadians / 2)) * (self.height / 2)
      // mesh.screenSpacePx = projectedRadius
    }
    function isOccluder(item, mesh) {
      // if its transparent/alpha-clip it cant occlude!
      if (mesh.material.transparent || mesh.material.alphaTest) {
        return false
      }
      // return true
      return screenSpaceTester.test(item, mesh) > 50
      // Only render as occluder if projected size is above threshold
      // const minOccluderSizePixels = 50 // Adjust this threshold as needed
      // return mesh.screenSpacePx >= minOccluderSizePixels
    }
  }

  patchShadowPipeline() {
    const self = this
    const octree = this.world.stage.octree
    const gl = this.renderer.getContext()
    const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: true })
    // this.world.setupMaterial(proxyMat)
    // const iMeshes = new Map() // model -> InstanceMesh
    const batches = new WeakMap() // renderable -> batch { renderable, items, count, pass } { imesh }
    const active = []
    let pass = 0
    let scene
    let camera
    let shadowCamera
    let shadowCameraPos = new THREE.Vector3()
    let light
    let type
    let frustum
    let objects
    let renderer
    let getDepthMaterial
    this.renderer.shadowMap.renderSpatial = (
      _scene,
      _camera,
      _shadowCamera,
      _light,
      _type,
      _frustum,
      _objects,
      _renderer,
      _getDepthMaterial
    ) => {
      // ignore if different scene, eg postprocessing etc
      if (_scene !== this.world.stage.scene) return

      scene = _scene
      camera = _camera
      shadowCamera = _shadowCamera
      shadowCameraPos.setFromMatrixPosition(shadowCamera.matrixWorld)
      light = _light
      type = _type
      frustum = _frustum
      objects = _objects
      renderer = _renderer
      getDepthMaterial = _getDepthMaterial
      pass++
      active.length = 0
      // console.time('sTraverse')
      // renderer.clearDepth()
      // gl.colorMask(false, false, false, false)
      // gl.depthMask(true)
      traverse(octree.root)

      // if (globalThis.lol >= 0 && globalThis.lol < 3) {
      //   const _projScreenMatrix = /*@__PURE__*/ new THREE.Matrix4()
      //   const _lightPositionWorld = /*@__PURE__*/ new THREE.Vector3()
      //   const _lookTarget = /*@__PURE__*/ new THREE.Vector3()
      //   const shadowCamera = light.shadow.camera
      //   const shadowMatrix = light.shadow.matrix

      //   _lightPositionWorld.setFromMatrixPosition(light.matrixWorld)
      //   shadowCamera.position.copy(_lightPositionWorld)

      //   _lookTarget.setFromMatrixPosition(light.target.matrixWorld)
      //   shadowCamera.lookAt(_lookTarget)
      //   shadowCamera.updateMatrixWorld()

      //   _projScreenMatrix.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse)
      //   light.shadow._frustum.setFromProjectionMatrix(_projScreenMatrix)

      //   shadowMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0)

      //   shadowMatrix.multiply(_projScreenMatrix)

      //   self.world.stage.scene.add(createFrustumWireframe(_projScreenMatrix))

      //   frustum._bar = true

      //   globalThis.lol++

      //   console.log('LOL')
      // }

      // console.timeEnd('sTraverse')

      // console.time('sRender')
      for (const batch of active) {
        let imesh = batch.imesh
        const size = imesh ? imesh.instanceMatrix.array.length / 16 : 0
        const count = batch.count
        // if imesh isn't big enough, create a bigger one
        if (size < count) {
          // free up instanceMatrix on GPU from any previous imesh
          imesh?.dispose()
          // create a new one
          const mesh = batch.renderable.mesh
          imesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, count)
          imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          imesh.castShadow = mesh.castShadow
          imesh.receiveShadow = mesh.receiveShadow
          imesh.matrixAutoUpdate = false
          imesh.matrixWorldAutoUpdate = false
          imesh.frustumCulled = false
          batch.imesh = imesh
          batch.changed = true
        }
        // count can shrink without batch change
        imesh.count = count
        // if items changed since last time, repopulate and push to gpu!
        if (batch.changed) {
          for (let i = 0; i < count; i++) {
            imesh.setMatrixAt(i, batch.items[i].matrix)
          }
          imesh.instanceMatrix.needsUpdate = true
          // HACK: threejs only allows pushing instanceMatrix changes to the GPU once per frame
          // but since we build the instances manually on each pass (multiple per frame) we need to force push this to the GPU.
          // this could be more efficient with a `renderer.pushAttribute()` or something that does it more directly.
          // see: WebGLObjects
          const currFrame = renderer.info.render.frame
          renderer.info.render.frame = -1
          objects.update(imesh)
          renderer.info.render.frame = currFrame
          //
          batch.changed = false
        }
        renderObject(imesh)
      }
      // console.timeEnd('sRender')
    }
    // function check(node) {
    //   if (frustum.intersectsBox(node.outer)) {
    //     console.log('WTF')
    //   }
    //   for (const item of node.items) {
    //     if (frustum.intersectsSphere(item.sphere)) {
    //       console.log('WTF2')
    //     }
    //     // if (item.node?.id === 'Furnace_2') {
    //     if (item.node?.id === 'Cube310') {
    //       // console.log('OOF', item.sphere)
    //       if (globalThis.foo && !node._foo) {
    //         const size = node.outer.getSize(new THREE.Vector3())
    //         const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
    //         const center = node.outer.getCenter(new THREE.Vector3())
    //         console.log(size.x, size.y, size.z, node.size * 4)
    //         console.log(center.toArray(), node.center.toArray())

    //         // const geometry = new THREE.BoxGeometry(node.size * 4, node.size * 4, node.size * 4) // outer
    //         const color = '#' + Math.floor(Math.random() * 16777215).toString(16)
    //         const material = new THREE.MeshBasicMaterial({ wireframe: true, color })
    //         const mesh = new THREE.Mesh(geometry, material)
    //         // mesh.position.copy(node.center)
    //         mesh.position.copy(center)
    //         // mesh.position.x += Math.random()
    //         self.world.stage.scene.add(mesh)
    //         console.log('ADDED')
    //         node._foo = true

    //         // const cam = new THREE.CameraHelper(light.shadow.camera)
    //         // self.world.stage.scene.add(cam)

    //         // const sp = new THREE.Mesh(new THREE.SphereGeometry(item.sphere.radius), new THREE.MeshBasicMaterial())
    //         // sp.position.copy(item.sphere.center)
    //         // self.world.stage.scene.add(sp)
    //       }
    //       if (globalThis.foo && !frustum._bar) {
    //         const _projScreenMatrix = /*@__PURE__*/ new THREE.Matrix4()
    //         const _lightPositionWorld = /*@__PURE__*/ new THREE.Vector3()
    //         const _lookTarget = /*@__PURE__*/ new THREE.Vector3()
    //         const shadowCamera = light.shadow.camera
    //         const shadowMatrix = light.shadow.matrix

    //         _lightPositionWorld.setFromMatrixPosition(light.matrixWorld)
    //         shadowCamera.position.copy(_lightPositionWorld)

    //         _lookTarget.setFromMatrixPosition(light.target.matrixWorld)
    //         shadowCamera.lookAt(_lookTarget)
    //         shadowCamera.updateMatrixWorld()

    //         _projScreenMatrix.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse)
    //         light.shadow._frustum.setFromProjectionMatrix(_projScreenMatrix)

    //         shadowMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0)

    //         shadowMatrix.multiply(_projScreenMatrix)

    //         self.world.stage.scene.add(createFrustumWireframe(_projScreenMatrix))

    //         frustum._bar = true

    //         console.log('FRUST')
    //       }
    //     }
    //   }
    //   for (const child of node.children) {
    //     check(child)
    //   }
    // }
    function traverse(node) {
      // if (!node.sc) {
      //   initNode(node)
      // }
      // if node is outside frustum, skip all descendants
      // const expandedOuter = node.outer.clone().expandByScalar(30)
      // if (!frustum.intersectsBox(expandedOuter)) {
      if (!frustum.intersectsBox(node.outer)) {
        // check(node)
        return
      }
      // // if node encapsulates frustum, render items without query (this node only) and recurse fresh
      // if (node.outer.containsPoint(shadowCameraPos)) {
      //   renderItems(node.items)
      //   for (const child of sortNodes(node.children)) {
      //     traverse(child)
      //   }
      //   return
      // }
      // // allow visible nodes to skip frames and reduce query workload
      // if (node.sc.visible && node.sc.skips) {
      //   node.sc.skips--
      //   renderItems(node.items)
      //   for (const child of sortNodes(node.children)) {
      //     traverse(child)
      //   }
      //   return
      // }
      // // no pending queries? issue one!
      // if (!node.sc.pending) {
      //   issueOcclusionQuery(node)
      //   // return
      // }
      // // if query is pending check for result (important: we use else here so we dont read immediately after issue)
      // else if (node.sc.pending) {
      //   if (hasQueryResult(node)) {
      //     const visible = getQueryResult(node)
      //     if (visible) {
      //       node.sc.visible = true
      //       node.sc.skips = 60
      //     } else {
      //       node.sc.visible = false
      //       // hideSubtree(node)
      //       return
      //     }
      //   }
      // }
      // // not visible? skip entire tree
      // if (!node.sc.visible) {
      //   // hideSubtree(node)
      //   return
      // }
      // // don't recurse into tiny nodes, just force visible
      // if (node.size < 4) {
      //   renderSubtree(node)
      //   return
      // }
      // render items
      renderItems(node.items)
      // continue traversal into children
      looseOctreeTraverse(shadowCameraPos, node, traverse)
      // for (const child of sortNodes(node.children)) {
      //   // for (const child of node.children) {
      //   traverse(child)
      // }
      // NOTE: if in frustum dont have to test all children or sort nodes just insta-render everything asap
    }
    function initNode(node) {
      const geometry = new THREE.BoxGeometry(node.size * 4, node.size * 4, node.size * 4) // outer
      const proxy = new THREE.Mesh(geometry, proxyMat)
      proxy.position.copy(node.center)
      proxy.matrixWorld.compose(proxy.position, proxy.quaternion, proxy.scale)
      proxy.matrix.copy(proxy.matrixWorld)
      proxy.matrixAutoUpdate = false
      proxy.matrixWorldAutoUpdate = false
      proxy.castShadow = false
      proxy.receiveShadow = false
      proxy.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, proxy.matrixWorld)
      // proxy.normalMatrix.getNormalMatrix(proxy.modelViewMatrix)
      node.sc = {
        proxy,
        query: gl.createQuery(),
        visible: false,
        skips: 0,
      }
    }
    function renderSubtree(node) {
      // if this node and all descendant have no objects, we can just skip it all
      if (!node.count) {
        // stats.skipRenderSubtreeNoCount++
        return
      }
      if (!node.sc) {
        initNode(node)
      }
      renderItems(node.items)
      node.sc.visible = true
      for (const child of node.children) {
        renderSubtree(child)
      }
    }
    function hasQueryResult(node) {
      return gl.getQueryParameter(node.sc.query, gl.QUERY_RESULT_AVAILABLE)
    }
    function getQueryResult(node) {
      const result = gl.getQueryParameter(node.sc.query, gl.QUERY_RESULT)
      node.sc.pending = false
      return result > 0
    }
    function issueOcclusionQuery(node) {
      node.sc.pending = true
      // stats.queries++
      const proxy = node.sc.proxy
      const geometry = objects.update(proxy)
      const material = proxy.material
      // gl.colorMask(false, false, false, false)
      // gl.depthMask(false)
      gl.beginQuery(gl.ANY_SAMPLES_PASSED, node.sc.query)
      proxy.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, proxy.matrixWorld)
      // proxy.normalMatrix.getNormalMatrix(proxy.modelViewMatrix)
      renderer.renderBufferDirect(
        shadowCamera, // camera
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
    function renderItems(items) {
      for (const item of items) {
        renderItem(item)
      }
    }
    function renderItem(item) {
      // if (item._shadowPass === pass) return console.log('DUPE')
      // item._shadowPass = pass

      // // NOTE: this render single mesh works fine but if we try to do the instanced mesh collection to reduce draws it does something weird af
      // renderObject(item._mesh)
      // return

      // if (item.node?.id === 'Cube310') {
      //   console.log('boop')
      //   console.log(`Shadow pass ${pass}: rendering item`, item.node.id)
      // }

      // collect instances to render later
      const renderable = item.renderable
      if (renderable) {
        let batch = batches.get(renderable)
        // no batch yet? init and mark active
        if (!batch) {
          batch = { renderable, items: [], count: 0, pass }
          batches.set(renderable, batch)
          active.push(batch)
        }
        // new pass? reset count and mark active
        if (batch.pass !== pass) {
          batch.pass = pass
          batch.count = 0
          active.push(batch)
        }
        // if next item is different, flag changed.
        // this lets us know if we need to rebuild the entire instanceMatrix later.
        if (batch.items[batch.count] !== item) {
          batch.items[batch.count] = item
          batch.changed = true
        }
        // track moved items
        if (item.move !== item._shadowMove) {
          item._shadowMove = item.move
          batch.changed = true
        }
        // keep count
        batch.count++
      }

      // if (item._mesh) {
      //   renderObject(item._mesh)
      // }
    }
    function renderObject(object) {
      // if (!object) return
      // if (object.visible === false) return
      // const visible = object.layers.test(camera.layers)
      // if (visible && (object.isMesh || object.isLine || object.isPoints)) {
      if (object.isMesh || object.isLine || object.isPoints) {
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
    }
    function sortNodes(nodes) {
      // todo: avoid slice :/
      return nodes.slice().sort(sortNodesFn)
    }
    function sortNodesFn(a, b) {
      return a.center.distanceToSquared(shadowCameraPos) - b.center.distanceToSquared(shadowCameraPos)
    }
  }
}

function createScreenSpaceTester() {
  let camera
  let halfHeight
  let tanHalfFov

  const tempVec = new THREE.Vector3()
  const tempMatrix = new THREE.Matrix4()

  let viewMatrix
  let projMatrix

  const largeSize = 100 // Objects this size or larger get minSkips
  const minSkips = 15 // 0.25 seconds for large objects
  const tinySize = 30 // Objects this size or smaller get maxSkips
  const maxSkips = 180 // 3 seconds for tiny objects

  return {
    update(screenHeight, _camera) {
      camera = _camera
      halfHeight = screenHeight * 0.5
      tanHalfFov = Math.tan((camera.fov * Math.PI) / 360)

      viewMatrix = camera.matrixWorldInverse
      projMatrix = camera.projectionMatrix
      tempMatrix.multiplyMatrices(projMatrix, viewMatrix)
    },
    test(item, mesh) {
      if (!item._ss) {
        item._ss = { skips: 0 }
      }
      if (item._ss.skips > 0) {
        item._ss.skips--
        return item._ss.pixelSize
      }
      let sphere = mesh.geometry.boundingSphere
      if (!sphere) {
        mesh.geometry.computeBoundingSphere()
        sphere = mesh.geometry.boundingSphere
      }
      // World space center
      tempVec.copy(sphere.center)
      tempVec.applyMatrix4(mesh.matrixWorld)
      // View space z (avoid full projection)
      const viewZ = -(
        viewMatrix.elements[2] * tempVec.x +
        viewMatrix.elements[6] * tempVec.y +
        viewMatrix.elements[10] * tempVec.z +
        viewMatrix.elements[14]
      )
      let pixelSize
      // Behind camera or too close
      if (viewZ < camera.near || viewZ > camera.far) {
        pixelSize = 999
      } else {
        // Screen size estimation
        const scale = mesh.matrixWorld.getMaxScaleOnAxis()
        pixelSize = (sphere.radius * scale * halfHeight) / (tanHalfFov * viewZ)
      }
      // temporal coherence
      const skipScale = Math.max(0, Math.min(1, (largeSize - pixelSize) / (largeSize - tinySize)))
      item._ss.skips = Math.floor(minSkips + (maxSkips - minSkips) * skipScale)
      item._ss.pixelSize = pixelSize
      return pixelSize
    },
  }
}
