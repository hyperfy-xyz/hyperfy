# Loot System Implementation Report

## Overview

The Loot System manages item drops from NPCs, chests, and other sources. It includes loot table definitions, drop rate calculations, item spawning, and ownership mechanics to ensure fair distribution in multiplayer environments.

## Architecture

### System Structure

```typescript
export class LootSystem extends System {
  // Core components
  private lootTables: Map<string, LootTable>;
  private activeDrops: Map<string, ItemDropEntity>;
  private dropPool: ObjectPool<ItemDropEntity>;
  private rareDropTable: RareDropTable;
  
  // Update cycle
  update(delta: number): void;
  
  // Loot operations
  generateLoot(sourceId: string, lootTableId: string, modifiers?: LootModifiers): ItemDrop[];
  spawnLoot(position: Vector3, drops: ItemDrop[], owner?: string): void;
  pickupItem(playerId: string, dropId: string): boolean;
  
  // Table management
  registerLootTable(table: LootTable): void;
  modifyDropRates(tableId: string, modifier: number): void;
}
```

### Core Components

#### 1. Loot Table Structure

```typescript
interface LootTable {
  id: string;
  name: string;
  description: string;
  
  // Drop categories
  alwaysDrops: ItemDrop[];        // 100% drop rate
  commonDrops: LootEntry[];       // Main drop table
  uncommonDrops: LootEntry[];     // Secondary drops
  rareDrops: LootEntry[];         // Rare items
  
  // Special mechanics
  rareTableAccess: number;        // Chance to roll on global rare table
  maxDrops: number;               // Maximum items per kill
  
  // Requirements
  requirements?: {
    slayerLevel?: number;
    questCompleted?: string[];
    ringOfWealth?: boolean;
  };
}

interface LootEntry {
  itemId: number;
  quantity: QuantityRange;
  weight: number;               // Drop weight (not item weight)
  noted?: boolean;              // Drop as note
  
  // Special conditions
  requirements?: LootRequirements;
  memberOnly?: boolean;
}

interface QuantityRange {
  min: number;
  max: number;
  // Optional weighted distribution
  distribution?: 'uniform' | 'weighted' | 'exponential';
}
```

#### 2. Drop Calculation Engine

```typescript
class DropCalculator {
  calculateDrops(table: LootTable, modifiers: LootModifiers): ItemDrop[] {
    const drops: ItemDrop[] = [];
    
    // Always drops
    drops.push(...table.alwaysDrops);
    
    // Calculate number of additional drops
    const dropCount = this.calculateDropCount(table, modifiers);
    
    // Roll for each drop slot
    for (let i = 0; i < dropCount; i++) {
      const category = this.selectDropCategory(table, modifiers);
      const drop = this.rollDrop(table[category], modifiers);
      
      if (drop) {
        drops.push(drop);
      }
    }
    
    // Check for rare table access
    if (this.rollRareTable(table.rareTableAccess, modifiers)) {
      const rareDrop = this.rollGlobalRareTable(modifiers);
      if (rareDrop) drops.push(rareDrop);
    }
    
    return drops;
  }
  
  private rollDrop(entries: LootEntry[], modifiers: LootModifiers): ItemDrop | null {
    // Calculate total weight including empty drops
    const totalWeight = entries.reduce((sum, entry) => {
      return sum + this.getAdjustedWeight(entry, modifiers);
    }, 0);
    
    // Add empty drop weight
    const emptyWeight = totalWeight * 0.3; // 30% nothing
    const rollMax = totalWeight + emptyWeight;
    
    // Roll
    let roll = Math.random() * rollMax;
    
    // Check for empty drop
    if (roll >= totalWeight) {
      return null;
    }
    
    // Find selected drop
    for (const entry of entries) {
      const weight = this.getAdjustedWeight(entry, modifiers);
      roll -= weight;
      
      if (roll <= 0) {
        return this.createDrop(entry, modifiers);
      }
    }
    
    return null;
  }
  
  private createDrop(entry: LootEntry, modifiers: LootModifiers): ItemDrop {
    const quantity = this.rollQuantity(entry.quantity, modifiers);
    
    return {
      itemId: entry.itemId,
      quantity,
      noted: entry.noted || (quantity > 5 && this.shouldNote(entry.itemId))
    };
  }
}
```

