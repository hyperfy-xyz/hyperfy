import { System } from '../../core/systems/System';
import type { World } from '../../types';
import { NPCEntity } from '../entities/NPCEntity';
import {
  AttackType,
  CombatComponent,
  MovementComponent,
  NPCBehavior,
  NPCComponent,
  NPCDefinition,
  NPCState,
  NPCType,
  PlayerEntity,
  RPGEntity,
  StatsComponent,
  Vector3
} from '../types';
import { NPCBehaviorManager } from './npc/NPCBehaviorManager';
import { NPCDialogueManager } from './npc/NPCDialogueManager';
import { NPCSpawnManager } from './npc/NPCSpawnManager';
import { ConfigLoader } from '../config/ConfigLoader';
import { createLogger } from '../../core/logger';

export class NPCSystem extends System {
  // Core management
  private npcs: Map<string, NPCEntity> = new Map();
  private npcDefinitions: Map<number, NPCDefinition> = new Map();
  
  // Sub-managers
  private behaviorManager: NPCBehaviorManager;
  private dialogueManager: NPCDialogueManager;
  private spawnManager: NPCSpawnManager;
  
  // Configuration
  private readonly INTERACTION_RANGE = 3;
  
  // Add counter for unique IDs
  private npcIdCounter = 0;
  
  // Logger
  private logger = createLogger('NPCSystem');
  
  constructor(world: World) {
    super(world);
    this.behaviorManager = new NPCBehaviorManager(world);
    this.dialogueManager = new NPCDialogueManager(world);
    this.spawnManager = new NPCSpawnManager(world, this);
  }

  /**
   * Initialize the system
   */
  override async init(_options: any): Promise<void> {
    this.logger.info('Initializing...');
    
    // Initialize sub-managers
    this.behaviorManager.init();
    
    // Load NPC definitions from config
    const configLoader = ConfigLoader.getInstance();
    if (!configLoader.isConfigLoaded()) {
      await configLoader.loadAllConfigurations();
    }
    
    // Register all NPCs from config
    const npcConfigs = configLoader.getAllNPCs();
    this.logger.debug(`Found ${Object.keys(npcConfigs).length} NPC configs`);
    for (const config of Object.values(npcConfigs)) {
      const definition = this.convertConfigToDefinition(config);
      this.registerNPCDefinition(definition);
      this.logger.debug(`Registered NPC: ${definition.name} (ID: ${definition.id})`);
    }
    this.logger.info(`Loaded ${this.npcDefinitions.size} NPC definitions from config`);
    
    // Listen for entity events
    this.world.events.on('entity:created', (event: any) => {
      const entity = this.getEntity(event.entityId);
      if (entity && this.isNPCEntity(entity)) {
        this.onNPCCreated(entity as NPCEntity);
      }
    });
    
    this.world.events.on('entity:destroyed', (event: any) => {
      this.npcs.delete(event.entityId);
    });
    
    // Listen for combat events
    this.world.events.on('entity:death', (event: any) => {
      const npc = this.npcs.get(event.entityId);
      if (npc) {
        this.onNPCDeath(npc, event.killerId);
      }
    });
  }

  /**
   * Fixed update for AI and behavior
   */
  override fixedUpdate(delta: number): void {
    // Update NPC behaviors
    for (const [_npcId, npc] of this.npcs) {
      this.behaviorManager.updateBehavior(npc, delta);
    }
    
    // Update spawn points
    this.spawnManager.update(delta);
  }

  /**
   * Regular update for animations and visuals
   */
  override update(delta: number): void {
    // Update dialogue sessions
    this.dialogueManager.update(delta);
  }

