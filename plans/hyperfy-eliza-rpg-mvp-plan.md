# Hyperfy-Eliza RPG MVP Implementation Plan
## RuneScape-Style MMORPG in Hyperfy

### Table of Contents
1. [MVP Overview](#mvp-overview)
2. [Core Components](#core-components)
3. [Entity Definitions](#entity-definitions)
4. [System Architecture](#system-architecture)
5. [Data Models](#data-models)
6. [Implementation Phases](#implementation-phases)
7. [Technical Requirements](#technical-requirements)

## MVP Overview

### Core Features for MVP
- **Combat System**: Click-to-attack with auto-combat, weapon types, and combat styles
- **Skill System**: Combat skills (Attack, Strength, Defense, Magic, Ranged, Prayer, HP)
- **Loot System**: Item drops, rarity tiers, and loot tables
- **Inventory**: 28-slot inventory system with equipment slots
- **Death Mechanics**: Item loss on death with gravestone system
- **NPCs**: Hostile mobs, quest NPCs, and shopkeepers
- **Basic Quests**: Kill quests, fetch quests, and delivery quests
- **Progression**: XP-based leveling with skill requirements
- **World Zones**: Safe zones, PvP zones, and wilderness areas
- **Banking System**: Item storage and management

## Core Components

### 1. Stats Component
```typescript
interface StatsComponent extends Component {
  // Combat Stats
  hitpoints: { current: number; max: number; level: number; xp: number };
  attack: { level: number; xp: number; bonus: number };
  strength: { level: number; xp: number; bonus: number };
  defense: { level: number; xp: number; bonus: number };
  ranged: { level: number; xp: number; bonus: number };
  magic: { level: number; xp: number; bonus: number };
  prayer: { level: number; xp: number; points: number; maxPoints: number };
  
  // Combat Bonuses
  combatBonuses: {
    attackStab: number;
    attackSlash: number;
    attackCrush: number;
    attackMagic: number;
    attackRanged: number;
    
    defenseStab: number;
    defenseSlash: number;
    defenseCrush: number;
    defenseMagic: number;
    defenseRanged: number;
    
    meleeStrength: number;
    rangedStrength: number;
    magicDamage: number;
    prayerBonus: number;
  };
  
  // Computed
  combatLevel: number;
  totalLevel: number;
}
```

### 2. Inventory Component
```typescript
interface InventoryComponent extends Component {
  items: (Item | null)[];  // 28 slots
  maxSlots: 28;
  
  equipment: {
    head: Equipment | null;
    cape: Equipment | null;
    amulet: Equipment | null;
    weapon: Equipment | null;
    body: Equipment | null;
    shield: Equipment | null;
    legs: Equipment | null;
    gloves: Equipment | null;
    boots: Equipment | null;
    ring: Equipment | null;
    ammo: Equipment | null;
  };
  
  // Methods
  addItem(item: Item): boolean;
  removeItem(slot: number): Item | null;
  moveItem(from: number, to: number): void;
  equipItem(slot: number): boolean;
  unequipItem(equipSlot: EquipmentSlot): boolean;
  getWeight(): number;
  getFreeSlots(): number;
}
```

### 3. Combat Component
```typescript
interface CombatComponent extends Component {
  inCombat: boolean;
  target: string | null;  // Entity ID
  lastAttackTime: number;
  attackSpeed: number;  // Ticks between attacks
  combatStyle: CombatStyle;
  autoRetaliate: boolean;
  
  // Combat state
  hitSplatQueue: HitSplat[];
  animationQueue: CombatAnimation[];
  
  // Special attack
  specialAttackEnergy: number;  // 0-100
  specialAttackActive: boolean;
  
  // Protection
  protectionPrayers: {
    melee: boolean;
    ranged: boolean;
    magic: boolean;
  };
}

enum CombatStyle {
  ACCURATE = 'accurate',    // +3 attack
  AGGRESSIVE = 'aggressive', // +3 strength  
  DEFENSIVE = 'defensive',   // +3 defense
  CONTROLLED = 'controlled', // +1 all
  RAPID = 'rapid',          // Ranged: faster attacks
  LONGRANGE = 'longrange'   // Ranged: +2 range
}
```

### 4. NPC Component
```typescript
interface NPCComponent extends Component {
  npcId: number;
  name: string;
  combatLevel: number;
  maxHitpoints: number;
  currentHitpoints: number;
  
  // Behavior
  behavior: NPCBehavior;
  aggressionRange: number;
  wanderRadius: number;
  respawnTime: number;
  
  // Combat stats
  attackLevel: number;
  strengthLevel: number;
  defenseLevel: number;
  maxHit: number;
  attackSpeed: number;
  attackStyle: 'melee' | 'ranged' | 'magic';
  
  // Loot
  lootTable: LootTable;
  
  // Dialogue (for non-combat NPCs)
  dialogue?: DialogueTree;
  shop?: ShopInventory;
  questGiver?: string[];  // Quest IDs
}

enum NPCBehavior {
  AGGRESSIVE = 'aggressive',   // Attacks players on sight
  PASSIVE = 'passive',        // Only attacks when attacked
  FRIENDLY = 'friendly',      // Cannot be attacked
  SHOP = 'shop',             // Shop keeper
  QUEST = 'quest',           // Quest giver
  BANKER = 'banker'          // Bank access
}
```

## Entity Definitions

### 1. Player Entity
```typescript
class PlayerEntity extends Entity {
  components = {
    stats: StatsComponent,
    inventory: InventoryComponent,
    combat: CombatComponent,
    movement: MovementComponent,
    bank: BankComponent,
    quests: QuestLogComponent,
    friends: FriendsListComponent,
    prayers: PrayerComponent,
    skills: SkillsComponent
  };
  
  // Player-specific data
  username: string;
  displayName: string;
  accountType: 'normal' | 'ironman' | 'hardcore_ironman';
  playTime: number;
  membershipStatus: boolean;
  
  // Death mechanics
  deathLocation: Vector3 | null;
  gravestoneTimer: number;
  
  // PvP
  skullTimer: number;  // PK skull
  wildernessLevel: number;
  combatZone: 'safe' | 'pvp' | 'wilderness';
}
```

### 2. NPC Entity
```typescript
class NPCEntity extends Entity {
  components = {
    npc: NPCComponent,
    stats: StatsComponent,
    combat: CombatComponent,
    movement: MovementComponent,
    spawner: SpawnerComponent
  };
  
  // NPC-specific
  spawnPoint: Vector3;
  currentTarget: string | null;
  deathTime: number;
  
  // AI State
  aiState: 'idle' | 'wandering' | 'chasing' | 'attacking' | 'fleeing';
  lastStateChange: number;
}
```

### 3. Item Drop Entity
```typescript
class ItemDropEntity extends Entity {
  components = {
    item: ItemComponent,
    physics: PhysicsComponent,
    ownership: OwnershipComponent
  };
  
  itemId: number;
  quantity: number;
  owner: string | null;  // Player who can pick up
  ownershipTimer: number;  // When it becomes public
  despawnTimer: number;  // When it disappears
  
  // Visual
  model: string;
  glowColor: string;  // Based on value
}
```

## System Architecture

### 1. Combat System
```typescript
export class CombatSystem extends System {
  private combatQueue: Map<string, CombatAction> = new Map();
  private hitCalculator: HitCalculator;
  private damageCalculator: DamageCalculator;
  
  update(delta: number): void {
    // Process combat ticks
    for (const [entityId, entity] of this.world.entities) {
      const combat = entity.getComponent<CombatComponent>('combat');
      if (!combat || !combat.inCombat) continue;
      
      this.processCombatTick(entity, combat, delta);
    }
    
    // Process hit splats
    this.processHitSplats();
    
    // Check combat timeouts
    this.checkCombatTimeouts();
  }
  
  attack(attackerId: string, targetId: string): void {
    const attacker = this.world.entities.get(attackerId);
    const target = this.world.entities.get(targetId);
    
    if (!this.canAttack(attacker, target)) return;
    
    // Set combat state
    const attackerCombat = attacker.getComponent<CombatComponent>('combat');
    attackerCombat.inCombat = true;
    attackerCombat.target = targetId;
    
    // Queue first attack
    this.queueAttack(attacker, target);
  }
  
  private calculateHit(attacker: Entity, target: Entity): Hit {
    const attackerStats = attacker.getComponent<StatsComponent>('stats');
    const targetStats = target.getComponent<StatsComponent>('stats');
    const attackerCombat = attacker.getComponent<CombatComponent>('combat');
    
    // Get attack and defense rolls
    const attackRoll = this.hitCalculator.getAttackRoll(
      attackerStats,
      attackerCombat.combatStyle,
      attackerCombat.attackType
    );
    
    const defenseRoll = this.hitCalculator.getDefenseRoll(
      targetStats,
      attackerCombat.attackType
    );
    
    // Calculate if hit lands
    const hitChance = this.hitCalculator.getHitChance(attackRoll, defenseRoll);
    const hits = Math.random() < hitChance;
    
    if (!hits) {
      return { damage: 0, type: 'miss' };
    }
    
    // Calculate damage
    const maxHit = this.damageCalculator.getMaxHit(
      attackerStats,
      attackerCombat.combatStyle,
      attackerCombat.attackType
    );
    
    const damage = Math.floor(Math.random() * (maxHit + 1));
    
    return { damage, type: 'normal' };
  }
}
```

### 2. Skill System
```typescript
export class SkillSystem extends System {
  private xpTable: number[];
  private xpRates: Map<string, XPRate> = new Map();
  
  constructor() {
    // Generate XP table for levels 1-99
    this.xpTable = this.generateXPTable();
  }
  
  grantXP(entityId: string, skill: SkillType, amount: number): void {
    const entity = this.world.entities.get(entityId);
    if (!entity) return;
    
    const stats = entity.getComponent<StatsComponent>('stats');
    const skillData = stats[skill];
    
    // Add XP
    const oldLevel = skillData.level;
    skillData.xp += amount;
    
    // Check for level up
    const newLevel = this.getLevelForXP(skillData.xp);
    if (newLevel > oldLevel) {
      skillData.level = newLevel;
      this.onLevelUp(entity, skill, oldLevel, newLevel);
    }
    
    // Update combat level if combat skill
    if (this.isCombatSkill(skill)) {
      stats.combatLevel = this.calculateCombatLevel(stats);
    }
    
    // Send XP drop
    this.world.events.emit('xp:gained', {
      entityId,
      skill,
      amount,
      total: skillData.xp
    });
  }
  
  private calculateCombatLevel(stats: StatsComponent): number {
    // RuneScape combat level formula
    const base = 0.25 * (stats.defense.level + stats.hitpoints.level + 
                        Math.floor(stats.prayer.level / 2));
    
    const melee = 0.325 * (stats.attack.level + stats.strength.level);
    const range = 0.325 * (Math.floor(stats.ranged.level * 1.5));
    const mage = 0.325 * (Math.floor(stats.magic.level * 1.5));
    
    return Math.floor(base + Math.max(melee, range, mage));
  }
  
  private generateXPTable(): number[] {
    const table = [0, 0]; // Levels 0 and 1
    
    for (let level = 2; level <= 99; level++) {
      const xp = Math.floor(
        (level - 1) + 300 * Math.pow(2, (level - 1) / 7)
      ) / 4;
      table.push(Math.floor(table[level - 1] + xp));
    }
    
    return table;
  }
}
```

### 3. Loot System
```typescript
export class LootSystem extends System {
  private lootTables: Map<string, LootTable> = new Map();
  private rareDropTable: LootTable;
  
  generateDrop(npcId: string): ItemDrop[] {
    const npc = this.world.entities.get(npcId);
    if (!npc) return [];
    
    const npcComponent = npc.getComponent<NPCComponent>('npc');
    const lootTable = this.lootTables.get(npcComponent.lootTable.id);
    
    if (!lootTable) return [];
    
    const drops: ItemDrop[] = [];
    
    // Always drop bones for most NPCs
    if (lootTable.alwaysDrops) {
      drops.push(...lootTable.alwaysDrops);
    }
    
    // Roll for main drops
    const mainDrop = this.rollDrop(lootTable.mainDrops);
    if (mainDrop) drops.push(mainDrop);
    
    // Roll for rare drop table
    if (Math.random() < lootTable.rareTableChance) {
      const rareDrop = this.rollDrop(this.rareDropTable.drops);
      if (rareDrop) drops.push(rareDrop);
    }
    
    return drops;
  }
  
  dropItems(position: Vector3, drops: ItemDrop[], owner?: string): void {
    for (const drop of drops) {
      const offset = {
        x: (Math.random() - 0.5) * 1.5,
        z: (Math.random() - 0.5) * 1.5
      };
      
      const dropEntity = new ItemDropEntity(this.world, {
        position: {
          x: position.x + offset.x,
          y: position.y,
          z: position.z + offset.z
        },
        itemId: drop.itemId,
        quantity: drop.quantity,
        owner: owner,
        ownershipTimer: owner ? 60000 : 0, // 1 minute
        despawnTimer: 180000 // 3 minutes
      });
      
      this.world.entities.add(dropEntity);
    }
  }
}
```

### 4. Quest System with Eliza Integration
```typescript
export class QuestSystem extends System {
  private quests: Map<string, Quest> = new Map();
  private playerQuests: Map<string, QuestProgress[]> = new Map();
  private elizaGenerator: ElizaQuestGenerator;
  
  async generateDynamicQuest(player: PlayerEntity, npc: NPCEntity): Promise<Quest> {
    const context = {
      playerStats: player.getComponent<StatsComponent>('stats'),
      playerQuests: this.playerQuests.get(player.id) || [],
      npcInfo: npc.getComponent<NPCComponent>('npc'),
      worldState: this.getWorldState(),
      nearbyAreas: this.getNearbyAreas(npc.position)
    };
    
    // Generate quest using Eliza
    const questData = await this.elizaGenerator.generateQuest(context);
    
    // Create quest structure
    const quest: Quest = {
      id: `dynamic_${Date.now()}`,
      name: questData.name,
      description: questData.description,
      startNPC: npc.id,
      
      requirements: this.parseRequirements(questData.requirements),
      
      stages: questData.stages.map(stage => ({
        id: stage.id,
        description: stage.description,
        objectives: this.parseObjectives(stage.objectives),
        dialogue: stage.dialogue,
        rewards: stage.rewards
      })),
      
      rewards: {
        xp: questData.rewards.xp,
        items: questData.rewards.items,
        unlocks: questData.rewards.unlocks
      },
      
      isDynamic: true,
      generatedAt: Date.now()
    };
    
    return quest;
  }
}
```

### 5. Death and Respawn System
```typescript
export class DeathSystem extends System {
  private graveyards: Map<string, Vector3> = new Map();
  private gravestones: Map<string, GravestoneEntity> = new Map();
  
  handleDeath(entityId: string, killerId?: string): void {
    const entity = this.world.entities.get(entityId);
    if (!entity) return;
    
    if (entity instanceof PlayerEntity) {
      this.handlePlayerDeath(entity, killerId);
    } else if (entity instanceof NPCEntity) {
      this.handleNPCDeath(entity, killerId);
    }
  }
  
  private handlePlayerDeath(player: PlayerEntity, killerId?: string): void {
    const inventory = player.getComponent<InventoryComponent>('inventory');
    const position = player.getComponent<MovementComponent>('movement').position;
    
    // Determine kept items (3 most valuable, 4 with Protect Item prayer)
    const keptItems = this.determineKeptItems(inventory);
    const lostItems = this.determineLostItems(inventory, keptItems);
    
    // Create gravestone
    if (lostItems.length > 0) {
      const gravestone = new GravestoneEntity(this.world, {
        position,
        owner: player.id,
        items: lostItems,
        timer: 900000 // 15 minutes
      });
      
      this.gravestones.set(player.id, gravestone);
      this.world.entities.add(gravestone);
    }
    
    // Clear inventory except kept items
    inventory.items = new Array(28).fill(null);
    keptItems.forEach((item, index) => {
      inventory.items[index] = item;
    });
    
    // Reset stats
    const stats = player.getComponent<StatsComponent>('stats');
    stats.hitpoints.current = stats.hitpoints.max;
    stats.prayer.points = stats.prayer.maxPoints;
    
    // Find respawn point
    const respawnPoint = this.getClosestGraveyard(position);
    
    // Teleport to respawn
    const movement = player.getComponent<MovementComponent>('movement');
    movement.position = respawnPoint;
    movement.teleportDestination = respawnPoint;
    
    // Death animation and message
    this.world.events.emit('player:death', {
      playerId: player.id,
      killerId,
      location: position,
      lostItems: lostItems.length
    });
  }
}
```

## Data Models

### Items and Equipment
```typescript
interface Item {
  id: number;
  name: string;
  examine: string;
  value: number;
  
  // Item properties
  stackable: boolean;
  noted: boolean;
  tradeable: boolean;
  equipable: boolean;
  
  // Weight
  weight: number;
  
  // Requirements
  requirements?: {
    skills?: { [skill: string]: number };
    quests?: string[];
  };
}

interface Equipment extends Item {
  slot: EquipmentSlot;
  
  // Combat bonuses
  bonuses: {
    attackStab: number;
    attackSlash: number;
    attackCrush: number;
    attackMagic: number;
    attackRanged: number;
    
    defenseStab: number;
    defenseSlash: number;
    defenseCrush: number;
    defenseMagic: number;
    defenseRanged: number;
    
    meleeStrength: number;
    rangedStrength: number;
    magicDamage: number;
    prayer: number;
  };
  
  // Special properties
  weaponSpeed?: number;
  weaponType?: WeaponType;
  ammoType?: AmmoType;
  specialAttack?: SpecialAttack;
}
```

### Loot Tables
```typescript
interface LootTable {
  id: string;
  name: string;
  
  // Always dropped items (like bones)
  alwaysDrops: ItemDrop[];
  
  // Main drop table
  mainDrops: LootEntry[];
  
  // Chance to access rare drop table
  rareTableChance: number;
}

interface LootEntry {
  itemId: number;
  minQuantity: number;
  maxQuantity: number;
  weight: number;  // Drop weight
  noted?: boolean;
}
```

### Quest Data
```typescript
interface Quest {
  id: string;
  name: string;
  description: string;
  difficulty: 'novice' | 'intermediate' | 'experienced' | 'master' | 'grandmaster';
  
  // Requirements
  requirements: {
    skills?: { [skill: string]: number };
    quests?: string[];
    items?: { itemId: number; quantity: number }[];
  };
  
  // Quest stages
  stages: QuestStage[];
  
  // NPCs
  startNPC: string;
  involvedNPCs: string[];
  
  // Rewards
  rewards: {
    xp: { [skill: string]: number };
    items: { itemId: number; quantity: number }[];
    unlocks: string[];  // Areas, features, etc.
    questPoints: number;
  };
  
  // Dynamic quest properties
  isDynamic?: boolean;
  generatedAt?: number;
  elizaPrompt?: string;
}
```

## Implementation Phases

### Phase 1: Core Combat (Week 1-2)
1. **Basic Combat System**
   - Click-to-attack mechanics
   - Auto-retaliate
   - Combat formulas (accuracy and damage)
   - Hit splats and animations
   - Death mechanics

2. **Stats System**
   - HP, Attack, Strength, Defense
   - Combat level calculation
   - XP gain and leveling

3. **Basic Movement**
   - Click-to-move pathfinding
   - Collision detection
   - Run/walk toggle

### Phase 2: Items and Inventory (Week 3-4)
1. **Inventory System**
   - 28-slot inventory
   - Item stacking
   - Equipment slots
   - Item interactions (use, drop, examine)

2. **Loot System**
   - Item drops on death
   - Loot tables
   - Item ownership timers
   - Despawn timers

3. **Banking**
   - Bank interface
   - Deposit/withdraw
   - Bank tabs
   - Search functionality

### Phase 3: NPCs and Spawning (Week 5-6)
1. **NPC System**
   - Basic NPC entities
   - Combat NPCs
   - NPC respawning
   - Aggression mechanics

2. **Spawning System**
   - Spawn points
   - Spawn timers
   - Player proximity activation
   - Multiple mob types per spawner

3. **Basic AI**
   - Pathfinding to player
   - Combat AI
   - Retreat mechanics

### Phase 4: Quests and Progression (Week 7-8)
1. **Quest System**
   - Quest data structure
   - Objective tracking
   - Quest log interface
   - Basic quest types

2. **Eliza Integration**
   - Dynamic quest generation
   - NPC dialogue generation
   - Context-aware responses

3. **Skill Progression**
   - Remaining combat skills (Magic, Ranged, Prayer)
   - Skill requirements
   - Unlock system

### Phase 5: World and Zones (Week 9-10)
1. **Zone System**
   - Safe zones
   - PvP zones
   - Wilderness levels
   - Zone-specific rules

2. **Interactive Objects**
   - Doors
   - Ladders
   - Resource nodes
   - Teleportation

3. **World Events**
   - Random events
   - World bosses
   - Dynamic spawns

### Phase 6: Polish and Optimization (Week 11-12)
1. **Performance**
   - Entity pooling
   - Network optimization
   - LOD system
   - Spatial indexing

2. **UI/UX**
   - Combat interfaces
   - Skill guides
   - Settings menu
   - Minimap

3. **Balance**
   - Combat balance
   - XP rates
   - Loot tables
   - Spawn rates

## Technical Requirements

### Performance Targets
- Support 100+ concurrent players per instance
- 60 FPS client performance
- <100ms network latency
- <50ms server tick rate

### Architecture Requirements
- Modular plugin system
- Hot-reloadable components
- Scalable spawning system
- Efficient collision detection
- State synchronization

### Security Requirements
- Server-authoritative combat
- Anti-cheat validation
- Rate limiting
- Secure random for loot
- Input validation

### Data Persistence
- Player stats and inventory
- Bank storage
- Quest progress
- Death markers
- World state

This MVP plan provides a solid foundation for a RuneScape-style MMORPG in Hyperfy, with room for expansion into skills like Mining, Smithing, Crafting, and more complex content like raids and minigames.
