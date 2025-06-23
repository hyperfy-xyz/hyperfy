import type { World } from '../../types';
import { CombatSystem } from '../systems/CombatSystem';
import { RPGEntity } from '../entities/RPGEntity';
import { 
  StatsComponent, 
  CombatComponent, 
  CombatStyle,
  CombatBonuses 
} from '../types';

/**
 * Combat System Demo
 * 
 * This example demonstrates how to set up and use the combat system
 */
export async function runCombatDemo(world: World) {
  console.log('Starting Combat System Demo...');
  
  // Register the combat system
  const combatSystem = world.register('combat', CombatSystem) as CombatSystem;
  
  // Create player entity
  const player = new RPGEntity(world, 'player', {
    id: 'player1',
    name: 'Hero',
    health: 100,
    position: { x: 0, y: 0, z: 0 }
  });
  
  // Add stats component to player
  const playerStats: StatsComponent = {
    type: 'stats',
    entity: player as any,
    data: {},
    hitpoints: {
      current: 100,
      max: 100,
      level: 10,
      xp: 1154
    },
    attack: { level: 75, xp: 1210421 },
    strength: { level: 80, xp: 1986068 },
    defense: { level: 70, xp: 737627 },
    ranged: { level: 60, xp: 273742 },
    magic: { level: 55, xp: 166636 },
    prayer: {
      level: 52,
      xp: 123660,
      points: 52,
      maxPoints: 52
    },
    combatBonuses: createDefaultBonuses(),
    combatLevel: 95,
    totalLevel: 442
  };
  player.addComponent('stats', playerStats);
  
  // Add combat component to player
  const playerCombat: CombatComponent = {
    type: 'combat',
    entity: player as any,
    data: {},
    inCombat: false,
    target: null,
    lastAttackTime: 0,
    attackSpeed: 4, // 4 ticks = 2.4 seconds
    combatStyle: CombatStyle.AGGRESSIVE,
    autoRetaliate: true,
    hitSplatQueue: [],
    animationQueue: [],
    specialAttackEnergy: 100,
    specialAttackActive: false,
    protectionPrayers: {
      melee: false,
      ranged: false,
      magic: false
    }
  };
  player.addComponent('combat', playerCombat);
  
  // Create enemy entity
  const goblin = new RPGEntity(world, 'goblin', {
    id: 'goblin1',
    name: 'Goblin Warrior',
    health: 50,
    position: { x: 5, y: 0, z: 0 }
  });
  
  // Add stats component to goblin
  const goblinStats: StatsComponent = {
    type: 'stats',
    entity: goblin as any,
    data: {},
    hitpoints: {
      current: 10,
      max: 10,
      level: 2,
      xp: 0
    },
    attack: { level: 1, xp: 0 },
    strength: { level: 1, xp: 0 },
    defense: { level: 1, xp: 0 },
    ranged: { level: 1, xp: 0 },
    magic: { level: 1, xp: 0 },
    prayer: {
      level: 1,
      xp: 0,
      points: 0,
      maxPoints: 0
    },
    combatBonuses: createWeakBonuses(),
    combatLevel: 2,
    totalLevel: 6
  };
  goblin.addComponent('stats', goblinStats);
  
  // Add combat component to goblin
  const goblinCombat: CombatComponent = {
    type: 'combat',
    entity: goblin as any,
    data: {},
    inCombat: false,
    target: null,
    lastAttackTime: 0,
    attackSpeed: 4,
    combatStyle: CombatStyle.AGGRESSIVE,
    autoRetaliate: true,
    hitSplatQueue: [],
    animationQueue: [],
    specialAttackEnergy: 0,
    specialAttackActive: false,
    protectionPrayers: {
      melee: false,
      ranged: false,
      magic: false
    }
  };
  goblin.addComponent('combat', goblinCombat);
  
  // Add entities to world
  (world.entities.items as Map<string, any>).set(player.data.id, player);
  (world.entities.items as Map<string, any>).set(goblin.data.id, goblin);
  
  // Listen to combat events
  combatSystem.on('combat:start', (event) => {
    console.log('Combat started:', event.session);
  });
  
  combatSystem.on('combat:hit', (event) => {
    const hit = event.hit;
    console.log(`${hit.attackerId} hit ${hit.targetId} for ${hit.damage} damage!`);
  });
  
  combatSystem.on('combat:damage', (event) => {
    console.log(`${event.targetId} took ${event.damage} damage (${event.remaining} HP remaining)`);
  });
  
  combatSystem.on('entity:death', (event) => {
    console.log(`${event.entityId} was killed by ${event.killerId}!`);
  });
  
  combatSystem.on('combat:end', (event) => {
    console.log('Combat ended:', event.session);
  });
  
  // Start combat
  console.log('\nInitiating combat between player and goblin...');
  const combatStarted = combatSystem.initiateAttack(player.data.id, goblin.data.id);
  
  if (combatStarted) {
    console.log('Combat initiated successfully!');
    
    // Simulate some game ticks
    console.log('\nSimulating combat ticks...');
    let tickCount = 0;
    const maxTicks = 20;
    
    const interval = setInterval(() => {
      tickCount++;
      
      // Update the combat system
      combatSystem.fixedUpdate(600); // 600ms tick
      combatSystem.update(16); // ~60 FPS frame time
      
      // Check if combat is still active
      if (!combatSystem.isInCombat(player.data.id) || tickCount >= maxTicks) {
        clearInterval(interval);
        console.log('\nCombat demo complete!');
        
        // Show final stats
        const finalPlayerStats = player.getComponent<StatsComponent>('stats');
        const finalGoblinStats = goblin.getComponent<StatsComponent>('stats');
        
        console.log('\nFinal Stats:');
        console.log(`Player HP: ${finalPlayerStats?.hitpoints.current}/${finalPlayerStats?.hitpoints.max}`);
        console.log(`Goblin HP: ${finalGoblinStats?.hitpoints.current}/${finalGoblinStats?.hitpoints.max}`);
      }
    }, 600); // Run every combat tick
  } else {
    console.log('Failed to initiate combat!');
  }
}

/**
 * Create default combat bonuses for a well-equipped player
 */
function createDefaultBonuses(): CombatBonuses {
  return {
    attackStab: 65,
    attackSlash: 72,
    attackCrush: 68,
    attackMagic: -15,
    attackRanged: 0,
    defenseStab: 55,
    defenseSlash: 58,
    defenseCrush: 52,
    defenseMagic: -10,
    defenseRanged: 45,
    meleeStrength: 82,
    rangedStrength: 0,
    magicDamage: 0,
    prayerBonus: 4
  };
}

/**
 * Create weak combat bonuses for a basic NPC
 */
function createWeakBonuses(): CombatBonuses {
  return {
    attackStab: 1,
    attackSlash: 1,
    attackCrush: 1,
    attackMagic: 0,
    attackRanged: 0,
    defenseStab: 1,
    defenseSlash: 1,
    defenseCrush: 1,
    defenseMagic: 0,
    defenseRanged: 1,
    meleeStrength: 1,
    rangedStrength: 0,
    magicDamage: 0,
    prayerBonus: 0
  };
} 