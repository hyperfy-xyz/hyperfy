import { World } from '../../core/World';
import type { WorldOptions } from '../../types';

// Import core systems
import { SpatialIndex } from '../../core/systems/SpatialIndex';
import { Terrain } from '../../core/systems/Terrain';
import { Time } from '../../core/systems/Time';

// Import RPG systems
import { CombatSystem } from '../../rpg/systems/CombatSystem';
import { InventorySystem } from '../../rpg/systems/InventorySystem';
import { NPCSystem } from '../../rpg/systems/NPCSystem';
import { LootSystem } from '../../rpg/systems/LootSystem';
import { MovementSystem } from '../../rpg/systems/MovementSystem';
import { SkillsSystem } from '../../rpg/systems/SkillsSystem';
import { QuestSystem } from '../../rpg/systems/QuestSystem';
import { BankingSystem } from '../../rpg/systems/BankingSystem';
import { SpawningSystem } from '../../rpg/systems/SpawningSystem';

/**
 * Test world implementation for runtime integration testing
 */
export class TestWorld extends World {
  constructor() {
    super();
    
    // Register core systems (with type casting for compatibility)
    this.register('spatialIndex', SpatialIndex as any);
    this.register('terrain', Terrain as any);
    this.register('time', Time as any);
    
    // Register RPG systems
    this.register('combat', CombatSystem);
    this.register('inventory', InventorySystem);
    this.register('npc', NPCSystem);
    this.register('loot', LootSystem);
    this.register('movement', MovementSystem);
    this.register('skills', SkillsSystem);
    this.register('quest', QuestSystem);
    this.register('banking', BankingSystem);
    this.register('spawning', SpawningSystem);
  }
  
  /**
   * Initialize the test world
   */
  async init(options: Partial<WorldOptions> = {}): Promise<void> {
    const defaultOptions: WorldOptions = {
      physics: true,
      renderer: 'headless',
      networkRate: 60,
      maxDeltaTime: 1/30,
      fixedDeltaTime: 1/60,
      ...options
    };
    
    await super.init(defaultOptions);
    
    // Setup test network
    const network = (this as any).network;
    if (network) {
      // Create mock connection for local testing
      const mockConnection = network.createMockConnection('test-client');
      network.addConnection(mockConnection);
    }
  }
  
  /**
   * Run the world for a specific duration
   */
  async run(duration: number): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    while (Date.now() < endTime) {
      const now = Date.now();
      this.tick(now);
      
      // Sleep for fixed timestep
      await new Promise(resolve => setTimeout(resolve, 16)); // ~60 FPS
    }
  }
  
  /**
   * Step the world by one tick
   */
  step(): void {
    const now = Date.now();
    this.tick(now);
  }
  
  /**
   * Get system by name with proper typing
   */
  getSystem<T>(name: string): T | undefined {
    return (this as any)[name] as T;
  }
} 