import { isNumber } from 'lodash-es';

import type { Stage as IStage, World } from '../../types/index.js';
import { LooseOctree } from '../extras/LooseOctree.js';
import * as THREE from '../extras/three.js';
import { System } from './System.js';

const vec2 = new THREE.Vector2();

// Type definitions
interface StageOptions {
  viewport?: HTMLElement;
}

interface InsertOptions {
  linked?: boolean;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  node: any; // Node type from the node system
  matrix: THREE.Matrix4;
}

interface StageItem {
  matrix: THREE.Matrix4;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  getEntity: () => any;
  node: any;
}

interface StageHandle {
  material: MaterialProxy;
  move: (matrix: THREE.Matrix4) => void;
  destroy: () => void;
}

interface MaterialOptions {
  raw?: THREE.Material;
  unlit?: boolean;
  color?: string | number;
  metalness?: number;
  roughness?: number;
}

interface MaterialProxy {
  readonly id: string;
  textureX: number;
  textureY: number;
  color: string;
  emissiveIntensity: number;
  fog: boolean;
  readonly _ref?: any;
}

interface MaterialWrapper {
  raw: THREE.Material;
  proxy: MaterialProxy;
}

/**
 * Stage System
 *
 * - Runs on both the server and client.
 * - Allows inserting meshes etc into the world, and providing a handle back.
 * - Automatically handles instancing/batching.
 * - This is a logical scene graph, no rendering etc is handled here.
 *
 */
export class Stage extends System implements IStage {
  scene: THREE.Scene;
  environment: any;
  private models: Map<string, Model>;
  octree: LooseOctree;  // Made public for Model access
  private defaultMaterial: MaterialWrapper | null = null;
  private raycaster: THREE.Raycaster;
  private raycastHits: any[] = [];
  private maskNone: THREE.Layers;
  private dirtyNodes: Set<any> = new Set();
  private viewport?: HTMLElement;

  constructor(world: World) {
    super(world);
    this.scene = new THREE.Scene();
    this.models = new Map();
    this.octree = new LooseOctree({
      scene: this.scene,
      center: new THREE.Vector3(0, 0, 0),
      size: 10,
    });
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.maskNone = new THREE.Layers();
    this.maskNone.enableAll();
  }

  override async init(options: any): Promise<void> {
    this.viewport = options.viewport;
    if (this.world.rig) {
      this.scene.add(this.world.rig);
    }
  }

  override update(delta: number): void {
    this.models.forEach(model => model.clean());
  }

  override postUpdate(): void {
    this.clean(); // after update all matrices should be up to date for next step
  }

  override postLateUpdate(): void {
    this.clean(); // after lateUpdate all matrices should be up to date for next step
  }

  getDefaultMaterial(): MaterialWrapper {
    if (!this.defaultMaterial) {
      this.defaultMaterial = this.createMaterial();
    }
    return this.defaultMaterial;
  }

  clean(): void {
    for (const node of this.dirtyNodes) {
      node.clean();
    }
    this.dirtyNodes.clear();
  }

  insert(options: InsertOptions): StageHandle {
    if (options.linked) {
      return this.insertLinked(options);
    } else {
      return this.insertSingle(options);
    }
  }

  private insertLinked(options: InsertOptions): StageHandle {
    const { geometry, material, castShadow = false, receiveShadow = false, node, matrix } = options;
    const id = `${geometry.uuid}/${material.uuid}/${castShadow}/${receiveShadow}`;
    
    if (!this.models.has(id)) {
      const model = new Model(this, geometry, material, castShadow, receiveShadow);
      this.models.set(id, model);
    }
    
    return this.models.get(id)!.create(node, matrix);
  }

  private insertSingle(options: InsertOptions): StageHandle {
    const { geometry, material, castShadow = false, receiveShadow = false, node, matrix } = options;
    const materialWrapper = this.createMaterial({ raw: material });
    const mesh = new THREE.Mesh(geometry, materialWrapper.raw);
    
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixWorld.copy(matrix);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    
    const sItem: StageItem = {
      matrix,
      geometry,
      material: materialWrapper.raw,
      getEntity: () => node.ctx?.entity,
      node,
    };
    
    this.scene.add(mesh);
    this.octree.insert(sItem);
    
    return {
      material: materialWrapper.proxy,
      move: (newMatrix: THREE.Matrix4) => {
        mesh.matrixWorld.copy(newMatrix);
        this.octree.move(sItem);
      },
      destroy: () => {
        this.scene.remove(mesh);
        this.octree.remove(sItem);
      },
    };
  }

