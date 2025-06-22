import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Chat, ExtendedChatMessage } from '../../core/systems/Chat.js';
import { createTestWorld, MockWorld } from '../test-world-factory.js';
import moment from 'moment';

// Mock uuid function
vi.mock('../../core/utils.js', () => ({
  uuid: vi.fn(() => 'test-uuid-' + Math.random())
}));

describe('Chat System', () => {
  let world: MockWorld;
  let chat: Chat;

  beforeEach(async () => {
    world = await createTestWorld();
    chat = new Chat(world);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty messages and listeners', () => {
      expect(chat.msgs).toEqual([]);
      expect((chat as any).chatListeners.size).toBe(0);
    });
  });

  describe('add', () => {
    it('should add a message to the chat', () => {
      const msg: ExtendedChatMessage = {
        id: 'msg-1',
        from: 'Player1',
        fromId: 'player-1',
        body: 'Hello world!',
        text: 'Hello world!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      };

      chat.add(msg);

      expect(chat.msgs).toHaveLength(1);
      expect(chat.msgs[0]).toEqual(msg);
    });

    it('should limit messages to CHAT_MAX_MESSAGES', () => {
      // Add 51 messages (one more than the limit)
      for (let i = 0; i < 51; i++) {
        const msg: ExtendedChatMessage = {
          id: `msg-${i}`,
          from: 'Player1',
          body: `Message ${i}`,
          text: `Message ${i}`,
          timestamp: Date.now(),
          createdAt: moment().toISOString()
        };
        chat.add(msg);
      }

      expect(chat.msgs).toHaveLength(50);
      expect(chat.msgs[0].id).toBe('msg-1'); // First message should be removed
      expect(chat.msgs[49].id).toBe('msg-50'); // Last message should be present
    });

    it('should notify listeners when message is added', () => {
      const listener = vi.fn();
      chat.subscribe(listener);

      const msg: ExtendedChatMessage = {
        id: 'msg-1',
        from: 'Player1',
        body: 'Hello!',
        text: 'Hello!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      };

      chat.add(msg);

      expect(listener).toHaveBeenCalledTimes(2); // Once on subscribe, once on add
      expect(listener).toHaveBeenLastCalledWith([msg]);
    });

    it('should trigger player chat animation if fromId is provided', () => {
      const mockPlayer = {
        chat: vi.fn()
      };
      world.entities.players.set('player-1', mockPlayer as any);

      const msg: ExtendedChatMessage = {
        id: 'msg-1',
        from: 'Player1',
        fromId: 'player-1',
        body: 'Hello!',
        text: 'Hello!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      };

      chat.add(msg);

      expect(mockPlayer.chat).toHaveBeenCalledWith('Hello!');
    });

    it('should emit chat event', () => {
      const msg: ExtendedChatMessage = {
        id: 'msg-1',
        from: 'Player1',
        body: 'Hello!',
        text: 'Hello!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      };

      chat.add(msg);

      expect(world.events.emit).toHaveBeenCalledWith('chat', expect.objectContaining(msg));
    });

    it('should broadcast message when broadcast is true', () => {
      const mockNetwork = {
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      const msg: ExtendedChatMessage = {
        id: 'msg-1',
        from: 'Player1',
        body: 'Hello!',
        text: 'Hello!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      };

      chat.add(msg, true);

      expect(mockNetwork.send).toHaveBeenCalledWith('chatAdded', msg);
    });
  });

  describe('command', () => {
    it('should not process commands on server', () => {
      const mockNetwork = {
        isServer: true,
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      chat.command('/stats');

      expect(mockNetwork.send).not.toHaveBeenCalled();
    });

    it('should parse and send command to network', () => {
      const mockNetwork = {
        isServer: false,
        isClient: true,
        id: 'player-1',
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      chat.command('/teleport home');

      expect(mockNetwork.send).toHaveBeenCalledWith('command', ['teleport', 'home']);
    });

    it('should toggle stats when /stats command is used', () => {
      const mockPrefs = {
        stats: false,
        setStats: vi.fn()
      };
      const mockNetwork = {
        isServer: false,
        isClient: true,
        id: 'player-1',
        send: vi.fn()
      };
      (world as any).prefs = mockPrefs;
      (world as any).network = mockNetwork;

      chat.command('/stats');

      expect(mockPrefs.setStats).toHaveBeenCalledWith(true);
    });

    it('should emit command event for non-admin commands', () => {
      const mockNetwork = {
        isServer: false,
        isClient: true,
        id: 'player-1',
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      chat.command('/teleport home');

      expect(world.events.emit).toHaveBeenCalledWith('command', {
        playerId: 'player-1',
        args: ['teleport', 'home']
      });
    });

    it('should not emit command event for admin commands', () => {
      const mockNetwork = {
        isServer: false,
        isClient: true,
        id: 'player-1',
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      chat.command('/admin kick player2');

      expect(world.events.emit).not.toHaveBeenCalledWith(
        'command',
        expect.anything()
      );
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      // Add some messages
      for (let i = 0; i < 5; i++) {
        chat.add({
          id: `msg-${i}`,
          from: 'Player1',
          body: `Message ${i}`,
          text: `Message ${i}`,
          timestamp: Date.now(),
          createdAt: moment().toISOString()
        });
      }

      expect(chat.msgs).toHaveLength(5);

      chat.clear();

      expect(chat.msgs).toHaveLength(0);
    });

    it('should notify listeners when cleared', () => {
      const listener = vi.fn();
      chat.subscribe(listener);

      chat.clear();

      expect(listener).toHaveBeenLastCalledWith([]);
    });

    it('should broadcast clear when broadcast is true', () => {
      const mockNetwork = {
        send: vi.fn()
      };
      (world as any).network = mockNetwork;

      chat.clear(true);

      expect(mockNetwork.send).toHaveBeenCalledWith('chatCleared');
    });
  });

  describe('send', () => {
    it('should only work on client', () => {
      const mockNetwork = {
        isServer: true,
        isClient: false
      };
      (world as any).network = mockNetwork;

      const result = chat.send('Hello!');

      expect(result).toBeUndefined();
      expect(chat.msgs).toHaveLength(0);
    });

    it('should create and add message from current player', () => {
      const mockPlayer = {
        data: {
          id: 'player-1',
          name: 'Player1'
        }
      };
      const mockNetwork = {
        isServer: false,
        isClient: true,
        send: vi.fn()
      };
      (world.entities as any).player = mockPlayer;
      (world as any).network = mockNetwork;

      const result = chat.send('Hello world!');

      expect(result).toBeDefined();
      expect(result?.from).toBe('Player1');
      expect(result?.fromId).toBe('player-1');
      expect(result?.body).toBe('Hello world!');
      expect(result?.text).toBe('Hello world!');
      expect(chat.msgs).toHaveLength(1);
    });

    it('should broadcast sent message', () => {
      const mockPlayer = {
        data: {
          id: 'player-1',
          name: 'Player1'
        }
      };
      const mockNetwork = {
        isServer: false,
        isClient: true,
        send: vi.fn()
      };
      (world.entities as any).player = mockPlayer;
      (world as any).network = mockNetwork;

      chat.send('Hello!');

      expect(mockNetwork.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
        from: 'Player1',
        fromId: 'player-1',
        body: 'Hello!',
        text: 'Hello!'
      }));
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize messages', () => {
      const messages: ExtendedChatMessage[] = [
        {
          id: 'msg-1',
          from: 'Player1',
          body: 'Hello!',
          text: 'Hello!',
          timestamp: Date.now(),
          createdAt: moment().toISOString()
        },
        {
          id: 'msg-2',
          from: 'Player2',
          body: 'Hi there!',
          text: 'Hi there!',
          timestamp: Date.now(),
          createdAt: moment().toISOString()
        }
      ];

      messages.forEach(msg => chat.add(msg));

      const serialized = chat.serialize();
      expect(serialized).toEqual(messages);
    });

    it('should deserialize messages', () => {
      const messages: ExtendedChatMessage[] = [
        {
          id: 'msg-1',
          from: 'Player1',
          body: 'Hello!',
          text: 'Hello!',
          timestamp: Date.now(),
          createdAt: moment().toISOString()
        },
        {
          id: 'msg-2',
          from: 'Player2',
          body: 'Hi there!',
          text: 'Hi there!',
          timestamp: Date.now(),
          createdAt: moment().toISOString()
        }
      ];

      chat.deserialize(messages);

      expect(chat.msgs).toEqual(messages);
    });

    it('should notify listeners on deserialize', () => {
      const listener = vi.fn();
      chat.subscribe(listener);

      const messages: ExtendedChatMessage[] = [
        {
          id: 'msg-1',
          from: 'Player1',
          body: 'Hello!',
          text: 'Hello!',
          timestamp: Date.now(),
          createdAt: moment().toISOString()
        }
      ];

      chat.deserialize(messages);

      expect(listener).toHaveBeenLastCalledWith(messages);
    });
  });

  describe('subscribe', () => {
    it('should add listener and call it immediately', () => {
      const listener = vi.fn();

      const unsubscribe = chat.subscribe(listener);

      expect(listener).toHaveBeenCalledWith([]);
      expect((chat as any).chatListeners.has(listener)).toBe(true);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();

      const unsubscribe = chat.subscribe(listener);
      expect((chat as any).chatListeners.has(listener)).toBe(true);

      unsubscribe();
      expect((chat as any).chatListeners.has(listener)).toBe(false);
    });

    it('should call listener with current messages on subscribe', () => {
      const msg: ExtendedChatMessage = {
        id: 'msg-1',
        from: 'Player1',
        body: 'Hello!',
        text: 'Hello!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      };
      chat.add(msg);

      const listener = vi.fn();
      chat.subscribe(listener);

      expect(listener).toHaveBeenCalledWith([msg]);
    });
  });

  describe('destroy', () => {
    it('should clear messages and listeners', () => {
      // Add messages and listeners
      chat.add({
        id: 'msg-1',
        from: 'Player1',
        body: 'Hello!',
        text: 'Hello!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      });

      const listener = vi.fn();
      chat.subscribe(listener);

      expect(chat.msgs).toHaveLength(1);
      expect((chat as any).chatListeners.size).toBe(1);

      chat.destroy();

      expect(chat.msgs).toHaveLength(0);
      expect((chat as any).chatListeners.size).toBe(0);
    });
  });

  describe('integration', () => {
    it('should handle full chat flow', () => {
      // Setup as client
      const mockPlayer = {
        data: {
          id: 'player-1',
          name: 'Player1'
        }
      };
      const mockNetwork = {
        isServer: false,
        isClient: true,
        id: 'player-1',
        send: vi.fn()
      };
      (world.entities as any).player = mockPlayer;
      (world as any).network = mockNetwork;

      // Subscribe listener
      const listener = vi.fn();
      const unsubscribe = chat.subscribe(listener);

      // Send message
      const sentMsg = chat.send('Hello everyone!');
      expect(sentMsg).toBeDefined();
      expect(listener).toHaveBeenCalledWith([sentMsg]);

      // Simulate receiving message from another player
      const receivedMsg: ExtendedChatMessage = {
        id: 'msg-2',
        from: 'Player2',
        fromId: 'player-2',
        body: 'Hi Player1!',
        text: 'Hi Player1!',
        timestamp: Date.now(),
        createdAt: moment().toISOString()
      };
      chat.add(receivedMsg);

      expect(chat.msgs).toHaveLength(2);
      expect(listener).toHaveBeenCalledWith([sentMsg, receivedMsg]);

      // Send command
      chat.command('/stats');
      expect(mockNetwork.send).toHaveBeenCalledWith('command', ['stats']);

      // Clear chat
      chat.clear(true);
      expect(chat.msgs).toHaveLength(0);
      expect(mockNetwork.send).toHaveBeenCalledWith('chatCleared');

      // Cleanup
      unsubscribe();
      chat.destroy();
    });
  });
}); 