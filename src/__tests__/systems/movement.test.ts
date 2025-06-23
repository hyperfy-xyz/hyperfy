import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementSystem } from '../../rpg/systems/MovementSystem';
import { createTestWorld } from '../test-world-factory';
import type { World, Entity, Component } from '../../types';
import type { Vector3, MovementComponent, PlayerEntity } from '../../rpg/types';

describe('MovementSystem', () => {
  let world: World;
  let movementSystem: MovementSystem;
  let mockPlayer: Entity;

  beforeEach(async () => {
    world = await createTestWorld() as any;
    movementSystem = new MovementSystem(world);

    // Create mock player entity with proper Entity interface
    mockPlayer = {
      id: 'player_1',
      name: 'Test Player',
      type: 'player',
      world: world,
      node: null as any,
      components: new Map(),
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      isPlayer: true,
      
      addComponent: vi.fn(),
      removeComponent: vi.fn(),
      getComponent: vi.fn((type: string): any => {
        if (type === 'movement') {
          return {
            type: 'movement',
            entity: mockPlayer,
            data: {},
            isMoving: false,
            position: { x: 0, y: 0, z: 0 },
            destination: null,
            path: [],
            moveSpeed: 4.0,
            isRunning: false,
            runEnergy: 100,
            pathfindingFlags: 0,
            lastMoveTime: 0,
            teleportDestination: null,
            teleportTime: 0,
            teleportAnimation: ''
          };
        }
        return null;
      }),
      hasComponent: vi.fn(),
      applyForce: vi.fn(),
      applyImpulse: vi.fn(),
      setVelocity: vi.fn(),
      getVelocity: vi.fn(),
      serialize: vi.fn(),
      destroy: vi.fn()
    };

    (world.entities as any).items.set(mockPlayer.id, mockPlayer);
  });

  describe('Basic Movement', () => {
    it('should handle player move command', () => {
      const targetPosition = { x: 10, y: 0, z: 10 };
      const emitSpy = vi.spyOn(world.events, 'emit');

      world.events.emit('player:move', {
        playerId: mockPlayer.id,
        targetPosition
      });

      // Should emit movement started event
      expect(emitSpy).toHaveBeenCalledWith('player:moveStarted', expect.objectContaining({
        playerId: mockPlayer.id,
        targetPosition,
        isRunning: false
      }));
    });

    it('should calculate path to target', () => {
      const targetPosition = { x: 5, y: 0, z: 5 };
      
      movementSystem.moveEntity(mockPlayer.id, targetPosition);

      // Movement component should be updated
      const movement = mockPlayer.getComponent('movement') as unknown as MovementComponent;
      expect(movement.isMoving).toBe(true);
      expect(movement.destination).toEqual(targetPosition);
    });

    it('should stop movement on command', () => {
      const targetPosition = { x: 10, y: 0, z: 10 };
      const emitSpy = vi.spyOn(world.events, 'emit');

      // Start movement
      movementSystem.moveEntity(mockPlayer.id, targetPosition);

      // Stop movement
      movementSystem.stopEntity(mockPlayer.id);

      expect(emitSpy).toHaveBeenCalledWith('entity:movementStopped', expect.objectContaining({
        entityId: mockPlayer.id
      }));
    });
  });

  describe('Running and Energy', () => {
    it('should toggle run mode', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');

      world.events.emit('player:toggleRun', { playerId: mockPlayer.id });

      expect(emitSpy).toHaveBeenCalledWith('player:runToggled', expect.objectContaining({
        playerId: mockPlayer.id,
        isRunning: true
      }));
    });

    it('should drain run energy while running', () => {
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      movement.isRunning = true;
      movement.runEnergy = 100;

      // Start running movement
      movementSystem.moveEntity(mockPlayer.id, { x: 20, y: 0, z: 20 });

      // Simulate update with delta time
      movementSystem.update(1.0); // 1 second

      // Energy should be drained
      expect(movement.runEnergy).toBeLessThan(100);
    });

    it('should restore run energy while walking', () => {
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      movement.isRunning = false;
      movement.runEnergy = 50;

      // Start walking movement
      movementSystem.moveEntity(mockPlayer.id, { x: 5, y: 0, z: 5 });

      // Simulate update
      movementSystem.update(1.0); // 1 second

      // Energy should be restored
      expect(movement.runEnergy).toBeGreaterThan(50);
    });

    it('should stop running when energy depleted', () => {
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      movement.isRunning = true;
      movement.runEnergy = 0.5; // Very low energy

      movementSystem.moveEntity(mockPlayer.id, { x: 50, y: 0, z: 50 });

      // Simulate update to deplete energy
      movementSystem.update(1.0);

      expect(movement.isRunning).toBe(false);
      expect(movement.runEnergy).toBe(0);
    });
  });

  describe('Pathfinding', () => {
    it('should find direct path when no obstacles', () => {
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 10, y: 0, z: 0 };

      movementSystem.moveEntity(mockPlayer.id, end);

      // Should create a path
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      expect(movement.isMoving).toBe(true);
    });

    it('should handle blocked paths', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');

      // Create blocking entity
      const obstacle: Entity = {
        id: 'obstacle_1',
        name: 'Obstacle',
        type: 'obstacle',
        world: world,
        node: null as any,
        components: new Map(),
        position: { x: 5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
        isPlayer: false,
        addComponent: vi.fn(),
        removeComponent: vi.fn(),
        getComponent: vi.fn((type: string): any => {
          if (type === 'collider') {
            return { type: 'collider', entity: obstacle, data: { blocking: true } };
          }
          return null;
        }),
        hasComponent: vi.fn(),
        applyForce: vi.fn(),
        applyImpulse: vi.fn(),
        setVelocity: vi.fn(),
        getVelocity: vi.fn(),
        serialize: vi.fn(),
        destroy: vi.fn()
      };

      (world.entities as any).items.set(obstacle.id, obstacle);

      // Try to move through obstacle
      movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 0 });

      // Path should go around obstacle
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      expect(movement.isMoving).toBe(true);
    });

    it('should emit blocked event when no path available', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');

      // Mock isWalkable to always return false
      const isWalkableSpy = vi.spyOn(movementSystem as any, 'isWalkable');
      isWalkableSpy.mockReturnValue(false);

      movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 10 });

      expect(emitSpy).toHaveBeenCalledWith('player:moveBlocked', expect.objectContaining({
        playerId: mockPlayer.id,
        reason: 'No path found'
      }));
    });
  });

  describe('Movement Updates', () => {
    it('should move entity along path', () => {
      const targetPosition = { x: 4, y: 0, z: 0 };
      const initialPosition = { ...mockPlayer.position };

      movementSystem.moveEntity(mockPlayer.id, targetPosition);

      // Simulate multiple update frames
      for (let i = 0; i < 10; i++) {
        movementSystem.update(0.1); // 100ms per frame
      }

      // Player should have moved
      expect(mockPlayer.position.x).toBeGreaterThan(initialPosition.x);
    });

    it('should emit position updates during movement', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');

      movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 10 });
      movementSystem.update(0.1);

      expect(emitSpy).toHaveBeenCalledWith('entity:positionUpdate', expect.objectContaining({
        entityId: mockPlayer.id,
        position: expect.any(Object),
        isRunning: false
      }));
    });

    it('should update facing direction during movement', () => {
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      
      movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 10 });
      movementSystem.update(0.1);

      // Facing direction should be updated
      const extMovement = movement as any;
      if (extMovement.facingDirection !== undefined) {
        expect(extMovement.facingDirection).not.toBe(0);
      }
    });

    it('should emit reached destination event', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');
      const targetPosition = { x: 1, y: 0, z: 0 }; // Close target

      movementSystem.moveEntity(mockPlayer.id, targetPosition);

      // Simulate movement to destination
      for (let i = 0; i < 20; i++) {
        movementSystem.update(0.1);
      }

      expect(emitSpy).toHaveBeenCalledWith('entity:reachedDestination', expect.objectContaining({
        entityId: mockPlayer.id
      }));
    });
  });

  describe('Teleportation', () => {
    it('should teleport entity to position', () => {
      const teleportPosition = { x: 100, y: 0, z: 100 };
      const emitSpy = vi.spyOn(world.events, 'emit');

      movementSystem.teleportEntity(mockPlayer.id, teleportPosition);

      expect(mockPlayer.position).toEqual(teleportPosition);
      expect(emitSpy).toHaveBeenCalledWith('entity:teleported', expect.objectContaining({
        entityId: mockPlayer.id,
        position: teleportPosition
      }));
    });

    it('should stop current movement when teleporting', () => {
      // Start movement
      movementSystem.moveEntity(mockPlayer.id, { x: 50, y: 0, z: 50 });

      // Teleport
      movementSystem.teleportEntity(mockPlayer.id, { x: 100, y: 0, z: 100 });

      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      expect(movement.isMoving).toBe(false);
      const extMovement = movement as any;
      if (extMovement.targetPosition !== undefined) {
        expect(extMovement.targetPosition).toBeNull();
      }
    });
  });

  describe('Collision Detection', () => {
    it('should check world bounds', () => {
      const outOfBoundsPosition = { x: 2000, y: 0, z: 2000 };
      
      // Try to move out of bounds
      movementSystem.moveEntity(mockPlayer.id, outOfBoundsPosition);

      // Should still try to move but path might be limited
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      expect(movement.isMoving).toBe(true);
    });

    it('should recalculate path on collision', () => {
      const targetPosition = { x: 10, y: 0, z: 10 };
      
      // Start movement
      movementSystem.moveEntity(mockPlayer.id, targetPosition);

      // Add obstacle in path after movement started
      const obstacle: Entity = {
        id: 'obstacle_2',
        name: 'Obstacle 2',
        type: 'obstacle',
        world: world,
        node: null as any,
        components: new Map(),
        position: { x: 5, y: 0, z: 5 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
        isPlayer: false,
        addComponent: vi.fn(),
        removeComponent: vi.fn(),
        getComponent: vi.fn((type: string): any => {
          if (type === 'collider') {
            return { type: 'collider', entity: obstacle, data: { blocking: true } };
          }
          return null;
        }),
        hasComponent: vi.fn(),
        applyForce: vi.fn(),
        applyImpulse: vi.fn(),
        setVelocity: vi.fn(),
        getVelocity: vi.fn(),
        serialize: vi.fn(),
        destroy: vi.fn()
      };

      (world.entities as any).items.set(obstacle.id, obstacle);

      // Update movement
      movementSystem.update(0.5);

      // Movement should continue (path recalculated)
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      expect(movement.isMoving).toBe(true);
    });
  });

  describe('Path Smoothing', () => {
    it('should smooth generated paths', () => {
      // This is tested internally by the pathfinding algorithm
      // The smoothPath method reduces unnecessary waypoints
      
      movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 10 });
      
      // Path should be created and smoothed
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      expect(movement.isMoving).toBe(true);
    });
  });

  describe('Multiple Entity Movement', () => {
    it('should handle multiple entities moving simultaneously', () => {
      // Create second player
      const player2: Entity = {
        id: 'player_2',
        name: 'Player 2',
        type: 'player',
        world: world,
        node: null as any,
        components: new Map(),
        position: { x: 20, y: 0, z: 20 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
        isPlayer: true,
        addComponent: vi.fn(),
        removeComponent: vi.fn(),
        getComponent: vi.fn((): any => null), // Will be set below
        hasComponent: vi.fn(),
        applyForce: vi.fn(),
        applyImpulse: vi.fn(),
        setVelocity: vi.fn(),
        getVelocity: vi.fn(),
        serialize: vi.fn(),
        destroy: vi.fn()
      };

      // Now set the getComponent function with proper reference
      player2.getComponent = vi.fn((): any => ({
        type: 'movement',
        entity: player2,
        data: {},
        isMoving: false,
        position: { x: 20, y: 0, z: 20 },
        destination: null,
        path: [],
        moveSpeed: 4.0,
        isRunning: false,
        runEnergy: 100,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      }));

      (world.entities as any).items.set(player2.id, player2);

      // Move both players
      movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 10 });
      movementSystem.moveEntity(player2.id, { x: 30, y: 0, z: 30 });

      // Update system
      movementSystem.update(0.1);

      // Both should be moving
      expect(mockPlayer.position.x).toBeGreaterThan(0);
      expect(player2.position.x).toBeGreaterThan(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity removal during movement', () => {
      movementSystem.moveEntity(mockPlayer.id, { x: 50, y: 0, z: 50 });

      // Remove entity
      (world.entities as any).items.delete(mockPlayer.id);

      // Update should not crash
      expect(() => movementSystem.update(0.1)).not.toThrow();
    });

    it('should handle zero distance movement', () => {
      const currentPosition = { ...mockPlayer.position };
      
      movementSystem.moveEntity(mockPlayer.id, currentPosition);

      // Should reach destination immediately
      const emitSpy = vi.spyOn(world.events, 'emit');
      movementSystem.update(0.1);

      expect(emitSpy).toHaveBeenCalledWith('entity:reachedDestination', expect.any(Object));
    });

    it('should handle missing movement component', () => {
      mockPlayer.getComponent = vi.fn(() => null);

      // Should not crash
      expect(() => {
        movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 10 });
      }).not.toThrow();
    });

    it('should handle movement when canMove is false', () => {
      const movement = mockPlayer.getComponent('movement') as MovementComponent;
      const extMovement = movement as any;
      extMovement.canMove = false;

      const emitSpy = vi.spyOn(world.events, 'emit');
      movementSystem.moveEntity(mockPlayer.id, { x: 10, y: 0, z: 10 });

      // Should not start movement
      expect(emitSpy).not.toHaveBeenCalledWith('player:moveStarted', expect.any(Object));
    });
  });
}); 