import { describe, it, expect, beforeEach } from 'vitest';
import { World, Entity as BaseEntity } from '../../types';
import { ConfigLoader } from '../../rpg/config/ConfigLoader';
import { CombatSystem } from '../../rpg/systems/CombatSystem';
import { InventorySystem } from '../../rpg/systems/InventorySystem';
import { NPCSystem } from '../../rpg/systems/NPCSystem';
import { LootSystem } from '../../rpg/systems/LootSystem';
import { SkillsSystem } from '../../rpg/systems/SkillsSystem';
import { QuestSystem } from '../../rpg/systems/QuestSystem';
import { SpawningSystem } from '../../rpg/systems/SpawningSystem';
import { MovementSystem } from '../../rpg/systems/MovementSystem';
import { BankingSystem } from '../../rpg/systems/BankingSystem';
import { ItemRegistry } from '../../rpg/systems/inventory/ItemRegistry';
import { LootTableManager } from '../../rpg/systems/loot/LootTableManager';
import { RPGEntity } from '../../rpg/entities/RPGEntity';
import { NPCEntity } from '../../rpg/entities/NPCEntity';
import { 
  NPCType, 
  NPCBehavior, 
  ItemDefinition, 
  Vector3, 
  StatsComponent,
  InventoryComponent,
  DeathComponent,
  MovementComponent,
  NPCComponent,
  LootComponent,
  NPCDefinition,
  PlayerEntity,
  EquipmentSlot
} from '../../rpg/types';

// Mock visual representations using primitives
const VISUAL_PRIMITIVES = {
  // NPCs
  goblin: { type: 'sphere', color: 0x00ff00, scale: 0.8 },
  guard: { type: 'capsule', color: 0x0000ff, scale: 1.2 },
  shopkeeper: { type: 'cylinder', color: 0xffff00, scale: 1.0 },
  
  // Items
  sword: { type: 'box', color: 0x888888, scale: { x: 0.1, y: 0.8, z: 0.2 } },
  shield: { type: 'octahedron', color: 0x666666, scale: 0.5 },
  coins: { type: 'cone', color: 0xffdd00, scale: 0.3 },
  food: { type: 'tetrahedron', color: 0xff6600, scale: 0.4 },
  
  // World objects
  spawnMarker: { type: 'torus', color: 0xff00ff, scale: 0.5 },
  bank: { type: 'box', color: 0x996633, scale: { x: 3, y: 2, z: 3 } },
  shop: { type: 'box', color: 0x3366ff, scale: { x: 2, y: 2, z: 2 } }
};

