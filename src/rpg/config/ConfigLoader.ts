import * as fs from 'fs';
import * as path from 'path';
import type { NPCDefinition, ItemDefinition, LootTable } from '../types';

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

export class ConfigLoader {
  private static instance: ConfigLoader;
  private configPath: string;
  private data: ConfigData;
  private isLoaded: boolean = false;
  
  private constructor(configPath?: string) {
    this.configPath = configPath || path.join(__dirname);
    this.data = {
      npcs: new Map(),
      items: new Map(),
      lootTables: new Map(),
      shops: new Map(),
      quests: new Map(),
      skills: new Map()
    };
  }
  
  static getInstance(configPath?: string): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader(configPath);
    }
    return ConfigLoader.instance;
  }
  
  // Load all configuration files
  async loadAll(): Promise<void> {
    if (this.isLoaded) return;
    
    console.log('[ConfigLoader] Loading configuration files...');
    
    try {
      await Promise.all([
        this.loadNPCs(),
        this.loadItems(),
        this.loadLootTables(),
        this.loadShops(),
        this.loadQuests(),
        this.loadSkills()
      ]);
      
      this.isLoaded = true;
      console.log('[ConfigLoader] All configuration files loaded successfully');
    } catch (error) {
      console.error('[ConfigLoader] Error loading configuration:', error);
      throw error;
    }
  }
  
  // Load NPC definitions
  private async loadNPCs(): Promise<void> {
    const npcsPath = path.join(this.configPath, 'npcs');
    const files = await this.getJsonFiles(npcsPath);
    
    for (const file of files) {
      const data = await this.loadJsonFile(path.join(npcsPath, file));
      if (Array.isArray(data)) {
        for (const npc of data) {
          this.data.npcs.set(npc.id, npc);
        }
      } else if (data && typeof data === 'object') {
        this.data.npcs.set(data.id, data);
      }
    }
    
    console.log(`[ConfigLoader] Loaded ${this.data.npcs.size} NPC definitions`);
  }
  
  // Load item definitions
  private async loadItems(): Promise<void> {
    const itemsPath = path.join(this.configPath, 'items');
    const files = await this.getJsonFiles(itemsPath);
    
    for (const file of files) {
      const data = await this.loadJsonFile(path.join(itemsPath, file));
      if (Array.isArray(data)) {
        for (const item of data) {
          this.data.items.set(item.id, item);
        }
      } else if (data && typeof data === 'object') {
        this.data.items.set(data.id, data);
      }
    }
    
    console.log(`[ConfigLoader] Loaded ${this.data.items.size} item definitions`);
  }
  
  // Load loot tables
  private async loadLootTables(): Promise<void> {
    const lootPath = path.join(this.configPath, 'loot');
    const files = await this.getJsonFiles(lootPath);
    
    for (const file of files) {
      const data = await this.loadJsonFile(path.join(lootPath, file));
      if (data && typeof data === 'object') {
        const tableName = path.basename(file, '.json');
        this.data.lootTables.set(data.id || tableName, data);
      }
    }
    
    console.log(`[ConfigLoader] Loaded ${this.data.lootTables.size} loot tables`);
  }
  
  // Load shop definitions
  private async loadShops(): Promise<void> {
    const shopsPath = path.join(this.configPath, 'shops');
    const files = await this.getJsonFiles(shopsPath);
    
    for (const file of files) {
      const data = await this.loadJsonFile(path.join(shopsPath, file));
      if (data && typeof data === 'object') {
        const shopId = data.id || path.basename(file, '.json');
        this.data.shops.set(shopId, data);
      }
    }
    
    console.log(`[ConfigLoader] Loaded ${this.data.shops.size} shop definitions`);
  }
  
  // Load quest definitions
  private async loadQuests(): Promise<void> {
    const questsPath = path.join(this.configPath, 'quests');
    const files = await this.getJsonFiles(questsPath);
    
    for (const file of files) {
      const data = await this.loadJsonFile(path.join(questsPath, file));
      if (data && typeof data === 'object') {
        const questId = data.id || path.basename(file, '.json');
        this.data.quests.set(questId, data);
      }
    }
    
    console.log(`[ConfigLoader] Loaded ${this.data.quests.size} quest definitions`);
  }
  
  // Load skill configurations
  private async loadSkills(): Promise<void> {
    const skillsPath = path.join(this.configPath, 'skills');
    const files = await this.getJsonFiles(skillsPath);
    
    for (const file of files) {
      const data = await this.loadJsonFile(path.join(skillsPath, file));
      if (data && typeof data === 'object') {
        const skillName = path.basename(file, '.json');
        this.data.skills.set(skillName, data);
      }
    }
    
    console.log(`[ConfigLoader] Loaded ${this.data.skills.size} skill configurations`);
  }
  
  // Get all JSON files in a directory
  private async getJsonFiles(dirPath: string): Promise<string[]> {
    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      
      const files = await fs.promises.readdir(dirPath);
      return files.filter(file => file.endsWith('.json'));
    } catch (error) {
      console.warn(`[ConfigLoader] Could not read directory ${dirPath}:`, error);
      return [];
    }
  }
  
  // Load a single JSON file
  private async loadJsonFile(filePath: string): Promise<any> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[ConfigLoader] Error loading ${filePath}:`, error);
      throw error;
    }
  }
  
  // Reload configuration (useful for development)
  async reload(): Promise<void> {
    this.data = {
      npcs: new Map(),
      items: new Map(),
      lootTables: new Map(),
      shops: new Map(),
      quests: new Map(),
      skills: new Map()
    };
    this.isLoaded = false;
    await this.loadAll();
  }
  
  // Getters for configuration data
  getNPC(id: number): NPCDefinition | undefined {
    return this.data.npcs.get(id);
  }
  
  getAllNPCs(): NPCDefinition[] {
    return Array.from(this.data.npcs.values());
  }
  
  getItem(id: number): ItemDefinition | undefined {
    return this.data.items.get(id);
  }
  
  getAllItems(): ItemDefinition[] {
    return Array.from(this.data.items.values());
  }
  
  getLootTable(id: string): LootTable | undefined {
    return this.data.lootTables.get(id);
  }
  
  getShop(id: string): Shop | undefined {
    return this.data.shops.get(id);
  }
  
  getQuest(id: string): Quest | undefined {
    return this.data.quests.get(id);
  }
  
  getSkillConfig(skillName: string): any {
    return this.data.skills.get(skillName);
  }
  
  // Check if configuration is loaded
  isConfigLoaded(): boolean {
    return this.isLoaded;
  }
  
  // Export configuration (for debugging or backup)
  exportConfig(): ConfigData {
    return {
      npcs: new Map(this.data.npcs),
      items: new Map(this.data.items),
      lootTables: new Map(this.data.lootTables),
      shops: new Map(this.data.shops),
      quests: new Map(this.data.quests),
      skills: new Map(this.data.skills)
    };
  }
} 