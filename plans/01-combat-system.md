# Combat System Implementation Report

## Overview

The Combat System is the core of the RPG experience, handling all combat interactions between players and NPCs. It will be implemented as a Hyperfy System that manages combat states, damage calculations, and combat animations.

## Architecture

### System Structure

```typescript
export class CombatSystem extends System {
  // Core components
  private combatSessions: Map<string, CombatSession>;
  private hitCalculator: HitCalculator;
  private damageCalculator: DamageCalculator;
  private combatAnimations: CombatAnimationManager;
  
  // Update cycle
  fixedUpdate(delta: number): void;
  update(delta: number): void;
  
  // Combat methods
  initiateAttack(attackerId: string, targetId: string): void;
  processCombatTick(session: CombatSession): void;
  calculateHit(attacker: Entity, target: Entity): HitResult;
  applyDamage(target: Entity, damage: number, source: Entity): void;
}
```

### Core Components

#### 1. Combat Session
Manages the state of an ongoing combat interaction:

```typescript
interface CombatSession {
  id: string;
  attackerId: string;
  targetId: string;
  startTime: number;
  lastAttackTime: number;
  combatTimer: number; // Time until combat ends
  hits: HitResult[];
}
```

#### 2. Hit Calculator
Determines if attacks land based on accuracy vs defense:

```typescript
class HitCalculator {
  calculateAttackRoll(attacker: StatsComponent, style: CombatStyle): number;
  calculateDefenseRoll(defender: StatsComponent, attackType: AttackType): number;
  calculateHitChance(attackRoll: number, defenseRoll: number): number;
}
```

#### 3. Damage Calculator
Calculates damage output based on stats and equipment:

```typescript
class DamageCalculator {
  calculateMaxHit(attacker: StatsComponent, style: CombatStyle): number;
  calculateDamage(maxHit: number): number;
  applyDamageReductions(damage: number, target: StatsComponent): number;
}
```

## Implementation Details

### Combat Flow

1. **Attack Initiation**
   - Player clicks on target
   - System validates attack (range, line of sight, target validity)
   - Creates CombatSession if valid

2. **Combat Loop**
   - Runs every game tick (600ms for RuneScape-style)
   - Checks attack speed timer
   - Calculates hit/miss
   - Applies damage
   - Triggers animations

3. **Combat End**
   - No attacks for 10 seconds
   - Target dies
   - Player moves too far away

### Combat Formulas

#### Attack Roll
```typescript
attackRoll = effectiveLevel * (equipmentBonus + 64)
effectiveLevel = level + styleBonus + 8

// Style bonuses:
// Accurate: +3 attack
// Aggressive: +3 strength
// Defensive: +3 defense
// Controlled: +1 all
```

#### Defense Roll
```typescript
defenseRoll = effectiveDefense * (equipmentDefense + 64)
effectiveDefense = defenseLevel + styleBonus + 8
```

#### Hit Chance
```typescript
if (attackRoll > defenseRoll) {
  hitChance = 1 - (defenseRoll + 2) / (2 * (attackRoll + 1))
} else {
  hitChance = attackRoll / (2 * (defenseRoll + 1))
}
```

#### Max Hit Calculation
```typescript
// Melee
maxHit = 0.5 + effectiveStrength * (equipmentStrength + 64) / 640
effectiveStrength = strengthLevel + styleBonus + 8

// Apply bonuses
maxHit = floor(maxHit * prayerBonus * otherBonuses)
```

### Network Synchronization

Combat actions need to be synchronized across all clients:

```typescript
// Client initiates attack
world.network.send('combat:attack', {
  attackerId: localPlayer.id,
  targetId: target.id,
  timestamp: Date.now()
});

// Server validates and broadcasts
world.network.broadcast('combat:validated', {
  sessionId: combatSession.id,
  attackerId,
  targetId,
  startTime
});

// All clients display combat
world.network.on('combat:hit', (data) => {
  displayHitSplat(data.targetId, data.damage);
  playAnimation(data.attackerId, 'attack');
});
```

### Integration with Entity System

Combat components will be attached to entities:

```typescript
// Add to player/NPC entities
entity.addComponent('combat', new CombatComponent({
  autoRetaliate: true,
  combatStyle: CombatStyle.AGGRESSIVE,
  attackSpeed: 4, // ticks
}));

entity.addComponent('stats', new StatsComponent({
  attack: { level: 1, xp: 0 },
  strength: { level: 1, xp: 0 },
  defense: { level: 1, xp: 0 },
  hitpoints: { level: 10, xp: 1154, current: 10, max: 10 }
}));
```

### Visual Feedback

#### Hit Splats
- Display damage numbers on hit
- Different colors for different damage types
- Stack multiple hits

#### Combat Animations
- Attack animations based on weapon type
- Block/defend animations
- Death animations

#### Health Bars
- Display above entities in combat
- Update in real-time
- Hide when out of combat

## Performance Considerations

1. **Spatial Indexing**
   - Use octree for efficient range checks
   - Only process combat for nearby entities

2. **Update Frequency**
   - Combat ticks at fixed 600ms intervals
   - Visual updates at frame rate

3. **Memory Management**
   - Pool hit splat objects
   - Clean up expired combat sessions

## Security Considerations

1. **Server Authority**
   - All damage calculations on server
   - Client only sends attack requests
   - Validate all combat actions

2. **Anti-Cheat**
   - Validate attack speed
   - Check maximum possible damage
   - Verify player position/range

## Testing Strategy

1. **Unit Tests**
   - Hit calculation formulas
   - Damage calculations
   - Combat state management

2. **Integration Tests**
   - Multi-player combat scenarios
   - NPC combat behavior
   - Network synchronization

3. **Performance Tests**
   - 100+ simultaneous combats
   - Large-scale PvP scenarios

## Development Phases

### Phase 1: Core Combat (Week 1)
- Basic attack system
- Hit/miss calculations
- Simple damage application

### Phase 2: Visual Feedback (Week 2)
- Hit splats
- Basic animations
- Health bars

### Phase 3: Advanced Features (Week 3)
- Combat styles
- Special attacks
- Multi-combat areas

### Phase 4: Polish (Week 4)
- Performance optimization
- Bug fixes
- Balance adjustments

## Dependencies

- Stats System (for combat stats)
- Entity System (for combat components)
- Animation System (for combat animations)
- Network System (for multiplayer sync)
- Physics System (for line of sight)

## API Reference

```typescript
// Initiate combat
combatSystem.attack(attackerId: string, targetId: string): boolean;

// Check combat status
combatSystem.isInCombat(entityId: string): boolean;

// Get combat session
combatSystem.getCombatSession(entityId: string): CombatSession | null;

// Force end combat
combatSystem.endCombat(entityId: string): void;

// Events
combatSystem.on('combat:start', (session: CombatSession) => {});
combatSystem.on('combat:hit', (hit: HitResult) => {});
combatSystem.on('combat:miss', (miss: MissResult) => {});
combatSystem.on('combat:end', (session: CombatSession) => {});
```

## Configuration

```typescript
interface CombatConfig {
  tickRate: number; // milliseconds between combat ticks (default: 600)
  combatTimeout: number; // seconds before combat ends (default: 10)
  maxAttackRange: number; // maximum melee range (default: 1)
  hitSplatDuration: number; // milliseconds to show hit splat (default: 1000)
}
``` 