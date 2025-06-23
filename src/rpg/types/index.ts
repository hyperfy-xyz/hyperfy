// Core RPG Type Definitions

// Core type re-exports
export * from '../../types';

// Import core types
import type { Entity, Component as CoreComponent } from '../../types';

// Re-export Entity type from core
export type { Entity } from '../../types';

// Skill types
export type SkillType = 
  | 'attack'
  | 'strength'
  | 'defense'
  | 'ranged'
  | 'magic'
  | 'prayer'
  | 'hitpoints'
  | 'mining'
  | 'smithing'
  | 'fishing'
  | 'cooking'
  | 'woodcutting'
  | 'firemaking'
  | 'crafting'
  | 'herblore'
  | 'agility'
  | 'thieving'
  | 'slayer'
  | 'farming'
  | 'runecrafting'
  | 'hunter'
  | 'construction';

// Vector types
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Component types
export interface Component extends CoreComponent {
  type: string;
  entityId?: string;
}

// Combat types
export enum CombatStyle {
  ACCURATE = 'accurate',
  AGGRESSIVE = 'aggressive',
  DEFENSIVE = 'defensive',
  CONTROLLED = 'controlled',
  RAPID = 'rapid',
  LONGRANGE = 'longrange'
}

export enum AttackType {
  MELEE = 'melee',
  RANGED = 'ranged',
  MAGIC = 'magic'
}

export interface CombatBonuses {
  // Attack bonuses
  attackStab: number;
  attackSlash: number;
  attackCrush: number;
  attackMagic: number;
  attackRanged: number;
  
  // Defense bonuses
  defenseStab: number;
  defenseSlash: number;
  defenseCrush: number;
  defenseMagic: number;
  defenseRanged: number;
  
  // Other bonuses
  meleeStrength: number;
  rangedStrength: number;
  magicDamage: number;
  prayerBonus: number;
}

export interface HitResult {
  damage: number;
  type: 'normal' | 'miss' | 'critical';
  attackType: AttackType;
  attackerId: string;
  targetId: string;
  timestamp: number;
}

export interface CombatSession {
  id: string;
  attackerId: string;
  targetId: string;
  startTime: number;
  lastAttackTime: number;
  combatTimer: number;
  hits: HitResult[];
}

// Stats types
export interface SkillData {
  level: number;
  xp: number;
  bonus?: number;
  current?: number;
  experience?: number;
}

export interface StatsComponent extends Component {
  type: 'stats';
  
  // Combat skills
  hitpoints: {
    current: number;
    max: number;
    level: number;
    xp: number;
    experience?: number;
  };
  attack: SkillData;
  strength: SkillData;
  defense: SkillData;
  ranged: SkillData;
  magic: SkillData;
  prayer: {
    level: number;
    xp: number;
    points: number;
    maxPoints: number;
    current?: number;
    experience?: number;
  };
  
  // Combat bonuses from equipment
  combatBonuses: CombatBonuses;
  
  // Computed values
  combatLevel: number;
  totalLevel: number;
}

export interface CombatComponent extends Component {
  type: 'combat';
  
  inCombat: boolean;
  target: string | null;
  lastAttackTime: number;
  lastAttack?: number;
  attackSpeed: number;
  attackRange?: number;
  combatStyle: CombatStyle;
  autoRetaliate: boolean;
  
  // Combat state
  hitSplatQueue: HitSplat[];
  hitSplats?: HitSplat[];
  animationQueue: string[];
  
  // Special attack
  specialAttackEnergy: number;
  specialAttackActive: boolean;
  
  // Protection prayers
  protectionPrayers: {
    melee: boolean;
    ranged: boolean;
    magic: boolean;
  };
}

export interface HitSplat {
  damage: number;
  type: 'normal' | 'miss' | 'critical' | 'poison' | 'disease';
  position: Vector3;
  timestamp: number;
  duration: number;
}

// Item and Equipment types
export enum EquipmentSlot {
  HEAD = 'head',
  CAPE = 'cape',
  AMULET = 'amulet',
  WEAPON = 'weapon',
  BODY = 'body',
  SHIELD = 'shield',
  LEGS = 'legs',
  GLOVES = 'gloves',
  BOOTS = 'boots',
  RING = 'ring',
  AMMO = 'ammo'
}

export enum WeaponType {
  DAGGER = 'dagger',
  SWORD = 'sword',
  SCIMITAR = 'scimitar',
  MACE = 'mace',
  AXE = 'axe',
  SPEAR = 'spear',
  HALBERD = 'halberd',
  BOW = 'bow',
  CROSSBOW = 'crossbow',
  STAFF = 'staff',
  WAND = 'wand'
}

export interface ItemDefinition {
  id: number;
  name: string;
  examine: string;
  value: number;
  weight: number;
  
  // Properties
  stackable: boolean;
  equipable: boolean;
  tradeable: boolean;
  members: boolean;
  
