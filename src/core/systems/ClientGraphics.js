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
  DepthOfFieldEffect,
} from 'postprocessing'
import CustomShaderMaterial from '../libs/three-custom-shader-material'

import { System } from './System'

const v1 = new THREE.Vector3()

let renderer
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      // logarithmicDepthBuffer: true,
      // reverseDepthBuffer: true,
      stencil: true,
    })
    renderer.autoClear = false // Important for manual clearing
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

  async setupMagicWindow() {
    // const planeGeo = new THREE.PlaneGeometry(10, 10)

    // await new Promise(resolve => setTimeout(resolve, 500))

    // const url = this.world.resolveURL('http://localhost:3000/frame.png')
    // console.log('url', url)

    // const planeTexture = await this.world.loader.load('texture', url)
    // console.log('planeTexture', planeTexture)

    // Create the window frame (the portal)
    const windowMaterial = new THREE.MeshPhongMaterial({
      color: 0x4444ff,
      side: THREE.DoubleSide,
    })

    // Create window frame border (visible part)
    const frameGroup = new THREE.Group()
    frameGroup.renderOrder = 1 // Render after stencil mask

    // Top border
    const topBorder = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.1), windowMaterial)
    topBorder.position.y = 0.95
    frameGroup.add(topBorder)

    // Bottom border
    const bottomBorder = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.1), windowMaterial)
    bottomBorder.position.y = -0.95
    frameGroup.add(bottomBorder)

    // Left border
    const leftBorder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.1), windowMaterial)
    leftBorder.position.x = -0.95
    frameGroup.add(leftBorder)

    // Right border
    const rightBorder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.1), windowMaterial)
    rightBorder.position.x = 0.95
    frameGroup.add(rightBorder)

    this.world.stage.scene.add(frameGroup)

    // Material that writes to stencil buffer (for the window opening)
    const stencilWriteMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      stencilWrite: true,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilRef: 1,
      stencilZPass: THREE.ReplaceStencilOp,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
    })

    // Create the stencil mask (invisible plane that defines the window area)
    const maskGeometry = new THREE.PlaneGeometry(1.8, 1.8)
    const stencilMask = new THREE.Mesh(maskGeometry, stencilWriteMaterial)
    stencilMask.position.z = 0.01 // Slightly in front of window frame
    stencilMask.renderOrder = 0 // Render first to set up stencil
    this.world.stage.scene.add(stencilMask)

    // Create the hidden object (only visible through window)
    const hiddenGeometry = new THREE.SphereGeometry(0.5, 32, 16)
    const hiddenMaterial = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
    })
    const hiddenMesh = new THREE.Mesh(hiddenGeometry, hiddenMaterial)
    hiddenMesh.position.z = -1 // Behind the window
    hiddenMesh.renderOrder = 2 // Render after stencil is set
    this.world.stage.scene.add(hiddenMesh)

    // Create some background objects (always visible)
    const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
    const cubeMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
    })

    // Cube 1 - in front of the hidden sphere
    const cube1 = new THREE.Mesh(cubeGeometry, cubeMaterial)
    cube1.position.set(0.3, 0.3, -0.5)
    cube1.renderOrder = 2
    this.world.stage.scene.add(cube1)

    // Cube 2 - behind the hidden sphere
    const cube2 = new THREE.Mesh(cubeGeometry, cubeMaterial)
    cube2.position.set(-0.3, -0.3, -1.5)
    cube2.renderOrder = 2
    this.world.stage.scene.add(cube2)

    // Cube 3 - way off to the side
    const cube3 = new THREE.Mesh(cubeGeometry, cubeMaterial)
    cube3.position.set(2, 1, -1)
    cube3.renderOrder = 2
    this.world.stage.scene.add(cube3)

    // Cube 4 - another one to the side
    const cube4 = new THREE.Mesh(cubeGeometry, cubeMaterial)
    cube4.position.set(-2, -1, -0.5)
    cube4.renderOrder = 2
    this.world.stage.scene.add(cube4)

    // Add a background plane to make depth more obvious
    const bgGeometry = new THREE.PlaneGeometry(10, 10)
    const bgMaterial = new THREE.MeshPhongMaterial({
      color: 0x333366,
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.AlwaysStencilFunc,
    })
    const bgPlane = new THREE.Mesh(bgGeometry, bgMaterial)
    bgPlane.position.z = -5
    bgPlane.renderOrder = 2
    this.world.stage.scene.add(bgPlane)

    this.stencilMask = stencilMask
  }

  setupMagicWindow2() {
    // Create the magic window plane
    const windowGeometry = new THREE.PlaneGeometry(2, 2)
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 'white',
      opacity: 0.02,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial)
    windowMesh.position.y += 1
    windowMesh.renderOrder = 1 // Render after the sphere
    this.world.stage.scene.add(windowMesh)

    const uniforms = {
      windowMatrix: { value: windowMesh.matrixWorld },
      windowSize: { value: new THREE.Vector2(2, 2) },
    }

    // Create the sphere with custom shader
    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32)
    const sphereShaderMaterial = new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      color: 'blue',
      roughness: 0.2,
      metalness: 0.8,
      uniforms,
      vertexShader: `
            varying vec3 vWorldPosition;
            varying vec3 vNormal2;

            void main() {
                vec4 worldPosition2 = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition2.xyz;
                vNormal2 = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * viewMatrix * worldPosition2;
            }
        `,
      fragmentShader: `
            uniform mat4 windowMatrix;
            uniform vec2 windowSize;

            varying vec3 vWorldPosition;
            varying vec3 vNormal2;

            void main() {
                // Get window position and normal from the matrix
                vec3 windowPos = vec3(windowMatrix[3][0], windowMatrix[3][1], windowMatrix[3][2]);
                vec3 windowNormal = normalize(vec3(windowMatrix[0][2], windowMatrix[1][2], windowMatrix[2][2]));

                // Ray from camera to fragment
                vec3 rayDir = normalize(vWorldPosition - cameraPosition);
                vec3 rayOrigin = cameraPosition;

                // Check if ray intersects the window plane
                float denom = dot(windowNormal, rayDir);

                // If ray is parallel to plane or facing away, discard
                if (abs(denom) < 0.0001) {
                    discard;
                }

                // Calculate intersection point with window plane
                float t = dot(windowPos - rayOrigin, windowNormal) / denom;

                // If intersection is behind the camera or beyond the fragment, discard
                if (t < 0.0) {
                    discard;
                }

                vec3 intersectionPoint = rayOrigin + rayDir * t;

                // Check if the fragment is behind the intersection point (from camera's perspective)
                float fragmentDistance = length(vWorldPosition - cameraPosition);
                float intersectionDistance = length(intersectionPoint - cameraPosition);

                if (fragmentDistance < intersectionDistance - 0.001) {
                    discard;
                }

                // Transform intersection point to window's local space to check bounds
                vec4 localPos = inverse(windowMatrix) * vec4(intersectionPoint, 1.0);

                // Check if intersection is within window bounds
                if (abs(localPos.x) > windowSize.x * 0.5 || abs(localPos.y) > windowSize.y * 0.5) {
                    discard;
                }

                // Basic lighting for the red sphere
                // vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                // float diff = max(dot(vNormal2, lightDir), 0.0);
                // vec3 color = vec3(1.0, 0.2, 0.2) * (0.3 + 0.7 * diff);

                // gl_FragColor = vec4(color, 1.0);
            }
        `,
      side: THREE.DoubleSide,
    })
    const sphere = new THREE.Mesh(sphereGeometry, sphereShaderMaterial)

    // sphere.castShadow = true
    // sphere.receiveShadow = true
    sphere.position.y += 1
    sphere.position.z = -1 // Place behind the window
    sphere.renderOrder = 0 // Render before the window
    this.world.stage.scene.add(sphere)
  }

  async init({ viewport }) {
    // this.setupMagicWindow()
    this.setupMagicWindow2()

    this.viewport = viewport
    this.width = this.viewport.offsetWidth
    this.height = this.viewport.offsetHeight
    this.aspect = this.width / this.height
    this.renderer = getRenderer()
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
      // stencilBuffer: true,
    })
    this.renderPass = new RenderPass(this.world.stage.scene, this.world.camera)
    this.renderPass.renderToScreen = false
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

    // Depth of Field effect - realistic settings for metaverse in meters
    this.depthOfField = new DepthOfFieldEffect(this.world.camera, {
      // worldFocusDistance: 0, // perfectly sharp distance
      // worldFocusRange: 30, // range of sharpness outward from focus distance
      bokehScale: 2.0, // 0 = no blur, 1 = normal, 3+ strong blur
    })

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
      preset: SMAAPreset.ULTRA,
    })
    this.tonemapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    })
    this.effectPass = new EffectPass(this.world.camera, this.bloom, /*this.depthOfField,*/ this.smaa, this.tonemapping)
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
    // this.renderer.state.buffers.stencil.setTest(true)

    // this.renderer.clear(false, false, true)
    // this.renderer.clear(true, true, true)
    // this.renderer.state.buffers.stencil.setTest(true)

    // this.world.stage.scene.traverse(child => {
    //   if (child.isMesh) {
    //     child.material.depthWrite = true
    //     child.material.depthTest = true
    //   }
    // })

    // Special handling for stencil mask
    if (this.stencilMask) {
      this.stencilMask.material.depthWrite = false
      this.stencilMask.material.depthTest = true
    }

    if (this.renderer.xr.isPresenting || !this.usePostprocessing) {
      this.renderer.render(this.world.stage.scene, this.world.camera)
    } else {
      const hit = this.world.stage.raycastReticle()[0]
      if (hit) {
        if (!this.depthOfField.target) {
          this.depthOfField.target = new THREE.Vector3()
        }
        // console.log(hit.distance, hit.point.toArray())
        this.depthOfField.target.copy(hit.point)
        // this.depthOfField.worldFocusDistance = hit.distance
        // this.depthOfField.worldFocusRange = Math.max(0.5, hit.distance * 0.1)
      }

      this.composer.render()
    }
    if (this.xrDimensionsNeeded) {
      this.checkXRDimensions()
    }

    // this.renderer.state.buffers.stencil.setTest(false)
  }

  commit() {
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
    // effects.push(this.depthOfField)
    effects.push(this.smaa)
    effects.push(this.tonemapping)
    this.effectPass.setEffects(effects)
    this.effectPass.recompile()
  }

  destroy() {
    this.resizer.disconnect()
    this.viewport.removeChild(this.renderer.domElement)
  }
}