  createMaterial(options: MaterialOptions = {}): MaterialWrapper {
    const self = this;
    const material: any = {};
    let raw: THREE.Material;
    
    if (options.raw) {
      raw = options.raw.clone();
      (raw as any).onBeforeCompile = (options.raw as any).onBeforeCompile;
    } else if (options.unlit) {
      raw = new THREE.MeshBasicMaterial({
        color: options.color || 'white',
      });
    } else {
      raw = new THREE.MeshStandardMaterial({
        color: options.color || 'white',
        metalness: isNumber(options.metalness) ? options.metalness : 0,
        roughness: isNumber(options.roughness) ? options.roughness : 1,
      });
    }
    
    (raw as any).shadowSide = THREE.BackSide; // fix csm shadow banding
    const textures: THREE.Texture[] = [];
    
    if ((raw as any).map) {
      (raw as any).map = (raw as any).map.clone();
      textures.push((raw as any).map);
    }
    if ((raw as any).emissiveMap) {
      (raw as any).emissiveMap = (raw as any).emissiveMap.clone();
      textures.push((raw as any).emissiveMap);
    }
    if ((raw as any).normalMap) {
      (raw as any).normalMap = (raw as any).normalMap.clone();
      textures.push((raw as any).normalMap);
    }
    if ((raw as any).bumpMap) {
      (raw as any).bumpMap = (raw as any).bumpMap.clone();
      textures.push((raw as any).bumpMap);
    }
    if ((raw as any).roughnessMap) {
      (raw as any).roughnessMap = (raw as any).roughnessMap.clone();
      textures.push((raw as any).roughnessMap);
    }
    if ((raw as any).metalnessMap) {
      (raw as any).metalnessMap = (raw as any).metalnessMap.clone();
      textures.push((raw as any).metalnessMap);
    }
    
    this.world.setupMaterial(raw);
    
    const proxy: MaterialProxy = {
      get id() {
        return raw.uuid;
      },
      get textureX() {
        return textures[0]?.offset.x || 0;
      },
      set textureX(val: number) {
        for (const tex of textures) {
          tex.offset.x = val;
        }
        raw.needsUpdate = true;
      },
      get textureY() {
        return textures[0]?.offset.y || 0;
      },
      set textureY(val: number) {
        for (const tex of textures) {
          tex.offset.y = val;
        }
        raw.needsUpdate = true;
      },
      get color() {
        return (raw as any).color;
      },
      set color(val: string) {
        if (typeof val !== 'string') {
          throw new Error('[material] color must be a string (e.g. "red", "#ff0000", "rgb(255,0,0)")');
        }
        (raw as any).color.set(val);
        raw.needsUpdate = true;
      },
      get emissiveIntensity() {
        return (raw as any).emissiveIntensity || 0;
      },
      set emissiveIntensity(value: number) {
        if (!isNumber(value)) {
          throw new Error('[material] emissiveIntensity not a number');
        }
        (raw as any).emissiveIntensity = value;
        raw.needsUpdate = true;
      },
      get fog() {
        return (raw as any).fog ?? true;
      },
      set fog(value: boolean) {
        (raw as any).fog = value;
        raw.needsUpdate = true;
      },
      get _ref() {
        if ((self.world as any)._allowMaterial) return material;
        return undefined;
      },
    };
    
    material.raw = raw;
    material.proxy = proxy;
    return material as MaterialWrapper;
  }

