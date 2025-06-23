import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LootSystem } from '../../rpg/systems/LootSystem';
import { RPGEntity } from '../../rpg/entities/RPGEntity';
import { MockWorld } from '../test-world-factory';
import type { 
  LootTable,
  LootEntry,
  ItemDrop,
  NPCComponent,
  StatsComponent
} from '../../rpg/types';

describe('LootSystem', () => {
  let world: MockWorld;
  let lootSystem: LootSystem;
  let goblin: RPGEntity;
  let dragon: RPGEntity;
  let player: RPGEntity;

  // Mock loot tables
  const goblinLootTable: LootTable = {
    id: 'goblin_drops',
    name: 'Goblin Drops',
    description: 'Common goblin loot',
    drops: [
      { itemId: 526, quantity: 1, weight: 100, rarity: 'always' }, // Bones
      { itemId: 995, quantity: 3, weight: 50, rarity: 'common' }, // Coins (avg)
      { itemId: 1203, quantity: 1, weight: 20, rarity: 'uncommon' }, // Iron dagger
      { itemId: 1139, quantity: 1, weight: 10, rarity: 'uncommon' }  // Bronze med helm
    ],
    rareDropTable: false,
    // Legacy properties for compatibility
    alwaysDrops: [
      { itemId: 526, quantity: 1 } // Bones
    ],
    commonDrops: [
      { itemId: 995, quantity: { min: 1, max: 5 }, weight: 50 }, // Coins
      { itemId: 1203, quantity: { min: 1, max: 1 }, weight: 20 }, // Iron dagger
      { itemId: 1139, quantity: { min: 1, max: 1 }, weight: 10 }  // Bronze med helm
    ],
    uncommonDrops: [
      { itemId: 1277, quantity: { min: 1, max: 1 }, weight: 5 }, // Mithril dagger
      { itemId: 886, quantity: { min: 5, max: 15 }, weight: 10 } // Steel arrows
    ],
    rareDrops: [
      { itemId: 1319, quantity: { min: 1, max: 1 }, weight: 1 } // Rune 2h sword
    ],
    rareTableAccess: 0.01, // 1% chance to access rare drop table
    maxDrops: 3
  };

  const dragonLootTable: LootTable = {
    id: 'dragon_drops',
    name: 'Dragon Drops',
    description: 'High level dragon loot',
    drops: [
      { itemId: 536, quantity: 1, weight: 100, rarity: 'always' }, // Dragon bones
      { itemId: 1751, quantity: 1, weight: 100, rarity: 'always' }, // Green dragonhide
      { itemId: 995, quantity: 350, weight: 50, rarity: 'common' }, // Coins (avg)
      { itemId: 563, quantity: 40, weight: 20, rarity: 'common' },   // Law runes (avg)
      { itemId: 560, quantity: 22, weight: 20, rarity: 'common' }    // Death runes (avg)
    ],
    rareDropTable: false,
    // Legacy properties for compatibility
    alwaysDrops: [
      { itemId: 536, quantity: 1 }, // Dragon bones
      { itemId: 1751, quantity: 1 }  // Green dragonhide
    ],
    commonDrops: [
      { itemId: 995, quantity: { min: 200, max: 500 }, weight: 50 }, // Coins
      { itemId: 563, quantity: { min: 30, max: 50 }, weight: 20 },   // Law runes
      { itemId: 560, quantity: { min: 15, max: 30 }, weight: 20 }    // Death runes
    ],
    uncommonDrops: [
      { itemId: 1249, quantity: { min: 1, max: 1 }, weight: 10 }, // Dragon spear
      { itemId: 1187, quantity: { min: 1, max: 1 }, weight: 8 }   // Dragon sq shield
    ],
    rareDrops: [
      { itemId: 11286, quantity: { min: 1, max: 1 }, weight: 1 }, // Draconic visage
      { itemId: 1149, quantity: { min: 1, max: 1 }, weight: 2 }   // Dragon med helm
    ],
    rareTableAccess: 0.05, // 5% chance
    maxDrops: 5
  };

  const rareDropTable: LootTable = {
    id: 'rare_drop_table',
    name: 'Rare Drop Table',
    description: 'Global rare drop table',
    drops: [
      { itemId: 985, quantity: 1, weight: 20, rarity: 'common' },    // Tooth half of key
      { itemId: 987, quantity: 1, weight: 20, rarity: 'common' },    // Loop half of key
      { itemId: 1623, quantity: 1, weight: 15, rarity: 'common' },   // Uncut sapphire
      { itemId: 1621, quantity: 1, weight: 10, rarity: 'uncommon' }, // Uncut emerald
      { itemId: 1619, quantity: 1, weight: 8, rarity: 'uncommon' },  // Uncut ruby
      { itemId: 1617, quantity: 1, weight: 5, rarity: 'uncommon' },  // Uncut diamond
      { itemId: 1631, quantity: 1, weight: 1, rarity: 'rare' },      // Uncut dragonstone
      { itemId: 2577, quantity: 1, weight: 0.5, rarity: 'rare' }     // Ranger boots
    ],
    rareDropTable: false,
    // Legacy properties for compatibility
    alwaysDrops: [],
    commonDrops: [
      { itemId: 985, quantity: { min: 1, max: 1 }, weight: 20 },    // Tooth half of key
      { itemId: 987, quantity: { min: 1, max: 1 }, weight: 20 },    // Loop half of key
      { itemId: 1623, quantity: { min: 1, max: 1 }, weight: 15 }    // Uncut sapphire
    ],
    uncommonDrops: [
      { itemId: 1621, quantity: { min: 1, max: 1 }, weight: 10 },   // Uncut emerald
      { itemId: 1619, quantity: { min: 1, max: 1 }, weight: 8 },    // Uncut ruby
      { itemId: 1617, quantity: { min: 1, max: 1 }, weight: 5 }     // Uncut diamond
    ],
    rareDrops: [
      { itemId: 1631, quantity: { min: 1, max: 1 }, weight: 1 },    // Uncut dragonstone
      { itemId: 2577, quantity: { min: 1, max: 1 }, weight: 0.5 }   // Ranger boots
    ],
    rareTableAccess: 0,
    maxDrops: 1
  };

  beforeEach(async () => {
    world = new MockWorld();
    lootSystem = new LootSystem(world as any);
    
    // Initialize the system
    await lootSystem.init({});
    
    // Register loot tables
    (lootSystem as any).registerLootTable(goblinLootTable);
    (lootSystem as any).registerLootTable(dragonLootTable);
    (lootSystem as any).registerRareDropTable(rareDropTable);
    
    // Create NPCs
    goblin = new RPGEntity(world as any, 'npc', {
      id: 'goblin-1',
      name: 'Goblin',
      position: { x: 10, y: 0, z: 10 }
    });
    
    dragon = new RPGEntity(world as any, 'npc', {
      id: 'dragon-1',
      name: 'Green Dragon',
      position: { x: 50, y: 0, z: 50 }
    });
    
    // Create player
    player = new RPGEntity(world as any, 'player', {
      id: 'player-1',
      name: 'Test Player',
      position: { x: 0, y: 0, z: 0 }
    });
    
    // Add entities to world
    world.entities.items.set(goblin.data.id, goblin);
    world.entities.items.set(dragon.data.id, dragon);
    world.entities.items.set(player.data.id, player);
    
    // Add NPC components
    const goblinNPC: NPCComponent = {
      type: 'npc',
      entity: goblin as any,
      data: {},
      npcId: 1,
      name: 'Goblin',
      examine: 'An ugly green creature.',
      npcType: 'monster' as any,
      behavior: 'aggressive' as any,
      faction: 'monsters',
      state: 'idle' as any,
      level: 2,
      combatLevel: 2,
      maxHitpoints: 5,
      currentHitpoints: 5,
      attackStyle: 'melee' as any,
      aggressionLevel: 10,
      aggressionRange: 5,
      attackBonus: 5,
      strengthBonus: 3,
      defenseBonus: 2,
      maxHit: 1,
      attackSpeed: 4,
      respawnTime: 30000,
      wanderRadius: 10,
      spawnPoint: { x: 10, y: 0, z: 10 },
      lootTable: 'goblin_drops',
      currentTarget: null,
      lastInteraction: 0
    };
    
    const dragonNPC: NPCComponent = {
      type: 'npc',
      entity: dragon as any,
      data: {},
      npcId: 2,
      name: 'Green Dragon',
      examine: 'A powerful dragon.',
      npcType: 'monster' as any,
      behavior: 'aggressive' as any,
      faction: 'dragons',
      state: 'idle' as any,
      level: 79,
      combatLevel: 79,
      maxHitpoints: 75,
      currentHitpoints: 75,
      attackStyle: 'melee' as any,
      aggressionLevel: 100,
      aggressionRange: 10,
      attackBonus: 50,
      strengthBonus: 50,
      defenseBonus: 50,
      maxHit: 20,
      attackSpeed: 4,
      respawnTime: 120000,
      wanderRadius: 20,
      spawnPoint: { x: 50, y: 0, z: 50 },
      lootTable: 'dragon_drops',
      currentTarget: null,
      lastInteraction: 0
    };
    
    goblin.addComponent('npc', goblinNPC);
    dragon.addComponent('npc', dragonNPC);
    
    // Add stats components
    const goblinStats: StatsComponent = {
      type: 'stats',
      entity: goblin as any,
      data: {},
      hitpoints: { current: 5, max: 5, level: 2, xp: 0 },
      attack: { level: 1, xp: 0, bonus: 0 },
      strength: { level: 1, xp: 0, bonus: 0 },
      defense: { level: 1, xp: 0, bonus: 0 },
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
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      },
      combatLevel: 2,
      totalLevel: 7
    };
    
    goblin.addComponent('stats', goblinStats);
  });

  describe('initialization', () => {
    it('should register loot tables', () => {
      expect((lootSystem as any).lootTables.has('goblin_drops')).toBe(true);
      expect((lootSystem as any).lootTables.has('dragon_drops')).toBe(true);
      expect((lootSystem as any).rareDropTable).toBeDefined();
    });
  });

  describe('drop generation', () => {
    it('should always include guaranteed drops', () => {
      const drops = lootSystem.generateDrops(goblin.data.id);
      
      // Should always have bones
      const bones = drops.find(drop => drop.itemId === 526);
      expect(bones).toBeDefined();
      expect(bones?.quantity).toBe(1);
    });

    it('should generate random drops from common table', () => {
      // Mock random to ensure we get drops
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.5); // For drop roll
      randomSpy.mockReturnValueOnce(0.1); // For item selection (coins)
      randomSpy.mockReturnValueOnce(0.5); // For quantity
      
      const drops = lootSystem.generateDrops(goblin.data.id);
      
      // Should have bones + at least one other drop
      expect(drops.length).toBeGreaterThanOrEqual(2);
      
      // Check for coins
      const coins = drops.find(drop => drop.itemId === 995);
      if (coins) {
        expect(coins.quantity).toBeGreaterThanOrEqual(1);
        expect(coins.quantity).toBeLessThanOrEqual(5);
      }
      
      randomSpy.mockRestore();
    });

    it('should respect max drops limit', () => {
      // Mock random to always generate drops
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
      
      const drops = lootSystem.generateDrops(goblin.data.id);
      
      // Should not exceed max drops (3) + always drops (1)
      expect(drops.length).toBeLessThanOrEqual(4);
      
      randomSpy.mockRestore();
    });

    it('should handle rare drop table access', () => {
      // Mock random to trigger rare drop table
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.005); // 0.5% - should trigger rare table for goblin
      randomSpy.mockReturnValueOnce(0.1);   // Select from rare table
      
      const drops = lootSystem.generateDrops(goblin.data.id);
      
      // Should have a drop from rare table
      const rareDropIds = [985, 987, 1623, 1621, 1619, 1617, 1631, 2577];
      const hasRareDrop = drops.some(drop => rareDropIds.includes(drop.itemId));
      expect(hasRareDrop).toBe(true);
      
      randomSpy.mockRestore();
    });

    it('should handle NPCs without loot tables', () => {
      // Create NPC without loot table
      const npc = new RPGEntity(world as any, 'npc', {
        id: 'npc-no-loot',
        name: 'No Loot NPC',
        position: { x: 0, y: 0, z: 0 }
      });
      
      npc.addComponent('npc', {
        type: 'npc',
        npcId: 999,
        name: 'No Loot NPC'
      } as NPCComponent);
      
      world.entities.items.set(npc.data.id, npc);
      
      const drops = lootSystem.generateDrops(npc.data.id);
      expect(drops).toEqual([]);
    });
  });

  describe('drop spawning', () => {
    it('should create item drop entities on death', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      // Kill goblin
      world.events.emit('entity:death', {
        entityId: goblin.data.id,
        killerId: player.data.id
      });
      
      // Should emit drop creation events
      const dropEvents = eventSpy.mock.calls.filter(call => call[0] === 'loot:dropped');
      expect(dropEvents.length).toBeGreaterThan(0);
      
      // Check drop has correct properties
      const dropEvent = dropEvents[0]?.[1];
      if (dropEvent) {
        expect(dropEvent).toHaveProperty('position');
        expect(dropEvent).toHaveProperty('itemId');
        expect(dropEvent).toHaveProperty('quantity');
        expect(dropEvent).toHaveProperty('owner', player.data.id);
      }
    });

    it('should randomize drop positions', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      // Mock random for multiple drops with different values for positions
      const randomSpy = vi.spyOn(Math, 'random');
      
      // Dragon has 2 always drops + potentially more
      // Mock values for drop generation
      randomSpy.mockReturnValueOnce(0.1);  // For rare table check
      randomSpy.mockReturnValueOnce(0.1);  // For first common drop
      randomSpy.mockReturnValueOnce(0.1);  // For item selection
      randomSpy.mockReturnValueOnce(0.5);  // For quantity
      
      // Mock values for position randomization
      randomSpy.mockReturnValueOnce(0.2);  // First drop x position
      randomSpy.mockReturnValueOnce(0.3);  // First drop z position
      randomSpy.mockReturnValueOnce(0.7);  // Second drop x position
      randomSpy.mockReturnValueOnce(0.8);  // Second drop z position
      randomSpy.mockReturnValueOnce(0.4);  // Third drop x position
      randomSpy.mockReturnValueOnce(0.6);  // Third drop z position
      
      // Kill dragon (multiple drops)
      world.events.emit('entity:death', {
        entityId: dragon.data.id,
        killerId: player.data.id
      });
      
      // Get all drop positions
      const dropEvents = eventSpy.mock.calls.filter(call => call[0] === 'loot:dropped');
      const positions = dropEvents.map(event => (event[1] as any).position);
      
      // Positions should be slightly different
      if (positions.length > 1) {
        const allSame = positions.every(pos => 
          pos.x === positions[0].x && pos.z === positions[0].z
        );
        expect(allSame).toBe(false);
      }
      
      randomSpy.mockRestore();
    });

    it('should set ownership timer for drops', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      // Kill goblin
      world.events.emit('entity:death', {
        entityId: goblin.data.id,
        killerId: player.data.id
      });
      
      // Check ownership timer
      const dropEvent = eventSpy.mock.calls.find(call => call[0] === 'loot:dropped')?.[1];
      if (dropEvent) {
        expect((dropEvent as any).ownershipTimer).toBe(60000); // 1 minute
        expect((dropEvent as any).despawnTimer).toBe(180000); // 3 minutes
      }
    });
  });

  describe('drop tables', () => {
    it('should calculate drop weights correctly', () => {
      const table = goblinLootTable;
      const totalWeight = (table.commonDrops || []).reduce((sum, drop) => sum + drop.weight, 0);
      expect(totalWeight).toBe(80); // 50 + 20 + 10
    });

    it('should handle quantity ranges', () => {
      // Mock random for quantity
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.5); // For drop roll
      randomSpy.mockReturnValueOnce(0.1); // For item selection (coins)
      randomSpy.mockReturnValueOnce(0.0); // Min quantity
      
      const drops1 = lootSystem.generateDrops(goblin.data.id);
      const coins1 = drops1.find(drop => drop.itemId === 995);
      expect(coins1?.quantity).toBe(1); // Min
      
      randomSpy.mockReturnValueOnce(0.5); // For drop roll
      randomSpy.mockReturnValueOnce(0.1); // For item selection (coins)
      randomSpy.mockReturnValueOnce(1.0); // Max quantity
      
      const drops2 = lootSystem.generateDrops(goblin.data.id);
      const coins2 = drops2.find(drop => drop.itemId === 995);
      expect(coins2?.quantity).toBe(5); // Max
      
      randomSpy.mockRestore();
    });

    it('should handle noted drops', () => {
      // Add noted drop to table
      const notedTable: LootTable = {
        ...goblinLootTable,
        commonDrops: [
          { itemId: 995, quantity: { min: 100, max: 200 }, weight: 50, noted: true }
        ]
      };
      
      (lootSystem as any).registerLootTable(notedTable);
      
      // Mock to get the noted drop
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
      
      const drops = lootSystem.generateDrops(goblin.data.id);
      const notedDrop = drops.find(drop => drop.itemId === 995);
      expect(notedDrop?.noted).toBe(true);
      
      randomSpy.mockRestore();
    });
  });

  describe('drop value calculation', () => {
    it('should calculate total drop value', () => {
      const drops: ItemDrop[] = [
        { itemId: 995, quantity: 100 },  // 100 coins
        { itemId: 1203, quantity: 1 }    // Iron dagger (value depends on item registry)
      ];
      
      const value = (lootSystem as any).calculateDropValue(drops);
      expect(value).toBeGreaterThanOrEqual(100); // At least the coin value
    });
  });

  describe('edge cases', () => {
    it('should handle empty loot tables', () => {
      const emptyTable: LootTable = {
        id: 'empty_table',
        name: 'Empty Table',
        description: 'No drops',
        drops: [],
        rareDropTable: false,
        alwaysDrops: [],
        commonDrops: [],
        uncommonDrops: [],
        rareDrops: [],
        rareTableAccess: 0,
        maxDrops: 0
      };
      
      (lootSystem as any).registerLootTable(emptyTable);
      
      // Create NPC with empty table
      const npc = new RPGEntity(world as any, 'npc', {
        id: 'empty-npc',
        name: 'Empty NPC',
        position: { x: 0, y: 0, z: 0 }
      });
      
      npc.addComponent('npc', {
        type: 'npc',
        lootTable: 'empty_table'
      } as NPCComponent);
      
      world.entities.items.set(npc.data.id, npc);
      
      const drops = lootSystem.generateDrops(npc.data.id);
      expect(drops).toEqual([]);
    });

    it('should handle invalid entity IDs', () => {
      const drops = lootSystem.generateDrops('invalid-id');
      expect(drops).toEqual([]);
    });

    it('should handle NPCs dying without killers', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      // Kill goblin without killer (environmental death)
      world.events.emit('entity:death', {
        entityId: goblin.data.id,
        killerId: null
      });
      
      // Should still drop items but without owner
      const dropEvent = eventSpy.mock.calls.find(call => call[0] === 'loot:dropped')?.[1];
      if (dropEvent) {
        expect((dropEvent as any).owner).toBeNull();
        expect((dropEvent as any).ownershipTimer).toBe(0);
      }
    });
  });
}); 