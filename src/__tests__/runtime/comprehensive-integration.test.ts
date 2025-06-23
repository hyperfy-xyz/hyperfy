import { TestWorld } from './TestWorld';
import { ConfigLoader } from '../../rpg/config/ConfigLoader';

describe('Comprehensive RPG Integration Tests', () => {
  let world: TestWorld;
  let config: ConfigLoader;

  beforeEach(async () => {
    // Enable test mode to avoid file loading issues
    config = ConfigLoader.getInstance();
    config.enableTestMode();
    
    world = new TestWorld();
    // Add timeout for initialization
  }, 10000);

  afterEach(() => {
    // Clean up the test world
    try {
      world.cleanup();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('System Integration', () => {
    it('should have all systems initialized', async () => {
      await world.init();
      
      expect(world.getSystem('combat')).toBeDefined();
      expect(world.getSystem('inventory')).toBeDefined();
      expect(world.getSystem('npc')).toBeDefined();
      expect(world.getSystem('loot')).toBeDefined();
      expect(world.getSystem('movement')).toBeDefined();
      expect(world.getSystem('skills')).toBeDefined();
      expect(world.getSystem('spatialIndex')).toBeDefined();
      expect(world.getSystem('terrain')).toBeDefined();
      expect(world.getSystem('time')).toBeDefined();
    });

    it('should create and manage entities', async () => {
      await world.init();
      
      const player = world.createTestPlayer('player1');
      expect(player).toBeDefined();
      if (player) {
        expect(player.id).toBe('player1');
        
        const stats = player.getComponent('stats');
        expect(stats).toBeDefined();
        expect(stats.hitpoints.current).toBe(100);
      }
    });
  });

  describe('Configuration System', () => {
    it('should load test configurations', () => {
      expect(config.isConfigLoaded()).toBe(true);
      
      // Test NPC configurations
      const goblin = config.getNPC(1);
      expect(goblin).toBeDefined();
      expect(goblin!.name).toBe('Goblin');
      expect(goblin!.dropTable).toBe('goblin_drops');
      
      // Test item configurations
      const bronzeSword = config.getItem(1);
      expect(bronzeSword).toBeDefined();
      expect(bronzeSword!.name).toBe('Bronze Sword');
      expect(bronzeSword!.equipable).toBe(true);
      
      // Test loot table configurations
      const goblinDrops = config.getLootTable('goblin_drops');
      expect(goblinDrops).toBeDefined();
      expect(goblinDrops!.drops.length).toBeGreaterThan(0);
    });
  });

  describe('NPC System Integration', () => {
    it('should spawn NPCs from configuration', async () => {
      await world.init();
      
      const npcSystem = world.getSystem('npc');
      expect(npcSystem).toBeDefined();
      
      if (npcSystem) {
        const goblin = npcSystem.spawnNPC(1, { x: 10, y: 0, z: 10 });
        expect(goblin).toBeDefined();
        
        if (goblin) {
          const npcComponent = goblin.getComponent('npc');
          expect(npcComponent).toBeDefined();
          expect(npcComponent.name).toBe('Goblin');
        }
      }
    });
  });

  describe('Skills System Integration', () => {
    it('should award XP and handle leveling', async () => {
      await world.init();
      
      const player = world.createTestPlayer('player1');
      const skillsSystem = world.getSystem('skills');
      
      if (player && skillsSystem) {
        // Award XP
        skillsSystem.awardExperience(player.id, 'attack', 100);
        
        const skills = player.getComponent('skills');
        expect(skills.attack.experience).toBe(100);
        
        // Check if leveling occurred
        if (skills.attack.experience >= 83) {
          expect(skills.attack.level).toBeGreaterThan(1);
        }
      }
    });
  });

  describe('Performance and Isolation', () => {
    it('should handle multiple worlds independently', async () => {
      // Create a second isolated world
      const config2 = ConfigLoader.getInstance();
      config2.enableTestMode();
      
      const isolatedWorld = new TestWorld();
      await isolatedWorld.init();
      
      // Create entities in both worlds
      const player1 = world.createTestPlayer('player1');
      const player2 = isolatedWorld.createTestPlayer('player2');
      
      if (player1 && player2) {
        // Verify isolation - this is a basic check since we can't directly access entities
        expect(player1.id).toBe('player1');
        expect(player2.id).toBe('player2');
        
        // Test systems work independently
        const movement1 = world.getSystem('movement');
        const movement2 = isolatedWorld.getSystem('movement');
        expect(movement1).toBeDefined();
        expect(movement2).toBeDefined();
        expect(movement1).not.toBe(movement2);
      }
      
      // Clean up isolated world
      try {
        isolatedWorld.cleanup();
      } catch (error) {
        console.warn('Isolated world cleanup error:', error);
      }
    });
  });
}); 