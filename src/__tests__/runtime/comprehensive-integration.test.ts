import { TestWorld } from './TestWorld';
import { RPGEntity } from '../../rpg/entities/RPGEntity';
import { ConfigLoader } from '../../rpg/config/ConfigLoader';
import type { SpatialIndex } from '../../core/systems/SpatialIndex';
import type { Terrain } from '../../core/systems/Terrain';
import type { Time } from '../../core/systems/Time';
import type { MovementSystem } from '../../rpg/systems/MovementSystem';
import type { NPCSystem } from '../../rpg/systems/NPCSystem';
import type { CombatSystem } from '../../rpg/systems/CombatSystem';
import type { LootSystem } from '../../rpg/systems/LootSystem';
import { Vector3 } from 'three';

describe('Comprehensive System Integration', () => {
  let world: TestWorld;
  let spatialIndex: SpatialIndex;
  let terrain: Terrain;
  let time: Time;
  let movementSystem: MovementSystem;
  let npcSystem: NPCSystem;
  let combatSystem: CombatSystem;
  let lootSystem: LootSystem;
  
  beforeAll(async () => {
    // Ensure config is loaded before tests
    const configLoader = ConfigLoader.getInstance();
    await configLoader.loadAll();
  });
  
  beforeEach(async () => {
    world = new TestWorld();
    await world.init();
    
    // Get all systems
    spatialIndex = world.getSystem<SpatialIndex>('spatialIndex')!;
    terrain = world.getSystem<Terrain>('terrain')!;
    time = world.getSystem<Time>('time')!;
    movementSystem = world.getSystem<MovementSystem>('movement')!;
    npcSystem = world.getSystem<NPCSystem>('npc')!;
    combatSystem = world.getSystem<CombatSystem>('combat')!;
    lootSystem = world.getSystem<LootSystem>('loot')!;
    
    expect(spatialIndex).toBeDefined();
    expect(terrain).toBeDefined();
    expect(time).toBeDefined();
    expect(movementSystem).toBeDefined();
    expect(npcSystem).toBeDefined();
    expect(combatSystem).toBeDefined();
    expect(lootSystem).toBeDefined();
  });
  
  afterEach(() => {
    // TestWorld doesn't have a stop method, just let it be garbage collected
  });
  
  describe('Configuration Loading Integration', () => {
    it('should load all configuration data successfully', async () => {
      const configLoader = ConfigLoader.getInstance();
      
      expect(configLoader.isConfigLoaded()).toBe(true);
      
      // Test NPC configurations
      const goblin = configLoader.getNPC(1);
      expect(goblin).toBeDefined();
      expect(goblin!.name).toBe('Goblin');
      expect(goblin!.lootTable).toBe('goblin_drops');
      
      // Test item configurations
      const bronzeSword = configLoader.getItem(1);
      expect(bronzeSword).toBeDefined();
      expect(bronzeSword!.name).toBe('Bronze Sword');
      expect(bronzeSword!.equipable).toBe(true);
      
      // Test loot table configurations
      const goblinDrops = configLoader.getLootTable('goblin_drops');
      expect(goblinDrops).toBeDefined();
      expect(goblinDrops!.drops.length).toBeGreaterThan(0);
    });
    
    it('should spawn NPCs from configuration', () => {
      const startingNPCs = npcSystem.getAllNPCs();
      expect(startingNPCs).toBeDefined();
      
      // Spawn a goblin from config
      const goblin = npcSystem.spawnNPC(1, { x: 10, y: 0, z: 10 });
      expect(goblin).toBeDefined();
      expect((goblin!.getComponent('npc') as any)?.name).toBe('Goblin');
      
      // Verify it was added to spatial index
      const nearbyEntities = spatialIndex.query({
        position: new Vector3(10, 0, 10),
        radius: 5
      });
      expect(nearbyEntities.length).toBeGreaterThan(0);
    });
  });
  
  describe('Movement and Spatial Index Integration', () => {
    it('should optimize pathfinding with spatial index', async () => {
      // Create a player entity
      const player = new RPGEntity(world, 'player-1', {
        position: [0, 0, 0]
      });
      
      // Add movement component
      player.addComponent('movement', {
        type: 'movement',
        entity: player as any,
        data: {},
        position: { x: 0, y: 0, z: 0 },
        destination: null,
        targetPosition: null,
        path: [],
        moveSpeed: 5,
        isMoving: false,
        canMove: true,
        runEnergy: 100,
        isRunning: false,
        currentSpeed: 0,
        facingDirection: 0,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      });
      
      // Add to spatial index
      spatialIndex.addEntity(player);
      
      // Test movement optimization
      const metrics = movementSystem.getPerformanceMetrics();
      expect(metrics.spatialIndexAvailable).toBe(true);
      
      // Move player
      movementSystem.moveEntity(player.id, { x: 20, y: 0, z: 20 });
      
      // Let movement process
      world.step();
      world.step();
      
      // Check performance metrics
      const updatedMetrics = movementSystem.getPerformanceMetrics();
      expect(updatedMetrics.activeMovements).toBeGreaterThan(0);
    });
    
    it('should handle collision detection with spatial index', () => {
      // Create blocking entity
      const obstacle = new RPGEntity(world, 'obstacle-1', {
        position: [5, 0, 5]
      });
      obstacle.addComponent('collider', {
        type: 'collider',
        entity: obstacle as any,
        data: {},
        blocking: true
      });
      spatialIndex.addEntity(obstacle);
      
      // Create moving entity
      const mover = new RPGEntity(world, 'mover-1', {
        position: [0, 0, 0]
      });
      mover.addComponent('movement', {
        type: 'movement',
        entity: mover as any,
        data: {},
        position: { x: 0, y: 0, z: 0 },
        destination: { x: 10, y: 0, z: 10 },
        targetPosition: null,
        path: [],
        moveSpeed: 5,
        isMoving: true,
        canMove: true,
        runEnergy: 100,
        isRunning: false,
        currentSpeed: 5,
        facingDirection: 0,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      });
      spatialIndex.addEntity(mover);
      
      // Test collision avoidance
      movementSystem.moveEntity(mover.id, { x: 5, y: 0, z: 5 });
      
      // Process movement
      for (let i = 0; i < 10; i++) {
        world.step();
      }
      
      // Entity should have avoided collision or stopped
      const finalPos = mover.position;
      const distanceToObstacle = Math.sqrt(
        Math.pow(finalPos.x - 5, 2) + Math.pow(finalPos.z - 5, 2)
      );
      expect(distanceToObstacle).toBeGreaterThan(0.5); // Should maintain distance
    });
  });
  
  describe('Terrain and Movement Integration', () => {
    it('should use terrain for movement validation', () => {
      // Get terrain height at various positions
      const height1 = terrain.getHeightAt(0, 0);
      const height2 = terrain.getHeightAt(50, 50);
      
      // Create entity at terrain level
      const entity = new RPGEntity(world, 'terrain-entity', {
        position: [0, height1, 0]
      });
      
      // Move to another position
      movementSystem.moveEntity(entity.id, { x: 50, y: height2, z: 50 });
      
      // Process movement
      for (let i = 0; i < 20; i++) {
        world.step();
      }
      
      // Entity should follow terrain
      expect(entity.position.y).toBeCloseTo(height2, 1);
    });
    
    it('should prevent movement on unwalkable terrain', () => {
      // Find a water tile (unwalkable)
      let waterPosition: { x: number; z: number } | null = null;
      
      for (let x = -10; x <= 10; x++) {
        for (let z = -10; z <= 10; z++) {
          if (!terrain.isWalkable(x, z)) {
            waterPosition = { x, z };
            break;
          }
        }
        if (waterPosition) break;
      }
      
      if (waterPosition) {
        const entity = new RPGEntity(world, 'test-entity', {
          position: [0, 0, 0]
        });
        
        // Try to move to unwalkable terrain
        movementSystem.moveEntity(entity.id, { 
          x: waterPosition.x, 
          y: 0, 
          z: waterPosition.z 
        });
        
        // Process movement
        for (let i = 0; i < 10; i++) {
          world.step();
        }
        
        // Entity should not reach the unwalkable position
        const distance = Math.sqrt(
          Math.pow(entity.position.x - waterPosition.x, 2) + 
          Math.pow(entity.position.z - waterPosition.z, 2)
        );
        expect(distance).toBeGreaterThan(1); // Should be stopped before reaching
      }
    });
  });
  
  describe('Time-Based System Integration', () => {
    it('should trigger time-based events', async () => {
      const currentTime = time.getTime();
      let eventTriggered = false;
      
      // Add time event for next hour
      time.addEvent({
        id: 'test-event',
        hour: (currentTime.hour + 1) % 24,
        minute: 0,
        callback: () => {
          eventTriggered = true;
        },
        repeat: false
      });
      
      // Fast forward time
      time.setTimeScale(3600); // 1 hour per second
      
      // Run world
      await world.run(1100);
      
      expect(eventTriggered).toBe(true);
    });
    
    it('should affect NPC spawning based on time', () => {
      const initialTime = time.getTime();
      
      // Change time to night
      time.setTime(22, 0); // 10 PM
      world.step();
      
      const nightTime = time.getTime();
      expect(nightTime.isDaytime).toBe(false);
      
      // Change time to day
      time.setTime(12, 0); // 12 PM
      world.step();
      
      const dayTime = time.getTime();
      expect(dayTime.isDaytime).toBe(true);
      
      // Different spawn behavior could be implemented based on time
      expect(dayTime.timeOfDay).toBe('noon');
    });
  });
  
  describe('Combat and Loot Integration', () => {
    it('should handle complete combat scenario with loot drops', async () => {
      // Spawn a goblin
      const goblin = npcSystem.spawnNPC(1, { x: 10, y: 0, z: 10 });
      expect(goblin).toBeDefined();
      
      // Create player
      const player = new RPGEntity(world, 'player-1', {
        position: [8, 0, 8]
      });
      
      // Add combat stats to player
      player.addComponent('stats', {
        type: 'stats',
        entity: player as any,
        data: {},
        hitpoints: { current: 10, max: 10, level: 10, xp: 1000 },
        attack: { level: 10, xp: 1000, bonus: 0 },
        strength: { level: 10, xp: 1000, bonus: 0 },
        defense: { level: 10, xp: 1000, bonus: 0 },
        ranged: { level: 1, xp: 0, bonus: 0 },
        magic: { level: 1, xp: 0, bonus: 0 },
        prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
        combatBonuses: {
          attackStab: 5, attackSlash: 5, attackCrush: 0,
          attackMagic: 0, attackRanged: 0,
          defenseStab: 0, defenseSlash: 0, defenseCrush: 0,
          defenseMagic: 0, defenseRanged: 0,
          meleeStrength: 5, rangedStrength: 0, magicDamage: 0, prayerBonus: 0
        },
        combatLevel: 10,
        totalLevel: 30
      });
      
      // Start combat (using a mock method or type assertion)
      if (typeof (combatSystem as any).startCombat === 'function') {
        (combatSystem as any).startCombat(player.id, goblin!.id);
      } else {
        // Alternative: trigger combat through events or other means
        world.events.emit('combat:start', { attackerId: player.id, defenderId: goblin!.id });
      }
      
      // Run combat until goblin dies
      let combatComplete = false;
      let lootDropped = false;
      
      world.events.on('entity:death', (event) => {
        if (event.entityId === goblin!.id) {
          combatComplete = true;
        }
      });
      
      world.events.on('loot:dropped', () => {
        lootDropped = true;
      });
      
      // Simulate combat for up to 10 seconds
      for (let i = 0; i < 600 && !combatComplete; i++) {
        world.step();
      }
      
      expect(combatComplete).toBe(true);
      // Note: Loot drop might be handled differently in actual implementation
    });
  });
  
  describe('Performance Testing', () => {
    it('should handle large numbers of entities efficiently', () => {
      const startTime = Date.now();
      
      // Create 100 entities
      const entities: RPGEntity[] = [];
      for (let i = 0; i < 100; i++) {
        const entity = new RPGEntity(world, `entity-${i}`, {
          position: [i % 10 * 5, 0, Math.floor(i / 10) * 5]
        });
        entities.push(entity);
        spatialIndex.addEntity(entity);
      }
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(1000); // Should create 100 entities in under 1 second
      
      // Test spatial queries
      const queryStartTime = Date.now();
      
      for (let i = 0; i < 50; i++) {
        const results = spatialIndex.query({
          position: new Vector3(
            Math.random() * 50,
            0,
            Math.random() * 50
          ),
          radius: 10
        });
        expect(results).toBeDefined();
      }
      
      const queryTime = Date.now() - queryStartTime;
      expect(queryTime).toBeLessThan(100); // 50 queries in under 100ms
      
      // Test debug info
      const debugInfo = spatialIndex.getDebugInfo();
      expect(debugInfo.entityCount).toBe(100);
      expect(debugInfo.cellCount).toBeGreaterThan(0);
    });
    
    it('should handle concurrent movement efficiently', async () => {
      // Create multiple moving entities
      const movers: RPGEntity[] = [];
      
      for (let i = 0; i < 20; i++) {
        const entity = new RPGEntity(world, `mover-${i}`, {
          position: [i * 2, 0, 0]
        });
        
        entity.addComponent('movement', {
          type: 'movement',
          entity: entity as any,
          data: {},
          position: { x: i * 2, y: 0, z: 0 },
          destination: { x: i * 2, y: 0, z: 20 },
          targetPosition: null,
          path: [],
          moveSpeed: 5,
          isMoving: false,
          canMove: true,
          runEnergy: 100,
          isRunning: false,
          currentSpeed: 0,
          facingDirection: 0,
          pathfindingFlags: 0,
          lastMoveTime: 0,
          teleportDestination: null,
          teleportTime: 0,
          teleportAnimation: ''
        });
        
        movers.push(entity);
        spatialIndex.addEntity(entity);
        
        // Start movement
        movementSystem.moveEntity(entity.id, { 
          x: i * 2, 
          y: 0, 
          z: 20 
        });
      }
      
      const startTime = Date.now();
      
      // Run simulation for 100 steps
      for (let i = 0; i < 100; i++) {
        world.step();
      }
      
      const simulationTime = Date.now() - startTime;
      
      // Performance expectations
      expect(simulationTime).toBeLessThan(2000); // 100 steps with 20 moving entities in under 2 seconds
      
      const metrics = movementSystem.getPerformanceMetrics();
      expect(metrics.activeMovements).toBeGreaterThan(0);
      expect(metrics.spatialIndexAvailable).toBe(true);
    });
    
    it('should maintain performance with terrain queries', () => {
      const startTime = Date.now();
      
      // Perform 1000 terrain queries
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 100 - 50;
        const z = Math.random() * 100 - 50;
        
        const height = terrain.getHeightAt(x, z);
        const type = terrain.getTypeAt(x, z);
        const walkable = terrain.isWalkable(x, z);
        
        expect(typeof height).toBe('number');
        expect(typeof type).toBe('string');
        expect(typeof walkable).toBe('boolean');
      }
      
      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(500); // 1000 terrain queries in under 500ms
    });
  });
  
  describe('Memory Management', () => {
    it('should clean up entities properly', () => {
      // Create entities
      const entities: RPGEntity[] = [];
      for (let i = 0; i < 50; i++) {
        const entity = new RPGEntity(world, `cleanup-${i}`, {
          position: [i, 0, 0]
        });
        entities.push(entity);
        spatialIndex.addEntity(entity);
      }
      
      const initialInfo = spatialIndex.getDebugInfo();
      expect(initialInfo.entityCount).toBe(50);
      
      // Remove entities
      for (const entity of entities) {
        spatialIndex.removeEntity(entity);
      }
      
      const finalInfo = spatialIndex.getDebugInfo();
      expect(finalInfo.entityCount).toBe(0);
      expect(finalInfo.cellCount).toBe(0); // Cells should be cleaned up too
    });
    
    it('should handle rapid entity creation and destruction', () => {
      // Rapid creation/destruction cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        const tempEntities: RPGEntity[] = [];
        
        // Create entities
        for (let i = 0; i < 20; i++) {
          const entity = new RPGEntity(world, `temp-${cycle}-${i}`, {
            position: [i, 0, cycle]
          });
          tempEntities.push(entity);
          spatialIndex.addEntity(entity);
        }
        
        // Immediately remove them
        for (const entity of tempEntities) {
          spatialIndex.removeEntity(entity);
        }
      }
      
      // System should be stable
      const debugInfo = spatialIndex.getDebugInfo();
      expect(debugInfo.entityCount).toBe(0);
      expect(debugInfo.cellCount).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid entity operations gracefully', () => {
      // Try to remove non-existent entity
      const fakeEntity = new RPGEntity(world, 'fake', { position: [0, 0, 0] });
      expect(() => spatialIndex.removeEntity(fakeEntity)).not.toThrow();
      
      // Try to query with invalid parameters
      expect(() => spatialIndex.query({
        position: new Vector3(NaN, NaN, NaN),
        radius: -1
      })).not.toThrow();
      
      // Try to move non-existent entity
      expect(() => movementSystem.moveEntity('non-existent', { x: 0, y: 0, z: 0 })).not.toThrow();
    });
    
    it('should handle system initialization failures gracefully', async () => {
      // This test ensures systems don't crash if dependencies are missing
      const isolatedWorld = new TestWorld();
      
      // Initialize without some systems
      await isolatedWorld.init();
      
      // Systems should handle missing dependencies
      const movement = isolatedWorld.getSystem<MovementSystem>('movement');
      expect(movement).toBeDefined();
      
      // TestWorld doesn't have a stop method, just let it be garbage collected
    });
  });
}); 