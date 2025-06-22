# Spawning System Implementation Report

## Overview

The Spawning System manages the creation and respawning of NPCs, resources, and other entities in the game world. It handles spawn points, respawn timers, player proximity activation, and ensures proper distribution of entities across the world.

## Architecture

### System Structure

```typescript
export class SpawningSystem extends System {
  // Core components
  private spawners: Map<string, Spawner>;
  private activeSpawns: Map<string, SpawnedEntity>;
  private spawnQueue: PriorityQueue<SpawnTask>;
  private spatialIndex: SpatialIndex<Spawner>;
  
  // Update cycles
  fixedUpdate(delta: number): void;
  
  // Spawner management
  registerSpawner(config: SpawnerConfig): string;
  unregisterSpawner(spawnerId: string): void;
  
  // Spawn operations
  spawnEntity(spawner: Spawner): Entity;
  despawnEntity(entityId: string): void;
  
  // Proximity checks
  checkPlayerProximity(spawner: Spawner): boolean;
  getActivePlayersInRange(position: Vector3, range: number): PlayerEntity[];
}
```

### Core Components

#### 1. Spawner Types

```typescript
interface Spawner {
  id: string;
  type: SpawnerType;
  position: Vector3;
  rotation: Quaternion;
  
  // Spawn configuration
  entityDefinitions: SpawnDefinition[];
  maxEntities: number;
  respawnTime: number;
  
  // Activation
  activationRange: number;
  deactivationRange: number;
  requiresLineOfSight: boolean;
  
  // Current state
  activeEntities: Set<string>;
  lastSpawnTime: number;
  isActive: boolean;
  
  // Spawn area
  spawnArea: SpawnArea;
  
  // Special conditions
  conditions?: SpawnConditions;
}

enum SpawnerType {
  NPC = 'npc',
  RESOURCE = 'resource',
  CHEST = 'chest',
  BOSS = 'boss',
  EVENT = 'event'
}

interface SpawnDefinition {
  entityType: string;
  weight: number;           // Spawn probability weight
  minLevel?: number;        // For scaling NPCs
  maxLevel?: number;
  metadata?: any;           // Additional spawn data
}
```

#### 2. Spawn Areas

```typescript
interface SpawnArea {
  type: 'point' | 'circle' | 'rectangle' | 'polygon';
  
  // Area-specific parameters
  radius?: number;          // For circle
  width?: number;           // For rectangle
  height?: number;          // For rectangle
  vertices?: Vector3[];     // For polygon
  
  // Spawn rules
  avoidOverlap: boolean;
  minSpacing: number;
  maxHeight: number;        // Y-axis variance
  
  // Validation
  isValidPosition(position: Vector3): boolean;
  getRandomPosition(): Vector3;
}

class CircularSpawnArea implements SpawnArea {
  type = 'circle' as const;
  
  constructor(
    private center: Vector3,
    public radius: number,
    public minSpacing: number = 1
  ) {}
  
  getRandomPosition(): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * this.radius;
    
    return {
      x: this.center.x + Math.cos(angle) * distance,
      y: this.center.y,
      z: this.center.z + Math.sin(angle) * distance
    };
  }
  
  isValidPosition(position: Vector3): boolean {
    const distance = Vector3.distance(position, this.center);
    return distance <= this.radius;
  }
}
```

#### 3. Spawn Conditions

```typescript
interface SpawnConditions {
  // Time-based conditions
  timeOfDay?: {
    start: number;  // 0-24
    end: number;
  };
  
  // Player conditions
  minPlayers?: number;
  maxPlayers?: number;
  playerLevel?: {
    min: number;
    max: number;
  };
  
  // World conditions
  weather?: WeatherType[];
  worldEvents?: string[];
  
  // Quest conditions
  questRequired?: string[];
  questCompleted?: string[];
  
  // Custom conditions
  customCondition?: (spawner: Spawner, world: World) => boolean;
}

class SpawnConditionChecker {
  checkConditions(spawner: Spawner, world: World): boolean {
    const conditions = spawner.conditions;
    if (!conditions) return true;
    
    // Check time of day
    if (conditions.timeOfDay) {
      const currentTime = world.getTimeOfDay();
      const { start, end } = conditions.timeOfDay;
      
      if (start <= end) {
        if (currentTime < start || currentTime > end) return false;
      } else {
        // Handles overnight periods
        if (currentTime < start && currentTime > end) return false;
      }
    }
    
    // Check player count
    if (conditions.minPlayers || conditions.maxPlayers) {
      const playerCount = this.getPlayersInRange(spawner).length;
      
      if (conditions.minPlayers && playerCount < conditions.minPlayers) {
        return false;
      }
      if (conditions.maxPlayers && playerCount > conditions.maxPlayers) {
        return false;
      }
    }
    
    // Check custom condition
    if (conditions.customCondition) {
      if (!conditions.customCondition(spawner, world)) {
        return false;
      }
    }
    
    return true;
  }
}
```

