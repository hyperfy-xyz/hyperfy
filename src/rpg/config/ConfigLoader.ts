import * as fs from 'fs/promises';
import * as path from 'path';
import type { NPCDefinition, ItemDefinition, LootTable as LootTableType } from '../types';

// Shop type from NPC definition
type Shop = NPCDefinition['shop'];

// Quest type for now (can be expanded later)
interface Quest {
  id: string;
  name: string;
  description: string;
  requirements?: any;
  rewards?: any;
  steps?: any[];
}

interface ConfigData {
  npcs: Map<number, NPCDefinition>;
  items: Map<number, ItemDefinition>;
  lootTables: Map<string, LootTable>;
  shops: Map<string, Shop>;
  quests: Map<string, Quest>;
  skills: Map<string, any>;
}

interface ItemConfig {
  id: number;
  name: string;
  type: string;
  value?: number;
  stackable?: boolean;
  equipable?: boolean;
  slot?: string;
  stats?: any;
}

interface NPCConfig {
  id: number;
  name: string;
  type?: string;
  level?: number;
  combatLevel?: number;
  behavior?: string;
  aggressionRange?: number;
  wanderRadius?: number;
  aggressionLevel?: number;
  dropTable?: string;
  dialogue?: string;
  faction?: string;
  attackSpeed?: number;
  combatStyle?: string;
  stats?: {
    hitpoints?: number;
    attack?: number;
    strength?: number;
    defence?: number;
    speed?: number;
  };
}

interface LootTable {
  id: string;
  name: string;
  drops: Array<{
    itemId: number;
    chance: number;
    minQuantity?: number;
    maxQuantity?: number;
  }>;
}

interface SkillConfig {
  name: string;
  baseExperience: number;
  experienceTable: number[];
}

interface QuestConfig {
  id: number;
  name: string;
  description: string;
  requirements?: any;
  rewards?: any;
  steps?: any[];
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private configLoaded = false;
  
  // Configuration data
  private npcs: { [key: number]: NPCConfig } = {};
  private items: { [key: number]: ItemConfig } = {};
  private lootTables: { [key: string]: LootTable } = {};
  private skills: { [key: string]: SkillConfig } = {};
  private quests: { [key: number]: QuestConfig } = {};

