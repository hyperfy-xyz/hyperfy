import { System } from './System.js';
import type { World, Entities as IEntities, Entity, Player } from '../../types/index.js';
import { PlayerLocal } from '../entities/PlayerLocal.js';
import { PlayerRemote } from '../entities/PlayerRemote.js';
import { App } from '../entities/App.js';

// Entity data structure
interface EntityData {
  id: string;
  type: string;
  name?: string;
  owner?: string;
  position?: any; // Can be object or array
  rotation?: any; // Can be object or array
  scale?: any; // Can be object or array
  [key: string]: any;
}

// Entity constructor type
interface EntityConstructor {
  new (world: World, data: EntityData, local?: boolean): Entity;
}

// Temporary entity implementation until we convert the actual entity classes
class BaseEntity implements Entity {
  world: World;
  data: EntityData;
  id: string;
  name: string;
  type: string;
  node: any;
  components: Map<string, any>;
  position: any;
  rotation: any;
  scale: any;
  velocity: any;
  isPlayer: boolean;

  constructor(world: World, data: EntityData, local?: boolean) {
    this.world = world;
    this.data = data;
    this.id = data.id;
    this.name = data.name || 'entity';
    this.type = data.type;
    this.components = new Map();
    this.node = {};
    this.position = data.position || { x: 0, y: 0, z: 0 };
    this.rotation = data.rotation || { x: 0, y: 0, z: 0, w: 1 };
    this.scale = data.scale || { x: 1, y: 1, z: 1 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.isPlayer = data.type === 'player';

    // Enrich the data with defaults (store as arrays for network serialization)
    this.data = {
      ...data,
      name: this.name,
      position: Array.isArray(data.position) ? data.position : [
        data.position?.x || 0,
        data.position?.y || 0,
        data.position?.z || 0
      ],
      quaternion: Array.isArray(data.quaternion) ? data.quaternion : [0, 0, 0, 1],
    };

    if (local && 'network' in world) {
      (world as any).network?.send('entityAdded', this.serialize());
    }
  }

  addComponent(type: string, data?: any): any {
    const component = { type, data };
    this.components.set(type, component);
    return component;
  }

  removeComponent(type: string): void {
    this.components.delete(type);
  }

  getComponent<T>(type: string): T | null {
    return this.components.get(type) || null;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  applyForce(force: any): void {
    // Physics implementation
  }

  applyImpulse(impulse: any): void {
    // Physics implementation
  }

  setVelocity(velocity: any): void {
    this.velocity = velocity;
  }

  getVelocity(): any {
    return this.velocity;
  }

  modify(data: Partial<EntityData>): void {
    Object.assign(this.data, data);
  }

  onEvent(version: number, name: string, data: any, networkId: string): void {
    // Handle events
  }

  serialize(): EntityData {
    return this.data;
  }

  fixedUpdate?(delta: number): void;
  update?(delta: number): void;
  lateUpdate?(delta: number): void;

  destroy(local?: boolean): void {
    if (local && 'network' in this.world) {
      (this.world as any).network?.send('entityRemoved', this.id);
    }
  }
}

// Entity type registry
const EntityTypes: Record<string, EntityConstructor> = {
  app: App as unknown as EntityConstructor,
  playerLocal: PlayerLocal as unknown as EntityConstructor,
  playerRemote: PlayerRemote as unknown as EntityConstructor,
};

/**
 * Entities System
 *
 * - Runs on both the server and client.
 * - Supports inserting entities into the world
 * - Executes entity scripts
 *
 */
export class Entities extends System implements IEntities {
  items: Map<string, Entity>;
  players: Map<string, Player>;
  player?: Player;
  apps: Map<string, Entity>;
  private hot: Set<Entity>;
  private removed: string[];

  constructor(world: World) {
    super(world);
    this.items = new Map();
    this.players = new Map();
    this.player = null as any;
    this.apps = new Map();
    this.hot = new Set();
    this.removed = [];
  }

  get(id: string): Entity | null {
    return this.items.get(id) || null;
  }

  getPlayer(entityId: string): Player | null {
    return this.players.get(entityId) || null;
  }

  // TypeScript-specific methods for interface compliance
  has(entityId: string): boolean {
    return this.items.has(entityId);
  }

  set(entityId: string, entity: Entity): void {
    this.items.set(entityId, entity);
    if (entity.isPlayer) {
      this.players.set(entityId, entity as Player);
    }
  }

  create(name: string, options?: any): Entity {
    const data: EntityData = {
      id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: options?.type || 'app',
      name,
      ...options
    };
    return this.add(data, true);
  }

  add(data: EntityData, local?: boolean): Entity {
    let EntityClass: EntityConstructor = BaseEntity;
    
    if (data.type === 'player') {
      const isLocal = 'network' in this.world && data.owner === (this.world as any).network?.id;
      EntityClass = EntityTypes[isLocal ? 'playerLocal' : 'playerRemote'] as EntityConstructor;
    } else if (data.type in EntityTypes) {
      EntityClass = EntityTypes[data.type] as EntityConstructor;
    }

    const entity = new EntityClass(this.world, data, local);
    this.items.set(entity.id, entity);

    if (data.type === 'player') {
      this.players.set(entity.id, entity as Player);
      
      // On the client, remote players emit enter events here.
      // On the server, enter events are delayed for players entering until after their snapshot is sent
      // so they can respond correctly to follow-through events.
      if ('network' in this.world && (this.world as any).network?.isClient) {
        if (data.owner !== (this.world as any).network?.id) {
          this.world.events.emit('enter', { playerId: entity.id });
        }
      }
    }

    if ('network' in this.world && data.owner === (this.world as any).network?.id) {
      this.player = entity as Player;
      (this.world as any).emit('player', entity);
    }

    // Initialize the entity if it has an init method
    if ('init' in entity && typeof (entity as any).init === 'function') {
      console.log(`[Entities] Initializing entity ${entity.id} of type ${data.type}`);
      (entity as any).init();
    }

    return entity;
  }

  remove(id: string): void {
    const entity = this.items.get(id);
    if (!entity) return console.warn(`Tried to remove entity that did not exist: ${id}`);
    if (entity.isPlayer) this.players.delete(entity.id);
    entity.destroy(true);
    this.items.delete(id);
    this.removed.push(id);
  }

  // TypeScript interface compliance method
  destroyEntity(entityId: string): void {
    this.remove(entityId);
  }

  setHot(entity: Entity, hot: boolean): void {
    if (hot) {
      this.hot.add(entity);
    } else {
      this.hot.delete(entity);
    }
  }

  override fixedUpdate(delta: number): void {
    const hotEntities = Array.from(this.hot);
    for (const entity of hotEntities) {
      entity.fixedUpdate?.(delta);
    }
  }

  override update(delta: number): void {
    const hotEntities = Array.from(this.hot);
    for (const entity of hotEntities) {
      entity.update?.(delta);
    }
  }

  override lateUpdate(delta: number): void {
    const hotEntities = Array.from(this.hot);
    for (const entity of hotEntities) {
      entity.lateUpdate?.(delta);
    }
  }

  serialize(): EntityData[] {
    const data: EntityData[] = [];
    this.items.forEach(entity => {
      data.push(entity.serialize());
    });
    return data;
  }

  async deserialize(datas: EntityData[]): Promise<void> {
    console.log(`[Entities] Deserializing ${datas.length} entities`);
    for (const data of datas) {
      this.add(data);
    }
    console.log(`[Entities] Deserialization complete`);
  }

  override destroy(): void {
    // Create array of IDs to avoid modifying map while iterating
    const entityIds = Array.from(this.items.keys());
    for (const id of entityIds) {
      this.remove(id);
    }
    
    this.items.clear();
    this.players.clear();
    this.hot.clear();
    this.removed = [];
  }

  // TypeScript interface compliance methods
  getLocalPlayer(): Player | null {
    return this.player || null;
  }

  getAll(): Entity[] {
    return Array.from(this.items.values());
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getRemovedIds(): string[] {
    const ids = [...new Set(this.removed)]; // Remove duplicates
    this.removed = [];
    return ids;
  }
} 