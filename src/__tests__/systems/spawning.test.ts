import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestWorld } from '../test-world-factory';
import { SpawningSystem } from '../../rpg/systems/SpawningSystem';
import { NPCSystem } from '../../rpg/systems/NPCSystem';
import { RPGEntity } from '../../rpg/entities/RPGEntity';
import type { World } from '../../types';
import { SpawnerType, type Vector3, type PlayerEntity } from '../../rpg/types';
import { CircularSpawnArea } from '../../rpg/systems/spawning/CircularSpawnArea';

describe('SpawningSystem', () => {
  let world: World;
  let spawningSystem: SpawningSystem;
  let npcSystem: NPCSystem;
  let player: RPGEntity;
  
  beforeEach(async () => {
    const testWorld = await createTestWorld();
    world = testWorld as any;
    
    // Ensure world.events exists
    if (!world.events) {
      world.events = testWorld.events;
    }
    
    // Ensure world.entities exists with proper structure
    if (!world.entities) {
      world.entities = {
        items: new Map(),
        get: function(id: string) { return this.items.get(id); },
        set: function(id: string, entity: any) { this.items.set(id, entity); }
      } as any;
    } else if (!world.entities.items) {
      world.entities.items = new Map();
    }
    
    spawningSystem = new SpawningSystem(world);
    npcSystem = new NPCSystem(world);
    
    // Add systems to world
    world.systems = [spawningSystem, npcSystem];
    (world as any).getSystem = (name: string) => {
      if (name === 'NPCSystem') return npcSystem;
      if (name === 'SpawningSystem') return spawningSystem;
      return null;
    };
    
    // Initialize systems
    await npcSystem.init({});
    await spawningSystem.init({});
    
    // Create player
    player = new RPGEntity(world, 'player', {
      id: 'player-1',
      name: 'Test Player',
      position: { x: 0, y: 0, z: 0 }
    });
    
    // Add to world
    world.entities.items.set(player.id, player as any);
    
    // Mock getEntitiesInRange
    (world as any).getEntitiesInRange = (position: any, range: number) => {
      const entities: RPGEntity[] = [];
      for (const entity of world.entities.items.values()) {
        const rpgEntity = entity as any as RPGEntity;
        const dist = Math.sqrt(
          Math.pow(rpgEntity.data.position.x - position.x, 2) +
          Math.pow(rpgEntity.data.position.z - position.z, 2)
        );
        if (dist <= range) {
          entities.push(rpgEntity);
        }
      }
      return entities;
    };
    
    // Mock removeEntity
    (world as any).removeEntity = (entity: RPGEntity) => {
      world.entities.items.delete(entity.id);
    };
  });
  
  describe('Spawner Registration', () => {
    it('should register spawners', () => {
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 10, y: 0, z: 10 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 1, weight: 100 }
        ],
        maxEntities: 3,
        respawnTime: 30000
      });

      expect(spawnerId).toMatch(/^spawner_/);
      
      // Verify spawner is registered
      const spawners = (spawningSystem as any).spawners;
      expect(spawners.has(spawnerId)).toBe(true);
      
      const spawner = spawners.get(spawnerId);
      expect(spawner.type).toBe(SpawnerType.NPC);
      expect(spawner.position).toEqual({ x: 10, y: 0, z: 10 });
      expect(spawner.maxEntities).toBe(3);
    });

    it('should set default values for optional parameters', () => {
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 }
      });

      const spawner = (spawningSystem as any).spawners.get(spawnerId);
      expect(spawner.activationRange).toBe(50);
      expect(spawner.deactivationRange).toBe(75);
      expect(spawner.respawnTime).toBe(30000);
      expect(spawner.maxEntities).toBe(1);
      expect(spawner.requiresLineOfSight).toBe(false);
    });

    it('should add spawner to spatial index', () => {
      const spatialIndex = (spawningSystem as any).spatialIndex;
      const addSpy = vi.spyOn(spatialIndex, 'add');

      spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 20, y: 0, z: 20 }
      });

      expect(addSpy).toHaveBeenCalled();
    });

    it('should support different spawner types', () => {
      const npcSpawner = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 }
      });

      const resourceSpawner = spawningSystem.registerSpawner({
        type: SpawnerType.RESOURCE,
        position: { x: 10, y: 0, z: 0 }
      });

      const chestSpawner = spawningSystem.registerSpawner({
        type: SpawnerType.CHEST,
        position: { x: 20, y: 0, z: 0 }
      });

      const bossSpawner = spawningSystem.registerSpawner({
        type: SpawnerType.BOSS,
        position: { x: 30, y: 0, z: 0 }
      });

      const spawners = (spawningSystem as any).spawners;
      expect(spawners.get(npcSpawner).type).toBe(SpawnerType.NPC);
      expect(spawners.get(resourceSpawner).type).toBe(SpawnerType.RESOURCE);
      expect(spawners.get(chestSpawner).type).toBe(SpawnerType.CHEST);
      expect(spawners.get(bossSpawner).type).toBe(SpawnerType.BOSS);
    });
  });

  describe('Spawner Unregistration', () => {
    it('should unregister spawners', () => {
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 }
      });

      spawningSystem.unregisterSpawner(spawnerId);

      const spawners = (spawningSystem as any).spawners;
      expect(spawners.has(spawnerId)).toBe(false);
    });

    it('should despawn active entities when unregistering', () => {
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 1, weight: 100 }
        ]
      });

      const spawner = (spawningSystem as any).spawners.get(spawnerId);
      spawner.activeEntities.add('entity1');
      spawner.activeEntities.add('entity2');

      const despawnSpy = vi.spyOn(spawningSystem as any, 'despawnEntity');

      spawningSystem.unregisterSpawner(spawnerId);

      expect(despawnSpy).toHaveBeenCalledWith('entity1');
      expect(despawnSpy).toHaveBeenCalledWith('entity2');
    });

    it('should remove from spatial index', () => {
      const spatialIndex = (spawningSystem as any).spatialIndex;
      const removeSpy = vi.spyOn(spatialIndex, 'remove');

      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 }
      });

      spawningSystem.unregisterSpawner(spawnerId);

      expect(removeSpy).toHaveBeenCalled();
    });
  });

  describe('Entity Spawning', () => {
    let spawner: any;

    beforeEach(() => {
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 1, weight: 60 },
          { entityType: 'npc', entityId: 2, weight: 40 }
        ],
        maxEntities: 3
      });
      
      spawner = (spawningSystem as any).spawners.get(spawnerId);
    });

    it('should spawn entities', () => {
      const entity = spawningSystem.spawnEntity(spawner);

      expect(entity).toBeTruthy();
      expect(entity?.data.type).toBe('npc');
      expect(spawner.activeEntities.has('npc_test_1')).toBe(true);
    });

    it('should emit spawn event', () => {
      const spawnSpy = vi.fn();
      world.events.on('entity:spawned', spawnSpy);

      spawningSystem.spawnEntity(spawner);

      expect(spawnSpy).toHaveBeenCalledWith({
        entityId: 'npc_test_1',
        spawnerId: spawner.id,
        position: expect.any(Object),
        entityType: 'npc'
      });
    });

    it('should respect max entities limit', () => {
      // Fill up spawner
      spawner.activeEntities.add('entity1');
      spawner.activeEntities.add('entity2');
      spawner.activeEntities.add('entity3');

      const entity = spawningSystem.spawnEntity(spawner);
      expect(entity).toBeNull();
    });

    it('should select spawn definition based on weights', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      
      // Test weight distribution
      randomSpy.mockReturnValue(0.3); // Should select first definition (60% weight)
      const def1 = (spawningSystem as any).selectSpawnDefinition(spawner.entityDefinitions);
      expect(def1.entityId).toBe(1);

      randomSpy.mockReturnValue(0.8); // Should select second definition (40% weight)
      const def2 = (spawningSystem as any).selectSpawnDefinition(spawner.entityDefinitions);
      expect(def2.entityId).toBe(2);

      randomSpy.mockRestore();
    });

    it('should use spawn area for positioning', () => {
      const customArea = new CircularSpawnArea({ x: 0, y: 0, z: 0 }, 10, 2);
      spawner.spawnArea = customArea;

      const getPosSpy = vi.spyOn(customArea, 'getRandomPosition');

      spawningSystem.spawnEntity(spawner);

      expect(getPosSpy).toHaveBeenCalled();
    });
  });

  describe('Activation System', () => {
    let spawner: any;

    beforeEach(async () => {
      await spawningSystem.init({});
      
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 50, y: 0, z: 50 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 1, weight: 100 }
        ],
        activationRange: 30,
        deactivationRange: 50
      });
      
      spawner = (spawningSystem as any).spawners.get(spawnerId);
    });

    it('should activate when players are in range', () => {
      // Mock player in range
      const mockPlayer: PlayerEntity = {
        id: 'player1',
        data: { 
          type: 'player', 
          id: 'player1',
          position: { x: 40, y: 0, z: 50 } // 10 units away
        },
        getComponent: vi.fn()
      } as any;

      vi.spyOn(spawningSystem, 'getActivePlayersInRange').mockReturnValue([mockPlayer]);

      const isActive = (spawningSystem as any).checkActivation(spawner);
      expect(isActive).toBe(true);
    });

    it('should not activate when players are out of range', () => {
      vi.spyOn(spawningSystem, 'getActivePlayersInRange').mockReturnValue([]);

      const isActive = (spawningSystem as any).checkActivation(spawner);
      expect(isActive).toBe(false);
    });

    it('should use deactivation range when already active', () => {
      spawner.isActive = true;

      // Player just outside activation range but within deactivation range
      const mockPlayer: PlayerEntity = {
        id: 'player1',
        data: { 
          type: 'player',
          id: 'player1', 
          position: { x: 90, y: 0, z: 50 } // 40 units away
        },
        getComponent: vi.fn()
      } as any;

      const getPlayersSpy = vi.spyOn(spawningSystem, 'getActivePlayersInRange');
      getPlayersSpy.mockReturnValueOnce([]); // No players in activation range
      getPlayersSpy.mockReturnValueOnce([mockPlayer]); // Player in deactivation range

      const isActive = (spawningSystem as any).checkActivation(spawner);
      expect(isActive).toBe(true);
    });

    it('should handle line of sight requirement', () => {
      spawner.requiresLineOfSight = true;

      const mockPlayer: PlayerEntity = {
        id: 'player1',
        data: { 
          type: 'player',
          id: 'player1',
          position: { x: 40, y: 0, z: 50 }
        },
        getComponent: vi.fn()
      } as any;

      vi.spyOn(spawningSystem, 'getActivePlayersInRange').mockReturnValue([mockPlayer]);
      vi.spyOn(spawningSystem as any, 'hasLineOfSight').mockReturnValue(false);

      const isActive = (spawningSystem as any).checkActivation(spawner);
      expect(isActive).toBe(false);
    });
  });

  describe('Respawn Mechanics', () => {
    beforeEach(async () => {
      await spawningSystem.init({});
    });

    it('should schedule respawn on entity death', () => {
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 1, weight: 100 }
        ],
        respawnTime: 5000
      });

      const spawner = (spawningSystem as any).spawners.get(spawnerId);
      spawner.activeEntities.add('npc1');
      
      (spawningSystem as any).activeSpawns.set('npc1', spawnerId);

      const scheduleSpy = vi.spyOn(spawningSystem as any, 'scheduleRespawn');

      world.events.emit('entity:death', { entityId: 'npc1' });

      expect(scheduleSpy).toHaveBeenCalledWith(spawner);
      expect(spawner.activeEntities.has('npc1')).toBe(false);
    });

    it('should process spawn queue', () => {
      const now = Date.now();
      const spawnQueue = (spawningSystem as any).spawnQueue;
      
      spawnQueue.push({
        spawnerId: 'spawner1',
        scheduledTime: now - 1000, // Past due
        priority: 1
      });

      spawnQueue.push({
        spawnerId: 'spawner2',
        scheduledTime: now + 1000, // Future
        priority: 1
      });

      const executeSpy = vi.spyOn(spawningSystem as any, 'executeSpawnTask');

      (spawningSystem as any).processSpawnQueue(now);

      expect(executeSpy).toHaveBeenCalledTimes(1);
      expect(spawnQueue).toHaveLength(1);
      expect(spawnQueue[0].spawnerId).toBe('spawner2');
    });

    it('should respect respawn timer', () => {
      const spawner = {
        id: 'test_spawner',
        activeEntities: new Set(),
        maxEntities: 1,
        lastSpawnTime: Date.now() - 1000, // 1 second ago
        respawnTime: 5000, // 5 seconds
        conditions: undefined
      };

      const shouldSpawn = (spawningSystem as any).shouldSpawn(spawner);
      expect(shouldSpawn).toBe(false);

      spawner.lastSpawnTime = Date.now() - 6000; // 6 seconds ago
      const shouldSpawnNow = (spawningSystem as any).shouldSpawn(spawner);
      expect(shouldSpawnNow).toBe(true);
    });
  });

  describe('Spawn Conditions', () => {
    it('should check spawn conditions', () => {
      const conditionChecker = (spawningSystem as any).conditionChecker;
      const checkSpy = vi.spyOn(conditionChecker, 'checkConditions').mockReturnValue(false);

      const spawner = {
        id: 'test_spawner',
        activeEntities: new Set(),
        maxEntities: 1,
        lastSpawnTime: 0,
        respawnTime: 0,
        conditions: {
          minPlayers: 2
        }
      };

      const shouldSpawn = (spawningSystem as any).shouldSpawn(spawner);
      expect(shouldSpawn).toBe(false);
      expect(checkSpy).toHaveBeenCalledWith(spawner, world);
    });

    it('should handle custom conditions', () => {
      const customCondition = vi.fn().mockReturnValue(true);
      
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 },
        conditions: {
          customCondition
        }
      });

      const spawner = (spawningSystem as any).spawners.get(spawnerId);
      spawner.lastSpawnTime = 0; // Allow spawning

      const shouldSpawn = (spawningSystem as any).shouldSpawn(spawner);
      expect(shouldSpawn).toBe(true);
    });
  });

  describe('Update Cycle', () => {
    beforeEach(async () => {
      await spawningSystem.init({});
    });

    it('should throttle updates', () => {
      const updateSpy = vi.spyOn(spawningSystem as any, 'updateSpawner');
      
      // Register a spawner
      spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 }
      });

      // First update should process
      spawningSystem.fixedUpdate(16);
      expect(updateSpy).toHaveBeenCalledTimes(1);

      // Immediate second update should be throttled
      spawningSystem.fixedUpdate(16);
      expect(updateSpy).toHaveBeenCalledTimes(1);

      // Update after interval should process
      (spawningSystem as any).lastUpdateTime = Date.now() - 2000;
      spawningSystem.fixedUpdate(16);
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it('should clean up destroyed entities', () => {
      const activeSpawns = (spawningSystem as any).activeSpawns;
      activeSpawns.set('entity1', 'spawner1');
      activeSpawns.set('entity2', 'spawner1');

      // Mock entity lookup
      vi.spyOn(spawningSystem as any, 'getEntity')
        .mockImplementation((...args: unknown[]) => {
          const id = args[0];
          if (id === 'entity1') return { id, data: { type: 'npc' } };
          return undefined; // entity2 is destroyed
        });

      const spawner = {
        id: 'spawner1',
        activeEntities: new Set(['entity1', 'entity2'])
      };
      (spawningSystem as any).spawners.set('spawner1', spawner);

      (spawningSystem as any).cleanupDestroyedEntities();

      expect(activeSpawns.has('entity1')).toBe(true);
      expect(activeSpawns.has('entity2')).toBe(false);
      expect(spawner.activeEntities.has('entity2')).toBe(false);
    });
  });

  describe('Different Entity Types', () => {
    it('should create NPCs', () => {
      const npcSystem = (world as any).getSystem('NPCSystem');
      
      const spawnerId = spawningSystem.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 5, weight: 100 }
        ]
      });

      const spawner = (spawningSystem as any).spawners.get(spawnerId);
      spawningSystem.spawnEntity(spawner);

      expect(npcSystem.spawnNPC).toHaveBeenCalledWith(
        5,
        expect.any(Object),
        spawnerId
      );
    });

    it('should handle unsupported entity types', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      // Resource spawner
      const resourceId = spawningSystem.registerSpawner({
        type: SpawnerType.RESOURCE,
        position: { x: 0, y: 0, z: 0 },
        entityDefinitions: [
          { entityType: 'resource', weight: 100 }
        ]
      });

      const resourceSpawner = (spawningSystem as any).spawners.get(resourceId);
      const resourceEntity = spawningSystem.spawnEntity(resourceSpawner);

      expect(resourceEntity).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SpawningSystem] Resource spawning not yet implemented'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Spatial Queries', () => {
    it('should find entities near position', () => {
      // Mock world method
      (world as any).getEntitiesInRange = vi.fn().mockReturnValue([
        { id: 'entity1', data: { type: 'npc' } },
        { id: 'entity2', data: { type: 'player' } }
      ]);

      const entities = (spawningSystem as any).getEntitiesNear(
        { x: 0, y: 0, z: 0 },
        10
      );

      expect(entities).toHaveLength(2);
    });

    it('should validate spawn positions', () => {
      const isValid = (spawningSystem as any).isValidSpawnPosition(
        { x: 0, y: 0, z: 0 },
        {}
      );

      // Default implementation always returns true
      expect(isValid).toBe(true);
    });

    it('should get ground height', () => {
      const height = (spawningSystem as any).getGroundHeight({ x: 0, y: 10, z: 0 });
      
      // Default implementation returns 0
      expect(height).toBe(0);
    });
  });
}); 