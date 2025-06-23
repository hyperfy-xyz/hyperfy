import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestScenario } from '../test-world-factory';
import type { Entity } from '../../types';

describe('Entity Physics (In-Sim)', () => {
  let scenario: TestScenario;

  beforeEach(async () => {
    scenario = new TestScenario();
    await scenario.setup();
  });

  afterEach(async () => {
    await scenario.cleanup();
  });

  describe('Basic Movement', () => {
    it('should move entity with applied force', async () => {
      // Spawn entity at origin
      const entity = await scenario.spawnEntity('TestCube', {
        position: { x: 0, y: 10, z: 0 },
        components: {
          rigidbody: { mass: 1, type: 'dynamic' },
          collider: { type: 'box', size: { x: 1, y: 1, z: 1 } }
        }
      });

      // Apply horizontal force
      entity.applyForce({ x: 100, y: 0, z: 0 });

      // Run physics simulation for 1 second
      await scenario.runFor(1000);

      // Entity should have moved in X direction
      expect(entity.position.x).toBeGreaterThan(0);
      expect(entity.position.y).toBeLessThan(10); // Gravity should pull it down
      expect(entity.position.z).toBeCloseTo(0, 2);
    });

    it('should handle gravity correctly', async () => {
      const entity = await scenario.spawnEntity('FallingCube', {
        position: { x: 0, y: 20, z: 0 }
      });

      const initialY = entity.position.y;

      // Let it fall for 2 seconds
      await scenario.runFor(2000);

      // Should have fallen due to gravity
      expect(entity.position.y).toBeLessThan(initialY);
      
      // Velocity should be negative (falling)
      const velocity = entity.getVelocity();
      expect(velocity.y).toBeLessThan(0);
    });

    it('should handle collisions between entities', async () => {
      // Create two entities that will collide
      const entity1 = await scenario.spawnEntity('Entity1', {
        position: { x: -5, y: 5, z: 0 },
        components: {
          rigidbody: { mass: 1, type: 'dynamic' },
          collider: { type: 'sphere', radius: 1 }
        }
      });

      const entity2 = await scenario.spawnEntity('Entity2', {
        position: { x: 5, y: 5, z: 0 },
        components: {
          rigidbody: { mass: 1, type: 'dynamic' },
          collider: { type: 'sphere', radius: 1 }
        }
      });

      // Apply forces towards each other
      entity1.applyForce({ x: 200, y: 0, z: 0 });
      entity2.applyForce({ x: -200, y: 0, z: 0 });

      // Track collision
      let collisionDetected = false;
      scenario.world.events.on('collision', (data: any) => {
        if ((data.entity1 === entity1.id && data.entity2 === entity2.id) ||
            (data.entity1 === entity2.id && data.entity2 === entity1.id)) {
          collisionDetected = true;
        }
      });

      // Run until collision or timeout
      await scenario.runUntil(() => collisionDetected, 3000);

      expect(collisionDetected).toBe(true);
      
      // After collision, velocities should have changed
      const vel1 = entity1.getVelocity();
      const vel2 = entity2.getVelocity();
      
      // They should be moving away from each other
      expect(vel1.x).toBeLessThan(0);
      expect(vel2.x).toBeGreaterThan(0);
    });
  });

  describe('Advanced Physics', () => {
    it('should handle impulses correctly', async () => {
      const entity = await scenario.spawnEntity('ImpulseTest', {
        position: { x: 0, y: 5, z: 0 },
        components: {
          rigidbody: { mass: 2, type: 'dynamic' }
        }
      });

      // Apply upward impulse
      entity.applyImpulse({ x: 0, y: 50, z: 0 });

      // Check immediate velocity
      const velocity = entity.getVelocity();
      expect(velocity.y).toBeGreaterThan(0);

      // Run for a bit
      await scenario.runFor(500);

      // Should be higher than starting position initially
      expect(entity.position.y).toBeGreaterThan(5);
    });

    it('should respect physics constraints', async () => {
      const staticEntity = await scenario.spawnEntity('StaticWall', {
        position: { x: 0, y: 0, z: 0 },
        components: {
          rigidbody: { type: 'static' },
          collider: { type: 'box', size: { x: 10, y: 10, z: 1 } }
        }
      });

      const dynamicEntity = await scenario.spawnEntity('Ball', {
        position: { x: 0, y: 10, z: 5 },
        components: {
          rigidbody: { mass: 1, type: 'dynamic' },
          collider: { type: 'sphere', radius: 0.5 }
        }
      });

      // Apply force towards the wall
      dynamicEntity.applyForce({ x: 0, y: 0, z: -100 });

      await scenario.runFor(2000);

      // Ball should stop at the wall (z ≈ 1.5 accounting for radius)
      expect(dynamicEntity.position.z).toBeGreaterThan(0.5);
      expect(dynamicEntity.position.z).toBeLessThan(2);
      
      // Static entity should not have moved
      expect(staticEntity.position).toBeNearVector({ x: 0, y: 0, z: 0 } as any);
    });

    it('should handle angular velocity', async () => {
      const entity = await scenario.spawnEntity('SpinningCube', {
        position: { x: 0, y: 10, z: 0 },
        components: {
          rigidbody: { 
            mass: 1, 
            type: 'dynamic',
            angularVelocity: { x: 0, y: 5, z: 0 } // Spinning around Y axis
          }
        }
      });

      const initialRotation = { ...entity.rotation };

      await scenario.runFor(1000);

      // Rotation should have changed
      expect(entity.rotation).not.toBeNearQuaternion(initialRotation);
    });
  });

  describe('Performance', () => {
    it('should handle 100 physics entities at 60fps', async () => {
      // Spawn many entities
      const entities: Entity[] = [];
      for (let i = 0; i < 100; i++) {
        const entity = await scenario.spawnEntity(`Entity${i}`, {
          position: { 
            x: (Math.random() - 0.5) * 20,
            y: Math.random() * 20 + 5,
            z: (Math.random() - 0.5) * 20
          },
          components: {
            rigidbody: { mass: 1, type: 'dynamic' },
            collider: { type: 'sphere', radius: 0.5 }
          }
        });
        entities.push(entity);
      }

      // Measure frame time
      const frameTimings: number[] = [];
      const measureFrame = () => {
        const start = performance.now();
        scenario.world.tick(16);
        frameTimings.push(performance.now() - start);
      };

      // Run for 60 frames
      for (let i = 0; i < 60; i++) {
        measureFrame();
        await new Promise(resolve => setTimeout(resolve, 16));
      }

      // Calculate average frame time
      const avgFrameTime = frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length;
      const maxFrameTime = Math.max(...frameTimings);

      // Should maintain 60fps (16.67ms per frame)
      expect(avgFrameTime).toBeLessThan(16.67);
      expect(maxFrameTime).toBeLessThan(33.33); // Allow occasional spikes up to 30fps
    });
  });

  describe('Raycasting', () => {
    it('should detect entities with raycast', async () => {
      // Create a wall
      const wall = await scenario.spawnEntity('Wall', {
        position: { x: 10, y: 0, z: 0 },
        components: {
          collider: { type: 'box', size: { x: 1, y: 10, z: 10 } }
        }
      });

      // Cast ray from origin towards the wall
      const hit = scenario.world.physics.raycast(
        { x: 0, y: 0, z: 0 }, // origin
        { x: 1, y: 0, z: 0 }, // direction
        20 // max distance
      );

      expect(hit).toBeTruthy();
      expect(hit?.distance).toBeCloseTo(9.5, 1); // Wall at x=10, thickness=1
      expect(hit?.entity?.id).toBe(wall.id);
      expect(hit?.normal).toBeNearVector({ x: -1, y: 0, z: 0 } as any);
    });

    it('should handle sphere cast for wider detection', async () => {
      // Create small obstacles
      for (let i = 0; i < 5; i++) {
        await scenario.spawnEntity(`Obstacle${i}`, {
          position: { x: i * 2 + 5, y: 0, z: 0 },
          components: {
            collider: { type: 'sphere', radius: 0.2 }
          }
        });
      }

      // Sphere cast with larger radius
      const hit = scenario.world.physics.sphereCast(
        { x: 0, y: 0, z: 0 }, // origin
        1, // sphere radius
        { x: 1, y: 0, z: 0 }, // direction
        20 // max distance
      );

      expect(hit).toBeTruthy();
      expect(hit?.distance).toBeLessThan(5); // Should hit first obstacle
    });
  });
}); 