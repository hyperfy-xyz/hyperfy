import * as THREE from 'three'
import { Emotes } from '../core/extras/playerEmotes'
import type { World } from '../types'

const MAX_UPLOAD_SIZE = 1000000000000 // TODO
const MAX_UPLOAD_SIZE_LABEL = '1LOLS'

const FOV = 70
const PLANE_ASPECT_RATIO = 16 / 9
const HDR_URL = '/day2.hdr'

const DEG2RAD = THREE.MathUtils.DEG2RAD

const v1 = new THREE.Vector3()

let renderer: THREE.WebGLRenderer | null = null // re-use one renderer for this
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      // canvas: undefined,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    })
  }
  return renderer
}

interface AvatarNode {
  instance: {
    raw: {
      scene: THREE.Scene;
      userData: {
        vrm: {
          humanoid: {
            getRawBone: (name: string) => { node: THREE.Object3D };
          };
        };
      };
    };
    update: (delta: number) => void;
  };
  activate: (options: object) => void;
  deactivate: () => void;
  setEmote: (emote: string) => void;
}

interface AvatarLoader {
  toNodes: (options?: {
    camera: THREE.Camera;
    scene: THREE.Scene;
    octree: null;
    loader: WorldLoader;
  }) => {
    get: (name: string) => AvatarNode;
  };
}

interface WorldLoader {
  load: (type: string, url: string) => Promise<AvatarLoader>;
}

interface AvatarInfo {
  rank: number;
  stats: {
    [key: string]: {
      value: number | number[];
      rank: number;
    };
  };
}

interface BoundsSpec {
  rank: number;
  fileSize: number;
  triangles: number;
  draws: number;
  bones: number;
  bounds: number[];
}

export class AvatarPreview {
  world: World
  viewport: HTMLElement
  scene: THREE.Scene
  size: { width: number; height: number; aspect: number }
  camera: THREE.PerspectiveCamera
  sun: THREE.DirectionalLight
  renderer: THREE.WebGLRenderer
  rig: THREE.Object3D
  file?: File
  url?: string
  avatar?: AvatarLoader
  node?: AvatarNode
  lastTime?: number
  info?: AvatarInfo
  isAsset?: boolean
  engine?: {
    driver: {
      uploadFile: (file: File) => Promise<string>;
      changeAvatar: (url: string, rank: number, makeDefault: boolean) => void;
    };
    urls: {
      route: (url: string, localUrl: string) => void;
    };
  }
  morphTargets?: THREE.SkinnedMesh[]
  materialTargets?: THREE.Material[]
  textureTargets?: THREE.Texture[]
  visibilityTargets?: THREE.Object3D[]
  boneTargets?: THREE.Bone[]

  constructor(world: World, viewport: HTMLElement) {
    this.world = world
    this.viewport = viewport
    this.scene = new THREE.Scene()
    this.size = { width: 1080, height: 900, aspect: 1080 / 900 } // defaults
    this.camera = new THREE.PerspectiveCamera(FOV, this.size.aspect, 0.01, 2000)
    this.camera.layers.enableAll()
    this.scene.add(this.camera)
    this.sun = new THREE.DirectionalLight(0xffffff, 3)
    this.sun.position.fromArray([200, 400, 200])
    this.sun.target.position.copy(this.camera.position)
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.renderer = getRenderer()
    this.renderer.setClearColor(0xffffff, 0)
    this.renderer.setPixelRatio(window.devicePixelRatio || 1)
    this.renderer.setSize(this.size.width, this.size.height)
    // this.renderer.useLegacyLights = false
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.rig = new THREE.Object3D() as any
    this.rig.rotation.y = 180 * DEG2RAD
    this.scene.add(this.rig)
    this.viewport.appendChild(this.renderer.domElement)
    this.resize(this.viewport.offsetWidth, this.viewport.offsetHeight, false)
    ;(window as any).preview = this
  }

  async load(file: File, url: string) {
    this.file = file
    this.url = url
    console.log('file', this.file)
    if (this.file.size > MAX_UPLOAD_SIZE) {
      return { error: `Max file size ${MAX_UPLOAD_SIZE_LABEL}` }
    }
    // load hdri
    const worldWithLoader = this.world as World & { loader: WorldLoader };
    const textureResult = await worldWithLoader.loader.load('hdr', HDR_URL);
    const texture = textureResult as unknown as THREE.Texture;
    texture.mapping = THREE.EquirectangularReflectionMapping
    this.scene.environment = texture
    // load avatar
    this.avatar = await worldWithLoader.loader.load('avatar', this.url)
    if (!this.avatar) return { error: 'Failed to load avatar' }
    
    this.node = this.avatar
      .toNodes({
        camera: this.camera,
        scene: this.scene,
        octree: null,
        loader: worldWithLoader.loader,
      })
      .get('avatar')
    this.node.activate({})
    this.node.setEmote(Emotes.IDLE)
    // check we're still alive / didnt destroy
    if (!this.renderer) return
    // position camera
    this.positionCamera()
    // render once to get stats
    this.render()
    // calc rank and stats
    this.resolveInfo()
    // start rendering
    this.renderer.setAnimationLoop(this.update)
    return this.info
  }

