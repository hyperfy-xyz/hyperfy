import { TestWorld } from './TestWorld';
import { RPGEntity } from '../../rpg/entities/RPGEntity';
import { EntityUtils } from '../../rpg/utils/EntityUtils';
import type { SpatialIndex } from '../../core/systems/SpatialIndex';
import type { Terrain } from '../../core/systems/Terrain';
import type { Time } from '../../core/systems/Time';
import { Vector3 } from 'three';

describe('Core Systems Integration', () => {
  let world: TestWorld;
  
  beforeEach(async () => {
    world = new TestWorld();
    await world.init();
  });
  
  afterEach(() => {
    // TestWorld doesn't have a stop method, just let it be garbage collected
  });
  
  describe('SpatialIndex System', () => {
    it('should track entity positions', () => {
      const spatialIndex = world.getSystem<SpatialIndex>('spatialIndex');
      expect(spatialIndex).toBeDefined();
      
      // Create test entities
      const entity1 = new RPGEntity(world, 'test-entity-1', {
        position: [0, 0, 0]
      });
      const entity2 = new RPGEntity(world, 'test-entity-2', {
        position: [5, 0, 0]
      });
      const entity3 = new RPGEntity(world, 'test-entity-3', {
        position: [15, 0, 0]
      });
      
      // Add entities to spatial index
      spatialIndex!.addEntity(entity1);
      spatialIndex!.addEntity(entity2);
      spatialIndex!.addEntity(entity3);
      
      // Query entities within radius
      const nearbyEntities = spatialIndex!.query({
        position: new Vector3(0, 0, 0),
        radius: 10
      });
      
      expect(nearbyEntities).toHaveLength(2);
      expect(nearbyEntities).toContain(entity1);
      expect(nearbyEntities).toContain(entity2);
      expect(nearbyEntities).not.toContain(entity3);
    });
    
    it('should update entity positions', () => {
      const spatialIndex = world.getSystem<SpatialIndex>('spatialIndex');
      expect(spatialIndex).toBeDefined();
      
      const entity = new RPGEntity(world, 'moving-entity', {
        position: [0, 0, 0]
      });
      
      spatialIndex!.addEntity(entity);
      
      // Move entity
      if (entity.node) {
        entity.node.position.set(20, 0, 0);
        spatialIndex!.updateEntity(entity);
      }
      
      // Should not be found at old position
      const oldPosEntities = spatialIndex!.query({
        position: new Vector3(0, 0, 0),
        radius: 5
      });
      expect(oldPosEntities).not.toContain(entity);
      
      // Should be found at new position
      const newPosEntities = spatialIndex!.query({
        position: new Vector3(20, 0, 0),
        radius: 5
      });
      expect(newPosEntities).toContain(entity);
    });
    
    it('should handle batch updates efficiently', () => {
      const spatialIndex = world.getSystem<SpatialIndex>('spatialIndex');
      expect(spatialIndex).toBeDefined();
      
      const entities: RPGEntity[] = [];
      // Create many entities
      for (let i = 0; i < 100; i++) {
        const entity = new RPGEntity(world, `entity-${i}`, {
          position: [i * 2, 0, 0]
        });
        entities.push(entity);
        spatialIndex!.addEntity(entity);
      }
      
      // Mark many as dirty
      for (let i = 0; i < 50; i++) {
        spatialIndex!.markDirty(entities[i]);
      }
      
      // Update should process all dirty entities
      world.step();
      
      const debugInfo = spatialIndex!.getDebugInfo();
      expect(debugInfo.entityCount).toBe(100);
    });
  });
  
  describe('Terrain System', () => {
    it('should generate terrain height', () => {
      const terrain = world.getSystem<Terrain>('terrain');
      expect(terrain).toBeDefined();
      
      // Get height at various positions
      const height1 = terrain!.getHeightAt(0, 0);
      const height2 = terrain!.getHeightAt(10, 10);
      const height3 = terrain!.getHeightAt(100, 100);
      
      // Heights should be different (unless coincidentally the same)
      expect(typeof height1).toBe('number');
      expect(typeof height2).toBe('number');
      expect(typeof height3).toBe('number');
    });
    
    it('should determine terrain types', () => {
      const terrain = world.getSystem<Terrain>('terrain');
      expect(terrain).toBeDefined();
      
      // Get terrain types at various positions
      const type1 = terrain!.getTypeAt(0, 0);
      const type2 = terrain!.getTypeAt(50, 50);
      
      expect(typeof type1).toBe('string');
      expect(typeof type2).toBe('string');
    });
    
    it('should check walkability', () => {
      const terrain = world.getSystem<Terrain>('terrain');
      expect(terrain).toBeDefined();
      
      // Check if positions are walkable
      const walkable1 = terrain!.isWalkable(0, 0);
      const walkable2 = terrain!.isWalkable(100, 100);
      
      expect(typeof walkable1).toBe('boolean');
      expect(typeof walkable2).toBe('boolean');
    });
    
    it('should perform terrain raycasting', () => {
      const terrain = world.getSystem<Terrain>('terrain');
      expect(terrain).toBeDefined();
      
      // Cast ray downward from above terrain
      const origin = new Vector3(0, 100, 0);
      const direction = new Vector3(0, -1, 0);
      
      const hit = terrain!.raycast(origin, direction, 200);
      
      if (hit) {
        expect(hit).toHaveProperty('x');
        expect(hit).toHaveProperty('y');
        expect(hit).toHaveProperty('z');
        expect(hit.y).toBeLessThan(100);
      }
    });
  });
  
  describe('Time System', () => {
    it('should track game time', () => {
      const time = world.getSystem<Time>('time');
      expect(time).toBeDefined();
      
      const gameTime = time!.getTime();
      expect(gameTime).toHaveProperty('hour');
      expect(gameTime).toHaveProperty('minute');
      expect(gameTime).toHaveProperty('day');
      expect(gameTime).toHaveProperty('timeOfDay');
      expect(gameTime).toHaveProperty('isDaytime');
    });
    
    it('should advance time', async () => {
      const time = world.getSystem<Time>('time');
      expect(time).toBeDefined();
      
      const startTime = time!.getTime();
      
      // Run world for 100ms
      await world.run(100);
      
      const endTime = time!.getTime();
      
      // Time should have advanced
      expect(endTime.hour * 60 + endTime.minute).toBeGreaterThan(
        startTime.hour * 60 + startTime.minute
      );
    });
    
    it('should handle time events', async () => {
      const time = world.getSystem<Time>('time');
      expect(time).toBeDefined();
      
      const currentTime = time!.getTime();
      const eventHour = (currentTime.hour + 1) % 24;
      
      let eventTriggered = false;
      
      // Add time event
      time!.addEvent({
        id: 'test-event',
        hour: eventHour,
        minute: 0,
        callback: (gameTime) => {
          expect(gameTime.hour).toBe(eventHour);
          eventTriggered = true;
        },
        repeat: false
      });
      
      // Fast forward time
      time!.setTimeScale(3600); // 1 hour per second
      await world.run(1100);
      
      expect(eventTriggered).toBe(true);
    });
    
    it('should pause and resume time', () => {
      const time = world.getSystem<Time>('time');
      expect(time).toBeDefined();
      
      const startTime = time!.getTime();
      
      // Pause time
      time!.pause();
      
      // Step world
      world.step();
      world.step();
      
      const pausedTime = time!.getTime();
      expect(pausedTime.hour).toBe(startTime.hour);
      expect(pausedTime.minute).toBe(startTime.minute);
      
      // Resume time
      time!.resume();
    });
  });
  
  describe('System Integration', () => {
    it('should integrate spatial index with movement', () => {
      const spatialIndex = world.getSystem<SpatialIndex>('spatialIndex');
      const movementSystem = world.getSystem<any>('movement');
      
      expect(spatialIndex).toBeDefined();
      expect(movementSystem).toBeDefined();
      
      // Create entity with movement
      const entity = new RPGEntity(world, 'moving-entity', {
        position: [0, 0, 0]
      });
      
      entity.addComponent('movement', {
        type: 'movement',
        entity: entity as any,
        data: {},
        position: { x: 0, y: 0, z: 0 },
        destination: { x: 10, y: 0, z: 0 },
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
      
      spatialIndex!.addEntity(entity);
      
      // Movement should update spatial index
      world.step();
      
      // Entity should be findable along its path
      const nearbyEntities = spatialIndex!.query({
        position: new Vector3(5, 0, 0),
        radius: 10
      });
      expect(nearbyEntities).toContain(entity);
    });
    
    it('should integrate terrain with movement', () => {
      const terrain = world.getSystem<Terrain>('terrain');
      const movementSystem = world.getSystem<any>('movement');
      
      expect(terrain).toBeDefined();
      expect(movementSystem).toBeDefined();
      
      // Get terrain height at a position
      const height = terrain!.getHeightAt(0, 0);
      
      // Create entity at terrain height
      const entity = new RPGEntity(world, 'terrain-entity', {
        position: [0, height, 0]
      });
      
      // Entity should be on terrain
      expect(entity.position.y).toBe(height);
    });
    
    it('should integrate time with NPC spawning', () => {
      const time = world.getSystem<Time>('time');
      const npcSystem = world.getSystem<any>('npc');
      const spawningSystem = world.getSystem<any>('spawning');
      
      expect(time).toBeDefined();
      expect(npcSystem).toBeDefined();
      expect(spawningSystem).toBeDefined();
      
      // Time-based spawning could be implemented
      const gameTime = time!.getTime();
      expect(gameTime.isDaytime).toBeDefined();
    });
  });
}); 