  /**
   * Convert NPCConfig to NPCDefinition
   */
  private convertConfigToDefinition(config: any): NPCDefinition {
    // Map type string to NPCType enum
    const npcTypeMap: { [key: string]: NPCType } = {
      'monster': NPCType.MONSTER,
      'guard': NPCType.GUARD,
      'quest_giver': NPCType.QUEST_GIVER,
      'shop': NPCType.SHOPKEEPER,
      'shopkeeper': NPCType.SHOPKEEPER,
      'banker': NPCType.BANKER,
      'boss': NPCType.BOSS,
      'animal': NPCType.ANIMAL,
      'citizen': NPCType.CITIZEN
    };

    // Map behavior string to NPCBehavior enum
    const behaviorMap: { [key: string]: NPCBehavior } = {
      'aggressive': NPCBehavior.AGGRESSIVE,
      'passive': NPCBehavior.PASSIVE,
      'defensive': NPCBehavior.DEFENSIVE,
      'friendly': NPCBehavior.FRIENDLY,
      'shop': NPCBehavior.SHOP,
      'quest': NPCBehavior.QUEST,
      'banker': NPCBehavior.BANKER,
      'wander': NPCBehavior.WANDER,
      'patrol': NPCBehavior.PATROL,
      'follow': NPCBehavior.FOLLOW
    };

    return {
      id: config.id,
      name: config.name,
      examine: config.examine || `A ${config.name}.`,
      npcType: npcTypeMap[config.type?.toLowerCase()] || NPCType.CITIZEN,
      behavior: behaviorMap[config.behavior?.toLowerCase()] || NPCBehavior.PASSIVE,
      faction: config.faction || 'neutral',
      level: config.level,
      combatLevel: config.combatLevel,
      maxHitpoints: config.stats?.hitpoints,
      attackStyle: AttackType.MELEE, // Default to melee
      aggressionLevel: config.aggressionLevel,
      aggressionRange: config.aggressionRange,
      combat: config.stats ? {
        attackBonus: config.stats.attack || 0,
        strengthBonus: config.stats.strength || 0,
        defenseBonus: config.stats.defence || 0,
        maxHit: Math.floor((config.stats.strength || 0) / 4) + 1,
        attackSpeed: config.attackSpeed || 4000
      } : undefined,
      lootTable: config.dropTable,
      respawnTime: 60000, // Default 1 minute
      wanderRadius: config.wanderRadius,
      moveSpeed: config.stats?.speed || 1,
      dialogue: config.dialogue ? { text: config.dialogue } : undefined
    };
  }

  /**
   * Register an NPC definition
   */
  registerNPCDefinition(definition: NPCDefinition): void {
    this.npcDefinitions.set(definition.id, definition);
  }

  /**
   * Spawn an NPC at a position
   */
  spawnNPC(definitionId: number, position: Vector3, spawnerId?: string): NPCEntity | null {
    const definition = this.npcDefinitions.get(definitionId);
    if (!definition) {
      this.logger.warn(`Unknown NPC definition: ${definitionId}`);
      return null;
    }
    
    // Create NPC entity
    const npc = this.createNPCEntity(definition, position);
    
    // Set spawner reference
    if (spawnerId) {
      npc.spawnerId = spawnerId;
    }
    
    // Add to world
    this.addNPCToWorld(npc);
    
    return npc;
  }

  /**
   * Despawn an NPC
   */
  despawnNPC(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (!npc) return;
    
    // Clean up
    this.npcs.delete(npcId);
    
    // Emit event
    this.world.events.emit('npc:despawned', {
      npcId,
      position: npc.position
    });
    
    // Remove from world
    this.world.entities.destroyEntity(npcId);
  }

  /**
   * Handle player interaction with NPC
   */
  interactWithNPC(playerId: string, npcId: string): void {
    const player = this.getEntity(playerId) as PlayerEntity;
    const npc = this.npcs.get(npcId);
    
    if (!player || !npc) return;
    
    // Check distance
    const playerPos = this.getEntityPosition(player);
    const npcPos = this.getEntityPosition(npc);
    if (!playerPos || !npcPos) return;
    
    const distance = this.getDistance(playerPos, npcPos);
    if (distance > this.INTERACTION_RANGE) {
      this.sendMessage(playerId, "You're too far away.");
      return;
    }
    
    // Check if NPC is in combat
    const npcCombat = npc.getComponent<CombatComponent>('combat');
    if (npcCombat?.inCombat && npc.npcType !== NPCType.BOSS) {
      this.sendMessage(playerId, "The NPC is busy fighting!");
      return;
    }
    
    // Handle based on NPC type
    switch (npc.npcType) {
      case NPCType.QUEST_GIVER:
        this.handleQuestGiverInteraction(playerId, npc);
        break;
      case NPCType.SHOPKEEPER:
        this.handleShopInteraction(playerId, npc);
        break;
      case NPCType.BANKER:
        this.handleBankerInteraction(playerId, npc);
        break;
      case NPCType.SKILL_MASTER:
        this.handleSkillMasterInteraction(playerId, npc);
        break;
      default:
        this.handleGenericInteraction(playerId, npc);
    }
    
    // Update last interaction time
    npc.lastInteraction = Date.now();
  }

  /**
   * Get NPC by ID
   */
  getNPC(npcId: string): NPCEntity | undefined {
    return this.npcs.get(npcId);
  }

