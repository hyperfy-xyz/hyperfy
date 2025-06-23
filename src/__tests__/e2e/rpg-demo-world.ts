import { RPGEntity } from '../../rpg/entities/RPGEntity';
import { CombatSystem } from '../../rpg/systems/CombatSystem';
import { InventorySystem } from '../../rpg/systems/InventorySystem';
import { LootSystem } from '../../rpg/systems/LootSystem';
import { NPCSystem } from '../../rpg/systems/NPCSystem';
import { SpawningSystem } from '../../rpg/systems/SpawningSystem';
import {
    CombatStyle,
    SpawnerType,
    Vector3
} from '../../rpg/types';
import { World } from '../../types';

/**
 * Demo world setup for E2E testing
 * Creates a small world with various NPCs, mobs, and interactive elements
 */
export class RPGDemoWorld {
  private world: World;
  private systems: {
    npc: NPCSystem;
    combat: CombatSystem;
    inventory: InventorySystem;
    loot: LootSystem;
    spawning: SpawningSystem;
  };

  constructor(world: World) {
    this.world = world;
    this.systems = {
      npc: new NPCSystem(world),
      combat: new CombatSystem(world),
      inventory: new InventorySystem(world),
      loot: new LootSystem(world),
      spawning: new SpawningSystem(world)
    };
  }

  /**
   * Initialize all systems
   */
  async initialize(): Promise<void> {
    // Initialize systems in order
    await this.systems.combat.init({});
    await this.systems.inventory.init({});
    await this.systems.loot.init({});
    await this.systems.npc.init({});
    await this.systems.spawning.init({});

    // Setup spawn points
    this.setupSpawnPoints();
  }

  /**
   * Setup spawn points
   */
  private setupSpawnPoints(): void {
    // Goblin spawn area
    this.systems.spawning.registerSpawner({
      type: SpawnerType.NPC,
      position: { x: 10, y: 0, z: 10 },
      spawnArea: {
        type: 'circle' as const,
        radius: 5,
        avoidOverlap: true,
        minSpacing: 1,
        maxHeight: 0,
        isValidPosition: () => true,
        getRandomPosition: function() {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * this.radius!;
          return {
            x: 10 + Math.cos(angle) * r,
            y: 0,
            z: 10 + Math.sin(angle) * r
          };
        }
      },
      entityDefinitions: [
        { entityType: 'npc', entityId: 2, weight: 100 } // Goblins
      ],
      maxEntities: 3,
      respawnTime: 10000, // 10 seconds
      activationRange: 20,
      deactivationRange: 30
    });

    // Guard patrol area
    this.systems.spawning.registerSpawner({
      type: SpawnerType.NPC,
      position: { x: -10, y: 0, z: -10 },
      entityDefinitions: [
        { entityType: 'npc', entityId: 3, weight: 100 } // Guards
      ],
      maxEntities: 2,
      respawnTime: 30000, // 30 seconds
      activationRange: 15,
      deactivationRange: 25
    });

    // Boss spawn (conditional)
    this.systems.spawning.registerSpawner({
      type: SpawnerType.NPC,
      position: { x: 30, y: 0, z: 30 },
      entityDefinitions: [
        { entityType: 'npc', entityId: 5, weight: 100 } // Goblin Chief
      ],
      maxEntities: 1,
      respawnTime: 120000, // 2 minutes
      activationRange: 30,
      deactivationRange: 40,
      conditions: {
        minPlayers: 1,
        timeOfDay: { start: 0, end: 24 } // Always
      }
    });

    // Static NPCs (non-spawner)
    this.spawnStaticNPCs();
  }

  /**
   * Spawn static NPCs that don't use spawners
   */
  private spawnStaticNPCs(): void {
    // Spawn shopkeeper
    this.systems.npc.spawnNPC(1, { x: 0, y: 0, z: 0 });

    // Spawn quest giver
    this.systems.npc.spawnNPC(100, { x: 5, y: 0, z: 0 });
  }

  /**
   * Get all systems for testing
   */
  getSystems() {
    return this.systems;
  }

  /**
   * Update all systems
   */
  update(delta: number): void {
    // Update in correct order
    this.systems.spawning.fixedUpdate(delta);
    this.systems.npc.update(delta);
    this.systems.combat.fixedUpdate(delta);
    this.systems.combat.update(delta);
    this.systems.loot.update(delta);
  }

  /**
   * Create test scenarios
   */
  createScenarios() {
    const world = this.world;
    const systems = this.systems;
    
    return {
      /**
       * Spawn a player at a specific location
       */
      spawnPlayer: (position: Vector3) => {
        const player = new RPGEntity(world, 'player', {
          id: `player-${Date.now()}`,
          position
        });
        
        world.entities.items.set(player.data.id, player as any);
        
        // Add stats component
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
        
        // Add combat component
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
        
        // Add movement component
        player.addComponent('movement', {
          type: 'movement',
          position: position,
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
        
        return player;
      },

      /**
       * Trigger combat between two entities
       */
      startCombat: (attackerId: string, targetId: string) => {
        return systems.combat.initiateAttack(attackerId, targetId);
      },

      /**
       * Give item to entity
       */
      giveItem: (entityId: string, itemId: number, quantity: number = 1) => {
        return systems.inventory.addItem(entityId, itemId, quantity);
      },

      /**
       * Spawn specific NPC at location
       */
      spawnNPC: (npcId: number, position: Vector3) => {
        return systems.npc.spawnNPC(npcId, position);
      },

      /**
       * Kill entity instantly (for testing death/loot)
       */
      killEntity: (entityId: string) => {
        const entity = world.entities.items.get(entityId) as any;
        if (entity) {
          const stats = entity.getComponent('stats') as any;
          if (stats && stats.hitpoints) {
            stats.hitpoints.current = 0;
            world.events.emit('entity:death', {
              entityId,
              killerId: 'test'
            });
          }
        }
      }
    };
  }
} 