# Hyperfy RPG Module

A comprehensive RPG system for Hyperfy virtual worlds, implementing RuneScape-inspired mechanics for combat, skills, inventory management, NPCs, quests, and more.

## System Overview

### Core Systems

1. **Combat System** (`/systems/CombatSystem.ts`)
   - Turn-based combat with attack speeds
   - Hit chance and damage calculations
   - Combat styles (Accurate, Aggressive, Defensive, etc.)
   - Protection prayers and special attacks
   - Auto-retaliation mechanics

2. **Inventory System** (`/systems/InventorySystem.ts`)
   - 28-slot inventory with weight management
   - Equipment system with 11 slots
   - Item stacking for stackable items
   - Equipment bonuses calculation
   - Item dropping and picking up

3. **NPC System** (`/systems/NPCSystem.ts`)
   - Multiple NPC types (monsters, guards, shopkeepers, etc.)
   - Behavior patterns (aggressive, passive, patrol, etc.)
   - Shop management with buying/selling
   - NPC dialogue system
   - Respawn mechanics

4. **Loot System** (`/systems/LootSystem.ts`)
   - Configurable loot tables with rarity tiers
   - Ownership system (60-second timer)
   - Automatic despawn after 3 minutes
   - Drop positioning and visibility

5. **Skills System** (`/systems/SkillsSystem.ts`)
   - 23 skills with experience tracking
   - Level calculation (max level 99)
   - Combat level calculation
   - Skill milestones and achievements

6. **Quest System** (`/systems/QuestSystem.ts`)
   - Quest objectives with progress tracking
   - Requirements checking (skills, items, quests)
   - Reward distribution
   - Quest state persistence

7. **Banking System** (`/systems/BankingSystem.ts`)
   - 816 slots across 9 tabs
   - PIN protection system
   - Deposit/withdraw operations
   - Note system for items

8. **Movement System** (`/systems/MovementSystem.ts`)
   - A* pathfinding with obstacle avoidance
   - Run energy management
   - Teleportation support
   - Collision detection

9. **Spawning System** (`/systems/SpawningSystem.ts`)
   - Area-based NPC spawning
   - Proximity activation
   - Respawn timers
   - Spatial indexing for performance

## Implementation Status

### ✅ Fully Implemented
- Combat mechanics with OSRS-accurate formulas
- Complete inventory and equipment system
- NPC behaviors and interactions
- Loot tables and drop mechanics
- All 23 skills with XP tables
- Quest framework with objectives
- Banking with all features
- Pathfinding and movement
- Spawning and despawning

### 🔧 Partially Implemented
- Network synchronization (stubbed)
- Death/respawn mechanics (basic implementation)
- Some visual effects and animations

### ❌ Not Yet Implemented
- PvP mechanics
- Trading between players
- Grand Exchange
- Minigames
- Clans/Friends system

## Configuration

All game data is stored in JSON configuration files:

```
/config/
  /items/          # Item definitions
  /npcs/           # NPC definitions  
  /loot/           # Loot tables
  /quests/         # Quest definitions
  /skills/         # Skill configurations
```

## Testing

### Unit Tests
Located in `src/__tests__/systems/`:
- `combat.test.ts` - Combat system tests
- `inventory.test.ts` - Inventory system tests

### Integration Tests  
Located in `src/__tests__/runtime/`:
- `rpg-integration.test.ts` - System integration tests

### End-to-End Tests
Located in `src/__tests__/e2e/`:
- `rpg-world.test.ts` - Complete game loop tests

Run tests with:
```bash
npm test
```

## Usage Example

```typescript
import { World } from '@hyperfy/sdk';
import { 
  CombatSystem,
  InventorySystem,
  NPCSystem,
  // ... other systems
} from './rpg';

// Initialize world
const world = new World();

// Create systems
const combat = new CombatSystem(world);
const inventory = new InventorySystem(world);
const npcs = new NPCSystem(world);

// Initialize systems
await combat.init({});
await inventory.init({});
await npcs.init({});

// Create player
const player = world.createEntity('player', {
  position: { x: 0, y: 0, z: 0 },
  name: 'PlayerName'
});

// Player can now interact with the RPG systems
inventory.addItem(player.id, 995, 1000); // Add 1000 coins
combat.initiateAttack(player.id, goblin.id); // Attack goblin
```

## Visual Primitives

The system uses geometric primitives to represent game objects:

- **NPCs**: Spheres, capsules, cylinders
- **Items**: Boxes, cones, tetrahedrons  
- **World Objects**: Boxes for banks/shops, torus for spawn markers

## Performance Considerations

- Spatial indexing for entity queries
- Proximity-based NPC activation
- Efficient pathfinding with caching
- Component-based architecture for memory efficiency

## Review Findings

### Strengths
1. **Complete Core Systems**: All major RPG systems are implemented
2. **Modular Architecture**: Clean separation of concerns
3. **Configuration-Driven**: Easy to modify game data
4. **OSRS Accuracy**: Combat formulas match OSRS mechanics
5. **Comprehensive Testing**: Good test coverage for critical systems

### Areas for Improvement
1. **Network Sync**: Needs full implementation for multiplayer
2. **Visual Polish**: Animations and effects are basic
3. **Error Handling**: Some edge cases need better handling
4. **Documentation**: API documentation could be more detailed
5. **Performance**: Could optimize for 1000+ entities

### Recommendations
1. Implement proper network synchronization
2. Add more comprehensive error handling
3. Create visual effect system for combat
4. Add player trading system
5. Implement Grand Exchange
6. Add more quest content
7. Create tutorial/onboarding flow

## Contributing

When adding new features:
1. Follow the existing component-based architecture
2. Add appropriate unit tests
3. Update configuration files as needed
4. Document new systems in this README
5. Ensure compatibility with existing systems

## License

This module is part of the Hyperfy platform and follows the main project's licensing terms. 