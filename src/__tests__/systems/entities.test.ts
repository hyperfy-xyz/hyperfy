import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entities } from '../../core/systems/Entities.js';
import { MockWorld } from '../test-world-factory.js';
import type { Entity } from '../../types/index.js';
import { Entity as BaseEntity } from '../../core/entities/Entity.js';

describe('Entities System', () => {
  let world: MockWorld;
  let entities: Entities;

  beforeEach(() => {
    world = new MockWorld();
    entities = new Entities(world);
    world.entities = entities as any;
  });

  describe('initialization', () => {
    it('should initialize with empty collections', () => {
      expect(entities.items.size).toBe(0);
      expect(entities.players.size).toBe(0);
      expect(entities.player).toBeNull();
    });
  });

  describe('add', () => {
    it('should add an entity', () => {
      const entityData = {
        id: 'test-entity-1',
        type: 'app',
        position: { x: 0, y: 0, z: 0 }
      };

      const entity = entities.add(entityData);

      expect(entity).toBeDefined();
      expect(entity.id).toBe('test-entity-1');
      expect(entity.type).toBe('app');
      expect(entities.items.size).toBe(1);
      expect(entities.get('test-entity-1')).toBe(entity);
    });

    it('should add a player entity', () => {
      world.network = { id: 'network-1', isClient: true };
      const playerData = {
        id: 'player-1',
        type: 'player',
        owner: 'network-1'
      };

      const player = entities.add(playerData);

      expect(player).toBeDefined();
      expect(player.isPlayer).toBe(true);
      expect(entities.players.size).toBe(1);
      expect(entities.getPlayer('player-1')).toBe(player);
      expect(entities.player).toBe(player); // Local player
    });

    it('should emit enter event for remote players on client', () => {
      world.network = { id: 'network-1', isClient: true };
      const emitSpy = vi.spyOn(world.events, 'emit');

      const remotePlayerData = {
        id: 'player-2',
        type: 'player',
        owner: 'network-2' // Different owner
      };

      entities.add(remotePlayerData);

      expect(emitSpy).toHaveBeenCalledWith('enter', { playerId: 'player-2' });
    });

    it('should broadcast entity addition when local', () => {
      world.network = { id: 'network-1', send: vi.fn() };
      const entityData = {
        id: 'test-entity-2',
        type: 'app'
      };

      const entity = entities.add(entityData, true);

      // The entity constructor sends the serialized entity data
      expect(world.network.send).toHaveBeenCalledWith('entityAdded', entity.serialize());
    });

    it('should add entity to items map', () => {
      const entityData = {
        id: 'test-entity-1',
        type: 'app'
      };
      
      const entity = entities.add(entityData);
      
      expect(entity.id).toBe('test-entity-1');
      expect(entity.type).toBe('app');
      expect(entities.has('test-entity-1')).toBe(true);
      expect(entities.get('test-entity-1')).toBe(entity);
    });

    it('should handle player entities correctly', () => {
      world.network = { id: 'test-network-id' };
      const playerData = {
        id: 'player-1',
        type: 'player',
        owner: 'test-network-id'
      };
      
      const player = entities.add(playerData);
      
      expect(player).toBeDefined();
      expect(entities.getPlayer('player-1')).toBe(player);
    });

    it('should destroy entity when removed', () => {
      const entity = entities.add({ id: 'test-entity', type: 'app' });
      // @ts-ignore - accessing private method for testing
      const destroySpy = vi.spyOn(entity, 'destroy' as any);
      
      entities.destroyEntity('test-entity');
      
      expect(destroySpy).toHaveBeenCalledWith(true);
      expect(entities.has('test-entity')).toBe(false);
    });

    it('should add entity to hot set when hot is true', () => {
      const entity = entities.add({ id: 'test-entity', type: 'app' });
      // @ts-ignore - adding method for testing
      entity.update = vi.fn();
      
      entities.setHot(entity, true);
      entities.update(16);
      
      expect(entity.update).toHaveBeenCalledWith(16);
    });

    it('should remove entity from hot set when hot is false', () => {
      const entity = entities.add({ id: 'test-entity', type: 'app' });
      // @ts-ignore - adding method for testing
      entity.update = vi.fn();
      
      entities.setHot(entity, true);
      entities.setHot(entity, false);
      entities.update(16);
      
      expect(entity.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a new entity with generated ID', () => {
      const entity = entities.create('TestEntity', { type: 'app' });

      expect(entity).toBeDefined();
      expect(entity.id).toMatch(/^entity-\d+-[a-z0-9]+$/);
      expect(entity.name).toBe('TestEntity');
      expect(entities.has(entity.id)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return entity by ID', () => {
      const entityData = { id: 'test-1', type: 'app' };
      const entity = entities.add(entityData);

      expect(entities.get('test-1')).toBe(entity);
    });

    it('should return null for non-existent entity', () => {
      expect(entities.get('non-existent')).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for existing entity', () => {
      entities.add({ id: 'test-1', type: 'app' });
      expect(entities.has('test-1')).toBe(true);
    });

    it('should return false for non-existent entity', () => {
      expect(entities.has('non-existent')).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove an entity', () => {
      const entity = entities.add({ id: 'test-1', type: 'app' });
      const destroySpy = vi.spyOn(entity, 'destroy');

      entities.remove('test-1');

      expect(entities.items.size).toBe(0);
      expect(entities.get('test-1')).toBeNull();
      expect(destroySpy).toHaveBeenCalled();
      expect(entities.getRemovedIds()).toContain('test-1');
    });

    it('should remove a player entity', () => {
      world.network = { id: 'network-1' };
      const player = entities.add({ id: 'player-1', type: 'player', owner: 'network-1' });

      entities.remove('player-1');

      expect(entities.players.size).toBe(0);
      expect(entities.getPlayer('player-1')).toBeNull();
    });

    it('should warn when removing non-existent entity', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      entities.remove('non-existent');

      expect(warnSpy).toHaveBeenCalledWith('Tried to remove entity that did not exist: non-existent');
      warnSpy.mockRestore();
    });
  });

  describe('setHot', () => {
    it('should add entity to hot set when true', () => {
      const entity = entities.add({ id: 'test-1', type: 'app' });
      entity.update = vi.fn();

      entities.setHot(entity, true);
      entities.update(16);

      expect(entity.update).toHaveBeenCalledWith(16);
    });

    it('should remove entity from hot set when false', () => {
      const entity = entities.add({ id: 'test-1', type: 'app' });
      entity.update = vi.fn();

      entities.setHot(entity, true);
      entities.setHot(entity, false);
      entities.update(16);

      expect(entity.update).not.toHaveBeenCalled();
    });
  });

  describe('update methods', () => {
    let entity1: Entity, entity2: Entity;

    beforeEach(() => {
      entity1 = entities.add({ id: 'test-1', type: 'app' });
      entity2 = entities.add({ id: 'test-2', type: 'app' });
      
      entity1.fixedUpdate = vi.fn();
      entity1.update = vi.fn();
      entity1.lateUpdate = vi.fn();
      
      entity2.fixedUpdate = vi.fn();
      entity2.update = vi.fn();
      entity2.lateUpdate = vi.fn();

      entities.setHot(entity1, true);
      entities.setHot(entity2, true);
    });

    it('should call fixedUpdate on hot entities', () => {
      entities.fixedUpdate(16);

      expect(entity1.fixedUpdate).toHaveBeenCalledWith(16);
      expect(entity2.fixedUpdate).toHaveBeenCalledWith(16);
    });

    it('should call update on hot entities', () => {
      entities.update(16);

      expect(entity1.update).toHaveBeenCalledWith(16);
      expect(entity2.update).toHaveBeenCalledWith(16);
    });

    it('should call lateUpdate on hot entities', () => {
      entities.lateUpdate(16);

      expect(entity1.lateUpdate).toHaveBeenCalledWith(16);
      expect(entity2.lateUpdate).toHaveBeenCalledWith(16);
    });

    it('should handle entities without update methods', () => {
      const entity3 = entities.add({ id: 'test-3', type: 'app' });
      // No update methods defined
      entities.setHot(entity3, true);

      // Should not throw
      expect(() => {
        entities.fixedUpdate(16);
        entities.update(16);
        entities.lateUpdate(16);
      }).not.toThrow();
    });

    it('should gracefully handle double update', () => {
      // Update hot sets
      entities.update(16);
      
      // @ts-ignore - accessing private destroy method for testing
      const destroySpy1 = vi.spyOn(entity1, 'destroy' as any);
      // @ts-ignore - accessing private destroy method for testing  
      const destroySpy2 = vi.spyOn(entity2, 'destroy' as any);
      
      expect(() => {
        entities.fixedUpdate(16);
        entities.update(16);
        entities.lateUpdate(16);
      }).not.toThrow();
    });

    it('should gracefully handle destroyed hot entities', () => {
      entities.setHot(entity1, true);
      entities.setHot(entity2, true);
      
      // @ts-ignore - accessing private destroy method for testing
      const destroySpy1 = vi.spyOn(entity1, 'destroy' as any);
      // @ts-ignore - accessing private destroy method for testing
      const destroySpy2 = vi.spyOn(entity2, 'destroy' as any);
      
      // Destroy entity1 during update
      entity1.update = vi.fn(() => {
        entities.destroyEntity('test-1');
      });
      
      expect(() => {
        entities.update(16);
      }).not.toThrow();
      
      expect(destroySpy1).toHaveBeenCalled();
      expect(entities.has('test-1')).toBe(false);
    });

    it('should use BaseEntity for unknown entity types', () => {
      const entity = entities.add({ id: 'test', type: 'unknown-type' });
      
      expect(entity.type).toBe('unknown-type');
      // BaseEntity is the default implementation
      expect(entity.id).toBe('test');
      expect(entity.name).toBe('entity');
    });
  });

  describe('serialization', () => {
    it('should serialize all entities', () => {
      // Create a blueprint for app entities
      world.blueprints.add({ id: 'test-blueprint', name: 'Test Blueprint', version: 1 });
      
      entities.add({ id: 'test-1', type: 'app', blueprint: 'test-blueprint', position: { x: 1, y: 2, z: 3 } });
      entities.add({ id: 'test-2', type: 'app', blueprint: 'test-blueprint', position: { x: 4, y: 5, z: 6 } });

      const serialized = entities.serialize();

      expect(serialized).toHaveLength(2);
      expect(serialized[0]).toMatchObject({
        id: 'test-1',
        type: 'app',
        blueprint: 'test-blueprint',
        position: [1, 2, 3] // Positions are serialized as arrays
      });
      expect(serialized[1]).toMatchObject({
        id: 'test-2',
        type: 'app',
        blueprint: 'test-blueprint',
        position: [4, 5, 6] // Positions are serialized as arrays
      });
    });

    it('should deserialize entities', async () => {
      // Create a blueprint for app entities
      world.blueprints.add({ id: 'test-blueprint', name: 'Test Blueprint', version: 1 });
      
      const datas = [
        { id: 'test-1', type: 'app', blueprint: 'test-blueprint', position: { x: 1, y: 2, z: 3 } },
        { id: 'test-2', type: 'app', blueprint: 'test-blueprint', position: { x: 4, y: 5, z: 6 } }
      ];

      await entities.deserialize(datas);

      expect(entities.items.size).toBe(2);
      expect(entities.get('test-1')).toBeDefined();
      expect(entities.get('test-2')).toBeDefined();
    });

    it('should use BaseEntity for unknown entity types', () => {
      const entity = entities.add({ id: 'test', type: 'unknown-type' });
      
      expect(entity.type).toBe('unknown-type');
      // BaseEntity is the default implementation
      expect(entity.id).toBe('test');
      expect(entity.name).toBe('entity');
    });
  });

  describe('get all entities', () => {
    it('should get all entities', () => {
      // Create a default blueprint for app entities
      world.blueprints.add({ id: 'test-blueprint', name: 'Test Blueprint', version: 1 });
      
      entities.add({ id: 'test-1', type: 'app', blueprint: 'test-blueprint' });
      entities.add({ id: 'test-2', type: 'app', blueprint: 'test-blueprint' });

      const all = entities.getAll();

      expect(all).toHaveLength(2);
      expect(all.map(e => e.id)).toEqual(['test-1', 'test-2']);
    });

    it('should get all players', () => {
      world.network = { id: 'network-1' };
      
      // Add PHYSX mock for player entities
      const originalPHYSX = (global as any).PHYSX;
      if (!originalPHYSX) {
        (global as any).PHYSX = {
          PxSphereGeometry: class {
            constructor(public radius: number) {}
          }
        };
      }
      
      entities.add({ id: 'player-1', type: 'player', owner: 'network-1' });
      entities.add({ id: 'player-2', type: 'player', owner: 'network-2' });
      
      // Create a blueprint for app entity
      world.blueprints.add({ id: 'test-blueprint', name: 'Test Blueprint', version: 1 });
      entities.add({ id: 'test-1', type: 'app', blueprint: 'test-blueprint' });

      const players = entities.getAllPlayers();

      expect(players).toHaveLength(2);
      expect(players.map(p => p.id)).toEqual(['player-1', 'player-2']);
      
      // Restore PHYSX if it was not originally there
      if (!originalPHYSX) {
        delete (global as any).PHYSX;
      }
    });

    it('should track and clear removed IDs', () => {
      entities.add({ id: 'test-1', type: 'app' });
      entities.add({ id: 'test-2', type: 'app' });
      
      entities.remove('test-1');
      entities.remove('test-2');

      const removed = entities.getRemovedIds();
      expect(removed).toEqual(['test-1', 'test-2']);

      // Should clear after getting
      expect(entities.getRemovedIds()).toEqual([]);
    });
  });

  describe('destroy', () => {
    it('should destroy all entities and clear collections', () => {
      // Create a blueprint for app entities
      world.blueprints.add({ id: 'test-blueprint', name: 'Test Blueprint', version: 1 });
      
      const entity1 = entities.add({ id: 'test-1', type: 'app', blueprint: 'test-blueprint' });
      const entity2 = entities.add({ id: 'test-2', type: 'app', blueprint: 'test-blueprint' });
      const destroySpy1 = vi.spyOn(entity1, 'destroy');
      const destroySpy2 = vi.spyOn(entity2, 'destroy');

      entities.destroy();

      expect(destroySpy1).toHaveBeenCalled();
      expect(destroySpy2).toHaveBeenCalled();
      expect(entities.items.size).toBe(0);
      expect(entities.players.size).toBe(0);
      expect(entities.getRemovedIds()).toEqual([]);
    });
  });

  describe('entity types', () => {
    it('should handle unknown entity types', () => {
      const entity = entities.add({ id: 'test-1', type: 'unknown-type' });
      
      expect(entity).toBeDefined();
      expect(entity.type).toBe('unknown-type');
    });

    it('should use correct player type based on ownership', () => {
      world.network = { id: 'network-1', isClient: true };

      // Local player
      const localPlayer = entities.add({ 
        id: 'player-1', 
        type: 'player', 
        owner: 'network-1' 
      });

      // Remote player
      const remotePlayer = entities.add({ 
        id: 'player-2', 
        type: 'player', 
        owner: 'network-2' 
      });

      expect(localPlayer).toBeDefined();
      expect(remotePlayer).toBeDefined();
      expect(entities.player).toBe(localPlayer);
    });

    it('should use BaseEntity for unknown entity types', () => {
      const entity = entities.add({ id: 'test', type: 'unknown-type' });
      
      expect(entity.type).toBe('unknown-type');
      // BaseEntity is the default implementation
      expect(entity.id).toBe('test');
      expect(entity.name).toBe('entity');
    });
  });
}); 