  // Noting system
  noteable?: boolean;
  noted?: boolean;
  notedId?: number;
  
  // Equipment data
  equipment?: {
    slot: EquipmentSlot;
    requirements: { [skill: string]: SkillData };
    bonuses: CombatBonuses;
    weaponType?: WeaponType;
    attackSpeed?: number;
    twoHanded?: boolean;
  };
  
  // Visual
  model: string;
  icon: string;
}

export interface ItemStack {
  itemId: number;
  quantity: number;
  metadata?: any;
}

export interface Equipment extends ItemDefinition {
  metadata?: any;
}

export interface InventoryComponent extends Component {
  type: 'inventory';
  
  items: (ItemStack | null)[];
  maxSlots: number;
  
  equipment: {
    [K in EquipmentSlot]: Equipment | null;
  };
  
  totalWeight: number;
  equipmentBonuses: CombatBonuses;
}

// NPC types
export enum NPCType {
  MONSTER = 'monster',
  QUEST_GIVER = 'quest_giver',
  SHOP = 'shop',
  BANKER = 'banker',
  SKILL_MASTER = 'skill_master',
  SHOPKEEPER = 'shopkeeper',
  GUARD = 'guard',
  BOSS = 'boss',
  ANIMAL = 'animal',
  CITIZEN = 'citizen'
}

export enum NPCBehavior {
  AGGRESSIVE = 'aggressive',
  PASSIVE = 'passive',
  FRIENDLY = 'friendly',
  SHOP = 'shop',
  QUEST = 'quest',
  BANKER = 'banker',
  DEFENSIVE = 'defensive',
  WANDER = 'wander',
  PATROL = 'patrol',
  FOLLOW = 'follow'
}

export enum NPCState {
  IDLE = 'idle',
  COMBAT = 'combat',
  FLEEING = 'fleeing',
  DEAD = 'dead',
  WANDERING = 'wandering',
  PATROLLING = 'patrolling',
  RETURNING = 'returning'
}

export interface NPCComponent extends Component {
  type: 'npc';
  
  npcId: number;
  name: string;
  examine: string;
  
  // Type and behavior
  npcType: NPCType;
  behavior: NPCBehavior;
  faction: string;
  
  // State
  state: NPCState;
  level: number;
  
  // Combat stats
  combatLevel: number;
  maxHitpoints: number;
  currentHitpoints: number;
  attackStyle: AttackType;
  aggressionLevel: number;
  aggressionRange: number;
  
  // Combat abilities
  attackBonus: number;
  strengthBonus: number;
  defenseBonus: number;
  maxHit: number;
  attackSpeed: number;
  
  // Spawning
  respawnTime: number;
  wanderRadius: number;
  spawnPoint: Vector3;
  
  // Loot
  lootTable?: string;
  
  // Interaction
  dialogue?: any;
  shop?: any;
  questGiver?: boolean;
  shopkeeper?: boolean;
  shopType?: string;
  currentTarget: string | null;
  lastInteraction: number;
}

// Movement types
export interface MovementComponent extends Component {
  type: 'movement';
  
  position: Vector3;
  velocity?: Vector3;
  destination: Vector3 | null;
  targetPosition: Vector3 | null;
  path: Vector3[];
  speed?: number;
  currentSpeed: number;
  moveSpeed: number;
  isMoving: boolean;
  canMove: boolean;
  runEnergy: number;
  isRunning: boolean;
  facingDirection: number;
  
  // Pathfinding
  pathfindingFlags: number;
  lastMoveTime: number;
  
  // Teleportation
  teleportDestination: Vector3 | null;
  teleportTime: number;
  teleportAnimation: string;
}

// Loot types
export interface ItemDrop {
  itemId: number;
  quantity: number;
  noted?: boolean;
}

export interface LootDrop {
  itemId: number;
  quantity: number;
  weight: number;
  rarity: 'always' | 'common' | 'uncommon' | 'rare' | 'very_rare' | 'ultra_rare';
}

export interface LootEntry {
  itemId: number;
  quantity: {
    min: number;
    max: number;
  };
  weight: number;
  noted?: boolean;
}

export interface LootTable {
  id: string;
  name: string;
  description?: string;
  
  drops: LootDrop[];
  rareDropTable: boolean;
  
  // Legacy properties for compatibility
  alwaysDrops?: ItemDrop[];
  commonDrops?: LootEntry[];
  uncommonDrops?: LootEntry[];
  rareDrops?: LootEntry[];
  
  rareTableAccess?: number;
  maxDrops?: number;
}

export interface LootComponent extends Component {
  type: 'loot';
  items: LootDrop[];
  owner: string | null;
  spawnTime: number;
  position: Vector3;
  source: string;
}

// Entity types
export interface RPGEntity extends Entity {
  // Override components with proper type
  components: Map<string, Component>;
  
