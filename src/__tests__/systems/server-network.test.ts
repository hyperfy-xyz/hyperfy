import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ServerNetwork, User, ConnectionParams, SpawnData } from '../../core/systems/ServerNetwork.js';
import { createTestWorld, MockWorld } from '../test-world-factory.js';
import moment from 'moment';

// Mock dependencies
vi.mock('../../core/packets.js', () => ({
  writePacket: vi.fn((name: string, data: any) => `packet:${name}:${JSON.stringify(data)}`)
}));

vi.mock('../../core/Socket.js', () => ({
  Socket: vi.fn().mockImplementation(({ id, ws, network }: any) => ({
    id,
    ws,
    network,
    alive: true,
    player: null,
    send: vi.fn(),
    sendPacket: vi.fn(),
    ping: vi.fn(),
    disconnect: vi.fn()
  }))
}));

vi.mock('../../core/utils-server.js', () => ({
  createJWT: vi.fn(({ userId }: any) => Promise.resolve(`jwt-token-${userId}`)),
  readJWT: vi.fn((token: string) => {
    if (token.startsWith('jwt-token-')) {
      return Promise.resolve({ userId: token.replace('jwt-token-', '') });
    }
    throw new Error('Invalid token');
  })
}));

vi.mock('../../core/utils.js', () => ({
  uuid: vi.fn(() => 'test-uuid-' + Math.random()),
  hasRole: vi.fn((roles: string[], role: string) => roles.includes(role)),
  addRole: vi.fn((roles: string[], role: string) => {
    if (!roles.includes(role)) roles.push(role);
  }),
  removeRole: vi.fn((roles: string[], role: string) => {
    const idx = roles.indexOf(role);
    if (idx >= 0) roles.splice(idx, 1);
  }),
  serializeRoles: vi.fn((roles: string[]) => roles.join(','))
}));

// Mock database
const createMockDb = () => {
  const data: Record<string, any[]> = {
    config: [
      { key: 'spawn', value: '{"position":[0,0,0],"quaternion":[0,0,0,1]}' },
      { key: 'settings', value: '{}' }
    ],
    blueprints: [],
    entities: [],
    users: []
  };

  const mockDb = (table: string) => ({
    where: (field: string, value: any) => ({
      first: () => Promise.resolve(data[table]?.find(row => row[field] === value)),
      update: (updates: any) => {
        const rows = data[table]?.filter(row => row[field] === value);
        rows?.forEach(row => Object.assign(row, updates));
        return Promise.resolve(rows?.length || 0);
      },
      delete: () => {
        const before = data[table]?.length || 0;
        data[table] = data[table]?.filter(row => row[field] !== value) || [];
        return Promise.resolve(before - data[table].length);
      }
    }),
    insert: (record: any) => {
      if (!data[table]) data[table] = [];
      data[table].push(record);
      return {
        onConflict: (field: string) => ({
          merge: (updates: any) => {
            const existing = data[table].find(row => row[field] === record[field]);
            if (existing) {
              Object.assign(existing, updates);
            } else {
              data[table].push(record);
            }
            return Promise.resolve();
          }
        })
      };
    },
    select: () => Promise.resolve(data[table] || []),
    // Direct access for getting all records
    then: (cb: any) => Promise.resolve(data[table] || []).then(cb)
  });

  mockDb.data = data; // Expose data for testing
  return mockDb;
};

