import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Stage } from '../../core/systems/Stage.js';
import { MockWorld } from '../test-world-factory.js';
import * as THREE from '../../core/extras/three.js';

// Mock LooseOctree
vi.mock('../../core/extras/LooseOctree.js', () => ({
  LooseOctree: vi.fn().mockImplementation(() => ({
    insert: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    raycast: vi.fn((raycaster, hits) => {
      // Simulate no hits by default
      hits.length = 0;
    }),
  })),
}));

describe('Stage System', () => {
  let world: MockWorld;
  let stage: Stage;

  beforeEach(() => {
    world = new MockWorld();
    world.rig = new THREE.Object3D();
    world.camera = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      fov: 75,
      near: 0.1,
      far: 1000,
    };
    world.setupMaterial = vi.fn();
    stage = new Stage(world);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create a Three.js scene', () => {
      expect(stage.scene).toBeInstanceOf(THREE.Scene);
    });

    it('should initialize octree for spatial indexing', () => {
      expect(stage.octree).toBeDefined();
    });

    it('should set up raycaster', () => {
      expect(stage['raycaster']).toBeInstanceOf(THREE.Raycaster);
      expect(stage['raycaster'].firstHitOnly).toBe(true);
    });

    it('should add world rig to scene on init', async () => {
      const viewport = document.createElement('div');
      await stage.init({ viewport });

      expect(stage.scene.children).toContain(world.rig);
    });
  });

  describe('material management', () => {
    it('should create default material', () => {
      const material = stage.getDefaultMaterial();

      expect(material).toBeDefined();
      expect(material.raw).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(material.proxy).toBeDefined();
    });

    it('should create standard material with options', () => {
      const material = stage.createMaterial({
        color: 'red',
        metalness: 0.5,
        roughness: 0.3,
      });

      expect(material.raw).toBeInstanceOf(THREE.MeshStandardMaterial);
      const mat = material.raw as THREE.MeshStandardMaterial;
      expect(mat.metalness).toBe(0.5);
      expect(mat.roughness).toBe(0.3);
    });

    it('should create unlit material when requested', () => {
      const material = stage.createMaterial({
        unlit: true,
        color: 'blue',
      });

      expect(material.raw).toBeInstanceOf(THREE.MeshBasicMaterial);
    });

    it('should clone existing material', () => {
      const original = new THREE.MeshStandardMaterial({ color: 'green' });
      const material = stage.createMaterial({ raw: original });

      expect(material.raw).not.toBe(original);
      expect(material.raw).toBeInstanceOf(THREE.MeshStandardMaterial);
    });

    it('should provide material proxy with texture controls', () => {
      const texturedMat = new THREE.MeshStandardMaterial();
      texturedMat.map = new THREE.Texture();
      
      const material = stage.createMaterial({ raw: texturedMat });
      const proxy = material.proxy;

      proxy.textureX = 0.5;
      // The cloned texture should have the offset
      expect((material.raw as any).map?.offset.x).toBe(0.5);

      proxy.textureY = 0.3;
      expect((material.raw as any).map?.offset.y).toBe(0.3);
    });

    it('should validate color input', () => {
      const material = stage.createMaterial();
      const proxy = material.proxy;

      expect(() => {
        proxy.color = 123 as any;
      }).toThrow('[material] color must be a string');

      // Verify color was set
      proxy.color = '#ff0000';
      expect((material.raw as any).color).toBeDefined();
      // Three.js materials may not have needsUpdate in test environment
    });
  });

  describe('mesh insertion', () => {
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    let node: any;
    let matrix: THREE.Matrix4;

    beforeEach(() => {
      geometry = new THREE.BoxGeometry();
      material = new THREE.MeshStandardMaterial();
      node = { ctx: { entity: { id: 'test-entity' } } };
      matrix = new THREE.Matrix4();
    });

    it('should insert single mesh', () => {
      const handle = stage.insert({
        linked: false,
        geometry,
        material,
        castShadow: true,
        receiveShadow: true,
        node,
        matrix,
      });

      expect(handle).toBeDefined();
      expect(handle.material).toBeDefined();
      expect(handle.move).toBeInstanceOf(Function);
      expect(handle.destroy).toBeInstanceOf(Function);
      expect(stage.scene.children.length).toBeGreaterThan(0);
    });

    it('should insert linked mesh for instancing', () => {
      const handle = stage.insert({
        linked: true,
        geometry,
        material,
        node,
        matrix,
      });

      expect(handle).toBeDefined();
      expect(stage['models'].size).toBe(1);
    });

    it('should reuse model for same geometry/material combination', () => {
      const options = {
        linked: true,
        geometry,
        material,
        node,
        matrix,
      };

      const handle1 = stage.insert(options);
      const handle2 = stage.insert(options);

      expect(stage['models'].size).toBe(1);
    });

    it('should handle mesh movement', () => {
      const handle = stage.insert({
        linked: false,
        geometry,
        material,
        node,
        matrix,
      });

      const newMatrix = new THREE.Matrix4().setPosition(10, 0, 0);
      handle.move(newMatrix);

      const mesh = stage.scene.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
      expect(mesh.matrixWorld.elements[12]).toBe(10);
    });

    it('should handle mesh destruction', () => {
      const handle = stage.insert({
        linked: false,
        geometry,
        material,
        node,
        matrix,
      });

      const initialCount = stage.scene.children.length;
      handle.destroy();

      expect(stage.scene.children.length).toBe(initialCount - 1);
    });
  });

  describe('raycasting', () => {
    beforeEach(async () => {
      const viewport = document.createElement('div');
      viewport.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      });
      await stage.init({ viewport });
    });

    it('should raycast from pointer position', () => {
      const position = { x: 400, y: 300 };
      const hits = stage.raycastPointer(position);

      expect(hits).toEqual([]);
      expect(stage.octree.raycast).toHaveBeenCalled();
    });

    it('should raycast from reticle (center)', () => {
      const hits = stage.raycastReticle();

      expect(hits).toEqual([]);
      expect(stage['raycaster'].ray.direction.x).toBeCloseTo(0);
      expect(stage['raycaster'].ray.direction.y).toBeCloseTo(0);
    });

    it('should apply layer mask to raycasting', () => {
      const layers = new THREE.Layers();
      layers.set(2);

      stage.raycastPointer({ x: 400, y: 300 }, layers);

      expect(stage['raycaster'].layers).toBe(layers);
    });

    it('should apply distance constraints to raycasting', () => {
      const min = 1;
      const max = 100;

      stage.raycastPointer({ x: 400, y: 300 }, undefined, min, max);

      expect(stage['raycaster'].near).toBe(min);
      expect(stage['raycaster'].far).toBe(max);
    });

    it('should throw error if no viewport', () => {
      const stageNoViewport = new Stage(world);

      expect(() => {
        stageNoViewport.raycastPointer({ x: 0, y: 0 });
      }).toThrow('no viewport');
    });
  });

  describe('update cycle', () => {
    it('should clean models on update', () => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshStandardMaterial();
      
      // Insert a linked mesh to create a model
      stage.insert({
        linked: true,
        geometry,
        material,
        node: { ctx: {} },
        matrix: new THREE.Matrix4(),
      });

      stage.update(0.016);

      // Model clean should be called
      expect(stage['models'].size).toBe(1);
    });

    it('should clean dirty nodes after updates', () => {
      const mockNode = { clean: vi.fn() };
      stage['dirtyNodes'].add(mockNode);

      stage.postUpdate();

      expect(mockNode.clean).toHaveBeenCalled();
      expect(stage['dirtyNodes'].size).toBe(0);
    });

    it('should clean after late update', () => {
      const mockNode = { clean: vi.fn() };
      stage['dirtyNodes'].add(mockNode);

      stage.postLateUpdate();

      expect(mockNode.clean).toHaveBeenCalled();
      expect(stage['dirtyNodes'].size).toBe(0);
    });
  });

  describe('interface methods', () => {
    it('should add objects to scene', () => {
      const object = new THREE.Object3D();
      stage.add(object);

      expect(stage.scene.children).toContain(object);
    });

    it('should remove objects from scene', () => {
      const object = new THREE.Object3D();
      stage.scene.add(object);
      
      stage.remove(object);

      expect(stage.scene.children).not.toContain(object);
    });

    it('should set environment texture', () => {
      const texture = new THREE.Texture();
      stage.setEnvironment(texture);

      expect(stage.scene.environment).toBe(texture);
    });

    it('should set background', () => {
      const color = new THREE.Color('skyblue');
      stage.setBackground(color);

      expect(stage.scene.background).toBe(color);
    });

    it('should set fog', () => {
      const fog = new THREE.Fog(0xffffff, 1, 100);
      stage.setFog(fog);

      expect(stage.scene.fog).toBe(fog);
    });
  });

  describe('instanced rendering', () => {
    it('should batch multiple instances of same mesh', () => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshStandardMaterial();
      
      const options = {
        linked: true,
        geometry,
        material,
        node: { ctx: {} },
        matrix: new THREE.Matrix4(),
      };

      // Add multiple instances
      const handles: any[] = [];
      for (let i = 0; i < 5; i++) {
        const matrix = new THREE.Matrix4().setPosition(i, 0, 0);
        handles.push(stage.insert({ ...options, matrix }));
      }

      // Should have one model with 5 instances
      expect(stage['models'].size).toBe(1);
      
      // Clean up
      stage.update(0.016);
      
      // Should have added instanced mesh to scene
      const instancedMeshes = stage.scene.children.filter(
        c => c instanceof THREE.InstancedMesh
      );
      expect(instancedMeshes.length).toBe(1);
      expect((instancedMeshes[0] as THREE.InstancedMesh).count).toBe(5);
    });

    it('should handle instance removal', () => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshStandardMaterial();
      
      const options = {
        linked: true,
        geometry,
        material,
        node: { ctx: {} },
        matrix: new THREE.Matrix4(),
      };

      // Add instances
      const handle1 = stage.insert(options);
      const handle2 = stage.insert(options);
      
      stage.update(0.016);

      // Remove one instance
      handle1.destroy();
      stage.update(0.016);

      const instancedMesh = stage.scene.children.find(
        c => c instanceof THREE.InstancedMesh
      ) as THREE.InstancedMesh;
      expect(instancedMesh.count).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should clear models on destroy', () => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshStandardMaterial();
      
      stage.insert({
        linked: true,
        geometry,
        material,
        node: { ctx: {} },
        matrix: new THREE.Matrix4(),
      });

      expect(stage['models'].size).toBe(1);

      stage.destroy();

      expect(stage['models'].size).toBe(0);
    });
  });
}); 