  private constructor() {
    // Empty constructor - no path needed for test mode
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Enable test mode with hardcoded data
   */
  enableTestMode(): void {
    this.loadTestData();
    this.configLoaded = true;
  }

  /**
   * Load all configurations
   */
  async loadAllConfigurations(): Promise<void> {
    if (this.configLoaded) return;

    // Only use test data if explicitly in test mode
    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      this.enableTestMode();
      return;
    }

    // In production/development, config files are required
    try {
      await this.loadFromFiles();
      this.configLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load configuration files: ${error}. Configuration files are required in non-test environments.`);
    }
  }

  /**
   * Load configurations from files
   */
  private async loadFromFiles(): Promise<void> {
    const configDir = path.join(process.cwd(), 'src/rpg/config');
    
    try {
      // Load NPCs
      const npcFiles = ['monsters.json', 'guards.json', 'quest_givers.json', 'shops.json'];
      for (const file of npcFiles) {
        try {
          const filePath = path.join(configDir, 'npcs', file);
          const data = await fs.readFile(filePath, 'utf-8');
          const npcs = JSON.parse(data);
          Object.assign(this.npcs, npcs);
        } catch (error) {
          console.warn(`Failed to load NPC file ${file}:`, error);
        }
      }

      // Load Items
      const itemFiles = ['basic_items.json', 'food_items.json', 'bones.json'];
      for (const file of itemFiles) {
        try {
          const filePath = path.join(configDir, 'items', file);
          const data = await fs.readFile(filePath, 'utf-8');
          const items = JSON.parse(data);
          Object.assign(this.items, items);
        } catch (error) {
          console.warn(`Failed to load item file ${file}:`, error);
        }
      }

      // Load Loot Tables
      const lootFiles = ['goblin_drops.json', 'skeleton_drops.json', 'hill_giant_drops.json', 'common_drops.json'];
      for (const file of lootFiles) {
        try {
          const filePath = path.join(configDir, 'loot', file);
          const data = await fs.readFile(filePath, 'utf-8');
          const lootTable = JSON.parse(data);
          this.lootTables[lootTable.id] = lootTable;
        } catch (error) {
          console.warn(`Failed to load loot file ${file}:`, error);
        }
      }

      // Load Skills
      const skillFiles = ['combat.json', 'gathering.json'];
      for (const file of skillFiles) {
        try {
          const filePath = path.join(configDir, 'skills', file);
          const data = await fs.readFile(filePath, 'utf-8');
          const skills = JSON.parse(data);
          Object.assign(this.skills, skills);
        } catch (error) {
          console.warn(`Failed to load skill file ${file}:`, error);
        }
      }

      // Load Quests
      const questFiles = ['tutorial_quest.json', 'goblin_menace.json'];
      for (const file of questFiles) {
        try {
          const filePath = path.join(configDir, 'quests', file);
          const data = await fs.readFile(filePath, 'utf-8');
          const quest = JSON.parse(data);
          this.quests[quest.id] = quest;
        } catch (error) {
          console.warn(`Failed to load quest file ${file}:`, error);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load configurations: ${error}`);
    }
  }

  /**
   * Load test data for development and testing
   */
  private loadTestData(): void {
    // Test NPCs
    this.npcs = {
      1: {
        id: 1,
        name: 'Goblin',
        type: 'monster',
        level: 2,
        combatLevel: 2,
        behavior: 'aggressive',
        aggressionRange: 10,
        wanderRadius: 5,
        aggressionLevel: 1,
        dropTable: 'goblin_drops',
        attackSpeed: 3000,
        combatStyle: 'melee',
        stats: {
          hitpoints: 25,
          attack: 5,
          strength: 5,
          defence: 1,
          speed: 4
        }
      },
      2: {
        id: 2,
        name: 'Guard',
        type: 'guard',
        level: 10,
        combatLevel: 15,
        behavior: 'defensive',
        aggressionRange: 5,
        wanderRadius: 3,
        aggressionLevel: 0,
        stats: {
          hitpoints: 100,
          attack: 20,
          strength: 20,
          defence: 25,
          speed: 6
        }
      }
    };

    // Test Items
    this.items = {
      1: {
        id: 1,
        name: 'Bronze Sword',
        type: 'weapon',
        value: 10,
        stackable: false,
        equipable: true,
        slot: 'weapon',
        stats: { attack: 5 }
      },
      2: {
        id: 2,
        name: 'Bread',
        type: 'food',
        value: 5,
        stackable: true,
        equipable: false
      },
      3: {
        id: 3,
        name: 'Bones',
        type: 'material',
        value: 1,
        stackable: true,
        equipable: false
      }
    };

    // Test Loot Tables
    this.lootTables = {
      'goblin_drops': {
        id: 'goblin_drops',
        name: 'Goblin Drops',
        drops: [
          { itemId: 3, chance: 1.0, minQuantity: 1, maxQuantity: 1 }, // Always drop bones
          { itemId: 2, chance: 0.3, minQuantity: 1, maxQuantity: 2 }, // 30% chance for bread
          { itemId: 1, chance: 0.05, minQuantity: 1, maxQuantity: 1 } // 5% chance for bronze sword
        ]
      },
      'common_drops': {
        id: 'common_drops',
        name: 'Common Drops',
        drops: [
          { itemId: 2, chance: 0.5, minQuantity: 1, maxQuantity: 1 }
        ]
      }
    };

    // Test Skills
    this.skills = {
      'attack': {
        name: 'Attack',
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      },
      'strength': {
        name: 'Strength',
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      },
      'defence': {
        name: 'Defence',
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      },
      'hitpoints': {
        name: 'Hitpoints',
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      }
    };

    // Test Quests
    this.quests = {
      1: {
        id: 1,
        name: 'Tutorial Quest',
        description: 'Learn the basics of the game',
        requirements: {},
        rewards: { experience: { attack: 100 }, items: [{ id: 1, quantity: 1 }] },
        steps: []
      },
      2: {
        id: 2,
        name: 'Goblin Menace',
        description: 'Defeat 5 goblins',
        requirements: { level: 2 },
        rewards: { experience: { attack: 500 }, items: [{ id: 2, quantity: 5 }] },
        steps: []
      }
    };
  }

  /**
   * Get NPC configuration by ID
   */
  getNPC(id: number): NPCConfig | null {
    return this.npcs[id] || null;
  }

  /**
   * Get all NPCs
   */
  getAllNPCs(): { [key: number]: NPCConfig } {
    return this.npcs;
  }

  /**
   * Get item configuration by ID
   */
  getItem(id: number): ItemConfig | null {
    return this.items[id] || null;
  }

  /**
   * Get all items
   */
  getAllItems(): { [key: number]: ItemConfig } {
    return this.items;
  }

  /**
   * Get loot table by ID
   */
  getLootTable(id: string): LootTable | null {
    return this.lootTables[id] || null;
  }

  /**
   * Get all loot tables
   */
  getAllLootTables(): { [key: string]: LootTable } {
    return this.lootTables;
  }

  /**
   * Get skill configuration by name
   */
  getSkill(name: string): SkillConfig | null {
    return this.skills[name] || null;
  }

  /**
   * Get all skills
   */
  getAllSkills(): { [key: string]: SkillConfig } {
    return this.skills;
  }

  /**
   * Get quest configuration by ID
   */
  getQuest(id: number): QuestConfig | null {
    return this.quests[id] || null;
  }

  /**
   * Get all quests
   */
  getAllQuests(): { [key: number]: QuestConfig } {
    return this.quests;
  }

  /**
   * Check if configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  /**
   * Reload all configurations
   */
  async reload(): Promise<void> {
    this.configLoaded = false;
    this.npcs = {};
    this.items = {};
    this.lootTables = {};
    this.skills = {};
    this.quests = {};
    
    await this.loadAllConfigurations();
  }
} 