  positionCamera() {
    const camera = this.camera
    const raw = this.node!.instance.raw
    const hips = raw.userData.vrm.humanoid.getRawBone('hips').node

    // vrm.bones.leftShoulder.scale.setScalar(0)
    // vrm.bones.rightShoulder.scale.setScalar(0)
    // vrm.scene.updateMatrixWorld(true)
    // vrm.scene.updateWorldMatrix(false, true)
    // for (const skeleton of vrm.skeletons) {
    //   skeleton.update()
    // }

    // see: https://wejn.org/2020/12/cracking-the-threejs-object-fitting-nut/

    const box = new THREE.Box3()
    box.setFromObject(raw.scene)

    const hipsY = hips.getWorldPosition(v1).y
    box.min.y = hipsY

    box.min.x = 0.5
    box.max.x = 0.5

    camera.position.y = box.max.y - box.getSize(v1).y / 2

    // box.min.x = 0.1
    // box.max.x = 0.1
    // box.min.y += box.getSize(v1).y / 2

    var size = new THREE.Vector3()
    box.getSize(size)

    // size.min.x = 0.1
    // size.max.x = 0.1
    // size.min.y =
    // size.x = 0.1
    // object.position.y = -this.node.height

    // figure out how to fit the box in the view:
    // 1. figure out horizontal FOV (on non-1.0 aspects)
    // 2. figure out distance from the object in X and Y planes
    // 3. select the max distance (to fit both sides in)
    //
    // The reason is as follows:
    //
    // Imagine a bounding box (BB) is centered at (0,0,0).
    // Camera has vertical FOV (camera.fov) and horizontal FOV
    // (camera.fov scaled by aspect, see fovh below)
    //
    // Therefore if you want to put the entire object into the field of view,
    // you have to compute the distance as: z/2 (half of Z size of the BB
    // protruding towards us) plus for both X and Y size of BB you have to
    // figure out the distance created by the appropriate FOV.
    //
    // The FOV is always a triangle:
    //
    //  (size/2)
    // +--------+
    // |       /
    // |      /
    // |     /
    // | F° /
    // |   /
    // |  /
    // | /
    // |/
    //
    // F° is half of respective FOV, so to compute the distance (the length
    // of the straight line) one has to: `size/2 / Math.tan(F)`.
    //
    // FTR, from https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
    // the camera.fov is the vertical FOV.

    const fov = camera.fov * (Math.PI / 180)
    const fovh = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)
    let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
    let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
    let cameraZ = Math.max(dx, dy)

    camera.position.z = -cameraZ
    camera.rotation.y += 180 * DEG2RAD
    // camera.position.set(0, 0, cameraZ)

    // set the far plane of the camera so that it easily encompasses the whole object
    const minZ = box.min.z
    const cameraToFarEdge = minZ < 0 ? -minZ + cameraZ : cameraZ - minZ