#### 4. Spatial Indexing

```typescript
class SpatialIndex<T extends { position: Vector3 }> {
  private grid: Map<string, Set<T>>;
  private cellSize: number;
  
  constructor(cellSize: number = 50) {
    this.grid = new Map();
    this.cellSize = cellSize;
  }
  
  add(item: T): void {
    const key = this.getGridKey(item.position);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key)!.add(item);
  }
  
  remove(item: T): void {
    const key = this.getGridKey(item.position);
    const cell = this.grid.get(key);
    if (cell) {
      cell.delete(item);
      if (cell.size === 0) {
        this.grid.delete(key);
      }
    }
  }
  
  getInRange(position: Vector3, range: number): T[] {
    const results: T[] = [];
    const cellRange = Math.ceil(range / this.cellSize);
    
    const centerCell = this.getCellCoords(position);
    
    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dz = -cellRange; dz <= cellRange; dz++) {
        const cellKey = `${centerCell.x + dx},${centerCell.z + dz}`;
        const cell = this.grid.get(cellKey);
        
        if (cell) {
          for (const item of cell) {
            const distance = Vector3.distance(position, item.position);
            if (distance <= range) {
              results.push(item);
            }
          }
        }
      }
    }
    
    return results;
  }
  
  private getGridKey(position: Vector3): string {
    const cell = this.getCellCoords(position);
    return `${cell.x},${cell.z}`;
  }
  
  private getCellCoords(position: Vector3): { x: number; z: number } {
    return {
      x: Math.floor(position.x / this.cellSize),
      z: Math.floor(position.z / this.cellSize)
    };
  }
}
```

### Spawning Logic

#### 1. Main Update Loop

```typescript
fixedUpdate(delta: number): void {
  const now = Date.now();
  
  // Process spawn queue
  while (!this.spawnQueue.isEmpty()) {
    const task = this.spawnQueue.peek();
    if (task.scheduledTime > now) break;
    
    this.spawnQueue.dequeue();
    this.executeSpawnTask(task);
  }
  
  // Update spawners
  for (const [id, spawner] of this.spawners) {
    this.updateSpawner(spawner, delta);
  }
  
  // Clean up destroyed entities
  this.cleanupDestroyedEntities();
}

private updateSpawner(spawner: Spawner, delta: number): void {
  // Check activation
  const wasActive = spawner.isActive;
  spawner.isActive = this.checkActivation(spawner);
  
  // Handle activation state change
  if (!wasActive && spawner.isActive) {
    this.onSpawnerActivated(spawner);
  } else if (wasActive && !spawner.isActive) {
    this.onSpawnerDeactivated(spawner);
  }
  
  // Skip inactive spawners
  if (!spawner.isActive) return;
  
  // Check if should spawn
  if (this.shouldSpawn(spawner)) {
    this.spawnFromSpawner(spawner);
  }
}

private shouldSpawn(spawner: Spawner): boolean {
  // Check entity limit
  if (spawner.activeEntities.size >= spawner.maxEntities) {
    return false;
  }
  
  // Check respawn timer
  const now = Date.now();
  if (now - spawner.lastSpawnTime < spawner.respawnTime) {
    return false;
  }
  
  // Check spawn conditions
  if (!this.conditionChecker.checkConditions(spawner, this.world)) {
    return false;
  }
  
  return true;
}
```

#### 2. Entity Spawning

```typescript
private spawnFromSpawner(spawner: Spawner): Entity | null {
  // Select entity type to spawn
  const definition = this.selectSpawnDefinition(spawner.entityDefinitions);
  if (!definition) return null;
  
  // Get spawn position
  const position = this.getSpawnPosition(spawner);
  if (!position) return null;
  
  // Create entity
  const entity = this.createEntity(definition, position, spawner);
  if (!entity) return null;
  
  // Register spawn
  this.registerSpawn(spawner, entity);
  
  // Emit spawn event
  this.world.events.emit('entity:spawned', {
    entityId: entity.id,
    spawnerId: spawner.id,
    position,
    entityType: definition.entityType
  });
  
  return entity;
}

private getSpawnPosition(spawner: Spawner): Vector3 | null {
  const maxAttempts = 10;
  
  for (let i = 0; i < maxAttempts; i++) {
    const position = spawner.spawnArea.getRandomPosition();
    
    // Validate position
    if (!this.isValidSpawnPosition(position, spawner)) {
      continue;
    }
    
    // Check spacing from other spawns
    if (spawner.spawnArea.avoidOverlap) {
      const nearby = this.getEntitiesNear(position, spawner.spawnArea.minSpacing);
      if (nearby.length > 0) {
        continue;
      }
    }
    
    // Adjust Y position to ground level
    position.y = this.getGroundHeight(position);
    
    return position;
  }
  
  return null;
}

private createEntity(
  definition: SpawnDefinition,
  position: Vector3,
  spawner: Spawner
): Entity | null {
  switch (spawner.type) {
    case SpawnerType.NPC:
      return this.createNPC(definition, position, spawner);
    
    case SpawnerType.RESOURCE:
      return this.createResource(definition, position, spawner);
    
    case SpawnerType.CHEST:
      return this.createChest(definition, position, spawner);
    
    case SpawnerType.BOSS:
      return this.createBoss(definition, position, spawner);
    
    default:
      return null;
  }
}
```

