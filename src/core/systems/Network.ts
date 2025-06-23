import { System } from '../systems/System';
import type { World } from '../../types';

export interface NetworkMessage {
  type: string;
  data: any;
  timestamp: number;
  senderId?: string;
  reliable?: boolean;
}

export interface NetworkConnection {
  id: string;
  latency: number;
  connected: boolean;
  
  send(message: NetworkMessage): void;
  disconnect(): void;
}

export class Network extends System {
  private connections: Map<string, NetworkConnection> = new Map();
  private messageQueue: NetworkMessage[] = [];
  private outgoingQueue: NetworkMessage[] = [];
  private messageHandlers: Map<string, Set<(message: NetworkMessage) => void>> = new Map();
  private isServer: boolean = false;
  private localId: string = 'local';
  private lastSyncTime: number = 0;
  private syncInterval: number = 50; // 20Hz sync rate
  
  constructor(world: World) {
    super(world);
  }
  
  override async init(): Promise<void> {
    // Determine if we're running as server or client
    this.isServer = !!(this.world as any).server;
    
    // Generate local ID
    this.localId = this.generateId();
    
    // Register core message handlers
    this.registerCoreHandlers();
  }
  
  // Send a message
  send(type: string, data: any, reliable: boolean = false): void {
    const message: NetworkMessage = {
      type,
      data,
      timestamp: Date.now(),
      senderId: this.localId,
      reliable
    };
    
    this.outgoingQueue.push(message);
  }
  
  // Broadcast to all connections
  broadcast(type: string, data: any, exclude?: string[]): void {
    const message: NetworkMessage = {
      type,
      data,
      timestamp: Date.now(),
      senderId: this.localId,
      reliable: true
    };
    
    for (const [connId, connection] of this.connections) {
      if (!exclude || !exclude.includes(connId)) {
        connection.send(message);
      }
    }
  }
  
  // Register message handler
  onMessage(type: string, handler: (message: NetworkMessage) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
  }
  
  // Unregister message handler
  offMessage(type: string, handler: (message: NetworkMessage) => void): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  // Add a connection
  addConnection(connection: NetworkConnection): void {
    this.connections.set(connection.id, connection);
    
    // Send initial state to new connection
    if (this.isServer) {
      this.sendInitialState(connection);
    }
    
    this.world.events.emit('network:connection', {
      connectionId: connection.id,
      timestamp: Date.now()
    });
  }
  
  // Remove a connection
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.disconnect();
    this.connections.delete(connectionId);
    
    this.world.events.emit('network:disconnection', {
      connectionId,
      timestamp: Date.now()
    });
  }
  
  // Process incoming message
  processMessage(message: NetworkMessage): void {
    // Add to queue for processing
    this.messageQueue.push(message);
  }
  
  // Update
  override update(delta: number): void {
    // Process incoming messages
    this.processIncomingMessages();
    
    // Process outgoing messages
    this.processOutgoingMessages();
    
    // Periodic sync
    const now = Date.now();
    if (now - this.lastSyncTime >= this.syncInterval) {
      this.performSync();
      this.lastSyncTime = now;
    }
  }
  
  // Process incoming messages
  private processIncomingMessages(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      // Call handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (error) {
            console.error(`Error handling network message ${message.type}:`, error);
          }
        }
      }
      
      // Emit as event
      this.world.events.emit(`network:${message.type}`, message);
    }
  }
  
  // Process outgoing messages
  private processOutgoingMessages(): void {
    while (this.outgoingQueue.length > 0) {
      const message = this.outgoingQueue.shift()!;
      
      // Send to all connections
      for (const connection of this.connections.values()) {
        connection.send(message);
      }
    }
  }
  
  // Perform periodic sync
  private performSync(): void {
    if (!this.isServer) return;
    
    // Sync entity states
    const entities = Array.from(this.world.entities.items.values());
    const entityStates = entities.map(entity => ({
      id: entity.id,
      position: entity.position,
      rotation: entity.rotation,
      velocity: entity.velocity
    }));
    
    this.broadcast('snapshot', {
      entities: entityStates,
      timestamp: Date.now()
    });
  }
  
  // Send initial state to new connection
  private sendInitialState(connection: NetworkConnection): void {
    // Send world state
    const worldState = {
      entities: Array.from(this.world.entities.items.entries()).map(([id, entity]) => ({
        id,
        data: entity.serialize()
      })),
      timestamp: Date.now()
    };
    
    connection.send({
      type: 'snapshot',
      data: worldState,
      timestamp: Date.now(),
      senderId: this.localId,
      reliable: true
    });
  }
  
  // Register core message handlers
  private registerCoreHandlers(): void {
    // Entity creation
    this.onMessage('entityAdded', (message) => {
      if (message.senderId === this.localId) return;
      
      const { data } = message.data;
      this.world.entities.create(data.type, data);
    });
    
    // Entity destruction
    this.onMessage('entityRemoved', (message) => {
      if (message.senderId === this.localId) return;
      
      const { entityId } = message.data;
      this.world.entities.destroyEntity(entityId);
    });
    
    // Entity updates
    this.onMessage('entityModified', (message) => {
      if (message.senderId === this.localId) return;
      
      const { entityId, updates } = message.data;
      const entity = this.world.entities.get(entityId);
      if (entity && typeof (entity as any).modify === 'function') {
        (entity as any).modify(updates);
      }
    });
    
    // Handle sync messages
    if (!this.isServer) {
      this.onMessage('snapshot', (message) => {
        const { entities } = message.data;
        
        for (const state of entities) {
          const entity = this.world.entities.get(state.id);
          if (entity && entity.id !== this.world.entities.player?.id) {
            // Interpolate position
            entity.position = state.position;
            entity.rotation = state.rotation;
            if (state.velocity) {
              entity.velocity = state.velocity;
            }
          }
        }
      });
      
      this.onMessage('spawnModified', (message) => {
        const { entities } = message.data;
        
        // Clear existing entities except local player
        for (const [id, entity] of Array.from(this.world.entities.items.entries())) {
          if (entity !== this.world.entities.player) {
            this.world.entities.destroyEntity(id);
          }
        }
        
        // Create entities from state
        for (const { id, data } of entities) {
          if (!this.world.entities.has(id)) {
            this.world.entities.create(data.type, data);
          }
        }
      });
    }
  }
  
  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Get connection by ID
  getConnection(connectionId: string): NetworkConnection | undefined {
    return this.connections.get(connectionId);
  }
  
  // Get all connections
  getConnections(): NetworkConnection[] {
    return Array.from(this.connections.values());
  }
  
  // Check if connected
  isConnected(): boolean {
    return this.connections.size > 0;
  }
  
  // Get local ID
  getLocalId(): string {
    return this.localId;
  }
  
  // Create mock connection for testing
  createMockConnection(id: string = 'mock'): NetworkConnection {
    const connection: NetworkConnection = {
      id,
      latency: 0,
      connected: true,
      
      send: (message: NetworkMessage) => {
        // Echo back to self for testing
        setTimeout(() => {
          this.processMessage({
            ...message,
            senderId: id
          });
        }, 0);
      },
      
      disconnect: () => {
        connection.connected = false;
      }
    };
    
    return connection;
  }
} 