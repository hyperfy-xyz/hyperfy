# Inventory System Implementation Report

## Overview

The Inventory System manages player items, equipment, and storage. It provides a 28-slot inventory grid with equipment slots, supporting item stacking, equipment bonuses, and network synchronization.

## Architecture

### System Structure

```typescript
export class InventorySystem extends System {
  // Core management
  private inventories: Map<string, InventoryComponent>;
  private itemRegistry: ItemRegistry;
  private equipmentCalculator: EquipmentBonusCalculator;
  
  // Update methods
  update(delta: number): void;
  
  // Inventory operations
  addItem(entityId: string, item: Item, quantity?: number): boolean;
  removeItem(entityId: string, slot: number, quantity?: number): Item | null;
  moveItem(entityId: string, fromSlot: number, toSlot: number): boolean;
  equipItem(entityId: string, inventorySlot: number): boolean;
  unequipItem(entityId: string, equipmentSlot: EquipmentSlot): boolean;
  
  // Utility methods
  getWeight(entityId: string): number;
  getFreeSlots(entityId: string): number;
  findItem(entityId: string, itemId: number): number | null;
}
```

### Core Components

#### 1. Inventory Component

```typescript
interface InventoryComponent {
  // Main inventory
  items: (ItemStack | null)[];
  maxSlots: 28;
  
  // Equipment slots
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
  
  // Calculated values
  totalWeight: number;
  equipmentBonuses: CombatBonuses;
}

interface ItemStack {
  itemId: number;
  quantity: number;
  metadata?: any; // For degradable items, charges, etc.
}
```

#### 2. Item Registry

```typescript
class ItemRegistry {
  private items: Map<number, ItemDefinition>;
  
  register(item: ItemDefinition): void;
  get(itemId: number): ItemDefinition | null;
  getByName(name: string): ItemDefinition | null;
  
  // Item categories
  isStackable(itemId: number): boolean;
  isEquipable(itemId: number): boolean;
  isTradeable(itemId: number): boolean;
  isNoteable(itemId: number): boolean;
}

interface ItemDefinition {
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
  
  // Equipment data (if equipable)
  equipment?: {
    slot: EquipmentSlot;
    requirements: SkillRequirements;
    bonuses: CombatBonuses;
    weaponType?: WeaponType;
    attackSpeed?: number;
  };
  
  // Visual
  model: string;
  icon: string;
}
```

#### 3. Equipment Bonus Calculator

```typescript
class EquipmentBonusCalculator {
  calculateTotalBonuses(equipment: Equipment): CombatBonuses;
  meetsRequirements(item: ItemDefinition, stats: StatsComponent): boolean;
  getEquipmentWeight(equipment: Equipment): number;
}

interface CombatBonuses {
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
```

## Implementation Details

### Inventory Operations

#### Adding Items

```typescript
addItem(entityId: string, item: Item, quantity: number = 1): boolean {
  const inventory = this.inventories.get(entityId);
  if (!inventory) return false;
  
  const itemDef = this.itemRegistry.get(item.id);
  if (!itemDef) return false;
  
  // Handle stackable items
  if (itemDef.stackable) {
    const existingSlot = this.findItem(entityId, item.id);
    if (existingSlot !== null) {
      inventory.items[existingSlot].quantity += quantity;
      this.syncInventory(entityId);
      return true;
    }
  }
  
  // Add to first free slot
  const freeSlot = this.findFreeSlot(inventory);
  if (freeSlot === -1) return false;
  
  inventory.items[freeSlot] = {
    itemId: item.id,
    quantity: itemDef.stackable ? quantity : 1,
    metadata: item.metadata
  };
  
  // Add remaining non-stackable items
  if (!itemDef.stackable && quantity > 1) {
    for (let i = 1; i < quantity; i++) {
      this.addItem(entityId, item, 1);
    }
  }
  
  this.updateWeight(inventory);
  this.syncInventory(entityId);
  return true;
}
```

#### Equipment System

```typescript
equipItem(entityId: string, inventorySlot: number): boolean {
  const inventory = this.inventories.get(entityId);
  const entity = this.world.entities.get(entityId);
  if (!inventory || !entity) return false;
  
  const itemStack = inventory.items[inventorySlot];
  if (!itemStack) return false;
  
  const itemDef = this.itemRegistry.get(itemStack.itemId);
  if (!itemDef || !itemDef.equipable) return false;
  
  // Check requirements
  const stats = entity.getComponent('stats') as StatsComponent;
  if (!this.equipmentCalculator.meetsRequirements(itemDef, stats)) {
    this.sendMessage(entityId, "You don't meet the requirements to equip this item.");
    return false;
  }
  
  const slot = itemDef.equipment!.slot;
  
  // Handle two-handed weapons
  if (slot === EquipmentSlot.WEAPON && itemDef.equipment!.twoHanded) {
    if (inventory.equipment.shield) {
      const freeSlot = this.findFreeSlot(inventory);
      if (freeSlot === -1) {
        this.sendMessage(entityId, "Not enough inventory space.");
        return false;
      }
    }
  }
  
  // Swap items
  const currentEquipped = inventory.equipment[slot];
  inventory.equipment[slot] = {
    ...itemDef,
    metadata: itemStack.metadata
  };
  
  // Remove from inventory
  if (itemStack.quantity > 1) {
    itemStack.quantity--;
  } else {
    inventory.items[inventorySlot] = null;
  }
  
  // Add previously equipped item to inventory
  if (currentEquipped) {
    this.addItem(entityId, currentEquipped, 1);
  }
  
  // Update bonuses
  this.updateEquipmentBonuses(inventory);
  this.syncInventory(entityId);
  
  return true;
}
```

