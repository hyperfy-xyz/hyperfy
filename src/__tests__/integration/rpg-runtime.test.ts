import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRealTestWorld, RealTestScenario } from '../real-world-factory';
import type { World } from '../../types';

describe('RPG Runtime Integration Tests', () => {
  let scenario: RealTestScenario;
  let world: World;

  beforeEach(async () => {
    scenario = new RealTestScenario();
    await scenario.setup({ enablePhysics: false });
    world = scenario.world;
  }, 10000); // Increase timeout to 10 seconds

  afterEach(async () => {
    await scenario.cleanup();
  });

  describe('Real World Initialization', () => {
    it('should create a real world with all RPG systems', async () => {
      expect(world).toBeDefined();
      expect(world.entities).toBeDefined();
      expect(world.events).toBeDefined();
      expect((world as any).combat).toBeDefined();
      expect((world as any).inventory).toBeDefined();
      expect((world as any).npc).toBeDefined();
      expect((world as any).loot).toBeDefined();
      expect((world as any).spawning).toBeDefined();
      expect((world as any).skills).toBeDefined();
      expect((world as any).quest).toBeDefined();
      expect((world as any).banking).toBeDefined();
      expect((world as any).movement).toBeDefined();
    });

    it('should have proper system initialization', async () => {
      // Verify systems are actual instances, not mocks
      const combat = (world as any).combat;
      expect(combat.constructor.name).toBe('CombatSystem');
      expect(typeof combat.initiateAttack).toBe('function');
      expect(typeof combat.calculateHit).toBe('function');
    });
  });

  describe('Combat System - Real Runtime', () => {
    it('should handle real combat between entities', async () => {
      // Create real player and NPC
      const player = await scenario.spawnPlayer('player-1', {
        position: { x: 0, y: 0, z: 0 },
        stats: {
          hitpoints: { current: 50, max: 50 },
          attack: { level: 10 },
          strength: { level: 10 },
          defence: { level: 5 }
        }
      });

      const npc = await scenario.spawnNPC(1, { x: 1, y: 0, z: 1 }); // Goblin
      expect(npc).toBeDefined();

      const combat = (world as any).combat;
      const combatStarted = combat.initiateAttack(player.id, npc.id);
      expect(combatStarted).toBe(true);

      // Run combat for a few ticks
      const startTime = Date.now();
      await scenario.runFor(3000); // 3 seconds of combat

      // Verify combat actually occurred
      const playerStats = player.getComponent('stats');
      const npcStats = npc.getComponent('stats');
      
      // At least one should have taken damage
      expect(
        playerStats.hitpoints.current < playerStats.hitpoints.max ||
        npcStats.hitpoints.current < npcStats.hitpoints.max
      ).toBe(true);
    });

    it('should calculate hits with real damage formulas', async () => {
      const player = await scenario.spawnPlayer('player-1', {
        stats: {
          attack: { level: 50 },
          strength: { level: 50 },
          defence: { level: 1 }
        }
      });

      const npc = await scenario.spawnNPC(1, { x: 1, y: 0, z: 0 });
      
      const combat = (world as any).combat;
      const hit = combat.calculateHit(player, npc);
      
      expect(hit).toBeDefined();
      expect(hit.damage).toBeGreaterThanOrEqual(0);
      expect(hit.damage).toBeLessThanOrEqual(50); // Reasonable max for these levels
      expect(hit.attackType).toBeDefined();
    });
  });

  describe('Inventory System - Real Runtime', () => {
    it('should manage real inventory operations', async () => {
      const player = await scenario.spawnPlayer('player-1');
      const inventory = (world as any).inventory;

      // Add items
      const goldAdded = inventory.addItem(player.id, 995, 100); // 100 coins
      expect(goldAdded).toBe(true);

      const swordAdded = inventory.addItem(player.id, 1, 1); // Bronze sword
      expect(swordAdded).toBe(true);

      // Check inventory state
      const playerInv = player.getComponent('inventory');
      expect(playerInv.items[0]).toEqual({ itemId: 995, quantity: 100 });
      expect(playerInv.items[1]).toEqual({ itemId: 1, quantity: 1 });

      // Equip item
      const equipped = inventory.equipItem(player, 1, 'weapon');
      expect(equipped).toBe(true);

      // Verify equipment bonuses
      expect(playerInv.equipment.weapon).toBeDefined();
      expect(playerInv.equipment.weapon.id).toBe(1);
      expect(playerInv.equipmentBonuses.attackSlash).toBeGreaterThan(0);
    });

    it('should handle stackable items correctly', async () => {
      const player = await scenario.spawnPlayer('player-1');
      const inventory = (world as any).inventory;

      // Add stackable items multiple times
      inventory.addItem(player.id, 995, 50);
      inventory.addItem(player.id, 995, 30);
      inventory.addItem(player.id, 995, 20);

      const playerInv = player.getComponent('inventory');
      
      // Should stack in one slot
      expect(playerInv.items[0]).toEqual({ itemId: 995, quantity: 100 });
      expect(playerInv.items[1]).toBeNull();
    });
  });

  describe('NPC System - Real Runtime', () => {
    it('should spawn NPCs with proper configuration', async () => {
      const npcSystem = (world as any).npc;
      
      const goblin = npcSystem.spawnNPC(1, { x: 10, y: 0, z: 10 });
      expect(goblin).toBeDefined();
      
      const npcComponent = goblin.getComponent('npc');
      expect(npcComponent.name).toBe('Goblin');
      expect(npcComponent.combatLevel).toBe(2);
      expect(npcComponent.behavior).toBe('aggressive');
      
      const stats = goblin.getComponent('stats');
      expect(stats.hitpoints.current).toBe(25);
      expect(stats.hitpoints.max).toBe(25);
    });

    it('should update NPC behavior in real time', async () => {
      const player = await scenario.spawnPlayer('player-1', { 
        position: { x: 0, y: 0, z: 0 } 
      });
      
      const npc = await scenario.spawnNPC(1, { x: 5, y: 0, z: 5 });
      const npcComponent = npc.getComponent('npc');
      
      // NPC should be idle initially
      expect(npcComponent.state).toBe('idle');
      
      // Move player close to aggressive NPC
      player.position = { x: 3, y: 0, z: 3 };
      
      // Update world for behavior processing
      await scenario.runFor(1000); // 1 second
      
      // NPC should have detected player and entered combat
      const combatComponent = npc.getComponent('combat');
      expect(combatComponent.inCombat || npcComponent.state === 'combat').toBe(true);
    });
  });

  describe('Loot System - Real Runtime', () => {
    it('should create loot drops when NPC dies', async () => {
      const player = await scenario.spawnPlayer('player-1', {
        stats: {
          attack: { level: 99 },
          strength: { level: 99 },
          defence: { level: 99 }
        }
      });
      
      const npc = await scenario.spawnNPC(1, { x: 1, y: 0, z: 0 });
      const npcId = npc.id;
      
      // Start combat
      const combat = (world as any).combat;
      combat.initiateAttack(player.id, npcId);
      
      // Run until NPC dies
      await scenario.runUntil(() => {
        const npcEntity = world.entities.get(npcId);
        if (!npcEntity) return true; // NPC removed
        const stats = npcEntity.getComponent('stats') as any;
        return stats ? stats.hitpoints.current <= 0 : false;
      }, 10000);
      
      // Check for loot drops
      const allEntities = Array.from((world.entities as any).items.values()) as any[];
      const lootDrops = allEntities.filter((e: any) => e.type === 'loot');
      
      expect(lootDrops.length).toBeGreaterThan(0);
      
      // Verify loot contains expected items (bones from goblin)
      const loot = lootDrops[0] as any;
      const lootComponent = loot.getComponent('loot') as any;
      expect(lootComponent).toBeDefined();
      expect(lootComponent.items.some((item: any) => item.itemId === 3)).toBe(true); // Bones
    });
  });

  describe('Skills System - Real Runtime', () => {
    it('should award experience and handle leveling', async () => {
      const player = await scenario.spawnPlayer('player-1');
      const skills = (world as any).skills;
      
      // Award experience
      skills.awardExperience(player.id, 'attack', 100);
      
      const playerSkills = player.getComponent('skills');
      expect(playerSkills.attack.experience).toBe(100);
      
      // Check if leveled up (83 xp for level 2)
      expect(playerSkills.attack.level).toBe(2);
      
      // Award more experience
      skills.awardExperience(player.id, 'attack', 500);
      expect(playerSkills.attack.experience).toBe(600);
      expect(playerSkills.attack.level).toBeGreaterThan(2);
    });

    it('should calculate combat level correctly', async () => {
      const player = await scenario.spawnPlayer('player-1', {
        skills: {
          attack: { level: 10, experience: 1000 },
          strength: { level: 10, experience: 1000 },
          defence: { level: 10, experience: 1000 },
          hitpoints: { level: 20, experience: 2000 }
        }
      });
      
      const skills = (world as any).skills;
      const combatLevel = skills.calculateCombatLevel({
        attack: { level: 10 },
        strength: { level: 10 },
        defence: { level: 10 },
        ranged: { level: 1 },
        magic: { level: 1 },
        prayer: { level: 1 },
        hitpoints: { level: 20 }
      });
      
      expect(combatLevel).toBeGreaterThan(1);
      expect(combatLevel).toBeLessThan(50);
    });
  });

  describe('Full Combat Scenario', () => {
    it('should handle complete combat flow with skills, loot, and inventory', async () => {
      const player = await scenario.spawnPlayer('player-1', {
        position: { x: 0, y: 0, z: 0 },
        stats: {
          hitpoints: { current: 100, max: 100 },
          attack: { level: 20 },
          strength: { level: 20 },
          defence: { level: 15 }
        }
      });

      // Give player equipment
      const inventory = (world as any).inventory;
      inventory.addItem(player.id, 1, 1); // Bronze sword
      inventory.equipItem(player, 0, 'weapon');

      // Spawn multiple NPCs
      const npcs: any[] = [];
      for (let i = 0; i < 3; i++) {
        const npc = await scenario.spawnNPC(1, { x: i * 2, y: 0, z: 0 });
        npcs.push(npc);
      }

      // Track events
      const events = {
        combatStarted: 0,
        hits: 0,
        deaths: 0,
        xpGained: 0
      };

      world.events.on('combat:start', () => events.combatStarted++);
      world.events.on('combat:hit', () => events.hits++);
      world.events.on('entity:death', () => events.deaths++);
      world.events.on('skills:xp-gained', () => events.xpGained++);

      // Attack first NPC
      const combat = (world as any).combat;
      combat.initiateAttack(player.id, npcs[0].id);

      // Run combat
      await scenario.runFor(10000); // 10 seconds

      // Verify events occurred
      expect(events.combatStarted).toBeGreaterThan(0);
      expect(events.hits).toBeGreaterThan(0);
      expect(events.deaths).toBeGreaterThan(0);
      expect(events.xpGained).toBeGreaterThan(0);

      // Check player gained experience
      const playerSkills = player.getComponent('skills');
      expect(playerSkills.attack.experience).toBeGreaterThan(0);
    });
  });
}); 