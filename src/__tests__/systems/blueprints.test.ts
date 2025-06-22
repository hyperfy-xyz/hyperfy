import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Blueprints } from '../../core/systems/Blueprints.js';
import { createTestWorld, MockWorld } from '../test-world-factory.js';
import type { World, Blueprint } from '../../types/index.js';

describe('Blueprints System', () => {
  let world: MockWorld;
  let blueprints: Blueprints;

  beforeEach(async () => {
    world = await createTestWorld();
    blueprints = new Blueprints(world);
  });

  describe('initialization', () => {
    it('should initialize with empty items map', () => {
      expect(blueprints.items).toBeInstanceOf(Map);
      expect(blueprints.items.size).toBe(0);
    });
  });

  describe('add', () => {
    it('should add a blueprint', () => {
      const blueprint: Blueprint = {
        id: 'test-blueprint',
        name: 'Test Blueprint',
        version: 1,
        components: [
          { type: 'mesh', data: { geometry: 'box' } },
          { type: 'material', data: { color: 0xff0000 } }
        ]
      };

      blueprints.add(blueprint);

      expect(blueprints.items.size).toBe(1);
      expect(blueprints.items.get('test-blueprint')).toEqual(blueprint);
    });

    it('should send network event when local is true', () => {
      const blueprint: Blueprint = {
        id: 'test-blueprint',
        name: 'Test Blueprint',
        version: 1,
        components: []
      };

      const mockNetwork = {
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      blueprints.add(blueprint, true);

      expect(mockNetwork.send).toHaveBeenCalledWith('blueprintAdded', blueprint);
    });

    it('should not send network event when local is false', () => {
      const blueprint: Blueprint = {
        id: 'test-blueprint',
        name: 'Test Blueprint',
        version: 1,
        components: []
      };

      const mockNetwork = {
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      blueprints.add(blueprint, false);

      expect(mockNetwork.send).not.toHaveBeenCalled();
    });

    it('should handle missing network system gracefully', () => {
      const blueprint: Blueprint = {
        id: 'test-blueprint',
        name: 'Test Blueprint',
        version: 1,
        components: []
      };

      // No network system
      (world as any).network = undefined;

      // Should not throw
      expect(() => blueprints.add(blueprint, true)).not.toThrow();
    });
  });

  describe('get', () => {
    it('should return a blueprint by id', () => {
      const blueprint: Blueprint = {
        id: 'test-blueprint',
        name: 'Test Blueprint',
        version: 1,
        components: []
      };

      blueprints.add(blueprint);
      const retrieved = blueprints.get('test-blueprint');

      expect(retrieved).toEqual(blueprint);
    });

    it('should return undefined for non-existent blueprint', () => {
      const retrieved = blueprints.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('modify', () => {
    let blueprint: Blueprint;
    let mockEntity: any;

    beforeEach(() => {
      blueprint = {
        id: 'test-blueprint',
        name: 'Test Blueprint',
        version: 1,
        components: [
          { type: 'mesh', data: { geometry: 'box' } }
        ]
      };

      mockEntity = {
        id: 'entity-1',
        data: {
          blueprint: 'test-blueprint',
          state: { foo: 'bar' }
        },
        build: vi.fn()
      };

      world.entities.items.set('entity-1', mockEntity);
      blueprints.add(blueprint);
    });

    it('should modify an existing blueprint', () => {
      const modifiedData = {
        id: 'test-blueprint',
        name: 'Modified Blueprint',
        version: 1
      };

      blueprints.modify(modifiedData);

      const modified = blueprints.get('test-blueprint');
      expect(modified?.name).toBe('Modified Blueprint');
      expect(modified?.components).toEqual(blueprint.components); // Original components preserved
    });

    it('should rebuild entities using the modified blueprint', () => {
      blueprints.modify({
        id: 'test-blueprint',
        name: 'Modified Blueprint',
        version: 1
      });

      expect(mockEntity.data.state).toEqual({});
      expect(mockEntity.build).toHaveBeenCalled();
    });

    it('should emit modify event', () => {
      const modifyHandler = vi.fn();
      blueprints.on('modify', modifyHandler);

      blueprints.modify({
        id: 'test-blueprint',
        name: 'Modified Blueprint',
        version: 1
      });

      expect(modifyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-blueprint',
          name: 'Modified Blueprint',
          components: blueprint.components
        })
      );
    });

    it('should not modify or emit if no changes', () => {
      const modifyHandler = vi.fn();
      blueprints.on('modify', modifyHandler);

      // Modify with same data
      blueprints.modify({
        id: 'test-blueprint',
        name: 'Test Blueprint', // Same name
        version: 1
      });

      expect(modifyHandler).not.toHaveBeenCalled();
      expect(mockEntity.build).not.toHaveBeenCalled();
    });

    it('should handle non-existent blueprint gracefully', () => {
      expect(() => blueprints.modify({
        id: 'non-existent',
        name: 'New Name',
        version: 1
      })).not.toThrow();
    });

    it('should handle entities without build method', () => {
      const entityWithoutBuild = {
        id: 'entity-2',
        data: {
          blueprint: 'test-blueprint',
          state: { foo: 'bar' }
        }
        // No build method
      };

      world.entities.items.set('entity-2', entityWithoutBuild as any);

      expect(() => blueprints.modify({
        id: 'test-blueprint',
        name: 'Modified Blueprint',
        version: 1
      })).not.toThrow();

      expect(entityWithoutBuild.data.state).toEqual({});
    });
  });

  describe('serialize', () => {
    it('should serialize all blueprints to array', () => {
      const blueprint1: Blueprint = {
        id: 'blueprint-1',
        name: 'Blueprint 1',
        version: 1,
        components: []
      };

      const blueprint2: Blueprint = {
        id: 'blueprint-2',
        name: 'Blueprint 2',
        version: 1,
        components: [
          { type: 'mesh', data: { geometry: 'sphere' } }
        ]
      };

      blueprints.add(blueprint1);
      blueprints.add(blueprint2);

      const serialized = blueprints.serialize();

      expect(serialized).toBeInstanceOf(Array);
      expect(serialized).toHaveLength(2);
      expect(serialized).toContainEqual(blueprint1);
      expect(serialized).toContainEqual(blueprint2);
    });

    it('should return empty array when no blueprints', () => {
      const serialized = blueprints.serialize();
      expect(serialized).toEqual([]);
    });
  });

  describe('deserialize', () => {
    it('should deserialize array of blueprints', () => {
      const blueprintData: Blueprint[] = [
        {
          id: 'blueprint-1',
          name: 'Blueprint 1',
          version: 1,
          components: []
        },
        {
          id: 'blueprint-2',
          name: 'Blueprint 2',
          version: 1,
          components: [
            { type: 'mesh', data: { geometry: 'cylinder' } }
          ]
        }
      ];

      blueprints.deserialize(blueprintData);

      expect(blueprints.items.size).toBe(2);
      expect(blueprints.get('blueprint-1')).toEqual(blueprintData[0]);
      expect(blueprints.get('blueprint-2')).toEqual(blueprintData[1]);
    });

    it('should handle empty array', () => {
      blueprints.deserialize([]);
      expect(blueprints.items.size).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clear all blueprints', () => {
      const blueprint: Blueprint = {
        id: 'test-blueprint',
        name: 'Test Blueprint',
        version: 1,
        components: []
      };

      blueprints.add(blueprint);
      expect(blueprints.items.size).toBe(1);

      blueprints.destroy();
      expect(blueprints.items.size).toBe(0);
    });
  });

  describe('integration', () => {
    it('should handle full lifecycle', () => {
      // Add blueprints
      const blueprint1: Blueprint = {
        id: 'character-blueprint',
        name: 'Character',
        version: 1,
        components: [
          { type: 'mesh', data: { geometry: 'capsule' } },
          { type: 'rigidbody', data: { mass: 80 } },
          { type: 'health', data: { max: 100, current: 100 } }
        ]
      };

      const blueprint2: Blueprint = {
        id: 'vehicle-blueprint',
        name: 'Vehicle',
        version: 1,
        components: [
          { type: 'mesh', data: { geometry: 'box' } },
          { type: 'rigidbody', data: { mass: 1000 } },
          { type: 'engine', data: { power: 200 } }
        ]
      };

      blueprints.add(blueprint1);
      blueprints.add(blueprint2);

      // Serialize
      const serialized = blueprints.serialize();
      expect(serialized).toHaveLength(2);

      // Clear and deserialize
      blueprints.destroy();
      expect(blueprints.items.size).toBe(0);

      blueprints.deserialize(serialized);
      expect(blueprints.items.size).toBe(2);

      // Verify restored blueprints
      expect(blueprints.get('character-blueprint')).toEqual(blueprint1);
      expect(blueprints.get('vehicle-blueprint')).toEqual(blueprint2);
    });
  });
}); 