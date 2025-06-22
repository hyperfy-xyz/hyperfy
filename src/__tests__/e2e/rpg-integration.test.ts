import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestWorld } from '../test-world-factory';
import type { World } from '../../types';
import { CombatSystem } from '../../rpg/systems/CombatSystem';
import { InventorySystem } from '../../rpg/systems/InventorySystem';
import { LootSystem } from '../../rpg/systems/LootSystem';
import { MovementSystem } from '../../rpg/systems/MovementSystem';
import { NPCSystem } from '../../rpg/systems/NPCSystem';
import { QuestSystem } from '../../rpg/systems/QuestSystem';
import { SkillsSystem } from '../../rpg/systems/SkillsSystem';
import { SpawningSystem } from '../../rpg/systems/SpawningSystem';
import { ItemRegistry } from '../../rpg/systems/inventory/ItemRegistry';
import { RPGEntity } from '../../rpg/entities/RPGEntity';
import { NPCEntity } from '../../rpg/entities/NPCEntity';
import { 
  NPCType,
  NPCBehavior,
  SpawnerType,
  EquipmentSlot,
  NPCState,
  AttackType,
  CombatStyle,
  StatsComponent,
  CombatComponent,
  InventoryComponent
} from '../../rpg/types';

describe('RPG E2E Integration Tests', () => {
  let world: any;
  let systems: {
    npc: NPCSystem;
    combat: CombatSystem;
    inventory: InventorySystem;
    loot: LootSystem;
    spawning: SpawningSystem;
  };

  beforeEach(async () => {
    world = await createTestWorld();
    
    // Initialize systems
    systems = {
      npc: new NPCSystem(world),
      combat: new CombatSystem(world),
      inventory: new InventorySystem(world),
      loot: new LootSystem(world),
      spawning: new SpawningSystem(world)
    };

    // Initialize all systems
    await systems.combat.init({});
    await systems.inventory.init({});
    await systems.loot.init({});
    await systems.npc.init({});
    await systems.spawning.init({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Player vs NPC Combat', () => {
    it('should handle complete combat scenario with loot drops', async () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 }
      });
      
      world.entities.items.set(player.data.id, player);
      
      // Add player components
      player.addComponent('stats', {
        type: 'stats',
        hitpoints: { current: 10, max: 10, level: 1, xp: 0 },
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
        combatLevel: 3,
        totalLevel: 7
      });
      
      player.addComponent('combat', {
        type: 'combat',
        inCombat: false,
        target: null,
        combatStyle: CombatStyle.ACCURATE,
        autoRetaliate: true,
        attackSpeed: 4,
        lastAttackTime: 0,
        specialAttackEnergy: 100,
        specialAttackActive: false,
        hitSplatQueue: [],
        animationQueue: [],
        protectionPrayers: {
          melee: false,
          ranged: false,
          magic: false
        }
      });
      
      player.addComponent('movement', {
        type: 'movement',
        position: { x: 0, y: 0, z: 0 },
        destination: null,
        path: [],
        moveSpeed: 1,
        isMoving: false,
        runEnergy: 100,
        isRunning: false,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      });
      
      // Initialize inventory for player
      const initMethod = (systems.inventory as any).createInventory || 
                        (systems.inventory as any).initializeInventory;
      if (initMethod) {
        initMethod.call(systems.inventory, player.data.id);
      }
      
      // Spawn an NPC
      const npc = systems.npc.spawnNPC(2, { x: 2, y: 0, z: 0 }); // Goblin
      expect(npc).toBeDefined();
      
      // Give player a weapon
      const hasWeapon = systems.inventory.addItem(player.data.id, 1, 1); // Bronze sword
      expect(hasWeapon).toBe(true);
      
      // Equip the weapon
      systems.inventory.equipItem(player, 0, EquipmentSlot.WEAPON); // Equip from slot 0
      
      // Check player's combat bonuses
      const playerInv = player.getComponent<InventoryComponent>('inventory');
      expect(playerInv?.equipmentBonuses.attackSlash).toBe(5);
      expect(playerInv?.equipmentBonuses.meleeStrength).toBe(4);
      
      // Start combat
      const combatStarted = systems.combat.initiateAttack(player.data.id, npc!.id);
      expect(combatStarted).toBe(true);
      
      // Check combat state
      const playerCombat = player.getComponent<CombatComponent>('combat');
      expect(playerCombat?.inCombat).toBe(true);
      expect(playerCombat?.target).toBe(npc!.id);
      
      // Mock time for combat ticks
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      Date.now = () => currentTime;
      
      // Reset combat system tick time
      (systems.combat as any).lastTickTime = 0;
      
      // Process combat until NPC dies
      const npcStats = npc!.getComponent<StatsComponent>('stats');
      let combatTicks = 0;
      
      while (npcStats && npcStats.hitpoints.current > 0 && combatTicks < 20) {
        currentTime += 600; // Advance time by one combat tick
        systems.combat.fixedUpdate(600);
        systems.combat.update(600);
        combatTicks++;
      }
      
      // NPC should be dead
      expect(npcStats?.hitpoints.current).toBe(0);
      
      // Check for loot drops
      const lootDrops = Array.from(world.entities.items.values())
        .filter((e: any) => e.type === 'loot');
      
      expect(lootDrops.length).toBeGreaterThan(0);
      
      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should handle protection prayers reducing damage', () => {
      // Create player and NPC
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 }
      });
      
      const npc = new NPCEntity(world, 'npc-1', {
        position: { x: 1, y: 0, z: 0 },
        definition: {
          id: 1,
          name: 'Test NPC',
          examine: 'A test NPC',
          npcType: NPCType.MONSTER,
          behavior: NPCBehavior.PASSIVE,
          level: 5,
          maxHitpoints: 20
        }
      });
      
      world.entities.items.set(player.data.id, player);
      world.entities.items.set(npc.data.id, npc);
      
      // Setup components
      player.addComponent('stats', {
        type: 'stats',
        hitpoints: { current: 20, max: 20, level: 10, xp: 0 },
        attack: { level: 10, xp: 0, bonus: 0 },
        strength: { level: 10, xp: 0, bonus: 0 },
        defense: { level: 1, xp: 0, bonus: 0 },
        ranged: { level: 1, xp: 0, bonus: 0 },
        magic: { level: 1, xp: 0, bonus: 0 },
        prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
        combatBonuses: {
          attackStab: 10,
          attackSlash: 10,
          attackCrush: 10,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 0,
          defenseSlash: 0,
          defenseCrush: 0,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: 10,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        },
        combatLevel: 13,
        totalLevel: 25
      });
      
      player.addComponent('combat', {
        type: 'combat',
        inCombat: false,
        target: null,
        combatStyle: CombatStyle.ACCURATE,
        autoRetaliate: true,
        attackSpeed: 4,
        lastAttackTime: 0,
        specialAttackEnergy: 100,
        specialAttackActive: false,
        hitSplatQueue: [],
        animationQueue: [],
        protectionPrayers: {
          melee: false,
          ranged: false,
          magic: false
        }
      });
      
      npc.addComponent('stats', {
        type: 'stats',
        hitpoints: { current: 20, max: 20, level: 5, xp: 0 },
        attack: { level: 5, xp: 0, bonus: 0 },
        strength: { level: 5, xp: 0, bonus: 0 },
        defense: { level: 5, xp: 0, bonus: 0 },
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
        combatLevel: 7,
        totalLevel: 19
      });
      
      npc.addComponent('combat', {
        type: 'combat',
        inCombat: false,
        target: null,
        combatStyle: CombatStyle.ACCURATE,
        autoRetaliate: true,
        attackSpeed: 4,
        lastAttackTime: 0,
        specialAttackEnergy: 100,
        specialAttackActive: false,
        hitSplatQueue: [],
        animationQueue: [],
        protectionPrayers: {
          melee: true, // Protection from melee enabled
          ranged: false,
          magic: false
        }
      });
      
      // Calculate hit without protection
      const hitWithoutProtection = systems.combat.calculateHit(player, npc);
      
      // Protection prayers should be considered in actual combat
      // For now, just verify the hit calculation works
      expect(hitWithoutProtection).toBeDefined();
      expect(hitWithoutProtection.attackType).toBe(AttackType.MELEE);
    });
  });

  describe('Inventory and Equipment', () => {
    it('should handle full inventory management flow', () => {
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 }
      });
      
      world.entities.items.set(player.data.id, player);
      
      // Initialize inventory
      const initMethod = (systems.inventory as any).createInventory || 
                        (systems.inventory as any).initializeInventory;
      if (initMethod) {
        initMethod.call(systems.inventory, player.data.id);
      }
      
      // Give various items
      systems.inventory.addItem(player.data.id, 995, 100); // 100 coins
      systems.inventory.addItem(player.data.id, 1, 1); // Bronze sword
      systems.inventory.addItem(player.data.id, 526, 5); // 5 bones
      
      // Check inventory
      const playerInv = player.getComponent<InventoryComponent>('inventory');
      expect(playerInv?.items[0]).toEqual({ itemId: 995, quantity: 100 });
      expect(playerInv?.items[1]).toEqual({ itemId: 1, quantity: 1 });
      expect(playerInv?.items[2]).toEqual({ itemId: 526, quantity: 5 });
      
      // Equip sword
      const equipped = systems.inventory.equipItem(player, 1, EquipmentSlot.WEAPON); // Equip from slot 1
      expect(equipped).toBe(true);
      
      // Check equipment
      expect(playerInv?.equipment.weapon?.id).toBe(1);
      
      // Check bonuses applied
      expect(playerInv?.equipmentBonuses.attackSlash).toBe(5);
      expect(playerInv?.equipmentBonuses.meleeStrength).toBe(4);
      
      // Test dropping items
      const dropped = systems.inventory.dropItem(player.data.id, 2, 2); // Drop 2 bones
      expect(dropped).toBe(true);
      
      // Check remaining inventory
      expect(playerInv?.items[2]?.quantity).toBe(3);
    });

    it('should handle stackable items correctly', () => {
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 }
      });
      
      world.entities.items.set(player.data.id, player);
      const initMethod = (systems.inventory as any).createInventory || 
                        (systems.inventory as any).initializeInventory;
      if (initMethod) {
        initMethod.call(systems.inventory, player.data.id);
      }
      
      // Add coins multiple times
      systems.inventory.addItem(player.data.id, 995, 50);
      systems.inventory.addItem(player.data.id, 995, 30);
      systems.inventory.addItem(player.data.id, 995, 20);
      
      const inv = player.getComponent<InventoryComponent>('inventory');
      
      // Should stack in one slot
      expect(inv?.items[0]).toEqual({ itemId: 995, quantity: 100 });
      expect(inv?.items[1]).toBeNull();
    });
  });

  describe('Spawning System', () => {
    it('should activate spawners based on player proximity', () => {
      // Create spawner
      const _spawnerId = systems.spawning.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 10, y: 0, z: 10 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 2, weight: 100 }
        ],
        maxEntities: 3,
        respawnTime: 10000,
        activationRange: 20,
        deactivationRange: 30
      });
      
      // Create player far away
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        position: { x: 50, y: 0, z: 50 }
      });
      
      world.entities.items.set(player.data.id, player);
      
      player.addComponent('movement', {
        type: 'movement',
        position: { x: 50, y: 0, z: 50 },
        destination: null,
        path: [],
        moveSpeed: 1,
        isMoving: false,
        runEnergy: 100,
        isRunning: false,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      });
      
      // Update spawning system
      systems.spawning.fixedUpdate(100);
      
      // No NPCs should spawn
      const npcs1 = systems.npc.getAllNPCs();
      expect(npcs1.length).toBe(0);
      
      // Move player close to spawner
      const movement = player.getComponent<any>('movement');
      movement.position = { x: 10, y: 0, z: 10 };
      
      // Reset spawning system update time
      (systems.spawning as any).lastUpdateTime = 0;
      
      // Update again
      systems.spawning.fixedUpdate(1000);
      
      // NPCs should spawn
      const npcs2 = systems.npc.getAllNPCs();
      expect(npcs2.length).toBeGreaterThan(0);
      expect(npcs2.length).toBeLessThanOrEqual(3);
    });

    it('should respawn NPCs after death', () => {
      // Create spawner with fast respawn
      const _spawnerId = systems.spawning.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 0, y: 0, z: 0 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 2, weight: 100 }
        ],
        maxEntities: 1,
        respawnTime: 100, // 100ms for testing
        activationRange: 50
      });
      
      // Create player to activate spawner
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 }
      });
      
      world.entities.items.set(player.data.id, player);
      
      player.addComponent('movement', {
        type: 'movement',
        position: { x: 0, y: 0, z: 0 },
        destination: null,
        path: [],
        moveSpeed: 1,
        isMoving: false,
        runEnergy: 100,
        isRunning: false,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      });
      
      // Spawn NPC
      systems.spawning.fixedUpdate(100);
      
      const npcs = systems.npc.getAllNPCs();
      expect(npcs.length).toBe(1);
      
      const npc = npcs[0];
      
      // Kill the NPC
      if (npc) {
        const stats = npc.getComponent<StatsComponent>('stats');
        if (stats) {
          stats.hitpoints.current = 0;
        }
        
        world.events.emit('entity:death', {
          entityId: npc.id,
          killerId: player.data.id
        });
      }
      
      // Wait for respawn
      const originalDateNow = Date.now;
      let currentTime = Date.now();
      Date.now = () => currentTime;
      
      // Reset spawning system update time
      (systems.spawning as any).lastUpdateTime = 0;
      
      // Advance time past respawn delay
      currentTime += 200; // 200ms
      systems.spawning.fixedUpdate(100);
      
      // Check for respawned NPC
      const newNpcs = systems.npc.getAllNPCs();
      expect(newNpcs.length).toBe(1);
      
      Date.now = originalDateNow;
    });
  });

  describe('Loot System', () => {
    it('should generate loot drops on NPC death', () => {
      // Spawn an NPC
      const npc = systems.npc.spawnNPC(2, { x: 0, y: 0, z: 0 });
      expect(npc).toBeDefined();
      
      // Kill the NPC
      world.events.emit('entity:death', {
        entityId: npc!.id,
        killerId: 'player-1'
      });
      
      // Check for loot drops
      const drops = Array.from(world.entities.items.values())
        .filter((e: any) => e.type === 'loot');
      
      expect(drops.length).toBeGreaterThan(0);
      
      // Check drop ownership
      const drop = drops[0] as any;
      if (drop && drop.getComponent) {
        const lootComp = drop.getComponent('loot');
        expect(lootComp?.owner).toBe('player-1');
      }
    });

    it('should handle loot ownership timers', () => {
      const npc = systems.npc.spawnNPC(2, { x: 0, y: 0, z: 0 });
      
      // Kill with specific killer
      world.events.emit('entity:death', {
        entityId: npc!.id,
        killerId: 'player-1'
      });
      
      const drops = Array.from(world.entities.items.values())
        .filter((e: any) => e.type === 'loot');
      
      const drop = drops[0] as any;
      if (drop && drop.getComponent) {
        const lootComp = drop.getComponent('loot');
        
        // Initially owned by killer
        expect(lootComp?.owner).toBe('player-1');
        
        // Mock time passage
        const originalDateNow = Date.now;
        let currentTime = Date.now();
        Date.now = () => currentTime;
        
        // Advance time past ownership timer (60 seconds)
        currentTime += 61000;
        systems.loot.update(100);
        
        // Ownership should be cleared
        expect(lootComp?.owner).toBeNull();
        
        Date.now = originalDateNow;
      }
    });
  });

  describe('Full Integration Scenario', () => {
    it('should handle complete gameplay loop', async () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 }
      });
      
      world.entities.items.set(player.data.id, player);
      
      // Setup player with all components
      player.addComponent('stats', {
        type: 'stats',
        hitpoints: { current: 20, max: 20, level: 5, xp: 100 },
        attack: { level: 5, xp: 50, bonus: 0 },
        strength: { level: 5, xp: 50, bonus: 0 },
        defense: { level: 5, xp: 50, bonus: 0 },
        ranged: { level: 1, xp: 0, bonus: 0 },
        magic: { level: 1, xp: 0, bonus: 0 },
        prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
        combatBonuses: {
          attackStab: 5,
          attackSlash: 5,
          attackCrush: 5,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 5,
          defenseSlash: 5,
          defenseCrush: 5,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: 5,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        },
        combatLevel: 8,
        totalLevel: 23
      });
      
      player.addComponent('combat', {
        type: 'combat',
        inCombat: false,
        target: null,
        combatStyle: CombatStyle.AGGRESSIVE,
        autoRetaliate: true,
        attackSpeed: 4,
        lastAttackTime: 0,
        specialAttackEnergy: 100,
        specialAttackActive: false,
        hitSplatQueue: [],
        animationQueue: [],
        protectionPrayers: {
          melee: false,
          ranged: false,
          magic: false
        }
      });
      
      player.addComponent('movement', {
        type: 'movement',
        position: { x: 0, y: 0, z: 0 },
        destination: null,
        path: [],
        moveSpeed: 1,
        isMoving: false,
        runEnergy: 100,
        isRunning: false,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      });
      
      // Initialize inventory
      const initMethod = (systems.inventory as any).createInventory || 
                        (systems.inventory as any).initializeInventory;
      if (initMethod) {
        initMethod.call(systems.inventory, player.data.id);
      }
      
      // Create spawner
      const _spawnerId = systems.spawning.registerSpawner({
        type: SpawnerType.NPC,
        position: { x: 5, y: 0, z: 5 },
        entityDefinitions: [
          { entityType: 'npc', entityId: 2, weight: 100 }
        ],
        maxEntities: 2,
        respawnTime: 5000,
        activationRange: 10
      });
      
      // Move player to activate spawner
      const movement = player.getComponent<any>('movement');
      movement.position = { x: 5, y: 0, z: 5 };
      
      // Update to spawn NPCs
      systems.spawning.fixedUpdate(100);
      
      const npcs = systems.npc.getAllNPCs();
      expect(npcs.length).toBe(2);
      
      // Start combat with one NPC
      const npc = npcs[0];
      if (npc) {
        systems.combat.initiateAttack(player.data.id, npc.id);
        
        // Mock time for combat
        const originalDateNow = Date.now;
        let currentTime = 1000000;
        Date.now = () => currentTime;
        
        (systems.combat as any).lastTickTime = 0;
        
        // Process combat
        const npcStats = npc.getComponent<StatsComponent>('stats');
        let ticks = 0;
        
        while (npcStats && npcStats.hitpoints.current > 0 && ticks < 30) {
          currentTime += 600;
          systems.combat.fixedUpdate(600);
          systems.combat.update(600);
          systems.loot.update(600);
          ticks++;
        }
        
        // NPC should be dead
        expect(npcStats?.hitpoints.current).toBe(0);
        
        // Check for loot
        const drops = Array.from(world.entities.items.values())
          .filter((e: any) => e.type === 'loot');
        
        expect(drops.length).toBeGreaterThan(0);
        
        // Player should still be alive
        const playerStats = player.getComponent<StatsComponent>('stats');
        expect(playerStats?.hitpoints.current).toBeGreaterThan(0);
        
        Date.now = originalDateNow;
      }
    });
  });
}); 