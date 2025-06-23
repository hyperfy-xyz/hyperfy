import { System } from '../../core/systems/System';
import type { World } from '../../types';
import type {
    NPCEntity,
    PlayerEntity,
    RPGEntity,
    Vector3,
    Entity
} from '../types';
import { 
    SpawnArea, 
    SpawnerType,
    NPCType,
    NPCBehavior,
    NPCState,
    AttackType 
} from '../types';
import { CircularSpawnArea } from './spawning/CircularSpawnArea';
import { SpatialIndex } from './spawning/SpatialIndex';
import { SpawnConditionChecker } from './spawning/SpawnConditionChecker';

// Re-export SpawnConditions from SpawnConditionChecker to avoid duplication
type SpawnConditions = {
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
  
  // Custom conditions
  customCondition?: (spawner: any, world: World) => boolean;
};

interface Spawner {
  id: string;
  type: SpawnerType;
  position: Vector3;
  
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

interface SpawnDefinition {
  entityType: string;
  entityId?: number;      // For NPCs
  weight: number;         // Spawn probability weight
  minLevel?: number;      // For scaling NPCs
  maxLevel?: number;
  metadata?: any;         // Additional spawn data
}

interface SpawnTask {
  spawnerId: string;
  scheduledTime: number;
  priority: number;
}

// Types for spawning system
interface SpawnPoint {
  id: string;
  entityId: string;
  minLevel?: number;
  respawnTime?: number;
  metadata?: any;
}

export class SpawningSystem extends System {
  // Core components
  private spawners: Map<string, Spawner> = new Map();
  private activeSpawns: Map<string, string> = new Map(); // entityId -> spawnerId
  private spawnQueue: SpawnTask[] = [];
  private spatialIndex: SpatialIndex<Spawner>;
  private conditionChecker: SpawnConditionChecker;
  
  // Configuration
  private readonly DEFAULT_ACTIVATION_RANGE = 50;
  private readonly DEFAULT_DEACTIVATION_RANGE = 75;
  private readonly UPDATE_INTERVAL = 1000; // 1 second
  private lastUpdateTime = 0;
  
  constructor(world: World) {
    super(world);
    this.spatialIndex = new SpatialIndex<Spawner>(50);
    this.conditionChecker = new SpawnConditionChecker();
  }
  
  /**
   * Initialize the system
   */
  override async init(_options: any): Promise<void> {
    console.log('[SpawningSystem] Initializing...');
    
    // Listen for entity death
    this.world.events.on('entity:death', (event: any) => {
      this.handleEntityDeath(event.entityId);
    });
    
    // Listen for entity despawn
    this.world.events.on('entity:despawned', (event: any) => {
      this.handleEntityDespawn(event.entityId);
    });
    
    // Register default spawners
    // this.registerDefaultSpawners(); // Commented out to prevent test interference
  }
  
  /**
   * Fixed update cycle
   */
  override fixedUpdate(delta: number): void {
    const now = Date.now();
    
    // Throttle updates
    if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) {
      return;
    }
    this.lastUpdateTime = now;
    
    // Process spawn queue
    this.processSpawnQueue(now);
    
    // Update spawners
    for (const [_id, spawner] of this.spawners) {
      this.updateSpawner(spawner, delta);
    }
    
    // Clean up destroyed entities
    this.cleanupDestroyedEntities();
  }
  