#### 3. Proximity Activation

```typescript
private checkActivation(spawner: Spawner): boolean {
  const players = this.getActivePlayersInRange(
    spawner.position,
    spawner.activationRange
  );
  
  if (players.length === 0) {
    // Check deactivation range (larger to prevent flickering)
    const deactivationPlayers = this.getActivePlayersInRange(
      spawner.position,
      spawner.deactivationRange
    );
    
    return deactivationPlayers.length > 0 && spawner.isActive;
  }
  
  // Check line of sight if required
  if (spawner.requiresLineOfSight) {
    const hasLOS = players.some(player => 
      this.hasLineOfSight(player.position, spawner.position)
    );
    
    if (!hasLOS) return false;
  }
  
  return true;
}

private hasLineOfSight(from: Vector3, to: Vector3): boolean {
  const ray = {
    origin: from,
    direction: Vector3.normalize(Vector3.subtract(to, from)),
    maxDistance: Vector3.distance(from, to)
  };
  
  const hit = this.world.physics.raycast(ray, {
    layers: ['terrain', 'buildings'],
    ignoreEntities: true
  });
  
  return !hit || hit.distance >= ray.maxDistance - 0.1;
}
```

### Specialized Spawners

#### 1. Boss Spawner

```typescript
class BossSpawner extends Spawner {
  // Boss-specific properties
  announceSpawn: boolean = true;
  requiredPlayers: number = 3;
  lockdownArea: boolean = true;
  
  // Loot bonus for participants
  participantTracking: Map<string, number> = new Map();
  
  onSpawn(boss: BossEntity): void {
    if (this.announceSpawn) {
      this.world.chat.broadcast({
        message: `${boss.name} has spawned!`,
        type: 'boss_spawn',
        color: 0xFF0000
      });
    }
    
    if (this.lockdownArea) {
      this.createBossArena(boss.position);
    }
    
    // Track participants
    boss.on('damaged', (event) => {
      const current = this.participantTracking.get(event.attackerId) || 0;
      this.participantTracking.set(event.attackerId, current + event.damage);
    });
    
    boss.on('death', () => {
      this.distributeBossRewards();
      this.participantTracking.clear();
    });
  }
  
  private distributeBossRewards(): void {
    // Sort by damage contribution
    const participants = Array.from(this.participantTracking.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Top contributors get better loot
    participants.forEach(([ playerId, damage], index) => {
      const tier = index < 3 ? 'top' : index < 10 ? 'high' : 'normal';
      this.grantBossReward(playerId, tier);
    });
  }
}
```

#### 2. Resource Spawner

```typescript
class ResourceSpawner extends Spawner {
  resourceType: ResourceType;
  depleteTime: number = 30000;  // Time before respawn
  
  // Resource-specific spawn rules
  clusterSpawn: boolean = true;
  clusterSize: number = 3;
  clusterRadius: number = 5;
  
  spawnResource(): ResourceEntity[] {
    const resources: ResourceEntity[] = [];
    
    if (this.clusterSpawn) {
      // Spawn cluster of resources
      const centerPos = this.spawnArea.getRandomPosition();
      
      for (let i = 0; i < this.clusterSize; i++) {
        const offset = {
          x: (Math.random() - 0.5) * this.clusterRadius * 2,
          z: (Math.random() - 0.5) * this.clusterRadius * 2
        };
        
        const position = Vector3.add(centerPos, offset);
        const resource = this.createResourceEntity(position);
        
        if (resource) {
          resources.push(resource);
          this.setupResourceHandlers(resource);
        }
      }
    } else {
      // Single resource spawn
      const position = this.spawnArea.getRandomPosition();
      const resource = this.createResourceEntity(position);
      
      if (resource) {
        resources.push(resource);
        this.setupResourceHandlers(resource);
      }
    }
    
    return resources;
  }
  
  private setupResourceHandlers(resource: ResourceEntity): void {
    resource.on('depleted', () => {
      // Schedule respawn
      this.spawnQueue.enqueue({
        spawnerId: this.id,
        scheduledTime: Date.now() + this.depleteTime,
        priority: 1
      });
      
      // Remove from active entities
      this.activeEntities.delete(resource.id);
    });
  }
}
```