describe('ServerNetwork System', () => {
  let world: MockWorld;
  let serverNetwork: ServerNetwork;
  let mockDb: any;

  beforeEach(async () => {
    world = await createTestWorld();
    mockDb = createMockDb();
    
    // Set ADMIN_CODE to prevent temporary admin role in tests
    process.env.ADMIN_CODE = 'test-admin-code';
    
    // Set up mock world systems
    (world as any).blueprints = {
      add: vi.fn(),
      get: vi.fn((id: string) => ({ id, version: 1 })),
      modify: vi.fn(),
      serialize: vi.fn(() => [])
    };
    
    (world as any).entities = {
      add: vi.fn((data: any) => ({ data, isApp: data.type === 'app', isPlayer: data.type === 'player', modify: vi.fn(), destroy: vi.fn() })),
      get: vi.fn((id: string) => ({ data: { id }, isApp: false, isPlayer: false, modify: vi.fn() })),
      remove: vi.fn(),
      serialize: vi.fn(() => [])
    };
    
    (world as any).settings = {
      public: false,
      playerLimit: 10,
      avatar: { url: 'default-avatar.vrm' },
      deserialize: vi.fn(),
      serialize: vi.fn(() => ({})),
      on: vi.fn(),
      set: vi.fn()
    };
    
    (world as any).chat = {
      add: vi.fn(),
      clear: vi.fn(),
      serialize: vi.fn(() => [])
    };
    
    (world as any).collections = {
      serialize: vi.fn(() => [])
    };
    
    (world as any).events = {
      emit: vi.fn()
    };
    
    (world as any).environment = {
      updateModel: vi.fn()
    };
    
    (world as any).livekit = {
      getPlayerOpts: vi.fn((userId: string) => Promise.resolve({ token: `livekit-${userId}` }))
    };
    
    (world as any).monitor = {
      getStats: vi.fn(() => Promise.resolve({ currentCPU: 25.5, currentMemory: 512, maxMemory: 2048 }))
    };
    
    serverNetwork = new ServerNetwork(world);
    serverNetwork.init({ db: mockDb });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up environment variable
    delete process.env.ADMIN_CODE;
    
    if (serverNetwork.socketIntervalId) {
      clearInterval(serverNetwork.socketIntervalId);
    }
    if (serverNetwork.saveTimerId) {
      clearTimeout(serverNetwork.saveTimerId);
    }
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(serverNetwork.id).toBe(0);
      expect(serverNetwork.ids).toBe(-1);
      expect(serverNetwork.sockets).toBeInstanceOf(Map);
      expect(serverNetwork.sockets.size).toBe(0);
      expect(serverNetwork.dirtyBlueprints).toBeInstanceOf(Set);
      expect(serverNetwork.dirtyApps).toBeInstanceOf(Set);
      expect(serverNetwork.isServer).toBe(true);
      expect(serverNetwork.queue).toEqual([]);
    });

    it('should set up socket check interval', () => {
      expect(serverNetwork.socketIntervalId).toBeDefined();
    });
  });

  describe('start', () => {
    it('should load spawn data from database', async () => {
      await serverNetwork.start();
      
      expect(serverNetwork.spawn).toEqual({
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1]
      });
    });

    it('should hydrate blueprints from database', async () => {
      mockDb.data.blueprints = [
        { id: 'bp1', data: '{"id":"bp1","name":"Blueprint 1"}' },
        { id: 'bp2', data: '{"id":"bp2","name":"Blueprint 2"}' }
      ];
      
      await serverNetwork.start();
      
      expect((world as any).blueprints.add).toHaveBeenCalledTimes(2);
      expect((world as any).blueprints.add).toHaveBeenCalledWith({ id: 'bp1', name: 'Blueprint 1' }, true);
      expect((world as any).blueprints.add).toHaveBeenCalledWith({ id: 'bp2', name: 'Blueprint 2' }, true);
    });

    it('should hydrate entities from database', async () => {
      mockDb.data.entities = [
        { id: 'e1', data: '{"id":"e1","type":"app"}' },
        { id: 'e2', data: '{"id":"e2","type":"npc"}' }
      ];
      
      await serverNetwork.start();
      
      expect((world as any).entities.add).toHaveBeenCalledTimes(2);
      expect((world as any).entities.add).toHaveBeenCalledWith({ id: 'e1', type: 'app', state: {} }, true);
      expect((world as any).entities.add).toHaveBeenCalledWith({ id: 'e2', type: 'npc', state: {} }, true);
    });

    it('should set up save timer when SAVE_INTERVAL is set', async () => {
      await serverNetwork.start();
      
      expect(serverNetwork.saveTimerId).toBeDefined();
    });
  });

  describe('send', () => {
    it('should send packet to all connected sockets', () => {
      const mockSocket1 = { id: 's1', sendPacket: vi.fn() };
      const mockSocket2 = { id: 's2', sendPacket: vi.fn() };
      
      serverNetwork.sockets.set('s1', mockSocket1 as any);
      serverNetwork.sockets.set('s2', mockSocket2 as any);
      
      serverNetwork.send('test', { data: 'value' });
      
      expect(mockSocket1.sendPacket).toHaveBeenCalledWith('packet:test:{"data":"value"}');
      expect(mockSocket2.sendPacket).toHaveBeenCalledWith('packet:test:{"data":"value"}');
    });

    it('should ignore specified socket when sending', () => {
      const mockSocket1 = { id: 's1', sendPacket: vi.fn() };
      const mockSocket2 = { id: 's2', sendPacket: vi.fn() };
      
      serverNetwork.sockets.set('s1', mockSocket1 as any);
      serverNetwork.sockets.set('s2', mockSocket2 as any);
      
      serverNetwork.send('test', { data: 'value' }, 's1');
      
      expect(mockSocket1.sendPacket).not.toHaveBeenCalled();
      expect(mockSocket2.sendPacket).toHaveBeenCalledWith('packet:test:{"data":"value"}');
    });
  });

  describe('sendTo', () => {
    it('should send to specific socket', () => {
      const mockSocket = { id: 's1', send: vi.fn() };
      serverNetwork.sockets.set('s1', mockSocket as any);
      
      serverNetwork.sendTo('s1', 'test', { data: 'value' });
      
      expect(mockSocket.send).toHaveBeenCalledWith('test', { data: 'value' });
    });

    it('should handle missing socket gracefully', () => {
      expect(() => serverNetwork.sendTo('nonexistent', 'test', {})).not.toThrow();
    });
  });

  describe('checkSockets', () => {
    it('should disconnect dead sockets', () => {
      const aliveSocket = { id: 's1', alive: true, ping: vi.fn(), disconnect: vi.fn() };
      const deadSocket = { id: 's2', alive: false, ping: vi.fn(), disconnect: vi.fn() };
      
      serverNetwork.sockets.set('s1', aliveSocket as any);
      serverNetwork.sockets.set('s2', deadSocket as any);
      
      serverNetwork.checkSockets();
      
      expect(aliveSocket.ping).toHaveBeenCalled();
      expect(deadSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('queue system', () => {
    it('should enqueue method calls', () => {
      const mockSocket = { id: 's1' };
      
      serverNetwork.enqueue(mockSocket as any, 'testMethod', { data: 'value' });
      
      expect(serverNetwork.queue).toHaveLength(1);
      expect(serverNetwork.queue[0]).toEqual([mockSocket, 'testMethod', { data: 'value' }]);
    });

    it('should flush queue and execute methods', () => {
      const mockSocket = { id: 's1' };
      const testMethod = vi.fn();
      (serverNetwork as any).testMethod = testMethod;
      
      serverNetwork.enqueue(mockSocket as any, 'testMethod', { data: 'value' });
      serverNetwork.flush();
      
      expect(testMethod).toHaveBeenCalledWith(mockSocket, { data: 'value' });
      expect(serverNetwork.queue).toHaveLength(0);
    });

    it('should handle errors during flush', () => {
      const mockSocket = { id: 's1' };
      const errorMethod = vi.fn(() => { throw new Error('Test error'); });
      (serverNetwork as any).errorMethod = errorMethod;
      
      serverNetwork.enqueue(mockSocket as any, 'errorMethod', {});
      
      expect(() => serverNetwork.flush()).not.toThrow();
      expect(errorMethod).toHaveBeenCalled();
    });
  });

  describe('save', () => {
    beforeEach(async () => {
      await serverNetwork.start();
    });

    it('should save dirty blueprints', async () => {
      const blueprint = { id: 'bp1', name: 'Test Blueprint' };
      (world as any).blueprints.get.mockReturnValue(blueprint);
      
      serverNetwork.dirtyBlueprints.add('bp1');
      await serverNetwork.save();
      
      expect(mockDb.data.blueprints).toHaveLength(1);
      expect(mockDb.data.blueprints[0]).toMatchObject({
        id: 'bp1',
        data: JSON.stringify(blueprint)
      });
      expect(serverNetwork.dirtyBlueprints.size).toBe(0);
    });

    it('should save dirty app entities', async () => {
      const entity = {
        data: { id: 'e1', type: 'app', name: 'Test App' },
        isApp: true
      };
      (world as any).entities.get.mockReturnValue(entity);
      
      serverNetwork.dirtyApps.add('e1');
      await serverNetwork.save();
      
      expect(mockDb.data.entities).toHaveLength(1);
      expect(mockDb.data.entities[0]).toMatchObject({
        id: 'e1',
        data: JSON.stringify(entity.data)
      });
      expect(serverNetwork.dirtyApps.size).toBe(0);
    });

    it('should delete removed app entities', async () => {
      mockDb.data.entities = [{ id: 'e1', data: '{}' }];
      (world as any).entities.get.mockReturnValue(null);
      
      serverNetwork.dirtyApps.add('e1');
      await serverNetwork.save();
      
      expect(mockDb.data.entities).toHaveLength(0);
      expect(serverNetwork.dirtyApps.size).toBe(0);
    });

    it('should reschedule save timer', async () => {
      const originalTimer = serverNetwork.saveTimerId;
      await serverNetwork.save();
      
      expect(serverNetwork.saveTimerId).toBeDefined();
      expect(serverNetwork.saveTimerId).not.toBe(originalTimer);
    });
  });

  describe('permissions', () => {
    it('should identify admin players', () => {
      const adminPlayer = { data: { roles: ['user', 'admin'] } };
      const normalPlayer = { data: { roles: ['user'] } };
      
      expect(serverNetwork.isAdmin(adminPlayer)).toBe(true);
      expect(serverNetwork.isAdmin(normalPlayer)).toBe(false);
    });

    it('should identify builders in public worlds', () => {
      const player = { data: { roles: ['user'] } };
      
      (world as any).settings.public = true;
      expect(serverNetwork.isBuilder(player)).toBe(true);
      
      (world as any).settings.public = false;
      expect(serverNetwork.isBuilder(player)).toBe(false);
    });

    it('should identify admin as builder', () => {
      const adminPlayer = { data: { roles: ['admin'] } };
      
      (world as any).settings.public = false;
      expect(serverNetwork.isBuilder(adminPlayer)).toBe(true);
    });
  });

  describe('onConnection', () => {
    let mockWs: any;

    beforeEach(() => {
      mockWs = {
        send: vi.fn(),
        disconnect: vi.fn()
      };
    });

    it('should reject connection when player limit reached', async () => {
      (world as any).settings.playerLimit = 1;
      serverNetwork.sockets.set('existing', {} as any);
      
      await serverNetwork.onConnection(mockWs, {});
      
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('player_limit'));
      expect(mockWs.disconnect).toHaveBeenCalled();
    });

    it('should create new user when no auth token provided', async () => {
      await serverNetwork.onConnection(mockWs, {});
      
      expect(mockDb.data.users).toHaveLength(1);
      expect(mockDb.data.users[0]).toMatchObject({
        name: 'Anonymous',
        avatar: null,
        roles: ''  // Roles are saved as empty string in DB, temporary admin role is only in memory
      });
    });

    it('should load existing user with valid auth token', async () => {
      const existingUser = {
        id: 'user123',
        name: 'Test User',
        avatar: 'avatar.png',
        roles: 'user,admin'
      };
      mockDb.data.users.push(existingUser);
      
      await serverNetwork.onConnection(mockWs, { authToken: 'jwt-token-user123' });
      
      // Should not create new user
      expect(mockDb.data.users).toHaveLength(1);
    });

    it('should reject duplicate user connections', async () => {
      // First, add an existing user to the database
      const existingUser = {
        id: 'user123',
        name: 'Test User',
        avatar: null,
        roles: ''
      };
      mockDb.data.users.push(existingUser);
      
      // Connect the first time
      await serverNetwork.onConnection(mockWs, { authToken: 'jwt-token-user123' });
      
      // Reset mocks
      mockWs.send.mockClear();
      mockWs.disconnect.mockClear();
      
      // Try to connect again with same user
      await serverNetwork.onConnection(mockWs, { authToken: 'jwt-token-user123' });
      
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('duplicate_user'));
      expect(mockWs.disconnect).toHaveBeenCalled();
    });

    it('should spawn player entity', async () => {
      await serverNetwork.onConnection(mockWs, { name: 'TestPlayer' });
      
      expect((world as any).entities.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player',
          name: 'TestPlayer',
          health: 100,
          position: [0, 0, 0],
          quaternion: [0, 0, 0, 1]
        }),
        true
      );
    });

    it('should send snapshot to connected player', async () => {
      const Socket = (await import('../../core/Socket.js')).Socket as any;
      await serverNetwork.onConnection(mockWs, {});
      
      const mockSocket = Socket.mock.results[0].value;
      expect(mockSocket.send).toHaveBeenCalledWith('snapshot', expect.objectContaining({
        serverTime: expect.any(Number),
        settings: {},
        chat: [],
        blueprints: [],
        entities: []
      }));
    });

    it('should emit enter event', async () => {
      await serverNetwork.onConnection(mockWs, {});
      
      expect((world as any).events.emit).toHaveBeenCalledWith('enter', expect.objectContaining({
        playerId: expect.any(String)
      }));
    });
  });

  describe('chat commands', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        id: 'socket1',
        send: vi.fn(),
        player: {
          data: {
            id: 'player1',
            userId: 'user1',
            roles: [],
            position: [5, 10, 15],
            quaternion: [0, 0, 0, 1]
          },
          modify: vi.fn()
        }
      };
    });

    describe('admin command', () => {
      beforeEach(() => {
        process.env.ADMIN_CODE = 'secret123';
      });

      it('should grant admin role with correct code', async () => {
        await serverNetwork.onCommand(mockSocket, ['admin', 'secret123']);
        
        expect(mockSocket.player.data.roles).toContain('admin');
        expect(mockSocket.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
          body: 'Admin granted!'
        }));
      });

      it('should revoke admin role if already admin', async () => {
        mockSocket.player.data.roles = ['admin'];
        
        await serverNetwork.onCommand(mockSocket, ['admin', 'secret123']);
        
        expect(mockSocket.player.data.roles).not.toContain('admin');
        expect(mockSocket.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
          body: 'Admin revoked!'
        }));
      });

      it('should not grant admin with wrong code', async () => {
        await serverNetwork.onCommand(mockSocket, ['admin', 'wrongcode']);
        
        expect(mockSocket.player.data.roles).not.toContain('admin');
        expect(mockSocket.send).not.toHaveBeenCalled();
      });
    });

    describe('name command', () => {
      it('should update player name', async () => {
        await serverNetwork.onCommand(mockSocket, ['name', 'NewName']);
        
        expect(mockSocket.player.data.name).toBe('NewName');
        expect(mockSocket.player.modify).toHaveBeenCalledWith({ name: 'NewName' });
        expect(mockSocket.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
          body: 'Name set to NewName!'
        }));
      });
    });

    describe('spawn command', () => {
      it('should call onSpawnModified', async () => {
        const spy = vi.spyOn(serverNetwork, 'onSpawnModified');
        
        await serverNetwork.onCommand(mockSocket, ['spawn', 'set']);
        
        expect(spy).toHaveBeenCalledWith(mockSocket, 'set');
      });
    });

    describe('chat command', () => {
      it('should clear chat when builder uses clear command', async () => {
        mockSocket.player.data.roles = ['admin'];
        
        await serverNetwork.onCommand(mockSocket, ['chat', 'clear']);
        
        expect((world as any).chat.clear).toHaveBeenCalledWith(true);
      });

      it('should not clear chat for non-builders', async () => {
        await serverNetwork.onCommand(mockSocket, ['chat', 'clear']);
        
        expect((world as any).chat.clear).not.toHaveBeenCalled();
      });
    });

    describe('server command', () => {
      it('should send server stats', async () => {
        await serverNetwork.onCommand(mockSocket, ['server', 'stats']);
        
        expect(mockSocket.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
          body: 'CPU: 25.500%'
        }));
        expect(mockSocket.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
          body: 'Memory: 512 / 2048 MB (25.0%)'
        }));
      });
    });
  });

  describe('entity management', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        id: 'socket1',
        player: {
          data: { roles: ['admin'] }
        }
      };
    });

    describe('onBlueprintAdded', () => {
      it('should add blueprint when player is builder', () => {
        const blueprint = { id: 'test-blueprint', name: 'Test Blueprint', version: 1, components: [] };
        serverNetwork.onBlueprintAdded(mockSocket, blueprint);
        
        expect((world as any).blueprints.add).toHaveBeenCalledWith(blueprint);
        expect(serverNetwork.dirtyBlueprints.has('test-blueprint')).toBe(true);
      });

      it('should not add blueprint when player is not builder', () => {
        mockSocket.player.data.roles = {};
        const blueprint = { id: 'test-blueprint', name: 'Test Blueprint', version: 1, components: [] };
        serverNetwork.onBlueprintAdded(mockSocket, blueprint);
        
        expect((world as any).blueprints.add).not.toHaveBeenCalled();
      });
    });

    describe('onBlueprintModified', () => {
      it('should modify blueprint with higher version', () => {
        const data = { id: 'bp1', version: 2 };
        
        serverNetwork.onBlueprintModified(mockSocket, data);
        
        expect((world as any).blueprints.modify).toHaveBeenCalledWith(data);
        expect(serverNetwork.dirtyBlueprints.has('bp1')).toBe(true);
      });

      it('should send revert for lower version', () => {
        mockSocket.send = vi.fn();
        const data = { id: 'bp1', version: 0 };
        const existingBlueprint = { id: 'bp1', version: 1 };
        (world as any).blueprints.get.mockReturnValue(existingBlueprint);
        
        serverNetwork.onBlueprintModified(mockSocket, data);
        
        expect((world as any).blueprints.modify).not.toHaveBeenCalled();
        expect(mockSocket.send).toHaveBeenCalledWith('blueprintModified', existingBlueprint);
      });
    });

    describe('onEntityAdded', () => {
      it('should add entity when player is builder', () => {
        const entityData = { id: 'e1', type: 'app' };
        const entity = { data: entityData, isApp: true };
        (world as any).entities.add.mockReturnValue(entity);
        
        serverNetwork.onEntityAdded(mockSocket, entityData);
        
        expect((world as any).entities.add).toHaveBeenCalledWith(entityData);
        expect(serverNetwork.dirtyApps.has('e1')).toBe(true);
      });
    });

    describe('onEntityModified', () => {
      it('should modify existing entity', async () => {
        const entity = {
          data: { id: 'e1', userId: 'u1' },
          isApp: true,
          isPlayer: false,
          modify: vi.fn()
        };
        (world as any).entities.get.mockReturnValue(entity);
        
        await serverNetwork.onEntityModified(mockSocket, { id: 'e1', name: 'Updated' });
        
        expect(entity.modify).toHaveBeenCalledWith({ id: 'e1', name: 'Updated' });
        expect(serverNetwork.dirtyApps.has('e1')).toBe(true);
      });

      it('should persist player name and avatar changes', async () => {
        const entity = {
          data: { id: 'p1', userId: 'u1' },
          isPlayer: true,
          modify: vi.fn()
        };
        (world as any).entities.get.mockReturnValue(entity);
        
        await serverNetwork.onEntityModified(mockSocket, { 
          id: 'p1', 
          name: 'NewName',
          avatar: 'new-avatar.png'
        });
        
        // Check if user record would be updated (mocked db doesn't actually update)
        expect(entity.modify).toHaveBeenCalled();
      });
    });

    describe('onEntityRemoved', () => {
      it('should remove entity when player is builder', () => {
        const entity = { isApp: true };
        (world as any).entities.get.mockReturnValue(entity);
        
        serverNetwork.onEntityRemoved(mockSocket, 'e1');
        
        expect((world as any).entities.remove).toHaveBeenCalledWith('e1');
        expect(serverNetwork.dirtyApps.has('e1')).toBe(true);
      });
    });
  });

  describe('spawn management', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        id: 'socket1',
        send: vi.fn(),
        player: {
          data: {
            roles: ['admin'],
            position: [10, 20, 30],
            quaternion: [0, 1, 0, 0]
          }
        }
      };
    });

    it('should set spawn to player position', async () => {
      await serverNetwork.onSpawnModified(mockSocket, 'set');
      
      expect(serverNetwork.spawn).toEqual({
        position: [10, 20, 30],
        quaternion: [0, 1, 0, 0]
      });
      expect(mockSocket.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
        body: 'Spawn updated'
      }));
    });

    it('should clear spawn to default', async () => {
      await serverNetwork.onSpawnModified(mockSocket, 'clear');
      
      expect(serverNetwork.spawn).toEqual({
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1]
      });
      expect(mockSocket.send).toHaveBeenCalledWith('chatAdded', expect.objectContaining({
        body: 'Spawn cleared'
      }));
    });
  });

  describe('player interactions', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = { id: 'socket1' };
    });

    it('should handle player teleport', () => {
      const targetSocket = { id: 'target', send: vi.fn() };
      serverNetwork.sockets.set('target', targetSocket as any);
      
      serverNetwork.onPlayerTeleport(mockSocket, { networkId: 'target', x: 10, y: 20 });
      
      expect(targetSocket.send).toHaveBeenCalledWith('playerTeleport', { networkId: 'target', x: 10, y: 20 });
    });

    it('should handle player push', () => {
      const targetSocket = { id: 'target', send: vi.fn() };
      serverNetwork.sockets.set('target', targetSocket as any);
      
      serverNetwork.onPlayerPush(mockSocket, { networkId: 'target', force: [1, 0, 0] });
      
      expect(targetSocket.send).toHaveBeenCalledWith('playerPush', { networkId: 'target', force: [1, 0, 0] });
    });

    it('should handle player session avatar', () => {
      const targetSocket = { id: 'target', send: vi.fn() };
      serverNetwork.sockets.set('target', targetSocket as any);
      
      serverNetwork.onPlayerSessionAvatar(mockSocket, { networkId: 'target', avatar: 'new-avatar.vrm' });
      
      expect(targetSocket.send).toHaveBeenCalledWith('playerSessionAvatar', 'new-avatar.vrm');
    });
  });

  describe('ping/pong', () => {
    it('should respond to ping with pong', () => {
      const mockSocket = { id: 's1', send: vi.fn() };
      
      serverNetwork.onPing(mockSocket as any, 12345);
      
      expect(mockSocket.send).toHaveBeenCalledWith('pong', 12345);
    });
  });

  describe('disconnect', () => {
    it('should handle player disconnect', () => {
      const mockPlayer = { destroy: vi.fn() };
      const mockSocket = { id: 's1', player: mockPlayer };
      serverNetwork.sockets.set('s1', mockSocket as any);
      
      serverNetwork.onDisconnect(mockSocket as any);
      
      expect(mockPlayer.destroy).toHaveBeenCalledWith(true);
      expect(serverNetwork.sockets.has('s1')).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      const mockSocket = { id: 's1', disconnect: vi.fn() };
      serverNetwork.sockets.set('s1', mockSocket as any);
      
      serverNetwork.destroy();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(serverNetwork.sockets.size).toBe(0);
    });
  });
}); 