  /**
   * Get all NPCs
   */
  getAllNPCs(): NPCEntity[] {
    return Array.from(this.npcs.values());
  }

  /**
   * Get NPCs in range of a position
   */
  getNPCsInRange(position: Vector3, range: number): NPCEntity[] {
    const npcsInRange: NPCEntity[] = [];
    
    for (const npc of this.npcs.values()) {
      const distance = this.getDistance(position, npc.position);
      if (distance <= range) {
        npcsInRange.push(npc);
      }
    }
    
    return npcsInRange;
  }

  /**
   * Create NPC entity from definition
   */
  private createNPCEntity(definition: NPCDefinition, position: Vector3): NPCEntity {
    const npc = new NPCEntity(this.world, `npc_${definition.id}_${Date.now()}_${this.npcIdCounter++}`, {
      position,
      definition
    });
    
    // Add NPC component
    const npcComponent: NPCComponent = {
      type: 'npc',
      entity: npc as any, // Will be set by addComponent
      data: {}, // Will be set by addComponent
      npcId: definition.id,
      name: definition.name,
      examine: definition.examine,
      npcType: definition.npcType,
      behavior: definition.behavior,
      faction: definition.faction || 'neutral',
      state: NPCState.IDLE,
      level: definition.level || 1,
      
      // Combat stats
      combatLevel: definition.combatLevel || 1,
      maxHitpoints: definition.maxHitpoints || 10,
      currentHitpoints: definition.maxHitpoints || 10,
      attackStyle: definition.attackStyle || AttackType.MELEE,
      aggressionLevel: definition.aggressionLevel || 0,
      aggressionRange: definition.aggressionRange || 5,
      
      // Combat abilities
      attackBonus: definition.combat?.attackBonus || 0,
      strengthBonus: definition.combat?.strengthBonus || 0,
      defenseBonus: definition.combat?.defenseBonus || 0,
      maxHit: definition.combat?.maxHit || 1,
      attackSpeed: definition.combat?.attackSpeed || 4,
      
      // Spawning
      respawnTime: definition.respawnTime || 60000,
      wanderRadius: definition.wanderRadius || 5,
      spawnPoint: { ...position },
      
      // Interaction
      lootTable: definition.lootTable,
      dialogue: definition.dialogue,
      shop: definition.shop,
      questGiver: definition.questGiver ? true : false,
      
      // State
      currentTarget: null,
      lastInteraction: 0
    };
    
    npc.addComponent('npc', npcComponent);
    
    // Add stats component if combat NPC
    if (this.isCombatNPC(definition)) {
      const stats: StatsComponent = {
        type: 'stats',
        entity: npc as any, // Will be set by addComponent
        data: {}, // Will be set by addComponent
        hitpoints: {
          current: definition.maxHitpoints || 10,
          max: definition.maxHitpoints || 10,
          level: definition.combatLevel || 1,
          xp: 0
        },
        attack: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
        strength: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
        defense: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
        ranged: { level: 1, xp: 0, bonus: 0 },
        magic: { level: 1, xp: 0, bonus: 0 },
        prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
        combatBonuses: {
          attackStab: 0,
          attackSlash: 0,
          attackCrush: 0,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 0,
          defenseSlash: 0,
          defenseCrush: 0,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: definition.combat?.strengthBonus || 0,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        },
        combatLevel: definition.combatLevel || 1,
        totalLevel: definition.combatLevel || 1
      };
      npc.addComponent('stats', stats);
    }
    
    // Add movement component
    const movement: MovementComponent = {
      type: 'movement',
      entity: npc as any, // Will be set by addComponent
      data: {}, // Will be set by addComponent
      position: { ...position },
      destination: null,
      targetPosition: null,
      path: [],
      moveSpeed: definition.moveSpeed || 1,
      isMoving: false,
      canMove: true,
      runEnergy: 100,
      isRunning: false,
      currentSpeed: 0,
      facingDirection: 0,
      pathfindingFlags: 0,
      lastMoveTime: 0,
      teleportDestination: null,
      teleportTime: 0,
      teleportAnimation: ''
    };
    npc.addComponent('movement', movement);
    
    return npc;
  }

  /**
   * Add NPC to world
   */
  private addNPCToWorld(npc: NPCEntity): void {
    this.npcs.set(npc.id, npc);
    
    // Add to world entities
    (this.world.entities as any).items.set(npc.id, npc);
    
    // Emit event
    this.world.events.emit('npc:spawned', {
      npcId: npc.id,
      definitionId: npc.getComponent<NPCComponent>('npc')!.npcId,
      position: npc.position
    });
  }