  // Component methods remain compatible with base Entity but handle the correct types
  getComponent<T extends Component>(type: string): T | null;
  hasComponent(type: string): boolean;
  
  // RPG-specific properties
  position: Vector3;
}

// Player specific
export interface PlayerEntity extends RPGEntity {
  id: string;
  username: string;
  displayName: string;
  accountType: 'normal' | 'ironman' | 'hardcore_ironman';
  playTime: number;
  membershipStatus: boolean;
  
  // Death mechanics
  deathLocation: Vector3 | null;
  gravestoneTimer: number;
  
  // PvP
  skullTimer: number;
  wildernessLevel: number;
  combatZone: 'safe' | 'pvp' | 'wilderness';
}

// NPC Entity
export interface NPCEntity extends RPGEntity {
  spawnPoint: Vector3;
  currentTarget: string | null;
  deathTime: number;
  
  // AI State
  aiState: 'idle' | 'wandering' | 'chasing' | 'attacking' | 'fleeing' | 'returning';
  stateTimer: number;
}

// Item Drop Entity
export interface ItemDropEntity extends RPGEntity {
  itemId: number;
  quantity: number;
  value: number;
  
  owner: string | null;
  ownershipTimer: number;
  publicSince: number;
  
  despawnTimer: number;
  highlightTimer: number;
}

// NPC Definition
export interface NPCDefinition {
  id: number;
  name: string;
  examine: string;
  npcType: NPCType;
  behavior: NPCBehavior;
  faction?: string;
  level?: number;
  combatLevel?: number;
  maxHitpoints?: number;
  attackStyle?: AttackType;
  aggressionLevel?: number;
  aggressionRange?: number;
  combat?: {
    attackBonus: number;
    strengthBonus: number;
    defenseBonus: number;
    maxHit: number;
    attackSpeed: number;
  };
  lootTable?: string;
  respawnTime?: number;
  wanderRadius?: number;
  moveSpeed?: number;
  dialogue?: any;
  shop?: {
    name: string;
    stock: Array<{ itemId: number; stock: number }>;
    currency: string;
    buyModifier: number;
    sellModifier: number;
    restock: boolean;
    restockTime: number;
  };
  questGiver?: {
    useLLM: boolean;
    quests: string[];
    minLevel: number;
    maxLevel: number;
    questCooldown: number;
  };
  skillMaster?: any;
}

// Spawning System Types
export enum SpawnerType {
  NPC = 'npc',
  RESOURCE = 'resource',
  CHEST = 'chest',
  BOSS = 'boss',
  EVENT = 'event'
}

export interface SpawnArea {
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

// Death/Respawn System Types
export interface QuestRequirement {
  questId: string;
}

export interface SkillRequirement {
  skill: SkillType;
  level: number;
}

export enum GravestoneTier {
  WOODEN = 'wooden',      // 5 minutes
  STONE = 'stone',        // 10 minutes  
  ORNATE = 'ornate',      // 15 minutes
  ANGEL = 'angel',        // 20 minutes
  MYSTIC = 'mystic'       // 30 minutes
}

export interface Gravestone {
  id: string;
  ownerId: string;
  position: Vector3;
  items: ItemStack[];
  createdAt: number;
  expiresAt: number;
  tier: GravestoneTier;
  blessed: boolean;
}

export interface RespawnPoint {
  id: string;
  name: string;
  position: Vector3;
  requirements?: QuestRequirement | SkillRequirement;
  isDefault?: boolean;
}

export interface SafeZone {
  id: string;
  name: string;
  bounds: BoundingBox;
  allowPvP: boolean;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

export interface DeathConfig {
  // Respawn locations
  defaultRespawnPoint: Vector3;
  respawnPoints: Map<string, RespawnPoint>;
  
  // Item protection
  itemsKeptOnDeath: number; // Default: 3
  protectItemPrayer: boolean;
  skullItemsKept: number; // Default: 0
  
  // Gravestone settings
  gravestoneEnabled: boolean;
  gravestoneBaseDuration: number; // milliseconds
  gravestoneTierMultipliers: Map<GravestoneTier, number>;
  
  // Safe zones
  safeZones: SafeZone[];
  
  // Death costs
  freeReclaimThreshold: number; // GP value
  reclaimFeePercentage: number; // Percentage of item value
}

export interface DeathComponent extends Component {
  type: 'death';
  
  isDead: boolean;
  deathTime: number;
  deathLocation: Vector3 | null;
  killer: string | null;
  
  // Gravestone
  gravestoneId: string | null;
  gravestoneTimer: number;
  
  // Respawn
  respawnPoint: string | null;
  respawnTimer: number;
  
  // Item protection
  itemsKeptOnDeath: ItemStack[];
  itemsLostOnDeath: ItemStack[];
  
  // Death count
  deathCount: number;
  lastDeathTime: number;
}

export interface ItemValue {
  stack: ItemStack;
  value: number;
} 