#### 3. Rare Drop Table

```typescript
class RareDropTable {
  private entries: RareTableEntry[] = [
    // Mega rare (1/5000 base)
    { itemId: DRAGON_SPEAR, weight: 1, category: 'mega-rare' },
    { itemId: SHIELD_LEFT_HALF, weight: 1, category: 'mega-rare' },
    
    // Very rare (1/1000 base)
    { itemId: DRAGON_MED_HELM, weight: 5, category: 'very-rare' },
    { itemId: RUNE_SPEAR, weight: 5, category: 'very-rare' },
    
    // Rare (1/128 base)
    { itemId: RUNE_BATTLEAXE, weight: 40, category: 'rare' },
    { itemId: RUNE_2H_SWORD, weight: 40, category: 'rare' },
    
    // Uncommon (1/64 base)
    { itemId: RUNE_SQ_SHIELD, weight: 80, category: 'uncommon' },
    { itemId: DRAGONSTONE, weight: 80, category: 'uncommon' },
    
    // Common
    { itemId: COINS, weight: 500, quantity: { min: 3000, max: 10000 } },
    { itemId: NATURE_RUNE, weight: 300, quantity: { min: 30, max: 100 } }
  ];
  
  roll(modifiers: LootModifiers): ItemDrop | null {
    // Ring of wealth increases rare drops
    const wealthBonus = modifiers.ringOfWealth ? 1.1 : 1.0;
    
    // Calculate adjusted weights
    const adjustedEntries = this.entries.map(entry => ({
      ...entry,
      adjustedWeight: entry.weight * 
        (entry.category === 'mega-rare' || entry.category === 'very-rare' 
          ? wealthBonus : 1.0)
    }));
    
    return this.selectWeightedEntry(adjustedEntries);
  }
}
```

#### 4. Item Drop Entity

```typescript
class ItemDropEntity extends Entity {
  // Core properties
  itemId: number;
  quantity: number;
  value: number;
  
  // Ownership
  owner: string | null;           // Player who has priority
  ownershipTimer: number;         // Time until public
  publicSince: number;            // When it became public
  
  // Timers
  despawnTimer: number;           // Time until removal
  highlightTimer: number;         // Visual effect duration
  
  // Visual
  model: ItemDropModel;
  glowEffect: GlowEffect;
  nameplate: ItemNameplate;
  
  constructor(world: World, drop: ItemDrop, position: Vector3, owner?: string) {
    super(world);
    
    this.itemId = drop.itemId;
    this.quantity = drop.quantity;
    this.value = this.calculateValue(drop);
    
    // Set ownership
    this.owner = owner;
    this.ownershipTimer = owner ? 60000 : 0; // 1 minute
    this.despawnTimer = 180000; // 3 minutes
    
    // Create visual representation
    this.createVisuals(drop, position);
    
    // Add physics for drop animation
    this.addDropPhysics(position);
  }
  
  update(delta: number): void {
    // Update timers
    if (this.owner && this.ownershipTimer > 0) {
      this.ownershipTimer -= delta;
      if (this.ownershipTimer <= 0) {
        this.owner = null;
        this.publicSince = Date.now();
        this.updateNameplate();
      }
    }
    
    this.despawnTimer -= delta;
    if (this.despawnTimer <= 0) {
      this.destroy();
    }
    
    // Update visual effects
    this.updateGlow();
  }
  
  canPickup(playerId: string): boolean {
    // Check ownership
    if (this.owner && this.owner !== playerId) {
      return false;
    }
    
    // Check if player is ironman and item is public
    const player = this.world.entities.get(playerId);
    if (player?.accountType === 'ironman' && !this.owner) {
      return false;
    }
    
    return true;
  }
}
```

### Loot Distribution Algorithms

#### 1. Weighted Random Selection