  /**
   * Handle NPC creation
   */
  private onNPCCreated(npc: NPCEntity): void {
    this.npcs.set(npc.id, npc);
  }

  /**
   * Handle NPC death
   */
  private onNPCDeath(npc: NPCEntity, killerId?: string): void {
    const npcComponent = npc.getComponent<NPCComponent>('npc');
    if (!npcComponent) return;
    
    // Drop loot
    if (npcComponent.lootTable && killerId) {
      this.world.events.emit('npc:death:loot', {
        npcId: npc.id,
        killerId,
        lootTable: npcComponent.lootTable,
        position: npc.position
      });
    }
    
    // Schedule respawn
    if (npcComponent.respawnTime > 0 && npc.spawnerId) {
      this.spawnManager.scheduleRespawn(
        npc.spawnerId,
        npcComponent.npcId,
        npcComponent.respawnTime
      );
    }
    
    // Remove from active NPCs
    this.npcs.delete(npc.id);
  }

  /**
   * Handle quest giver interaction
   */
  private handleQuestGiverInteraction(playerId: string, npc: NPCEntity): void {
    this.dialogueManager.startDialogue(playerId, npc.id);
    
    this.world.events.emit('quest:interact', {
      playerId: playerId,
      npcId: npc.id
    });
  }

  /**
   * Handle shop interaction
   */
  private handleShopInteraction(playerId: string, npc: NPCEntity): void {
    const npcComponent = npc.getComponent<NPCComponent>('npc');
    if (!npcComponent?.shop) return;
    
    this.world.events.emit('shop:open', {
      playerId: playerId,
      npcId: npc.id,
      shop: npcComponent.shop
    });
  }

  /**
   * Handle banker interaction
   */
  private handleBankerInteraction(playerId: string, npc: NPCEntity): void {
    this.world.events.emit('bank:open', {
      playerId: playerId,
      npcId: npc.id
    });
  }

  /**
   * Handle skill master interaction
   */
  private handleSkillMasterInteraction(playerId: string, npc: NPCEntity): void {
    this.dialogueManager.startDialogue(playerId, npc.id);
  }

  /**
   * Handle generic interaction
   */
  private handleGenericInteraction(playerId: string, npc: NPCEntity): void {
    const npcComponent = npc.getComponent<NPCComponent>('npc');
    if (!npcComponent) return;
    
    // Show examine text or start dialogue
    if (npcComponent.dialogue) {
      this.dialogueManager.startDialogue(playerId, npc.id);
    } else {
      this.sendMessage(playerId, npcComponent.examine);
    }
  }

  /**
   * Check if entity is an NPC
   */
  private isNPCEntity(entity: any): boolean {
    return entity.hasComponent?.('npc') || entity.getComponent?.('npc') !== null;
  }

  /**
   * Check if NPC is combat-capable
   */
  private isCombatNPC(definition: NPCDefinition): boolean {
    return definition.npcType === NPCType.MONSTER ||
           definition.npcType === NPCType.BOSS ||
           definition.npcType === NPCType.GUARD;
  }

  /**
   * Get entity from world
   */
  private getEntity(entityId: string): RPGEntity | undefined {
    if (this.world.entities.items instanceof Map) {
      const entity = this.world.entities.items.get(entityId);
      if (!entity || typeof entity.getComponent !== 'function') {
        return undefined;
      }
      return entity as unknown as RPGEntity;
    }
    
    const entity = this.world.entities.get?.(entityId);
    if (!entity || typeof entity.getComponent !== 'function') {
      return undefined;
    }
    return entity as unknown as RPGEntity;
  }

  /**
   * Calculate distance between two positions
   */
  private getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Send message to player
   */
  private sendMessage(playerId: string, message: string): void {
    this.world.events.emit('chat:system', {
      targetId: playerId,
      message
    });
  }

  /**
   * Get entity position
   */
  private getEntityPosition(entity: any): Vector3 | null {
    // Try different ways to get position
    if (entity.position && typeof entity.position === 'object') {
      return entity.position;
    }
    
    if (entity.data?.position) {
      // If position is an array, convert to Vector3
      if (Array.isArray(entity.data.position)) {
        return {
          x: entity.data.position[0] || 0,
          y: entity.data.position[1] || 0,
          z: entity.data.position[2] || 0
        };
      }
      return entity.data.position;
    }
    
    return null;
  }
} 