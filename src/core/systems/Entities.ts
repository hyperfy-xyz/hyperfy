import { System } from './System.js';
import type { World, Entities as IEntities, Entity, Player } from '../../types/index.js';

// Entity data structure
interface EntityData {
  id: string;
  type: string;
  name?: string;
  owner?: string;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
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
    this.name = data.name || data.id;
    this.type = data.type;
    this.components = new Map();
    this.node = {};
    this.position = data.position || { x: 0, y: 0, z: 0 };
    this.rotation = data.rotation || { x: 0, y: 0, z: 0, w: 1 };
    this.scale = data.scale || { x: 1, y: 1, z: 1 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.isPlayer = data.type === 'player';

    if (local && 'network' in world) {
      (world as any).network?.send('entityAdded', data);
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
  app: BaseEntity,
  playerLocal: BaseEntity,
  playerRemote: BaseEntity,
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
    this.player = undefined;
    this.apps = new Map();
    this.hot = new Set();
    this.removed = [];
  }

  get(entityId: string): Entity | null {
    return this.items.get(entityId) || null;
  }

  has(entityId: string): boolean {
    return this.items.has(entityId);
  }

  set(entityId: string, entity: Entity): void {
    this.items.set(entityId, entity);
    if (entity.isPlayer) {
      this.players.set(entityId, entity as Player);
    }
  }

  getPlayer(entityId: string): Player | null {
    return this.players.get(entityId) || null;
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
      this.emit('player', entity);
    }

    return entity;
  }

  remove(entityId: string): void {
    const entity = this.items.get(entityId);
    if (!entity) {
      console.warn(`Tried to remove entity that did not exist: ${entityId}`);
      return;
    }

    if (entity.isPlayer) {
      this.players.delete(entity.id);
    }

    entity.destroy();
    this.items.delete(entityId);
    this.removed.push(entityId);
  }

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

  deserialize(datas: EntityData[]): void {
    for (const data of datas) {
      this.add(data);
    }
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

  // Additional helper methods
  getAll(): Entity[] {
    return Array.from(this.items.values());
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getRemovedIds(): string[] {
    const ids = [...this.removed];
    this.removed = [];
    return ids;
  }

  // Add method to get local player
  getLocalPlayer(): Player | null {
    return this.player || null;
  }
} 