```typescript
class WeightedSelector<T extends { weight: number }> {
  select(items: T[]): T | null {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return null;
    
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) {
        return item;
      }
    }
    
    return items[items.length - 1]; // Fallback
  }
  
  selectMultiple(items: T[], count: number): T[] {
    const selected: T[] = [];
    const available = [...items];
    
    for (let i = 0; i < count && available.length > 0; i++) {
      const item = this.select(available);
      if (item) {
        selected.push(item);
        // Remove if not stackable
        if (!this.isStackable(item)) {
          const index = available.indexOf(item);
          available.splice(index, 1);
        }
      }
    }
    
    return selected;
  }
}
```

#### 2. Drop Rate Modifiers

```typescript
interface LootModifiers {
  // Player modifiers
  ringOfWealth: boolean;          // +10% rare drops
  luckPotion: boolean;            // +5% all drops
  skullStatus: boolean;           // PvP drops
  
  // Monster modifiers
  slayerTask: boolean;            // On-task bonus
  superiorVariant: boolean;       // Enhanced drops
  wildernessLevel: number;        // Wilderness multiplier
  
  // Global modifiers
  weekendBonus: boolean;          // Server event
  dropRateMultiplier: number;     // Admin setting
}

class DropRateCalculator {
  getAdjustedWeight(entry: LootEntry, modifiers: LootModifiers): number {
    let weight = entry.weight;
    
    // Ring of wealth affects rare items
    if (modifiers.ringOfWealth && this.isRareItem(entry.itemId)) {
      weight *= 1.1;
    }
    
    // Luck potion affects all drops
    if (modifiers.luckPotion) {
      weight *= 1.05;
    }
    
    // Slayer task bonus
    if (modifiers.slayerTask) {
      weight *= 1.15;
    }
    
    // Wilderness bonus (1% per level, max 56%)
    if (modifiers.wildernessLevel > 0) {
      weight *= 1 + (modifiers.wildernessLevel * 0.01);
    }
    
    // Global multiplier
    weight *= modifiers.dropRateMultiplier || 1;
    
    return Math.floor(weight);
  }
}
```

### Visual Effects System

```typescript
class LootVisualEffects {
  // Glow colors based on value
  private glowColors = {
    common: 0xFFFFFF,      // White
    uncommon: 0x00FF00,    // Green
    rare: 0x0080FF,        // Blue
    epic: 0xFF00FF,        // Purple
    legendary: 0xFFAA00    // Orange
  };
  
  getGlowColor(value: number): number {
    if (value >= 1000000) return this.glowColors.legendary;
    if (value >= 100000) return this.glowColors.epic;
    if (value >= 10000) return this.glowColors.rare;
    if (value >= 1000) return this.glowColors.uncommon;
    return this.glowColors.common;
  }
  
  createDropEffect(position: Vector3, rarity: string): void {
    // Particle burst on drop
    this.world.particles.emit('loot_drop', {
      position,
      color: this.glowColors[rarity],
      count: 20,
      spread: 0.5,
      lifetime: 1000
    });
    
    // Light pillar for rare drops
    if (rarity === 'epic' || rarity === 'legendary') {
      this.world.effects.createLightPillar({
        position,
        color: this.glowColors[rarity],
        duration: 3000,
        height: 5
      });
    }
  }
}
```

### Network Synchronization

```typescript
// Server broadcasts loot drops
world.network.broadcast('loot:spawn', {
  dropId: drop.id,
  itemId: drop.itemId,
  quantity: drop.quantity,
  position: drop.position,
  owner: drop.owner,
  glowColor: drop.glowColor
});

// Client requests pickup
world.network.send('loot:pickup', {
  dropId: drop.id
});

// Server validates and responds
private handlePickupRequest(playerId: string, dropId: string): void {
  const drop = this.activeDrops.get(dropId);
  const player = this.world.entities.get(playerId);
  
  if (!drop || !player) return;
  
  // Validate pickup
  if (!drop.canPickup(playerId)) {
    this.world.network.send(playerId, 'loot:pickup:denied', {
      reason: drop.owner ? 'not_owner' : 'ironman_restriction'
    });
    return;
  }
  
  // Check inventory space
  const inventory = player.getComponent('inventory');
  if (!inventory.canAdd(drop.itemId, drop.quantity)) {
    this.world.network.send(playerId, 'loot:pickup:denied', {
      reason: 'inventory_full'
    });
    return;
  }
  
  // Add to inventory
  inventory.add(drop.itemId, drop.quantity);
  
  // Remove drop
  drop.destroy();
  this.activeDrops.delete(dropId);
  
  // Broadcast removal
  this.world.network.broadcast('loot:remove', {
    dropId: dropId
  });
}
```