### Network Synchronization

```typescript
// Client requests
world.network.send('inventory:move', {
  fromSlot: 5,
  toSlot: 10
});

world.network.send('inventory:equip', {
  slot: 3
});

world.network.send('inventory:drop', {
  slot: 7,
  quantity: 10
});

// Server validation and broadcast
private handleInventoryMove(playerId: string, data: MoveRequest) {
  if (this.moveItem(playerId, data.fromSlot, data.toSlot)) {
    this.world.network.send(playerId, 'inventory:updated', {
      inventory: this.serializeInventory(playerId)
    });
  }
}

// Inventory state sync
private syncInventory(entityId: string) {
  const inventory = this.inventories.get(entityId);
  if (!inventory) return;
  
  this.world.network.send(entityId, 'inventory:state', {
    items: inventory.items,
    equipment: inventory.equipment,
    weight: inventory.totalWeight,
    bonuses: inventory.equipmentBonuses
  });
}
```

### Item Interactions

```typescript
interface ItemInteraction {
  use(player: Entity, item: ItemStack): void;
  useWith(player: Entity, item: ItemStack, target: Entity | ItemStack): void;
  examine(player: Entity, item: ItemStack): string;
  drop(player: Entity, item: ItemStack, quantity: number): void;
}

// Example: Food item
class FoodInteraction implements ItemInteraction {
  use(player: Entity, item: ItemStack) {
    const stats = player.getComponent('stats') as StatsComponent;
    const foodDef = foodDefinitions.get(item.itemId);
    
    if (stats.hitpoints.current >= stats.hitpoints.max) {
      this.sendMessage(player, "You don't need to eat right now.");
      return;
    }
    
    // Heal player
    stats.hitpoints.current = Math.min(
      stats.hitpoints.current + foodDef.healAmount,
      stats.hitpoints.max
    );
    
    // Remove food
    this.inventorySystem.removeItem(player.id, item.slot, 1);
    
    // Play animation
    player.playAnimation('eat');
  }
}
```

### Visual Interface

```typescript
interface InventoryUI {
  // Grid layout
  gridSize: { width: 4, height: 7 };
  slotSize: 36; // pixels
  
  // Drag and drop
  onDragStart(slot: number): void;
  onDragOver(slot: number): void;
  onDrop(fromSlot: number, toSlot: number): void;
  
  // Context menu
  onRightClick(slot: number): ContextMenu;
  
  // Equipment panel
  equipmentSlots: Map<EquipmentSlot, UISlot>;
  
  // Info panel
  showWeight: boolean;
  showValue: boolean;
  showBonuses: boolean;
}
```

## Performance Considerations

1. **Item Pooling**
   - Reuse item stack objects
   - Pool UI elements for inventory slots

2. **Update Batching**
   - Batch multiple inventory changes
   - Send updates at fixed intervals

3. **Lazy Loading**
   - Load item definitions on demand
   - Cache frequently used items

## Security Considerations

1. **Server Validation**
   - Validate all inventory operations
   - Check item ownership
   - Prevent item duplication

2. **Rate Limiting**
   - Limit inventory actions per second
   - Prevent spam clicking

3. **Inventory Limits**
   - Enforce maximum stack sizes
   - Validate item quantities

## Data Persistence

```typescript
interface InventoryData {
  playerId: string;
  items: {
    slot: number;
    itemId: number;
    quantity: number;
    metadata?: any;
  }[];
  equipment: {
    [slot: string]: {
      itemId: number;
      metadata?: any;
    };
  };
}

// Save inventory
async saveInventory(playerId: string): Promise<void> {
  const inventory = this.inventories.get(playerId);
  const data = this.serializeInventory(inventory);
  await this.world.storage.set(`inventory:${playerId}`, data);
}

// Load inventory
async loadInventory(playerId: string): Promise<void> {
  const data = await this.world.storage.get(`inventory:${playerId}`);
  if (data) {
    this.deserializeInventory(playerId, data);
  }
}
```

## Testing Strategy

1. **Unit Tests**
   - Item stacking logic
   - Equipment requirements
   - Weight calculations

2. **Integration Tests**
   - Drag and drop operations
   - Equipment swapping
   - Network synchronization

3. **Edge Cases**
   - Full inventory handling
   - Stackable item limits
   - Two-handed weapon equipping

## Development Phases

### Phase 1: Core Inventory (Week 1)
- Basic 28-slot inventory
- Add/remove items
- Item stacking

### Phase 2: Equipment System (Week 2)
- Equipment slots
- Bonus calculations
- Requirement checking

### Phase 3: UI Implementation (Week 3)
- Inventory grid UI
- Drag and drop
- Context menus

### Phase 4: Polish (Week 4)
- Animations
- Sound effects
- Performance optimization

## Configuration

```typescript
interface InventoryConfig {
  maxSlots: number; // Default: 28
  stackLimit: number; // Default: 2147483647
  dropDelay: number; // Milliseconds before item appears for others
  examineDistance: number; // Max distance to examine items
}
``` 