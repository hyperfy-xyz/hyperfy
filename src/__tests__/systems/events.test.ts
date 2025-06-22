import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Events } from '../../core/systems/Events.js';
import { createTestWorld } from '../test-world-factory.js';

describe('Events System', () => {
  let world: any;
  let events: Events;

  beforeEach(async () => {
    world = await createTestWorld();
    events = new Events(world);
  });

  describe('Basic Event Handling', () => {
    it('should emit and receive events', () => {
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

    it('should not throw when emitting event with no listeners', () => {
      expect(() => {
        events.emit('no-listeners', 'data');
      }).not.toThrow();
    });
  });

  describe('Event Listener Management', () => {
    it('should remove specific event listener', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      events.on('remove-test', handler1);
      events.on('remove-test', handler2);
      
      events.off('remove-test', handler1);
      events.emit('remove-test', 'data');
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('data', undefined);
    });

    it('should remove all listeners when no handler specified', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      events.on('clear-all', handler1);
      events.on('clear-all', handler2);
      
      events.off('clear-all');
      events.emit('clear-all', 'data');
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent listener gracefully', () => {
      const handler = vi.fn();
      
      expect(() => {
        events.off('non-existent', handler);
      }).not.toThrow();
    });

    it('should handle multiple events independently', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      events.on('event1', handler1);
      events.on('event2', handler2);
      
      events.emit('event1', 'data1');
      events.emit('event2', 'data2');
      
      expect(handler1).toHaveBeenCalledWith('data1', undefined);
      expect(handler1).not.toHaveBeenCalledWith('data2', undefined);
      expect(handler2).toHaveBeenCalledWith('data2', undefined);
      expect(handler2).not.toHaveBeenCalledWith('data1', undefined);
    });
  });

  describe('Error Handling', () => {
    it('should catch and log errors in event handlers', () => {
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

    it('should continue emitting to other handlers after error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler1 = vi.fn();
      const handler2 = vi.fn(() => {
        throw new Error('Handler 2 error');
      });
      const handler3 = vi.fn();
      
      events.on('continue-after-error', handler1);
      events.on('continue-after-error', handler2);
      events.on('continue-after-error', handler3);
      
      events.emit('continue-after-error', 'test');
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
      
      errorSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should clear all listeners on destroy', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      events.on('event1', handler1);
      events.on('event2', handler2);
      
      events.destroy();
      
      events.emit('event1', 'data');
      events.emit('event2', 'data');
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Game Event Patterns', () => {
    it('should handle player events', () => {
      const playerJoinHandler = vi.fn();
      const playerLeaveHandler = vi.fn();
      
      events.on('player:join', playerJoinHandler);
      events.on('player:leave', playerLeaveHandler);
      
      const playerData = { id: 'player-123', name: 'TestPlayer' };
      events.emit('player:join', playerData);
      events.emit('player:leave', { id: 'player-123' });
      
      expect(playerJoinHandler).toHaveBeenCalledWith(playerData, undefined);
      expect(playerLeaveHandler).toHaveBeenCalledWith({ id: 'player-123' }, undefined);
    });

    it('should handle world events', () => {
      const worldEvents: string[] = [];
      
      events.on('world:day', () => worldEvents.push('day'));
      events.on('world:night', () => worldEvents.push('night'));
      events.on('world:weather', (type) => worldEvents.push(`weather:${type}`));
      
      events.emit('world:day');
      events.emit('world:night');
      events.emit('world:weather', 'rain');
      events.emit('world:weather', 'clear');
      
      expect(worldEvents).toEqual(['day', 'night', 'weather:rain', 'weather:clear']);
    });
  });
}); 