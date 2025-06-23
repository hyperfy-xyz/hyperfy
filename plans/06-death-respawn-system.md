# Death/Respawn System Implementation Plan

## Overview
The Death/Respawn system handles player death, item loss, respawn mechanics, and gravestone functionality following RuneScape mechanics.

## Core Components

### 1. DeathSystem
Main system that handles death events and respawn logic.

```typescript
interface DeathSystem {
  // Death handling
  handleDeath(entity: RPGEntity, killer?: RPGEntity): void
  
  // Respawn handling
  respawn(entity: RPGEntity, location?: Vector3): void
  
  // Item recovery
  createGravestone(entity: RPGEntity, items: ItemStack[]): Gravestone
  reclaimItems(entity: RPGEntity, gravestone: Gravestone): void
  
  // Death mechanics
  isInSafeZone(position: Vector3): boolean
  getItemsKeptOnDeath(entity: RPGEntity): ItemStack[]
  getItemsLostOnDeath(entity: RPGEntity): ItemStack[]
}
```

### 2. Gravestone Entity
Represents a player's gravestone with dropped items.

```typescript
interface Gravestone {
  id: string
  ownerId: string
  position: Vector3
  items: ItemStack[]
  createdAt: number
  expiresAt: number
  tier: GravestoneTier
}

enum GravestoneTier {
  WOODEN = 'wooden',      // 5 minutes
  STONE = 'stone',        // 10 minutes  
  ORNATE = 'ornate',      // 15 minutes
  ANGEL = 'angel',        // 20 minutes
  MYSTIC = 'mystic'       // 30 minutes
}
```

### 3. Death Configuration
```typescript
interface DeathConfig {
  // Respawn locations
  defaultRespawnPoint: Vector3
  respawnPoints: Map<string, RespawnPoint>
  
  // Item protection
  itemsKeptOnDeath: number // Default: 3
  protectItemPrayer: boolean
  skullItemsKept: number // Default: 0
  
  // Gravestone settings
  gravestoneEnabled: boolean
  gravestoneBaseDuration: number // milliseconds
  gravestoneTierMultipliers: Map<GravestoneTier, number>
  
  // Safe zones
  safeZones: SafeZone[]
}

interface RespawnPoint {
  id: string
  name: string
  position: Vector3
  requirements?: QuestRequirement | SkillRequirement
  isDefault?: boolean
}

interface SafeZone {
  id: string
  name: string
  bounds: BoundingBox
  allowPvP: boolean
}
```

## Key Features

### 1. Death Mechanics
- Health reaches 0
- Death animation plays
- Items are calculated (kept vs lost)
- Gravestone spawns with lost items
- Player respawns at designated location

### 2. Item Protection
- Keep 3 most valuable items by default
- Protect Item prayer keeps +1 item
- Skulled players keep 0 items (unless Protect Item)
- Ultimate Ironman rules (no banking, lose everything)

### 3. Gravestone System
- Timed gravestones (5-30 minutes based on tier)
- Only owner can loot initially
- Items become visible to all after timer expires
- Blessing gravestones extends timer
- Gravestone upgrades from quest rewards

### 4. Respawn Locations
- Default: Lumbridge
- Unlockable respawn points (Edgeville, Falador, etc.)
- Last visited city respawn option
- Home teleport cooldown reset on death

### 5. Death Costs
- Free reclaim under 100k value
- Percentage-based fee for higher values
- Death coffer for automatic payments
- Gravestone blessing costs

## Implementation Steps

### Step 1: Core Death Handler
```typescript
class DeathSystem extends System {
  private gravestones: Map<string, Gravestone> = new Map()
  private deathTimers: Map<string, NodeJS.Timeout> = new Map()
  
  handleDeath(entity: RPGEntity, killer?: RPGEntity): void {
    // 1. Emit death event
    this.world.events.emit('entity:death', { entity, killer })
    
    // 2. Calculate kept/lost items
    const keptItems = this.getItemsKeptOnDeath(entity)
    const lostItems = this.getItemsLostOnDeath(entity)
    
    // 3. Create gravestone if items lost
    if (lostItems.length > 0 && !this.isInSafeZone(entity.position)) {
      const gravestone = this.createGravestone(entity, lostItems)
      this.startGravestoneTimer(gravestone)
    }
    
    // 4. Clear inventory except kept items
    this.clearInventoryExcept(entity, keptItems)
    
    // 5. Reset stats
    this.resetCombatStats(entity)
    
    // 6. Schedule respawn
    this.scheduleRespawn(entity)
  }
}
```

### Step 2: Item Value Calculator
```typescript
class ItemValueCalculator {
  calculateItemValues(items: ItemStack[]): ItemValue[] {
    return items
      .map(stack => ({
        stack,
        value: this.getItemValue(stack.itemId) * stack.quantity
      }))
      .sort((a, b) => b.value - a.value)
  }
  
  getItemsToKeep(
    items: ItemStack[], 
    keepCount: number
  ): ItemStack[] {
    const valued = this.calculateItemValues(items)
    const toKeep: ItemStack[] = []
    let kept = 0
    
    for (const { stack } of valued) {
      if (kept >= keepCount) break
      
      if (stack.quantity <= keepCount - kept) {
        toKeep.push(stack)
        kept += stack.quantity
      } else {
        toKeep.push({
          ...stack,
          quantity: keepCount - kept
        })
        kept = keepCount
      }
    }
    
    return toKeep
  }
}
```