  raycastPointer(position: { x: number; y: number }, layers: THREE.Layers = this.maskNone, min = 0, max = Infinity): any[] {
    if (!this.viewport) throw new Error('no viewport');
    
    const rect = this.viewport.getBoundingClientRect();
    vec2.x = ((position.x - rect.left) / rect.width) * 2 - 1;
    vec2.y = -((position.y - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(vec2, this.world.camera);
    this.raycaster.layers = layers;
    this.raycaster.near = min;
    this.raycaster.far = max;
    this.raycastHits.length = 0;
    this.octree.raycast(this.raycaster, this.raycastHits);
    
    return this.raycastHits;
  }

  raycastReticle(layers: THREE.Layers = this.maskNone, min = 0, max = Infinity): any[] {
    if (!this.viewport) throw new Error('no viewport');
    
    vec2.x = 0;
    vec2.y = 0;
    
    this.raycaster.setFromCamera(vec2, this.world.camera);
    this.raycaster.layers = layers;
    this.raycaster.near = min;
    this.raycaster.far = max;
    this.raycastHits.length = 0;
    this.octree.raycast(this.raycaster, this.raycastHits);
    
    return this.raycastHits;
  }

  override destroy(): void {
    this.models.clear();
  }

  // IStage interface methods
  add(object: any): void {
    this.scene.add(object);
  }

  remove(object: any): void {
    this.scene.remove(object);
  }

  setEnvironment(texture: any): void {
    this.scene.environment = texture;
  }

  setBackground(background: any): void {
    this.scene.background = background;
  }

  setFog(fog: any): void {
    this.scene.fog = fog;
  }
}

// Internal Model class for instanced rendering
class Model {
  private stage: Stage;
  private geometry: THREE.BufferGeometry;
  private material: MaterialWrapper;
  private castShadow: boolean;
  private receiveShadow: boolean;
  private iMesh: THREE.InstancedMesh;
  private items: Array<{ idx: number; node: any; matrix: THREE.Matrix4 }> = [];
  private dirty = true;

  constructor(stage: Stage, geometry: THREE.BufferGeometry, material: THREE.Material, castShadow: boolean, receiveShadow: boolean) {
    this.stage = stage;
    this.geometry = geometry;
    this.material = stage.createMaterial({ raw: material });
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;

    if (!(this.geometry as any).boundsTree) {
      (this.geometry as any).computeBoundsTree();
    }

    this.iMesh = new THREE.InstancedMesh(this.geometry, this.material.raw, 10);
    this.iMesh.castShadow = this.castShadow;
    this.iMesh.receiveShadow = this.receiveShadow;
    this.iMesh.matrixAutoUpdate = false;
    this.iMesh.matrixWorldAutoUpdate = false;
    this.iMesh.frustumCulled = false;
    (this.iMesh as any).getEntity = this.getEntity.bind(this);
  }

  create(node: any, matrix: THREE.Matrix4): StageHandle {
    const item = {
      idx: this.items.length,
      node,
      matrix,
    };
    
    this.items.push(item);
    this.iMesh.setMatrixAt(item.idx, item.matrix);
    this.dirty = true;
    
    const sItem: StageItem = {
      matrix,
      geometry: this.geometry,
      material: this.material.raw,
      getEntity: () => this.items[item.idx]?.node.ctx?.entity,
      node,
    };
    
    this.stage.octree.insert(sItem);
    
    return {
      material: this.material.proxy,
      move: (newMatrix: THREE.Matrix4) => {
        this.move(item, newMatrix);
        this.stage.octree.move(sItem);
      },
      destroy: () => {
        this.destroy(item);
        this.stage.octree.remove(sItem);
      },
    };
  }

  private move(item: any, matrix: THREE.Matrix4): void {
    item.matrix.copy(matrix);
    this.iMesh.setMatrixAt(item.idx, matrix);
    this.dirty = true;
  }

  private destroy(item: any): void {
    const last = this.items[this.items.length - 1];
    const isOnly = this.items.length === 1;
    const isLast = item === last;
    
    if (isOnly) {
      this.items = [];
      this.dirty = true;
    } else if (isLast) {
      this.items.pop();
      this.dirty = true;
    } else if (last) {
      this.iMesh.setMatrixAt(item.idx, last.matrix);
      last.idx = item.idx;
      this.items[item.idx] = last;
      this.items.pop();
      this.dirty = true;
    }
  }

  clean(): void {
    if (!this.dirty) return;
    
    const size = this.iMesh.instanceMatrix.array.length / 16;
    const count = this.items.length;
    
    if (size < this.items.length) {
      const newSize = count + 100;
      (this.iMesh as any).resize(newSize);
      for (let i = size; i < count; i++) {
        const item = this.items[i];
        if (item) {
          this.iMesh.setMatrixAt(i, item.matrix);
        }
      }
    }
    
    this.iMesh.count = count;
    
    if (this.iMesh.parent && !count) {
      this.stage.scene.remove(this.iMesh);
      this.dirty = false;
      return;
    }
    
    if (!this.iMesh.parent && count) {
      this.stage.scene.add(this.iMesh);
    }
    
    this.iMesh.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }

  private getEntity(instanceId: number): any {
    console.warn('TODO: remove if you dont ever see this');
    return this.items[instanceId]?.node.ctx?.entity;
  }

  getTriangles(): number {
    const geometry = this.geometry;
    if (geometry.index !== null) {
      return geometry.index.count / 3;
    } else {
      const position = geometry.attributes['position'];
      return position ? position.count / 3 : 0;
    }
  }
} 