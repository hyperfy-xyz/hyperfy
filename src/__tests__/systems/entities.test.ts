import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entities } from '../../core/systems/Entities.js';
import { MockWorld } from '../test-world-factory.js';
import type { Entity } from '../../types/index.js';

describe('Entities System', () => {
  let world: MockWorld;
  let entities: Entities;

  beforeEach(() => {
    world = new MockWorld();
    entities = new Entities(world);
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

      entities.add(entityData, true);

      expect(world.network.send).toHaveBeenCalledWith('entityAdded', entityData);
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
    let entity1: Entity;
    let entity2: Entity;

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
  });

  describe('serialization', () => {
    it('should serialize all entities', () => {
      entities.add({ id: 'test-1', type: 'app', position: { x: 1, y: 2, z: 3 } });
      entities.add({ id: 'test-2', type: 'app', position: { x: 4, y: 5, z: 6 } });

      const serialized = entities.serialize();

      expect(serialized).toHaveLength(2);
      expect(serialized[0]).toEqual({
        id: 'test-1',
        type: 'app',
        position: { x: 1, y: 2, z: 3 }
      });
      expect(serialized[1]).toEqual({
        id: 'test-2',
        type: 'app',
        position: { x: 4, y: 5, z: 6 }
      });
    });

    it('should deserialize entities', () => {
      const datas = [
        { id: 'test-1', type: 'app', position: { x: 1, y: 2, z: 3 } },
        { id: 'test-2', type: 'app', position: { x: 4, y: 5, z: 6 } }
      ];

      entities.deserialize(datas);

      expect(entities.items.size).toBe(2);
      expect(entities.get('test-1')).toBeDefined();
      expect(entities.get('test-2')).toBeDefined();
    });
  });

  describe('helper methods', () => {
    it('should get all entities', () => {
      entities.add({ id: 'test-1', type: 'app' });
      entities.add({ id: 'test-2', type: 'app' });

      const all = entities.getAll();

      expect(all).toHaveLength(2);
      expect(all.map(e => e.id)).toEqual(['test-1', 'test-2']);
    });

    it('should get all players', () => {
      world.network = { id: 'network-1' };
      entities.add({ id: 'player-1', type: 'player', owner: 'network-1' });
      entities.add({ id: 'player-2', type: 'player', owner: 'network-2' });
      entities.add({ id: 'test-1', type: 'app' });

      const players = entities.getAllPlayers();

      expect(players).toHaveLength(2);
      expect(players.map(p => p.id)).toEqual(['player-1', 'player-2']);
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
      const entity1 = entities.add({ id: 'test-1', type: 'app' });
      const entity2 = entities.add({ id: 'test-2', type: 'app' });
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
  });
}); 