#### 3. Dynamic Event Spawner

```typescript
class EventSpawner extends Spawner {
  eventType: string;
  eventDuration: number;
  eventRewards: EventReward[];
  
  // Dynamic scaling
  scaleWithPlayers: boolean = true;
  minDifficulty: number = 1;
  maxDifficulty: number = 10;
  
  triggerEvent(): void {
    const players = this.getPlayersInRange(this.activationRange);
    const difficulty = this.calculateDifficulty(players.length);
    
    // Create event
    const event = new WorldEvent({
      type: this.eventType,
      position: this.position,
      difficulty,
      duration: this.eventDuration,
      participants: new Set(players.map(p => p.id))
    });
    
    // Spawn event entities
    const entityCount = Math.floor(5 + difficulty * 2);
    for (let i = 0; i < entityCount; i++) {
      const entity = this.spawnEventEntity(difficulty);
      event.addEntity(entity);
    }
    
    // Start event
    this.world.events.startWorldEvent(event);
    
    // Announce event
    this.world.chat.broadcast({
      message: `A ${this.eventType} event has begun!`,
      type: 'event_start',
      position: this.position
    });
  }
  
  private calculateDifficulty(playerCount: number): number {
    if (!this.scaleWithPlayers) {
      return this.minDifficulty;
    }
    
    const scaled = this.minDifficulty + (playerCount - 1) * 0.5;
    return Math.min(Math.max(scaled, this.minDifficulty), this.maxDifficulty);
  }
}
```

### Performance Optimization

```typescript
class SpawnerOptimization {
  // Chunk-based activation
  private chunks: Map<string, Set<Spawner>> = new Map();
  private chunkSize: number = 100;
  
  updateChunks(playerPositions: Vector3[]): void {
    const activeChunks = new Set<string>();
    
    // Determine active chunks based on player positions
    for (const pos of playerPositions) {
      const nearby = this.getChunksInRange(pos, ACTIVATION_RANGE);
      nearby.forEach(chunk => activeChunks.add(chunk));
    }
    
    // Update only spawners in active chunks
    for (const chunkId of activeChunks) {
      const spawners = this.chunks.get(chunkId);
      if (spawners) {
        spawners.forEach(spawner => this.updateSpawner(spawner));
      }
    }
  }
  
  // Staggered updates
  private updateGroups: Spawner[][] = [[], [], [], []];
  private currentGroup: number = 0;
  
  distributeSpawners(spawners: Spawner[]): void {
    // Distribute spawners across update groups
    spawners.forEach((spawner, index) => {
      this.updateGroups[index % 4].push(spawner);
    });
  }
  
  updateStaggered(delta: number): void {
    // Update one group per frame
    const group = this.updateGroups[this.currentGroup];
    group.forEach(spawner => this.updateSpawner(spawner, delta));
    
    this.currentGroup = (this.currentGroup + 1) % 4;
  }
}
```

## Network Synchronization

```typescript
// Spawn broadcast
world.network.broadcast('spawn:entity', {
  entityId: entity.id,
  entityType: entity.type,
  position: entity.position,
  spawnerId: spawner.id,
  level: entity.level
});

// Despawn broadcast
world.network.broadcast('spawn:remove', {
  entityId: entity.id,
  deathAnimation: true
});

// Spawner state sync
world.network.broadcast('spawner:state', {
  spawnerId: spawner.id,
  activeCount: spawner.activeEntities.size,
  isActive: spawner.isActive
});
```

## Configuration

```typescript
interface SpawningConfig {
  maxSpawnersPerChunk: number;      // Performance limit
  defaultActivationRange: number;    // Default: 50
  defaultDeactivationRange: number;  // Default: 75
  spawnUpdateInterval: number;       // Milliseconds between updates
  maxSpawnAttemptsPerCycle: number;  // Prevent infinite loops
  enableSpawnLogging: boolean;       // Debug logging
}
```

## Development Phases

### Phase 1: Core System (Week 1)
- Basic spawner structure
- Simple point spawning
- Respawn timers

### Phase 2: Proximity System (Week 2)
- Player proximity detection
- Activation/deactivation
- Spatial indexing

### Phase 3: Advanced Spawning (Week 3)
- Area-based spawning
- Spawn conditions
- Entity weighting

### Phase 4: Specialized Spawners (Week 4)
- Boss spawners
- Resource spawners
- Event spawners

## Testing Strategy

1. **Unit Tests**
   - Spawn position calculation
   - Condition checking
   - Timer management

2. **Integration Tests**
   - Multi-spawner interaction
   - Performance under load
   - Network synchronization

3. **Stress Tests**
   - 1000+ spawners
   - Rapid activation/deactivation
   - Memory usage monitoring 