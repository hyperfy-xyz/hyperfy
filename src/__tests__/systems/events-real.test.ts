import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestWorld } from '../createTestWorld';
import type { World } from '../../types';
import type { Events } from '../../core/systems/Events';

describe('Events System (Real World)', () => {
  let world: World;
  let events: Events;

  beforeEach(async () => {
    world = await createTestWorld({ enablePhysics: false });
    events = world.events as Events;
  });

  afterEach(() => {
    world.destroy();
  });

  describe('Basic Event Handling', () => {
    it('should emit and receive events in real world', () => {
      const handler = vi.fn();
      events.on('test-event', handler);
      
      events.emit('test-event', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' }, undefined);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple listeners for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      
      events.on('multi-event', handler1);
      events.on('multi-event', handler2);
      events.on('multi-event', handler3);
      
      events.emit('multi-event', 'test-data');
      
      expect(handler1).toHaveBeenCalledWith('test-data', undefined);
      expect(handler2).toHaveBeenCalledWith('test-data', undefined);
      expect(handler3).toHaveBeenCalledWith('test-data', undefined);
    });

    it('should pass both data and extra parameters', () => {
      const handler = vi.fn();
      events.on('params-event', handler);
      
      events.emit('params-event', { id: 1 }, { extra: 'info' });
      
      expect(handler).toHaveBeenCalledWith({ id: 1 }, { extra: 'info' });
    });
  });

  describe('RPG Event Integration', () => {
    it('should handle combat events from real combat system', () => {
      const combatStartHandler = vi.fn();
      const combatHitHandler = vi.fn();
      const combatEndHandler = vi.fn();
      
      events.on('combat:start', combatStartHandler);
      events.on('combat:hit', combatHitHandler);
      events.on('combat:end', combatEndHandler);
      
      // Simulate combat events (these would normally come from CombatSystem)
      events.emit('combat:start', { 
        session: { 
          attackerId: 'player-1', 
          targetId: 'npc-1' 
        } 
      });
      
      events.emit('combat:hit', { 
        hit: { 
          damage: 5, 
          type: 'normal',
          attackerId: 'player-1',
          targetId: 'npc-1'
        } 
      });
      
      events.emit('combat:end', { 
        session: { 
          attackerId: 'player-1', 
          targetId: 'npc-1' 
        } 
      });
      
      expect(combatStartHandler).toHaveBeenCalled();
      expect(combatHitHandler).toHaveBeenCalled();
      expect(combatEndHandler).toHaveBeenCalled();
    });

    it('should handle loot events', () => {
      const lootDropHandler = vi.fn();
      events.on('loot:dropped', lootDropHandler);
      
      events.emit('loot:dropped', {
        itemId: 995,
        quantity: 100,
        position: { x: 10, y: 0, z: 10 },
        owner: 'player-1'
      });
      
      expect(lootDropHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 995,
          quantity: 100
        }),
        undefined
      );
    });

    it('should handle skill events', () => {
      const xpGainHandler = vi.fn();
      const levelUpHandler = vi.fn();
      
      events.on('xp:gained', xpGainHandler);
      events.on('skill:levelup', levelUpHandler);
      
      events.emit('xp:gained', {
        playerId: 'player-1',
        skill: 'attack',
        amount: 100
      });
      
      events.emit('skill:levelup', {
        playerId: 'player-1',
        skill: 'attack',
        newLevel: 2,
        oldLevel: 1
      });
      
      expect(xpGainHandler).toHaveBeenCalled();
      expect(levelUpHandler).toHaveBeenCalled();
    });
  });

  describe('System Communication', () => {
    it('should allow systems to communicate via events', () => {
      // Test that all RPG systems are loaded and can emit events
      const worldAny = world as any;
      expect(worldAny.combat).toBeDefined();
      expect(worldAny.inventory).toBeDefined();
      expect(worldAny.npc).toBeDefined();
      expect(worldAny.loot).toBeDefined();
      expect(worldAny.skills).toBeDefined();
      
      // Track entity death flow
      const deathHandlers = {
        combat: vi.fn(),
        loot: vi.fn(),
        spawning: vi.fn()
      };
      
      // Systems would register these handlers
      events.on('entity:death', deathHandlers.combat);
      events.on('entity:death', deathHandlers.loot);
      events.on('entity:death', deathHandlers.spawning);
      
      // Emit death event
      events.emit('entity:death', {
        entityId: 'npc-1',
        killerId: 'player-1'
      });
      
      // All systems should receive the event
      expect(deathHandlers.combat).toHaveBeenCalled();
      expect(deathHandlers.loot).toHaveBeenCalled();
      expect(deathHandlers.spawning).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in real world event handlers', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodHandler = vi.fn();
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      events.on('error-test', badHandler);
      events.on('error-test', goodHandler);
      
      events.emit('error-test', 'data');
      
      expect(errorSpy).toHaveBeenCalledWith(
        "Error in event listener for 'error-test':",
        expect.any(Error)
      );
      expect(goodHandler).toHaveBeenCalledWith('data', undefined);
      
      errorSpy.mockRestore();
    });
  });
}); 