import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Settings } from '../../core/systems/Settings.js';
import { createTestWorld } from '../test-world-factory.js';

describe('Settings System', () => {
  let world: any;
  let settings: Settings;

  beforeEach(async () => {
    world = await createTestWorld();
    settings = new Settings(world);
  });

  describe('Basic Operations', () => {
    it('should initialize with null values', () => {
      expect(settings.title).toBeNull();
      expect(settings.desc).toBeNull();
      expect(settings.image).toBeNull();
      expect(settings.model).toBeNull();
      expect(settings.avatar).toBeNull();
      expect(settings.public).toBeNull();
      expect(settings.playerLimit).toBeNull();
    });

    it('should get and set values', () => {
      settings.set('title', 'Test World');
      expect(settings.get('title')).toBe('Test World');

      settings.set('playerLimit', 50);
      expect(settings.get('playerLimit')).toBe(50);

      settings.set('public', true);
      expect(settings.get('public')).toBe(true);
    });

    it('should not create changes for same value', () => {
      settings.set('title', 'Test');
      settings.set('title', 'Test'); // Same value
      
      // Run preFixedUpdate to process changes
      const changeSpy = vi.fn();
      settings.on('change', changeSpy);
      settings.preFixedUpdate();
      
      // Should only emit once
      expect(changeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Serialization', () => {
    it('should serialize current state', () => {
      settings.set('title', 'My World');
      settings.set('desc', 'A test world');
      settings.set('playerLimit', 100);
      settings.set('public', true);

      const serialized = settings.serialize();
      
      expect(serialized).toEqual({
        title: 'My World',
        desc: 'A test world',
        image: null,
        model: null,
        avatar: null,
        public: true,
        playerLimit: 100,
      });
    });

    it('should deserialize data correctly', () => {
      const data = {
        title: 'Imported World',
        desc: 'An imported world',
        image: 'https://example.com/image.jpg',
        model: 'world.glb',
        avatar: 'avatar.vrm',
        public: false,
        playerLimit: 25,
      };

      const changeSpy = vi.fn();
      settings.on('change', changeSpy);
      
      settings.deserialize(data);

      expect(settings.title).toBe('Imported World');
      expect(settings.desc).toBe('An imported world');
      expect(settings.image).toBe('https://example.com/image.jpg');
      expect(settings.model).toBe('world.glb');
      expect(settings.avatar).toBe('avatar.vrm');
      expect(settings.public).toBe(false);
      expect(settings.playerLimit).toBe(25);
      
      // Should emit change event
      expect(changeSpy).toHaveBeenCalledWith({
        title: { value: 'Imported World' },
        desc: { value: 'An imported world' },
        image: { value: 'https://example.com/image.jpg' },
        model: { value: 'world.glb' },
        avatar: { value: 'avatar.vrm' },
        public: { value: false },
        playerLimit: { value: 25 },
      });
    });
  });

  describe('Change Tracking', () => {
    it('should track changes with previous values', () => {
      settings.set('title', 'Original');
      settings.preFixedUpdate(); // Clear changes

      const changeSpy = vi.fn();
      settings.on('change', changeSpy);

      settings.set('title', 'Modified');
      settings.set('desc', 'New description');
      
      settings.preFixedUpdate();

      expect(changeSpy).toHaveBeenCalledWith({
        title: { prev: 'Original', value: 'Modified' },
        desc: { prev: null, value: 'New description' },
      });
    });

    it('should clear changes after emitting', () => {
      settings.set('title', 'Test');
      settings.preFixedUpdate();

      const changeSpy = vi.fn();
      settings.on('change', changeSpy);
      
      settings.preFixedUpdate(); // Should not emit anything
      
      expect(changeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast changes when requested', () => {
      // Mock network
      world.network = {
        send: vi.fn()
      };

      settings.set('title', 'Broadcast Test', true);

      expect(world.network.send).toHaveBeenCalledWith('settingsModified', {
        key: 'title',
        value: 'Broadcast Test'
      });
    });

    it('should not broadcast when broadcast is false', () => {
      world.network = {
        send: vi.fn()
      };

      settings.set('title', 'No Broadcast', false);

      expect(world.network.send).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should support event listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      settings.on('change', handler1);
      settings.on('change', handler2);

      settings.set('title', 'Event Test');
      settings.preFixedUpdate();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should remove specific event handlers', () => {
      const handler = vi.fn();
      
      settings.on('change', handler);
      settings.off('change', handler);

      settings.set('title', 'No Handler');
      settings.preFixedUpdate();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all handlers when no specific handler provided', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      settings.on('change', handler1);
      settings.on('change', handler2);
      settings.off('change');

      settings.set('title', 'No Handlers');
      settings.preFixedUpdate();

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });
}); 