### Step 3: Gravestone Manager
```typescript
class GravestoneManager {
  createGravestone(
    owner: RPGEntity,
    items: ItemStack[],
    tier: GravestoneTier = GravestoneTier.WOODEN
  ): Gravestone {
    const duration = this.calculateDuration(tier)
    
    const gravestone: Gravestone = {
      id: generateId(),
      ownerId: owner.id,
      position: owner.position.clone(),
      items,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
      tier
    }
    
    // Spawn gravestone entity in world
    this.spawnGravestoneEntity(gravestone)
    
    return gravestone
  }
  
  reclaimItems(
    entity: RPGEntity,
    gravestone: Gravestone,
    payFee: boolean = true
  ): boolean {
    // Check ownership
    if (gravestone.ownerId !== entity.id) {
      const isExpired = Date.now() > gravestone.expiresAt
      if (!isExpired) return false
    }
    
    // Calculate and pay fee if required
    if (payFee && gravestone.ownerId === entity.id) {
      const fee = this.calculateReclaimFee(gravestone.items)
      if (!this.payFee(entity, fee)) return false
    }
    
    // Transfer items
    const inventory = this.world.systems.get(InventorySystem)
    for (const item of gravestone.items) {
      inventory.addItem(entity, item)
    }
    
    // Remove gravestone
    this.removeGravestone(gravestone.id)
    
    return true
  }
}
```

### Step 4: Respawn Handler
```typescript
class RespawnHandler {
  private respawnPoints: Map<string, RespawnPoint>
  
  getRespawnLocation(entity: RPGEntity): Vector3 {
    // Check for custom respawn point
    const customPoint = entity.data.respawnPoint
    if (customPoint && this.canUseRespawnPoint(entity, customPoint)) {
      return this.respawnPoints.get(customPoint)!.position
    }
    
    // Check for last city
    const lastCity = entity.data.lastVisitedCity
    if (lastCity && this.respawnPoints.has(lastCity)) {
      return this.respawnPoints.get(lastCity)!.position
    }
    
    // Default respawn
    return this.config.defaultRespawnPoint
  }
  
  respawn(entity: RPGEntity, location?: Vector3): void {
    const respawnLocation = location || this.getRespawnLocation(entity)
    
    // Restore health/prayer
    entity.data.stats.health = entity.data.stats.maxHealth
    entity.data.stats.prayer = Math.floor(entity.data.stats.maxPrayer * 0.5)
    
    // Reset poison/disease
    entity.data.combat.isPoisoned = false
    entity.data.combat.isDiseased = false
    
    // Teleport to respawn
    entity.position.copy(respawnLocation)
    
    // Emit respawn event
    this.world.events.emit('entity:respawn', { entity, location: respawnLocation })
  }
}
```

## Testing Requirements

### Unit Tests
1. Death trigger conditions
2. Item protection calculations
3. Gravestone creation and expiry
4. Respawn location selection
5. Fee calculations
6. Safe zone detection

### Integration Tests
1. Full death cycle (death → gravestone → respawn → reclaim)
2. PvP death scenarios
3. Multiple death handling
4. Gravestone interactions
5. Death in different zones

### Edge Cases
1. Death with full inventory
2. Death with no items
3. Simultaneous deaths
4. Death during teleport
5. Server restart with active gravestones

## Network Synchronization

### Events to Sync
```typescript
// Death event
{
  type: 'entity:death',
  entityId: string,
  killerId?: string,
  position: Vector3,
  keptItems: ItemStack[],
  gravestoneId?: string
}

// Gravestone spawn
{
  type: 'gravestone:spawn',
  gravestone: Gravestone
}

// Gravestone claim
{
  type: 'gravestone:claim',
  gravestoneId: string,
  claimerId: string
}

// Respawn event
{
  type: 'entity:respawn',
  entityId: string,
  position: Vector3
}
```

## Performance Considerations

1. **Gravestone Cleanup**: Regular cleanup of expired gravestones
2. **Timer Management**: Efficient timer handling for multiple gravestones
3. **Spatial Indexing**: Quick gravestone lookup by position
4. **Item Value Cache**: Cache item values to avoid repeated calculations

## Configuration Example

```typescript
const deathConfig: DeathConfig = {
  defaultRespawnPoint: new Vector3(3200, 0, 3200), // Lumbridge
  respawnPoints: new Map([
    ['lumbridge', { 
      id: 'lumbridge', 
      name: 'Lumbridge', 
      position: new Vector3(3200, 0, 3200),
      isDefault: true
    }],
    ['edgeville', { 
      id: 'edgeville', 
      name: 'Edgeville', 
      position: new Vector3(3090, 0, 3490),
      requirements: { type: 'quest', questId: 'death_to_the_dorgeshuun' }
    }]
  ]),
  itemsKeptOnDeath: 3,
  protectItemPrayer: true,
  skullItemsKept: 0,
  gravestoneEnabled: true,
  gravestoneBaseDuration: 5 * 60 * 1000, // 5 minutes
  gravestoneTierMultipliers: new Map([
    [GravestoneTier.WOODEN, 1],
    [GravestoneTier.STONE, 2],
    [GravestoneTier.ORNATE, 3],
    [GravestoneTier.ANGEL, 4],
    [GravestoneTier.MYSTIC, 6]
  ]),
  safeZones: [
    {
      id: 'lumbridge',
      name: 'Lumbridge',
      bounds: { min: new Vector3(3150, 0, 3150), max: new Vector3(3250, 100, 3250) },
      allowPvP: false
    }
  ]
}
``` 