    camera.far = cameraToFarEdge * 3
    camera.updateProjectionMatrix()
  }

  resize(width: number, height: number, render = true) {
    this.size.width = width
    this.size.height = height
    this.size.aspect = width / height
    this.camera.aspect = this.size.aspect

    // better field-of-view?
    // see: https://discourse.threejs.org/t/keeping-an-object-scaled-based-on-the-bounds-of-the-canvas-really-battling-to-explain-this-one/17574/10
    if (this.size.aspect > PLANE_ASPECT_RATIO) {
      const cameraHeight = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
      const ratio = this.camera.aspect / PLANE_ASPECT_RATIO
      const newCameraHeight = cameraHeight / ratio
      this.camera.fov = THREE.MathUtils.radToDeg(Math.atan(newCameraHeight)) * 2
    } else {
      this.camera.fov = FOV
    }

    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.size.width, this.size.height)
    if (render) {
      this.render()
    }
  }

  update = (time: number) => {
    const delta = (this.lastTime ? time - this.lastTime : 0) / 1000
    this.lastTime = time
    this.node!.instance.update(delta)
    this.render()
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  resolveInfo() {
    console.log(this.renderer.info)
    console.log(this.renderer.info.render.triangles)
    const stats: AvatarInfo['stats'] = {}
    // bounds
    const bbox = new THREE.Box3().setFromObject(this.node!.instance.raw.scene)
    const bounds = bbox
      .getSize(v1)
      .toArray()
      .map((n: number) => parseFloat(n.toFixed(1))) as [number, number, number]
    stats.bounds = {
      value: bounds,
      rank: this.determineRank((spec: BoundsSpec) => {
        return spec.bounds && 
               Array.isArray(spec.bounds) && 
               spec.bounds.length >= 3 &&
               spec.bounds[0] >= bounds[0] && 
               spec.bounds[1] >= bounds[1] && 
               spec.bounds[2] >= bounds[2]
      }),
    }
    // triangles
    let triangles = 0
    this.node!.instance.raw.scene.traverse((node) => {
      if ('isMesh' in node && node.isMesh) {
        const mesh = node as unknown as THREE.Mesh
        const geometry = mesh.geometry
        if (geometry.index !== null) {
          triangles += geometry.index.count / 3
        } else {
          triangles += geometry.attributes.position.count / 3
        }
      }
    })
    stats.triangles = {
      value: triangles,
      rank: this.determineRank(spec => spec.triangles >= triangles),
    }
    // draws
    let draws = 0
    this.node!.instance.raw.scene.traverse((node) => {
      if ((node as unknown as THREE.Mesh).isMesh) {
        const mesh = node as unknown as THREE.Mesh
        const material = mesh.material
        if (Array.isArray(material)) {
          for (let i = 0; i < material.length; i++) {
            draws++
          }
        } else {
          draws++
        }
      }
    })
    stats.draws = {
      value: draws,
      rank: this.determineRank(spec => spec.draws >= draws),
    }
    // file size
    const fileSize = this.file?.size || 0
    stats.fileSize = {
      value: fileSize,
      rank: this.determineRank((spec: BoundsSpec) => spec.fileSize >= fileSize),
    }
    // bones
    let skeleton: THREE.Skeleton | undefined
    this.node!.instance.raw.scene.traverse((node) => {
      if ((node as unknown as THREE.SkinnedMesh).isSkinnedMesh) {
        skeleton = (node as unknown as THREE.SkinnedMesh).skeleton
      }
    })
    const bones = skeleton?.bones?.length || 0
    stats.bones = {
      value: bones,
      rank: this.determineRank(spec => spec.bones >= bones),
    }
    // calculate final rank
    let rank = 5
    for (const key in stats) {
      if (stats[key].rank < rank) {
        rank = stats[key].rank
      }
    }
    this.info = {
      rank,
      stats,
    }
    console.log('info', this.info)
  }

  determineRank(fn: (spec: BoundsSpec) => boolean): number {
    // if fn returns true it passes the spec
    for (const spec of specs) {
      if (fn(spec)) return spec.rank
    }
    return 1
  }

  capture(width: number, height: number): string {
    const actualWidth = this.size.width
    const actualHeight = this.size.height
    this.resize(width, height)
    const base64 = this.renderer.domElement.toDataURL()
    this.resize(actualWidth, actualHeight)
    return base64
  }

  async uploadAndEquip(makeDefault: boolean): Promise<void> {
    let url = this.url
    if (!this.isAsset && this.file && this.engine) {
      url = await this.engine.driver.uploadFile(this.file)
    }
    if (url && this.engine) {
      this.engine.urls.route(url, this.url!) // instant equip!
      this.engine.driver.changeAvatar(url, this.info!.rank, makeDefault)
    }
  }

  destroy() {
    this.node?.deactivate()
    this.viewport.removeChild(this.renderer.domElement)
    this.renderer.setAnimationLoop(null)
    this.renderer.clear()
    // Note: We can't set renderer to null as it's not nullable in the type
    // this.renderer = null
  }
}

/**
 * The following are minimum specs to belong to a rank.
 * If a vrm doesn't fit into any of these ranks then it is ranked Very Poor (1)
 *
 * These specs closely follow VRChat Quest Limits:
 * https://docs.vrchat.com/docs/avatar-performance-ranking-system#quest-limits
 *
 */
const specs = [
  {
    rank: 5,
    // Perfect
    fileSize: 5 * 1048576, // 5 MB
    triangles: 4000,
    draws: 1,
    bones: 70,
    bounds: [3, 3, 3],
  },
  {
    rank: 4,
    // Great
    fileSize: 10 * 1048576, // 10 MB
    triangles: 16000,
    draws: 2,
    bones: 100,
    bounds: [3, 3, 3],
  },
  {
    rank: 3,
    // Good
    fileSize: 15 * 1048576, // 15 MB
    triangles: 32000,
    draws: 4,
    bones: 130,
    bounds: [4, 4, 4],
  },
  {
    rank: 2,
    // Heavy
    fileSize: 25 * 1048576, // 25 MB
    triangles: 64000,
    draws: 32,
    bones: 160,
    bounds: [7, 6, 4],
  },
]
