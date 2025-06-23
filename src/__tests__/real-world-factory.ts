import { World } from '../core/World';
import type { World as WorldType, WorldOptions } from '../types';
import { CombatSystem } from '../rpg/systems/CombatSystem';
import { InventorySystem } from '../rpg/systems/InventorySystem';
import { NPCSystem } from '../rpg/systems/NPCSystem';
import { LootSystem } from '../rpg/systems/LootSystem';
import { SpawningSystem } from '../rpg/systems/SpawningSystem';
import { SkillsSystem } from '../rpg/systems/SkillsSystem';
import { QuestSystem } from '../rpg/systems/QuestSystem';
import { BankingSystem } from '../rpg/systems/BankingSystem';
import { MovementSystem } from '../rpg/systems/MovementSystem';
import { ConfigLoader } from '../rpg/config/ConfigLoader';
import { Config } from '../core/config';

export interface RealTestWorldOptions extends Partial<WorldOptions> {
  enablePhysics?: boolean;
  configPath?: string;
  enableRPGSystems?: boolean;
}

/**
 * Creates a real test world with actual systems for testing
 * This replaces the mock-based test world factory
 */
export async function createRealTestWorld(options: RealTestWorldOptions = {}): Promise<WorldType> {
  // Enable test mode in config loader
  const configLoader = ConfigLoader.getInstance();
  configLoader.enableTestMode();
  
  const world = new World();
  
  // Register RPG systems if requested (default: true)
  if (options.enableRPGSystems !== false) {
    world.register('combat', CombatSystem as any);
    world.register('inventory', InventorySystem as any);
    world.register('npc', NPCSystem as any);
    world.register('loot', LootSystem as any);
    world.register('spawning', SpawningSystem as any);
    world.register('skills', SkillsSystem as any);
    world.register('quest', QuestSystem as any);
    world.register('banking', BankingSystem as any);
    world.register('movement', MovementSystem as any);
  }
  
  // Initialize world with test-appropriate options using Config system
  const appConfig = Config.get();
  const initOptions: WorldOptions = {
    physics: options.enablePhysics ?? false,
    renderer: 'headless',
    networkRate: options.networkRate ?? appConfig.networkRate,
    maxDeltaTime: options.maxDeltaTime ?? appConfig.maxDeltaTime,
    fixedDeltaTime: options.fixedDeltaTime ?? appConfig.fixedDeltaTime,
    assetsDir: options.assetsDir ?? (appConfig.assetsDir || undefined),
    assetsUrl: options.assetsUrl ?? appConfig.assetsUrl,
    ...options
  };
  
  // Initialize with timeout to prevent hanging
  const initPromise = world.init(initOptions);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('World initialization timed out after 5 seconds')), 5000)
  );
  
  try {
    await Promise.race([initPromise, timeoutPromise]);
  } catch (error) {
    console.error('World initialization failed:', error);
    throw error;
  }
  
  return world as WorldType;
}

/**
 * Creates a minimal test world without RPG systems
 * Useful for testing core functionality
 */
export async function createMinimalTestWorld(options: RealTestWorldOptions = {}): Promise<WorldType> {
  return createRealTestWorld({
    ...options,
    enableRPGSystems: false
  });
}

/**
 * Helper to run world for a specified duration
 */
export async function runWorldFor(world: WorldType, ms: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    world.tick(Date.now());
    await new Promise(resolve => setTimeout(resolve, 16)); // 60fps
  }
}

/**
 * Helper to run world until condition is met
 */
export async function runWorldUntil(
  world: WorldType, 
  condition: () => boolean, 
  timeout = 5000
): Promise<void> {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeout) {
    world.tick(Date.now());
    await new Promise(resolve => setTimeout(resolve, 16));
  }
  if (!condition()) {
    throw new Error('Condition not met within timeout');
  }
}

/**
 * Base class for real test scenarios
 */
export class RealTestScenario {
  world!: WorldType;
  
  async setup(options?: RealTestWorldOptions): Promise<void> {
    this.world = await createRealTestWorld(options);
  }
  
  async spawnPlayer(id: string, options?: any): Promise<any> {
    if (!this.world.entities) {
      throw new Error('Entities system not available');
    }
    
    const player = this.world.entities.create(id);
    if (!player) {
      throw new Error('Failed to create player entity');
    }
    
    // Add standard player components
    player.addComponent('stats', {
      hitpoints: { current: 100, max: 100 },
      attack: { current: 10, max: 10 },
      strength: { current: 10, max: 10 },
      defence: { current: 10, max: 10 },
      speed: { current: 5, max: 5 },
      combatLevel: 1,
      ...options?.stats
    });
    
    player.addComponent('inventory', {
      items: new Map(),
      capacity: 28,
      gold: 100,
      ...options?.inventory
    });
    
    player.addComponent('skills', {
      attack: { level: 1, experience: 0 },
      strength: { level: 1, experience: 0 },
      defence: { level: 1, experience: 0 },
      hitpoints: { level: 10, experience: 0 },
      ...options?.skills
    });
    
    player.addComponent('combat', {
      inCombat: false,
      target: null,
      lastAttack: 0,
      attackCooldown: 4000,
      combatStyle: 'melee',
      ...options?.combat
    });
    
    player.addComponent('movement', {
      position: options?.position || { x: 0, y: 0, z: 0 },
      destination: null,
      moveSpeed: 10,
      isMoving: false,
      facingDirection: 0,
      ...options?.movement
    });
    
    // Set entity position
    player.position = options?.position || { x: 0, y: 0, z: 0 };
    
    return player;
  }
  
  async spawnNPC(definitionId: number, position?: any): Promise<any> {
    const npcSystem = (this.world as any).npc;
    if (!npcSystem) {
      throw new Error('NPC system not available');
    }
    
    return npcSystem.spawnNPC(definitionId, position || { x: 0, y: 0, z: 0 });
  }
  
  async runFor(ms: number): Promise<void> {
    return runWorldFor(this.world, ms);
  }
  
  async runUntil(condition: () => boolean, timeout?: number): Promise<void> {
    return runWorldUntil(this.world, condition, timeout);
  }
  
  async cleanup(): Promise<void> {
    if (this.world) {
      this.world.destroy();
    }
  }
} 