## Example Loot Tables

### Goblin Loot Table

```typescript
const goblinLootTable: LootTable = {
  id: 'goblin_drops',
  name: 'Goblin',
  description: 'Standard goblin drops',
  
  alwaysDrops: [
    { itemId: BONES, quantity: 1 }
  ],
  
  commonDrops: [
    { itemId: COINS, quantity: { min: 1, max: 15 }, weight: 100 },
    { itemId: GOBLIN_MAIL, quantity: 1, weight: 20 },
    { itemId: BRONZE_SPEAR, quantity: 1, weight: 15 },
    { itemId: BRONZE_SQ_SHIELD, quantity: 1, weight: 10 }
  ],
  
  uncommonDrops: [
    { itemId: BRASS_NECKLACE, quantity: 1, weight: 5 },
    { itemId: CHEF_HAT, quantity: 1, weight: 2 }
  ],
  
  rareDrops: [
    { itemId: GOBLIN_CHAMPION_SCROLL, quantity: 1, weight: 1 }
  ],
  
  rareTableAccess: 0.001, // 0.1% chance
  maxDrops: 2
};
```

### Boss Loot Table

```typescript
const dragonLootTable: LootTable = {
  id: 'dragon_drops',
  name: 'Dragon',
  description: 'High-level dragon drops',
  
  alwaysDrops: [
    { itemId: DRAGON_BONES, quantity: 1 },
    { itemId: DRAGON_HIDE, quantity: 1 }
  ],
  
  commonDrops: [
    { itemId: COINS, quantity: { min: 5000, max: 15000 }, weight: 100 },
    { itemId: RUNE_PLATELEGS, quantity: 1, weight: 30 },
    { itemId: RUNE_LONGSWORD, quantity: 1, weight: 25 }
  ],
  
  uncommonDrops: [
    { itemId: DRAGON_PLATELEGS, quantity: 1, weight: 10 },
    { itemId: DRAGON_PLATESKIRT, quantity: 1, weight: 10 },
    { itemId: DRAGON_SPEAR, quantity: 1, weight: 5 }
  ],
  
  rareDrops: [
    { itemId: DRACONIC_VISAGE, quantity: 1, weight: 1 },
    { itemId: DRAGON_CLAWS, quantity: 1, weight: 2 }
  ],
  
  rareTableAccess: 0.1, // 10% chance
  maxDrops: 5,
  
  requirements: {
    slayerLevel: 80
  }
};
```

## Performance Optimization

1. **Object Pooling**
   - Reuse ItemDropEntity instances
   - Pre-allocate visual effects
   - Pool particle systems

2. **Spatial Partitioning**
   - Only render nearby drops
   - Cull drops outside view distance
   - LOD system for drop models

3. **Update Batching**
   - Update timers in batches
   - Batch network messages
   - Defer non-critical updates

## Development Phases

### Phase 1: Core System (Week 1)
- Loot table structure
- Basic drop calculation
- Item spawning

### Phase 2: Ownership System (Week 2)
- Player ownership timers
- Ironman restrictions
- Pickup validation

### Phase 3: Visual Effects (Week 3)
- Drop animations
- Glow effects
- Value-based colors

### Phase 4: Advanced Features (Week 4)
- Rare drop table
- Drop modifiers
- Special loot mechanics

## Configuration

```typescript
interface LootConfig {
  dropDespawnTime: number;        // Default: 180000 (3 minutes)
  ownershipDuration: number;      // Default: 60000 (1 minute)
  maxDropsPerArea: number;        // Performance limit
  dropAnimationDuration: number;  // Drop physics time
  glowEffectIntensity: number;    // Visual effect strength
  rareDropBroadcast: boolean;     // Announce rare drops
}
```