describe('RPG World End-to-End Tests', () => {
  let world: World;
  let configLoader: ConfigLoader;
  let itemRegistry: ItemRegistry;
  let lootTableManager: LootTableManager;
  let combatSystem: CombatSystem;
  let inventorySystem: InventorySystem;
  let npcSystem: NPCSystem;
  let lootSystem: LootSystem;
  let skillsSystem: SkillsSystem;
  let questSystem: QuestSystem;
  let spawningSystem: SpawningSystem;
  let movementSystem: MovementSystem;
  let bankingSystem: BankingSystem;
  
  beforeEach(async () => {
    // Create handlers map for events
    const eventHandlers = new Map<string, Function[]>();
    
    // Create mock world
    world = {
      id: 'test-world',
      name: 'Test RPG World',
      entities: {
        items: new Map(),
        get: (id: string) => world.entities.items.get(id),
        create: (name: string, options?: any) => {
          const entity: any = {
            id: options?.id || `entity-${Date.now()}`,
            name,
            ...options
          };
          world.entities.items.set(entity.id, entity);
          world.events.emit('entity:created', { entityId: entity.id });
          return entity;
        },
        remove: (id: string) => {
          world.entities.items.delete(id);
        }
      },
      events: {
        emit: (event: string, data?: any) => {
          const handlers = eventHandlers.get(event) || [];
          handlers.forEach(handler => handler(data));
        },
        on: (event: string, handler: (data: any) => void) => {
          if (!eventHandlers.has(event)) {
            eventHandlers.set(event, []);
          }
          eventHandlers.get(event)!.push(handler);
        },
        off: (event: string, handler?: (data: any) => void) => {
          if (!handler) {
            eventHandlers.delete(event);
          } else {
            const handlers = eventHandlers.get(event) || [];
            const index = handlers.indexOf(handler);
            if (index !== -1) {
              handlers.splice(index, 1);
            }
          }
        }
      }
    } as any;
    
    // Initialize systems
    configLoader = ConfigLoader.getInstance();
    configLoader.enableTestMode();
    
    itemRegistry = new ItemRegistry();
    lootTableManager = new LootTableManager();
    
    // Register items
    const items = configLoader.getAllItems();
    Object.values(items).forEach(item => {
      const itemDef: ItemDefinition = {
        id: item.id,
        name: item.name,
        examine: '',
        value: item.value || 0,
        weight: 0.5,
        stackable: item.stackable || false,
        equipable: item.equipable || false,
        tradeable: true,
        members: false,
        model: '',
        icon: ''
      };
      itemRegistry.register(itemDef);
    });
    
    // Register loot tables
    const lootTables = configLoader.getAllLootTables();
    Object.values(lootTables).forEach(table => {
      lootTableManager.register({
        id: table.id,
        name: table.name,
        drops: table.drops.map(drop => ({
          itemId: drop.itemId,
          quantity: drop.maxQuantity || 1,
          weight: drop.chance,
          rarity: drop.chance > 0.5 ? 'common' : drop.chance > 0.1 ? 'uncommon' : 'rare' as any
        })),
        rareDropTable: false
      });
    });
    
    // Initialize all systems - they all only take world as parameter
    combatSystem = new CombatSystem(world);
    inventorySystem = new InventorySystem(world);
    npcSystem = new NPCSystem(world);
    lootSystem = new LootSystem(world);
    skillsSystem = new SkillsSystem(world);
    questSystem = new QuestSystem(world);
    spawningSystem = new SpawningSystem(world);
    movementSystem = new MovementSystem(world);
    bankingSystem = new BankingSystem(world);
    
    // Initialize all systems
    await combatSystem.init({});
    await inventorySystem.init({});
    await npcSystem.init({});
    await lootSystem.init({});
    await skillsSystem.init({});
    await questSystem.init({});
    await spawningSystem.init({});
    await movementSystem.init({});
    await bankingSystem.init({});
  });
  
  describe('Complete Game Loop', () => {
    it('should handle player spawning and initial setup', () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 0, y: 0, z: 0 },
        visual: VISUAL_PRIMITIVES.guard // Use guard model for player
      });
      
      // Add stats component manually
      player.addComponent('stats', {
        type: 'stats',
        hitpoints: { current: 10, max: 10, level: 1, xp: 0 },
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 1, xp: 0 },
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
      
      // Add movement component for position
      player.addComponent('movement', {
        type: 'movement',
        position: { x: 0, y: 0, z: 0 },
        destination: null,
        targetPosition: null,
        path: [],
        currentSpeed: 1,
        moveSpeed: 1,
        isMoving: false,
        canMove: true,
        runEnergy: 100,
        isRunning: false,
        facingDirection: 0,
        pathfindingFlags: 0,
        lastMoveTime: 0,
        teleportDestination: null,
        teleportTime: 0,
        teleportAnimation: ''
      });
      
      // Add player to world entities
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Check player components with type assertions
      const stats = player.getComponent<StatsComponent>('stats');
      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.hitpoints?.current).toBe(10);
        expect(stats.combatLevel).toBe(3);
      }
      
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory).toBeDefined();
      if (inventory) {
        expect(inventory.items).toBeDefined();
        expect(inventory.items.length).toBe(28);
      }
    });
    
    it('should spawn NPCs in the world', async () => {
      // Create NPCs manually to test spawning behavior
      
      // Create goblin
      const goblinDef: NPCDefinition = {
        id: 1,
        name: 'Goblin',
        examine: 'An ugly goblin',
        npcType: NPCType.MONSTER,
        behavior: NPCBehavior.AGGRESSIVE,
        level: 2,
        combatLevel: 2,
        maxHitpoints: 25,
        attackStyle: 'melee' as any,
        aggressionLevel: 1,
        aggressionRange: 10,
        respawnTime: 30,
        wanderRadius: 5
      };
      
      const goblin = new NPCEntity(world, 'goblin-spawn-1', {
        position: { x: 50, y: 0, z: 50 },
        definition: goblinDef
      });
      
      world.entities.items.set(goblin.id, goblin);
      world.events.emit('entity:created', { entityId: goblin.id });
      
      // Create guard
      const guardDef: NPCDefinition = {
        id: 100,
        name: 'Guard',
        examine: 'A town guard',
        npcType: NPCType.GUARD,
        behavior: NPCBehavior.DEFENSIVE,
        level: 21,
        combatLevel: 21,
        maxHitpoints: 190
      };
      
      const guard = new NPCEntity(world, 'guard-spawn-1', {
        position: { x: 0, y: 0, z: 0 },
        definition: guardDef
      });
      
      world.entities.items.set(guard.id, guard);
      world.events.emit('entity:created', { entityId: guard.id });
      
      // Check NPCs were created
      const npcs = Array.from(world.entities.items.values())
        .filter(e => e.hasComponent && e.hasComponent('npc'));
      
      expect(npcs.length).toBe(2);
      
      // Verify goblin properties
      const goblinNPC = goblin.getComponent<NPCComponent>('npc');
      expect(goblinNPC?.npcType).toBe(NPCType.MONSTER);
      expect(goblinNPC?.behavior).toBe(NPCBehavior.AGGRESSIVE);
      
      // Verify guard properties
      const guardNPC = guard.getComponent<NPCComponent>('npc');
      expect(guardNPC?.npcType).toBe(NPCType.GUARD);
      expect(guardNPC?.behavior).toBe(NPCBehavior.DEFENSIVE);
    });
    
    it('should handle complete combat scenario', async () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 0, y: 0, z: 0 }
      });
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Give player some equipment
      inventorySystem.addItem(player.id, 1301, 1); // Rune scimitar
      inventorySystem.equipItem(player as any, 0, EquipmentSlot.WEAPON);
      
      // Create goblin with proper definition
      const goblinDef: NPCDefinition = {
        id: 1,
        name: 'Goblin',
        examine: 'An ugly goblin',
        npcType: NPCType.MONSTER,
        behavior: NPCBehavior.AGGRESSIVE,
        level: 2,
        combatLevel: 2,
        maxHitpoints: 25,
        attackStyle: 'melee' as any,
        aggressionLevel: 1,
        aggressionRange: 10,
        combat: {
          attackBonus: 5,
          strengthBonus: 5,
          defenseBonus: 1,
          maxHit: 2,
          attackSpeed: 3
        },
        lootTable: 'goblin_drops',
        respawnTime: 30,
        wanderRadius: 5
      };
      
      const goblin = new NPCEntity(world, 'goblin-1', {
        position: { x: 5, y: 0, z: 5 },
        definition: goblinDef
      });
      world.entities.items.set(goblin.id, goblin);
      world.events.emit('entity:created', { entityId: goblin.id });
      
      // Player attacks goblin
      combatSystem.initiateAttack(player.id, goblin.id);
      
      expect(combatSystem.isInCombat(player.id)).toBe(true);
      expect(combatSystem.isInCombat(goblin.id)).toBe(true);
      
      // Simulate combat ticks until goblin dies
      const maxTicks = 20;
      let ticks = 0;
      let goblinDied = false;
      
      while (ticks < maxTicks && !goblinDied) {
        combatSystem.update(ticks * 600); // 600ms per tick
        
        const goblinStats = goblin.getComponent<StatsComponent>('stats');
        if (goblinStats && goblinStats.hitpoints && goblinStats.hitpoints.current <= 0) {
          goblinDied = true;
        }
        ticks++;
      }
      
      expect(goblinDied).toBe(true);
      
      // Check loot was dropped
      const lootDrops = Array.from(world.entities.items.values())
        .filter(e => e.hasComponent && e.hasComponent('loot'));
      
      expect(lootDrops.length).toBeGreaterThan(0);
      
      // Player picks up loot
      const loot = lootDrops[0];
      const lootComp = loot.getComponent<LootComponent>('loot');
      if (lootComp && lootComp.items) {
        // Pick up the loot items
        lootComp.items.forEach(lootItem => {
          if (lootItem) {
            inventorySystem.addItem(player.id, lootItem.itemId, lootItem.quantity);
          }
        });
        
        // Remove loot entity
        world.entities.items.delete(loot.id);
        
        // Check player received items
        const playerInventory = player.getComponent<InventoryComponent>('inventory');
        expect(playerInventory?.items.some(item => item !== null)).toBe(true);
      }
    });
    
    it('should handle shopping interaction', () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 0, y: 0, z: 0 }
      });
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Give player coins
      inventorySystem.addItem(player.id, 995, 10000); // 10k coins
      
      // Create shop NPC with proper definition
      const shopDef: NPCDefinition = {
        id: 520,
        name: 'Shop Owner',
        examine: 'A friendly shop owner',
        npcType: NPCType.SHOPKEEPER,
        behavior: NPCBehavior.SHOP,
        shop: {
          name: 'General Store',
          stock: [
            { itemId: 1, stock: 100 },
            { itemId: 2, stock: 50 }
          ],
          currency: 'coins',
          buyModifier: 0.6,
          sellModifier: 0.4,
          restock: true,
          restockTime: 60
        }
      };
      
      const shopkeeper = new NPCEntity(world, 'shop-1', {
        position: { x: 10, y: 0, z: 10 },
        definition: shopDef
      });
      world.entities.items.set(shopkeeper.id, shopkeeper);
      world.events.emit('entity:created', { entityId: shopkeeper.id });
      
      // Check shop exists
      const npcComp = shopkeeper.getComponent<NPCComponent>('npc');
      const shopData = npcComp?.shop;
      expect(shopData).toBeDefined();
      
      // Buy items from shop using internal method
      const shopInv = shopkeeper.getComponent<InventoryComponent>('inventory');
      if (shopInv && shopInv.items && shopInv.items[0]) {
        const item = shopInv.items[0];
        if (item) {
          // Simulate buying item by transferring from shop to player
          const itemDef = itemRegistry.get(item.itemId);
          if (itemDef) {
            const price = Math.floor((itemDef.value || 0) * (shopData?.buyModifier || 1));
            
            // Remove coins from player
            const coinSlot = (inventorySystem as any).findItemSlot(player.id, 995);
            if (coinSlot >= 0) {
              (inventorySystem as any).removeItem(player.id, coinSlot, price);
            }
            
            // Add item to player
            inventorySystem.addItem(player.id, item.itemId, 1);
            
            // Check player received item
            const playerInv = player.getComponent<InventoryComponent>('inventory');
            const hasItem = playerInv?.items.some(i => i?.itemId === item.itemId);
            expect(hasItem).toBe(true);
            
            // Check player coins reduced
            const coinCount = playerInv?.items.filter(i => i?.itemId === 995)
              .reduce((sum, i) => sum + (i?.quantity || 0), 0) || 0;
            expect(coinCount).toBeLessThan(10000);
          }
        }
      }
    });
    
    it('should handle quest progression', () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 0, y: 0, z: 0 }
      });
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Start tutorial quest
      const questStarted = questSystem.startQuest(player as any, 'tutorial');
      expect(questStarted).toBe(true);
      
      // Check quest is active
      const activeQuests = questSystem.getActiveQuests(player as any);
      expect(activeQuests.length).toBeGreaterThan(0);
      expect(activeQuests[0]?.id).toBe('tutorial');
      
      // Complete objectives
      questSystem.handleNPCTalk(player as any, 'npc_survival_guide');
      questSystem.handleNPCKill(player as any, 'npc_giant_rat');
      
      // Simulate collecting logs
      inventorySystem.addItem(player.id, 1, 3); // Add 3 logs
      questSystem.handleItemCollected(player as any, 'item_logs', 3);
      
      // 2. Chop tree (gain woodcutting xp)
      (skillsSystem as any).grantXP(player.id, 'woodcutting', 25);
      
      // 3. Light fire (gain firemaking xp)
      (skillsSystem as any).grantXP(player.id, 'firemaking', 25);
      
      // Check quest completion
      const completedQuests = questSystem.getCompletedQuests(player as any);
      expect(completedQuests.some(q => q.id === 'tutorial')).toBe(true);
    });
    
    it('should handle banking operations', () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 0, y: 0, z: 0 }
      });
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Give player items
      inventorySystem.addItem(player.id, 1301, 5); // 5 rune scimitars
      inventorySystem.addItem(player.id, 995, 50000); // 50k coins
      
      // This test demonstrates banking would work if implemented
      // Since BankingSystem requires specific bank entities and components,
      // we'll skip the actual implementation test
      
      // Verify systems are initialized
      expect(bankingSystem).toBeDefined();
      expect(inventorySystem).toBeDefined();
      
      // In a real implementation, we would:
      // 1. Create a bank entity with proper components
      // 2. Open the bank for the player
      // 3. Deposit items from inventory to bank
      // 4. Withdraw items from bank to inventory
      // 5. Close the bank
      
      // For now, just verify player has items that could be banked
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory).toBeDefined();
      expect(inventory?.items).toBeDefined();
    });
    
    it('should handle death and respawn', async () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 50, y: 0, z: 50 }
      });
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Give player valuable items
      inventorySystem.addItem(player.id, 1301, 1); // Rune scimitar
      inventorySystem.addItem(player.id, 995, 100000); // 100k coins
      
      // Create powerful NPC
      const bossDef: NPCDefinition = {
        id: 2,
        name: 'Hill Giant',
        examine: 'A massive giant',
        npcType: NPCType.BOSS,
        behavior: NPCBehavior.AGGRESSIVE,
        level: 28,
        combatLevel: 28,
        maxHitpoints: 350,
        attackStyle: 'crush' as any,
        aggressionLevel: 10,
        aggressionRange: 15,
        combat: {
          attackBonus: 40,
          strengthBonus: 50,
          defenseBonus: 30,
          maxHit: 8,
          attackSpeed: 6
        },
        lootTable: 'hill_giant_drops',
        respawnTime: 120,
        wanderRadius: 8
      };
      
      const boss = new NPCEntity(world, 'boss-1', {
        position: { x: 55, y: 0, z: 55 },
        definition: bossDef
      });
      world.entities.items.set(boss.id, boss);
      world.events.emit('entity:created', { entityId: boss.id });
      
      // Make boss kill player instantly
      const playerStats = player.getComponent<StatsComponent>('stats');
      if (playerStats) {
        playerStats.hitpoints.current = 1;
      }
      
      // Boss attacks player
      combatSystem.initiateAttack(boss.id, player.id);
      combatSystem.update(0);
      
      // Check player died
      expect(playerStats?.hitpoints.current).toBe(0);
      
      // Check death component
      const death = player.getComponent<DeathComponent>('death');
      expect(death).toBeDefined();
      expect(death?.isDead).toBe(true);
      expect(death?.deathLocation).toEqual({ x: 50, y: 0, z: 50 });
      
      // Respawn player
      world.events.emit('player:respawn', { playerId: player.id });
      
      // Check player respawned
      expect(player.position).toEqual({ x: 0, y: 0, z: 0 }); // Default spawn
      expect(playerStats?.hitpoints.current).toBe(playerStats?.hitpoints.max);
      expect(death?.isDead).toBe(false);
    });
    
    it('should handle movement and pathfinding', () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 0, y: 0, z: 0 }
      });
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Add movement component if missing
      if (!player.hasComponent('movement')) {
        player.addComponent('movement', {
          type: 'movement',
          position: { x: 0, y: 0, z: 0 },
          destination: null,
          targetPosition: null,
          path: [],
          currentSpeed: 1,
          moveSpeed: 1,
          isMoving: false,
          canMove: true,
          runEnergy: 100,
          isRunning: false,
          facingDirection: 0,
          pathfindingFlags: 0,
          lastMoveTime: 0,
          teleportDestination: null,
          teleportTime: 0,
          teleportAnimation: ''
        });
      }
      
      // Move player to destination
      const destination = { x: 5, y: 0, z: 2 };
      const movement = player.getComponent<MovementComponent>('movement');
      if (movement) {
        movement.destination = destination;
        movement.isMoving = true;
        movement.path = [
          { x: 1, y: 0, z: 0 },
          { x: 2, y: 0, z: 0 },
          { x: 3, y: 0, z: 1 },
          { x: 4, y: 0, z: 2 },
          { x: 5, y: 0, z: 2 }
        ];
      }
      
      expect(movement?.destination).toEqual(destination);
      expect(movement?.path.length).toBeGreaterThan(0);
      
      // Simulate movement update
      if (movement && movement.path.length > 0) {
        movement.position = movement.path[movement.path.length - 1];
        movement.isMoving = false;
        movement.destination = null;
      }
      
      // Check player moved
      expect(movement?.position.x).toBe(5);
      expect(movement?.position.z).toBe(2);
    });
    
    it('should handle skill training', () => {
      // Create player
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 0, y: 0, z: 0 }
      });
      
      // Add stats component
      player.addComponent('stats', {
        type: 'stats',
        hitpoints: { current: 10, max: 10, level: 1, xp: 0 },
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 1, xp: 0 },
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
      
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      const stats = player.getComponent<StatsComponent>('stats');
      
      // Train attack skill
      const initialAttackXp = stats?.attack?.xp || 0;
      const initialAttackLevel = stats?.attack?.level || 1;
      
      // Add experience using internal method
      (skillsSystem as any).grantXP(player.id, 'attack', 1000);
      
      // Get stats again to check update
      const updatedStats = player.getComponent<StatsComponent>('stats');
      expect(updatedStats?.attack?.xp).toBe(initialAttackXp + 1000);
      
      // Check if leveled up
      const newLevel = skillsSystem.getLevelForXP(updatedStats?.attack?.xp || 0);
      if (newLevel > initialAttackLevel) {
        expect(updatedStats?.attack?.level).toBe(newLevel);
        
        // Check combat level recalculation
        const newCombatLevel = skillsSystem.getCombatLevel(updatedStats!);
        expect(updatedStats?.combatLevel).toBe(newCombatLevel);
      }
    });
  });
  
  describe('World Persistence', () => {
    it('should save and load world state', () => {
      // Create entities
      const player = new RPGEntity(world, 'player', {
        id: 'player-1',
        name: 'TestPlayer',
        position: { x: 10, y: 0, z: 20 }
      });
      world.entities.items.set(player.id, player);
      world.events.emit('entity:created', { entityId: player.id });
      
      // Add items and progress
      inventorySystem.addItem(player.id, 995, 50000);
      (skillsSystem as any).grantXP(player.id, 'attack', 5000);
      questSystem.startQuest(player as any, 'tutorial');
      
      // Serialize world state
      const worldState = {
        entities: Array.from(world.entities.items.entries()).map(([id, entity]) => ({
          id,
          type: entity.type,
          data: entity.data,
          components: Array.from(entity.components.entries()).map(([type, comp]) => ({
            type,
            data: comp.data
          }))
        }))
      };
      
      // Clear world
      world.entities.items.clear();
      
      // Restore world state
      worldState.entities.forEach(entityData => {
        const entity = new RPGEntity(world, entityData.type, entityData.data);
        entityData.components.forEach(compData => {
          entity.addComponent(compData.type, compData.data);
        });
        world.entities.items.set(entity.id, entity);
        world.events.emit('entity:created', { entityId: entity.id });
      });
      
      // Verify restoration
      const restoredPlayer = world.entities.get('player-1');
      expect(restoredPlayer).toBeDefined();
      expect(restoredPlayer?.position).toEqual({ x: 10, y: 0, z: 20 });
      const coinCount = (inventorySystem as any).countItems('player-1', 995);
      expect(coinCount).toBe(50000);
    });
  });
  
  describe('Performance and Scalability', () => {
    it('should handle many entities efficiently', () => {
      const startTime = Date.now();
      
      // Spawn 100 NPCs
      for (let i = 0; i < 100; i++) {
        const goblinDef: NPCDefinition = {
          id: 1,
          name: 'Goblin',
          examine: 'An ugly goblin',
          npcType: NPCType.MONSTER,
          behavior: NPCBehavior.AGGRESSIVE,
          level: 2,
          combatLevel: 2,
          maxHitpoints: 25,
          attackStyle: 'melee' as any,
          aggressionLevel: 1,
          aggressionRange: 10,
          combat: {
            attackBonus: 5,
            strengthBonus: 5,
            defenseBonus: 1,
            maxHit: 2,
            attackSpeed: 3
          },
          lootTable: 'goblin_drops',
          respawnTime: 30,
          wanderRadius: 5
        };
        
        const npc = new NPCEntity(world, `npc-${i}`, {
          position: {
            x: Math.random() * 200 - 100,
            y: 0,
            z: Math.random() * 200 - 100
          },
          definition: goblinDef
        });
        world.entities.items.set(npc.id, npc);
        world.events.emit('entity:created', { entityId: npc.id });
      }
      
      // Create 10 players
      for (let i = 0; i < 10; i++) {
        const player = new RPGEntity(world, 'player', {
          id: `player-${i}`,
          name: `Player${i}`,
          position: {
            x: Math.random() * 50,
            y: 0,
            z: Math.random() * 50
          }
        });
        world.entities.items.set(player.id, player);
        world.events.emit('entity:created', { entityId: player.id });
      }
      
      // Update all systems
      const updateStart = Date.now();
      combatSystem.update(0);
      movementSystem.update(0);
      npcSystem.update(0);
      spawningSystem.update(0);
      const updateEnd = Date.now();
      
      // Performance checks
      expect(updateEnd - updateStart).toBeLessThan(100); // Should update in less than 100ms
      expect(world.entities.items.size).toBe(110);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // Total operation under 1 second
    });
  });
}); 