  /**
   * Register a spawner
   */
  registerSpawner(config: Partial<Spawner> & { position: Vector3; type: SpawnerType }): string {
    const id = `spawner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const spawner: Spawner = {
      id,
      type: config.type,
      position: config.position,
      entityDefinitions: config.entityDefinitions || [],
      maxEntities: config.maxEntities || 1,
      respawnTime: config.respawnTime || 30000,
      activationRange: config.activationRange || this.DEFAULT_ACTIVATION_RANGE,
      deactivationRange: config.deactivationRange || this.DEFAULT_DEACTIVATION_RANGE,
      requiresLineOfSight: config.requiresLineOfSight || false,
      activeEntities: new Set(),
      lastSpawnTime: 0,
      isActive: false,
      spawnArea: config.spawnArea || new CircularSpawnArea(config.position, 5, 1),
      conditions: config.conditions
    };
    
    this.spawners.set(id, spawner);
    this.spatialIndex.add(spawner);
    
    console.log(`[SpawningSystem] Registered spawner ${id} at ${JSON.stringify(config.position)}`);
    
    return id;
  }
  
  /**
   * Unregister a spawner
   */
  unregisterSpawner(spawnerId: string): void {
    const spawner = this.spawners.get(spawnerId);
    if (!spawner) return;
    
    // Despawn all active entities
    for (const entityId of spawner.activeEntities) {
      this.despawnEntity(entityId);
    }
    
    this.spawners.delete(spawnerId);
    this.spatialIndex.remove(spawner);
    
    console.log(`[SpawningSystem] Unregistered spawner ${spawnerId}`);
  }
  
  /**
   * Spawn entity from spawner
   */
  spawnEntity(spawner: Spawner): RPGEntity | null {
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
      entityId: (entity as any).id || entity.data?.id,
      spawnerId: spawner.id,
      position,
      entityType: definition.entityType
    });
    
    return entity;
  }
  
  /**
   * Despawn entity
   */
  despawnEntity(entityId: string): void {
    const spawnerId = this.activeSpawns.get(entityId);
    if (!spawnerId) return;
    
    const spawner = this.spawners.get(spawnerId);
    if (spawner) {
      spawner.activeEntities.delete(entityId);
    }
    
    this.activeSpawns.delete(entityId);
    
    // Remove entity from world
    const entity = this.getEntity(entityId);
    if (entity) {
      (this.world as any).removeEntity?.(entity);
    }
    
    console.log(`[SpawningSystem] Despawned entity ${entityId}`);
  }
  
  /**
   * Get active players in range
   */
  getActivePlayersInRange(position: Vector3, range: number): PlayerEntity[] {
    const players: PlayerEntity[] = [];
    
    // Get all entities in range
    const entities = (this.world as any).getEntitiesInRange?.(position, range) || [];
    
    for (const entity of entities) {
      if (entity.data?.type === 'player') {
        players.push(entity as PlayerEntity);
      }
    }
    
    return players;
  }
  
  /**
   * Update spawner
   */
  private updateSpawner(spawner: Spawner, _delta: number): void {
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
  
  /**
   * Check spawner activation
   */
  private checkActivation(spawner: Spawner): boolean {
    const players = this.getActivePlayersInRange(
      spawner.position,
      spawner.activationRange
    );
    
    if (players.length > 0) {
      // Players in activation range - check line of sight if required
      if (spawner.requiresLineOfSight) {
        const hasLOS = players.some(player => {
          const playerPos = player.data?.position || (player as any).position;
          const playerVector3: Vector3 = Array.isArray(playerPos)
            ? { x: playerPos[0] || 0, y: playerPos[1] || 0, z: playerPos[2] || 0 }
            : playerPos;
          return this.hasLineOfSight(playerVector3, spawner.position);
        });
        
        if (!hasLOS) return false;
      }
      
      return true;
    }
    
    // No players in activation range
    // If spawner is active, check if players are still in deactivation range
    if (spawner.isActive) {
      const deactivationPlayers = this.getActivePlayersInRange(
        spawner.position,
        spawner.deactivationRange
      );
      
      return deactivationPlayers.length > 0;
    }
    
    return false;
  }
  
  /**
   * Check if should spawn
   */
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
    if (!this.conditionChecker.checkConditions(spawner as any, this.world)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Spawn from spawner
   */
  private spawnFromSpawner(spawner: Spawner): void {
    const entity = this.spawnEntity(spawner);
    if (entity) {
      spawner.lastSpawnTime = Date.now();
      console.log(`[SpawningSystem] Spawned ${entity.data?.type || 'entity'} from spawner ${spawner.id}`);
    }
  }
  
  /**
   * Select spawn definition based on weights
   */
  private selectSpawnDefinition(definitions: SpawnDefinition[]): SpawnDefinition | null {
    if (definitions.length === 0) return null;
    
    const totalWeight = definitions.reduce((sum, def) => sum + def.weight, 0);
    if (totalWeight === 0) return null;
    
    let roll = Math.random() * totalWeight;
    
    for (const definition of definitions) {
      roll -= definition.weight;
      if (roll <= 0) {
        return definition;
      }
    }
    
    return definitions[0] || null;
  }
  
  /**
   * Get spawn position
   */
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
  
  /**
   * Create entity based on type
   */
  private createEntity(
    definition: SpawnDefinition,
    position: Vector3,
    spawner: Spawner
  ): RPGEntity | null {
    switch (spawner.type) {
      case SpawnerType.NPC:
        return this.createNPC(definition, position, spawner);
      case SpawnerType.RESOURCE:
        return this.spawnResource(definition, position, spawner);
      case SpawnerType.CHEST:
        return this.spawnChest(definition, position, spawner);
      case SpawnerType.BOSS:
        return this.spawnBoss(definition, position, spawner);
      default:
        console.warn(`[SpawningSystem] Unknown spawner type: ${spawner.type}`);
        return null;
    }
  }
  
  /**
   * Create NPC
   */
  private createNPC(
    definition: SpawnDefinition,
    position: Vector3,
    spawner: Spawner
  ): NPCEntity | null {
    // Get NPC system
    const npcSystem = (this.world as any).getSystem?.('NPCSystem');
    if (!npcSystem) return null;
    
    // Create NPC
    const npc = npcSystem.spawnNPC?.(
      definition.entityId || 1,
      position,
      spawner.id
    );
    
    return npc;
  }
  
  /**
   * Spawn resource entity (trees, rocks, etc.)
   */
  private spawnResource(definition: SpawnDefinition, position: Vector3, spawner: Spawner): RPGEntity | null {
    const resourceId = `resource_${Date.now()}_${Math.random()}`;
    
    // Create resource entity
    const resource = {
      id: resourceId,
      type: 'resource',
      position: { ...position },
      data: {
        id: resourceId,
        resourceType: definition.entityType,
        spawnPointId: spawner.id,
        depleted: false,
        respawnTime: spawner.respawnTime || 60000 // 1 minute default
      },
      components: new Map(),
      getComponent(type: string) {
        return this.components.get(type) || null;
      },
      hasComponent(type: string) {
        return this.components.has(type);
      }
    } as RPGEntity;
    
    // Add resource component
    const resourceComponent = {
      type: 'resource',
      resourceType: definition.entityType,
      skillRequired: this.getResourceSkill(definition.entityType),
      levelRequired: definition.minLevel || 1,
      depleted: false,
      harvestTime: 3000, // 3 seconds
      drops: this.getResourceDrops(definition.entityType),
      respawnTime: spawner.respawnTime || 60000
    };
    resource.components.set('resource', resourceComponent as any);
    
    // Add visual component
    resource.components.set('visual', {
      type: 'visual',
      model: this.getResourceModel(definition.entityType),
      scale: definition.metadata?.scale || 1
    } as any);
    
    // Add collision
    resource.components.set('collider', {
      type: 'collider',
      shape: 'box',
      size: { x: 1, y: 2, z: 1 },
      blocking: true
    } as any);
    
    // Add to world
    (this.world as any).entities?.items?.set(resourceId, resource) || 
    ((this.world as any).entities = new Map()).set(resourceId, resource);
    
    return resource;
  }
  
  /**
   * Get resource skill requirement
   */
  private getResourceSkill(resourceType: string): string {
    const skillMap: Record<string, string> = {
      'tree': 'woodcutting',
      'oak_tree': 'woodcutting',
      'willow_tree': 'woodcutting',
      'rock': 'mining',
      'iron_rock': 'mining',
      'gold_rock': 'mining',
      'fishing_spot': 'fishing'
    };
    return skillMap[resourceType] || 'woodcutting';
  }
  
  /**
   * Get resource drops
   */
  private getResourceDrops(resourceType: string): any[] {
    const dropMap: Record<string, any[]> = {
      'tree': [{ itemId: 1511, quantity: 1 }], // Logs
      'oak_tree': [{ itemId: 1521, quantity: 1 }], // Oak logs
      'rock': [{ itemId: 436, quantity: 1 }], // Copper ore
      'iron_rock': [{ itemId: 440, quantity: 1 }], // Iron ore
    };
    return dropMap[resourceType] || [];
  }
  
  /**
   * Get resource model
   */
  private getResourceModel(resourceType: string): string {
    const modelMap: Record<string, string> = {
      'tree': 'models/tree_normal.glb',
      'oak_tree': 'models/tree_oak.glb',
      'rock': 'models/rock_normal.glb',
      'iron_rock': 'models/rock_iron.glb'
    };
    return modelMap[resourceType] || 'models/tree_normal.glb';
  }

  /**
   * Spawn chest entity
   */
  private spawnChest(definition: SpawnDefinition, position: Vector3, spawner: Spawner): RPGEntity | null {
    const chestId = `chest_${Date.now()}_${Math.random()}`;
    
    // Create chest entity
    const chest = {
      id: chestId,
      type: 'chest',
      position: { ...position },
      data: {
        id: chestId,
        chestType: definition.entityType,
        spawnPointId: spawner.id,
        locked: definition.metadata?.locked || false,
        keyRequired: definition.metadata?.keyRequired || null
      },
      components: new Map(),
      getComponent(type: string) {
        return this.components.get(type) || null;
      },
      hasComponent(type: string) {
        return this.components.has(type);
      }
    } as RPGEntity;
    
    // Add chest component
    const chestComponent = {
      type: 'chest',
      chestType: definition.entityType,
      lootTable: definition.metadata?.lootTable || 'chest_common',
      locked: definition.metadata?.locked || false,
      keyRequired: definition.metadata?.keyRequired || null,
      opened: false,
      respawnTime: spawner.respawnTime || 300000 // 5 minutes
    };
    chest.components.set('chest', chestComponent as any);
    
    // Add visual
    chest.components.set('visual', {
      type: 'visual',
      model: this.getChestModel(definition.entityType),
      scale: definition.metadata?.scale || 1
    } as any);
    
    // Add interactable
    chest.components.set('interactable', {
      type: 'interactable',
      interactionType: 'open',
      range: 2
    } as any);
    
    // Add to world
    (this.world as any).entities?.items?.set(chestId, chest) || 
    ((this.world as any).entities = new Map()).set(chestId, chest);
    
    return chest;
  }
  
  /**
   * Get chest model
   */
  private getChestModel(chestType: string): string {
    const modelMap: Record<string, string> = {
      'chest_common': 'models/chest_wooden.glb',
      'chest_rare': 'models/chest_ornate.glb',
      'chest_epic': 'models/chest_golden.glb'
    };
    return modelMap[chestType] || 'models/chest_wooden.glb';
  }

  /**
   * Spawn boss entity
   */
  private spawnBoss(definition: SpawnDefinition, position: Vector3, spawner: Spawner): RPGEntity | null {
    const bossId = `boss_${Date.now()}_${Math.random()}`;
    const bossDef = this.getBossDefinition(definition.entityType);
    
    if (!bossDef) return null;
    
    // Create boss entity
    const boss = {
      id: bossId,
      type: 'npc',
      position: { ...position },
      data: {
        id: bossId,
        npcId: bossDef.id,
        spawnPointId: spawner.id
      },
      components: new Map(),
      getComponent(type: string) {
        return this.components.get(type) || null;
      },
      hasComponent(type: string) {
        return this.components.has(type);
      }
    } as RPGEntity;
    
    // Add NPC component with boss stats
    const npcComponent = {
      type: 'npc',
      npcId: bossDef.id,
      name: bossDef.name,
      examine: bossDef.examine,
      npcType: NPCType.BOSS,
      behavior: NPCBehavior.AGGRESSIVE,
      faction: bossDef.faction || 'hostile',
      state: NPCState.IDLE,
      level: bossDef.level,
      combatLevel: bossDef.combatLevel,
      maxHitpoints: bossDef.maxHitpoints,
      currentHitpoints: bossDef.maxHitpoints,
      attackStyle: bossDef.attackStyle || AttackType.MELEE,
      aggressionLevel: 100,
      aggressionRange: bossDef.aggressionRange || 10,
      attackBonus: bossDef.combat.attackBonus,
      strengthBonus: bossDef.combat.strengthBonus,
      defenseBonus: bossDef.combat.defenseBonus,
      maxHit: bossDef.combat.maxHit,
      attackSpeed: bossDef.combat.attackSpeed,
      respawnTime: spawner.respawnTime || 600000, // 10 minutes
      wanderRadius: 0, // Bosses don't wander
      spawnPoint: position,
      lootTable: bossDef.lootTable,
      currentTarget: null,
      lastInteraction: 0
    };
    boss.components.set('npc', npcComponent as any);
    
    // Add boss-specific component
    boss.components.set('boss', {
      type: 'boss',
      phase: 1,
      maxPhases: bossDef.phases || 1,
      specialAttacks: bossDef.specialAttacks || [],
      immunities: bossDef.immunities || [],
      mechanics: bossDef.mechanics || []
    } as any);
    
    // Add stats
    boss.components.set('stats', this.createBossStats(bossDef) as any);
    
    // Add movement
    boss.components.set('movement', {
      type: 'movement',
      position: { ...position },
      destination: null,
      targetPosition: null,
      path: [],
      currentSpeed: 0,
      moveSpeed: bossDef.moveSpeed || 3,
      isMoving: false,
      canMove: true,
      runEnergy: 100,
      isRunning: false,
      facingDirection: 0,
      pathfindingFlags: 0,
      lastMoveTime: 0,
      teleportDestination: null,
      teleportTime: 0,
      teleportAnimation: ''
    } as any);
    
    // Add visual
    boss.components.set('visual', {
      type: 'visual',
      model: bossDef.model || 'models/boss_default.glb',
      scale: bossDef.scale || 2
    } as any);
    
    // Add to world
    (this.world as any).entities?.items?.set(bossId, boss) || 
    ((this.world as any).entities = new Map()).set(bossId, boss);
    
    // Announce boss spawn
    this.emit('boss:spawned', {
      bossId,
      bossName: bossDef.name,
      position
    });
    
    return boss;
  }
  
  /**
   * Get boss definition
   */
  private getBossDefinition(bossType: string): any {
    // In real implementation, load from data files
    const bosses: Record<string, any> = {
      'king_black_dragon': {
        id: 239,
        name: 'King Black Dragon',
        examine: 'The biggest, meanest dragon around!',
        level: 276,
        combatLevel: 276,
        maxHitpoints: 240,
        attackStyle: AttackType.MAGIC,
        aggressionRange: 15,
        combat: {
          attackBonus: 240,
          strengthBonus: 240,
          defenseBonus: 240,
          maxHit: 25,
          attackSpeed: 4
        },
        lootTable: 'kbd_drops',
        phases: 1,
        specialAttacks: ['dragonfire', 'poison_breath', 'freeze_breath'],
        model: 'models/boss_kbd.glb',
        scale: 3
      }
    };
    
    return bosses[bossType];
  }
  
  /**
   * Create boss stats
   */
  private createBossStats(bossDef: any): any {
    return {
      type: 'stats',
      hitpoints: {
        current: bossDef.maxHitpoints,
        max: bossDef.maxHitpoints,
        level: 99,
        xp: 13034431
      },
      attack: { level: 99, xp: 13034431 },
      strength: { level: 99, xp: 13034431 },
      defense: { level: 99, xp: 13034431 },
      ranged: { level: 99, xp: 13034431 },
      magic: { level: 99, xp: 13034431 },
      prayer: {
        level: 99,
        xp: 13034431,
        points: 99,
        maxPoints: 99
      },
      combatBonuses: {
        attackStab: bossDef.combat.attackBonus,
        attackSlash: bossDef.combat.attackBonus,
        attackCrush: bossDef.combat.attackBonus,
        attackMagic: bossDef.combat.attackBonus,
        attackRanged: bossDef.combat.attackBonus,
        defenseStab: bossDef.combat.defenseBonus,
        defenseSlash: bossDef.combat.defenseBonus,
        defenseCrush: bossDef.combat.defenseBonus,
        defenseMagic: bossDef.combat.defenseBonus,
        defenseRanged: bossDef.combat.defenseBonus,
        meleeStrength: bossDef.combat.strengthBonus,
        rangedStrength: bossDef.combat.strengthBonus,
        magicDamage: bossDef.combat.strengthBonus,
        prayerBonus: 0
      },
      combatLevel: bossDef.combatLevel,
      totalLevel: 2277
    };
  }
  
  /**
   * Register spawn
   */
  private registerSpawn(spawner: Spawner, entity: RPGEntity): void {
    const entityId = (entity as any).id || entity.data?.id;
    spawner.activeEntities.add(entityId);
    this.activeSpawns.set(entityId, spawner.id);
  }
  
  /**
   * Handle entity death
   */
  private handleEntityDeath(entityId: string): void {
    const spawnerId = this.activeSpawns.get(entityId);
    if (!spawnerId) return;
    
    const spawner = this.spawners.get(spawnerId);
    if (!spawner) return;
    
    // Remove from active entities
    spawner.activeEntities.delete(entityId);
    this.activeSpawns.delete(entityId);
    
    // Schedule respawn
    this.scheduleRespawn(spawner);
  }
  
  /**
   * Handle entity despawn
   */
  private handleEntityDespawn(entityId: string): void {
    this.handleEntityDeath(entityId);
  }
  
  /**
   * Schedule respawn
   */
  private scheduleRespawn(spawner: Spawner): void {
    const task: SpawnTask = {
      spawnerId: spawner.id,
      scheduledTime: Date.now() + spawner.respawnTime,
      priority: 1
    };
    
    this.spawnQueue.push(task);
    this.spawnQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
  }
  
  /**
   * Process spawn queue
   */
  private processSpawnQueue(now: number): void {
    while (this.spawnQueue.length > 0) {
      const task = this.spawnQueue[0];
      if (!task || task.scheduledTime > now) break;
      
      this.spawnQueue.shift();
      this.executeSpawnTask(task);
    }
  }
  
  /**
   * Execute spawn task
   */
  private executeSpawnTask(task: SpawnTask): void {
    const spawner = this.spawners.get(task.spawnerId);
    if (!spawner) return;
    
    if (spawner.isActive && this.shouldSpawn(spawner)) {
      this.spawnFromSpawner(spawner);
    }
  }
  
  /**
   * Clean up destroyed entities
   */
  private cleanupDestroyedEntities(): void {
    const toRemove: string[] = [];
    
    for (const [entityId, _spawnerId] of this.activeSpawns) {
      const entity = this.getEntity(entityId);
      if (!entity) {
        toRemove.push(entityId);
      }
    }
    
    for (const entityId of toRemove) {
      this.handleEntityDeath(entityId);
    }
  }
  
  /**
   * Get entity by ID
   */
  private getEntity(entityId: string): RPGEntity | undefined {
    // Try test world first
    if ((this.world as any).entities?.items) {
      return (this.world as any).entities.items.get(entityId);
    }
    
    // Handle production environment
    const entity = this.world.entities?.get?.(entityId);
    if (!entity || typeof entity.getComponent !== 'function') {
      return undefined;
    }
    return entity as unknown as RPGEntity;
  }
  
  /**
   * Get entities near position
   */
  private getEntitiesNear(position: Vector3, range: number): RPGEntity[] {
    // Use spatial query implementation
    const entities = this.spatialQuery(position, range);
    
    // Convert to RPGEntity array
    const rpgEntities: RPGEntity[] = [];
    for (const entity of entities) {
      // Check if it's an RPGEntity
      if (entity && typeof entity.getComponent === 'function') {
        rpgEntities.push(entity as RPGEntity);
      }
    }
    
    return rpgEntities;
  }
  
  /**
   * Check if spawn position is valid
   */
  private isValidSpawnPosition(position: Vector3, spawner: Spawner): boolean {
    // Use terrain/collision checks
    if (!this.isTerrainWalkable(position)) {
      return false;
    }
    
    // Additional spawner-specific checks
    if (spawner.spawnArea && !spawner.spawnArea.isValidPosition(position)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get ground height at position
   */
  private getGroundHeight(position: Vector3): number {
    // Use terrain height query implementation
    return this.getTerrainHeight(position);
  }
  
  /**
   * Check line of sight
   */
  private hasLineOfSight(from: Vector3, to: Vector3): boolean {
    // Use raycast implementation
    const physics = (this.world as any).physics;
    if (!physics) return true; // Assume LOS if no physics
    
    const hit = physics.raycast(from, to, {
      filterFlags: 'STATIC_BODIES',
      maxDistance: this.getDistance(from, to)
    });
    
    // If no hit, we have line of sight
    return !hit;
  }
  
  /**
   * Calculate distance between two positions
   */
  private getDistance(from: Vector3, to: Vector3): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Handle spawner activation
   */
  private onSpawnerActivated(spawner: Spawner): void {
    console.log(`[SpawningSystem] Spawner ${spawner.id} activated`);
    
    // Spawn initial entities up to maxEntities
    const entitiesToSpawn = spawner.maxEntities - spawner.activeEntities.size;
    for (let i = 0; i < entitiesToSpawn; i++) {
      // For initial spawn, temporarily bypass respawn timer
      const originalLastSpawnTime = spawner.lastSpawnTime;
      spawner.lastSpawnTime = 0;
      
      if (this.shouldSpawn(spawner)) {
        this.spawnFromSpawner(spawner);
      } else {
        // Restore original time if spawn failed
        spawner.lastSpawnTime = originalLastSpawnTime;
        break;
      }
    }
  }
  
  /**
   * Handle spawner deactivation
   */
  private onSpawnerDeactivated(spawner: Spawner): void {
    console.log(`[SpawningSystem] Spawner ${spawner.id} deactivated`);
    
    // Optionally despawn entities when deactivated
    // This depends on game design choice
  }
  
  /**
   * Register default spawners for testing
   */
  registerDefaultSpawners(): void {
    // Goblin spawner
    this.registerSpawner({
      type: SpawnerType.NPC,
      position: { x: 10, y: 0, z: 10 },
      entityDefinitions: [{
        entityType: 'npc',
        entityId: 1, // Goblin ID
        weight: 100
      }],
      maxEntities: 3,
      respawnTime: 30000,
      activationRange: 50,
      spawnArea: new CircularSpawnArea({ x: 10, y: 0, z: 10 }, 10, 2)
    });
    
    // Guard spawner
    this.registerSpawner({
      type: SpawnerType.NPC,
      position: { x: -20, y: 0, z: -20 },
      entityDefinitions: [{
        entityType: 'npc',
        entityId: 2, // Guard ID
        weight: 100
      }],
      maxEntities: 2,
      respawnTime: 60000,
      activationRange: 30
    });
  }

  /**
   * Check if position is available for spawning
   */
  private isPositionAvailable(position: Vector3, radius: number): boolean {
    // Use spatial query to check for nearby entities
    const nearbyEntities = this.spatialQuery(position, radius);
    
    // Check if any blocking entities exist
    for (const entity of nearbyEntities) {
      const collider = entity.getComponent('collider');
      if (collider && (collider as any).blocking) {
        return false;
      }
    }
    
    // Add terrain/collision checks
    if (!this.isTerrainWalkable(position)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Perform spatial query to find entities within radius
   */
  private spatialQuery(position: Vector3, radius: number): Entity[] {
    const results: Entity[] = [];
    
    // Check if world has spatial index
    const spatialIndex = (this.world as any).spatialIndex;
    if (spatialIndex) {
      // Use optimized spatial query
      return spatialIndex.query(position, radius);
    }
    
    // Fallback to brute force search
    const radiusSquared = radius * radius;
    
    for (const entity of this.world.entities.items.values()) {
      if (!entity.position) continue;
      
      const dx = entity.position.x - position.x;
      const dy = entity.position.y - position.y;
      const dz = entity.position.z - position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      if (distanceSquared <= radiusSquared) {
        results.push(entity);
      }
    }
    
    return results;
  }
  
  /**
   * Check if terrain is walkable at position
   */
  private isTerrainWalkable(position: Vector3): boolean {
    // Check collision map
    const collisionMap = (this.world as any).collisionMap;
    if (collisionMap) {
      const tileX = Math.floor(position.x);
      const tileZ = Math.floor(position.z);
      
      if (collisionMap[tileZ] && collisionMap[tileZ][tileX]) {
        return false; // Tile is blocked
      }
    }
    
    // Check terrain height - ensure spawn is on ground
    const terrainHeight = this.getTerrainHeight(position);
    if (Math.abs(position.y - terrainHeight) > 0.5) {
      return false; // Too far from ground
    }
    
    return true;
  }

  /**
   * Get terrain height at position
   */
  private getTerrainHeight(position: Vector3): number {
    // Use terrain system if available
    const terrain = (this.world as any).terrain;
    if (terrain && terrain.getHeightAt) {
      return terrain.getHeightAt(position.x, position.z);
    }
    
    // Use raycast to find ground
    const rayHeight = this.raycastGround(position);
    if (rayHeight !== null) {
      return rayHeight;
    }
    
    // Default to y=0
    return 0;
  }

  /**
   * Raycast to find ground level
   */
  private raycastGround(position: Vector3): number | null {
    const physics = (this.world as any).physics;
    if (!physics) return null;
    
    // Cast ray downward from high above
    const rayStart = { x: position.x, y: position.y + 100, z: position.z };
    const rayEnd = { x: position.x, y: position.y - 100, z: position.z };
    
    const hit = physics.raycast(rayStart, rayEnd, {
      filterFlags: 'STATIC_BODIES',
      maxDistance: 200
    });
    
    if (hit) {
      return hit.point.y;
    }
    
    return null;
  }
} 