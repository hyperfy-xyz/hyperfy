import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuestSystem } from '../../rpg/systems/QuestSystem';
import { createTestWorld } from '../test-world-factory';
import type { World } from '../../types';
import type { PlayerEntity, StatsComponent, InventoryComponent } from '../../rpg/types';
import type { QuestDefinition, QuestObjective } from '../../rpg/systems/QuestSystem';

describe('QuestSystem', () => {
  let world: World;
  let questSystem: QuestSystem;
  let mockPlayer: PlayerEntity;
  let mockSkillsSystem: any;
  let mockInventorySystem: any;

  beforeEach(async () => {
    world = await createTestWorld();
    questSystem = new QuestSystem(world);

    // Mock systems
    mockSkillsSystem = {
      addExperience: vi.fn()
    };
    
    mockInventorySystem = {
      addItem: vi.fn()
    };

    world.systems.push(mockSkillsSystem);
    world.systems.push(mockInventorySystem);

    // Create mock player
    const statsComponent: StatsComponent = {
      type: 'stats',
      entity: {} as any,
      data: {},
      combatLevel: 3,
      totalLevel: 32,
      hitpoints: { current: 10, max: 10, level: 10, xp: 1154 },
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defense: { level: 1, xp: 0 },
      ranged: { level: 1, xp: 0 },
      magic: { level: 1, xp: 0 },
      prayer: { level: 1, xp: 0, points: 1, maxPoints: 1 },
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
      }
    };

    const inventoryComponent: InventoryComponent = {
      type: 'inventory',
      entity: {} as any,
      data: {},
      items: new Array(28).fill(null),
      maxSlots: 28,
      equipment: {
        head: null,
        cape: null,
        amulet: null,
        weapon: null,
        body: null,
        shield: null,
        legs: null,
        gloves: null,
        boots: null,
        ring: null,
        ammo: null
      },
      totalWeight: 0,
      equipmentBonuses: {
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
      }
    };

    mockPlayer = {
      id: 'player_1',
      type: 'player',
      position: { x: 0, y: 0, z: 0 },
      data: { type: 'player', id: 'player_1' },
      getComponent: vi.fn().mockImplementation((type: string) => {
        if (type === 'stats') return statsComponent;
        if (type === 'inventory') return inventoryComponent;
        return null;
      }) as any
    } as PlayerEntity;
  });

  describe('Quest Registration', () => {
    it('should register a quest definition', () => {
      const quest: QuestDefinition = {
        id: 'test_quest',
        name: 'Test Quest',
        description: 'A test quest',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      const allQuests = questSystem.getAllQuests();
      
      expect(allQuests).toHaveLength(2); // Tutorial + test quest
      expect(allQuests.find(q => q.id === 'test_quest')).toBeDefined();
    });

    it('should emit quest:registered event', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');
      const quest: QuestDefinition = {
        id: 'test_quest',
        name: 'Test Quest',
        description: 'A test quest',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      expect(emitSpy).toHaveBeenCalledWith('quest:registered', { questId: 'test_quest' });
    });
  });

  describe('Quest Requirements', () => {
    it('should check quest prerequisites', () => {
      const quest: QuestDefinition = {
        id: 'advanced_quest',
        name: 'Advanced Quest',
        description: 'Requires tutorial completion',
        difficulty: 'intermediate',
        questPoints: 2,
        requirements: {
          quests: ['tutorial']
        },
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      const canStart = questSystem.canStartQuest(mockPlayer, 'advanced_quest');
      expect(canStart.canStart).toBe(false);
      expect(canStart.reason).toBe('Must complete quest: tutorial');
    });

    it('should check skill requirements', () => {
      const quest: QuestDefinition = {
        id: 'skill_quest',
        name: 'Skill Quest',
        description: 'Requires level 10 attack',
        difficulty: 'intermediate',
        questPoints: 2,
        requirements: {
          skills: [{ skill: 'attack', level: 10 }]
        },
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      const canStart = questSystem.canStartQuest(mockPlayer, 'skill_quest');
      expect(canStart.canStart).toBe(false);
      expect(canStart.reason).toBe('Requires attack level 10');
    });

    it('should check item requirements', () => {
      const quest: QuestDefinition = {
        id: 'item_quest',
        name: 'Item Quest',
        description: 'Requires specific items',
        difficulty: 'novice',
        questPoints: 1,
        requirements: {
          items: [{ itemId: 1001, quantity: 1 }]
        },
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      const canStart = questSystem.canStartQuest(mockPlayer, 'item_quest');
      expect(canStart.canStart).toBe(false);
      expect(canStart.reason).toBe('Requires 1 of item 1001');
    });

    it('should allow starting quest when all requirements are met', () => {
      const quest: QuestDefinition = {
        id: 'simple_quest',
        name: 'Simple Quest',
        description: 'No requirements',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      const canStart = questSystem.canStartQuest(mockPlayer, 'simple_quest');
      expect(canStart.canStart).toBe(true);
    });
  });

  describe('Quest Start Handlers', () => {
    it('should use custom start handler', () => {
      const quest: QuestDefinition = {
        id: 'handler_quest',
        name: 'Handler Quest',
        description: 'Has custom start handler',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      const startHandler = vi.fn().mockReturnValue(false);
      questSystem.registerQuestStartHandler('handler_quest', startHandler);
      
      const canStart = questSystem.canStartQuest(mockPlayer, 'handler_quest');
      expect(canStart.canStart).toBe(false);
      expect(canStart.reason).toBe('Quest cannot be started at this time');
      expect(startHandler).toHaveBeenCalledWith(mockPlayer);
    });
  });

  describe('Starting Quests', () => {
    it('should start a quest successfully', () => {
      const quest: QuestDefinition = {
        id: 'start_quest',
        name: 'Start Quest',
        description: 'Test starting',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [
          {
            id: 'obj1',
            type: 'kill',
            description: 'Kill 5 goblins',
            target: 'npc_goblin',
            quantity: 5,
            current: 0,
            completed: false
          }
        ],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      const started = questSystem.startQuest(mockPlayer, 'start_quest');
      expect(started).toBe(true);
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'start_quest');
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('in_progress');
      expect(progress?.objectives).toHaveLength(1);
      expect(progress?.objectives[0].current).toBe(0);
    });

    it('should emit quest:started event', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');
      const quest: QuestDefinition = {
        id: 'event_quest',
        name: 'Event Quest',
        description: 'Test events',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      questSystem.startQuest(mockPlayer, 'event_quest');
      
      expect(emitSpy).toHaveBeenCalledWith('quest:started', {
        playerId: 'player_1',
        questId: 'event_quest',
        questName: 'Event Quest'
      });
    });

    it('should not start already started quest', () => {
      const quest: QuestDefinition = {
        id: 'once_quest',
        name: 'Once Quest',
        description: 'Can only start once',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      questSystem.startQuest(mockPlayer, 'once_quest');
      
      const canStart = questSystem.canStartQuest(mockPlayer, 'once_quest');
      expect(canStart.canStart).toBe(false);
      expect(canStart.reason).toBe('Quest already started or completed');
    });
  });

  describe('Objective Progress', () => {
    let testQuest: QuestDefinition;

    beforeEach(() => {
      testQuest = {
        id: 'objective_quest',
        name: 'Objective Quest',
        description: 'Test objectives',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [
          {
            id: 'kill_goblins',
            type: 'kill',
            description: 'Kill 3 goblins',
            target: 'npc_goblin',
            quantity: 3,
            current: 0,
            completed: false
          },
          {
            id: 'collect_items',
            type: 'collect',
            description: 'Collect 5 logs',
            target: 'item_logs',
            quantity: 5,
            current: 0,
            completed: false
          }
        ],
        rewards: {
          experience: [{ skill: 'attack', amount: 100 }],
          items: [{ itemId: 995, quantity: 100 }], // 100 gold
          questPoints: 1
        }
      };

      questSystem.registerQuest(testQuest);
      questSystem.startQuest(mockPlayer, 'objective_quest');
    });

    it('should update kill objectives', () => {
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'objective_quest');
      expect(progress?.objectives[0].current).toBe(1);
      expect(progress?.objectives[0].completed).toBe(false);
    });

    it('should complete kill objective when target reached', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');
      
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'objective_quest');
      expect(progress?.objectives[0].current).toBe(3);
      expect(progress?.objectives[0].completed).toBe(true);
      
      expect(emitSpy).toHaveBeenCalledWith('quest:objective_complete', {
        playerId: 'player_1',
        questId: 'objective_quest',
        objectiveId: 'kill_goblins',
        objectiveDescription: 'Kill 3 goblins'
      });
    });

    it('should update collect objectives based on inventory', () => {
      // Add logs to inventory
      const inventory = mockPlayer.getComponent('inventory') as InventoryComponent;
      inventory.items[0] = { itemId: 1, quantity: 3 }; // Assuming logs are item ID 1
      
      questSystem.handleItemCollected(mockPlayer, 'item_logs', 3);
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'objective_quest');
      expect(progress?.objectives[1].current).toBe(3);
      expect(progress?.objectives[1].completed).toBe(false);
    });

    it('should update talk objectives', () => {
      const talkQuest: QuestDefinition = {
        id: 'talk_quest',
        name: 'Talk Quest',
        description: 'Talk to NPCs',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [
          {
            id: 'talk_to_guide',
            type: 'talk',
            description: 'Talk to the guide',
            target: 'npc_guide',
            quantity: 1,
            current: 0,
            completed: false
          }
        ],
        rewards: {}
      };

      questSystem.registerQuest(talkQuest);
      questSystem.startQuest(mockPlayer, 'talk_quest');
      
      questSystem.handleNPCTalk(mockPlayer, 'npc_guide');
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'talk_quest');
      expect(progress?.objectives[0].completed).toBe(true);
    });

    it('should not update objectives for wrong targets', () => {
      questSystem.handleNPCKill(mockPlayer, 'npc_guard'); // Wrong NPC
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'objective_quest');
      expect(progress?.objectives[0].current).toBe(0);
    });

    it('should not update completed objectives', () => {
      // Complete the kill objective
      questSystem.updateObjective(mockPlayer, 'objective_quest', 'kill_goblins', 3);
      
      // Try to update again
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'objective_quest');
      expect(progress?.objectives[0].current).toBe(3); // Still 3, not 4
    });
  });

  describe('Quest Completion', () => {
    let completionQuest: QuestDefinition;

    beforeEach(() => {
      completionQuest = {
        id: 'completion_quest',
        name: 'Completion Quest',
        description: 'Test completion',
        difficulty: 'novice',
        questPoints: 2,
        objectives: [
          {
            id: 'simple_task',
            type: 'kill',
            description: 'Kill 1 goblin',
            target: 'npc_goblin',
            quantity: 1,
            current: 0,
            completed: false
          }
        ],
        rewards: {
          experience: [
            { skill: 'attack', amount: 250 },
            { skill: 'strength', amount: 250 }
          ],
          items: [
            { itemId: 1001, quantity: 1 },
            { itemId: 995, quantity: 500 }
          ],
          gold: 1000,
          unlocks: ['advanced_area', 'next_quest']
        }
      };

      questSystem.registerQuest(completionQuest);
      questSystem.startQuest(mockPlayer, 'completion_quest');
    });

    it('should complete quest when all objectives are done', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');
      
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'completion_quest');
      expect(progress?.status).toBe('completed');
      expect(progress?.completedAt).toBeDefined();
      
      expect(emitSpy).toHaveBeenCalledWith('quest:completed', {
        playerId: 'player_1',
        questId: 'completion_quest',
        questName: 'Completion Quest',
        rewards: completionQuest.rewards
      });
    });

    it('should grant experience rewards', () => {
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      expect(mockSkillsSystem.addExperience).toHaveBeenCalledWith(mockPlayer, 'attack', 250);
      expect(mockSkillsSystem.addExperience).toHaveBeenCalledWith(mockPlayer, 'strength', 250);
    });

    it('should grant item rewards', () => {
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      expect(mockInventorySystem.addItem).toHaveBeenCalledWith(mockPlayer, 1001, 1);
      expect(mockInventorySystem.addItem).toHaveBeenCalledWith(mockPlayer, 995, 500);
    });

    it('should grant gold rewards', () => {
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      // Gold is added as item 995
      expect(mockInventorySystem.addItem).toHaveBeenCalledWith(mockPlayer, 995, 1000);
    });

    it('should emit unlock events', () => {
      const emitSpy = vi.spyOn(world.events, 'emit');
      
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      expect(emitSpy).toHaveBeenCalledWith('quest:unlock', {
        playerId: 'player_1',
        unlock: 'advanced_area'
      });
      expect(emitSpy).toHaveBeenCalledWith('quest:unlock', {
        playerId: 'player_1',
        unlock: 'next_quest'
      });
    });

    it('should call completion handler if registered', () => {
      const completeHandler = vi.fn();
      questSystem.registerQuestCompleteHandler('completion_quest', completeHandler);
      
      questSystem.handleNPCKill(mockPlayer, 'npc_goblin');
      
      expect(completeHandler).toHaveBeenCalledWith(mockPlayer);
    });
  });

  describe('Quest Queries', () => {
    beforeEach(() => {
      // Register multiple quests
      const quests: QuestDefinition[] = [
        {
          id: 'quest1',
          name: 'Quest 1',
          description: 'First quest',
          difficulty: 'novice',
          questPoints: 1,
          objectives: [],
          rewards: {}
        },
        {
          id: 'quest2',
          name: 'Quest 2',
          description: 'Second quest',
          difficulty: 'intermediate',
          questPoints: 2,
          requirements: { quests: ['quest1'] },
          objectives: [],
          rewards: {}
        },
        {
          id: 'quest3',
          name: 'Quest 3',
          description: 'Third quest',
          difficulty: 'experienced',
          questPoints: 3,
          objectives: [],
          rewards: {}
        }
      ];

      quests.forEach(q => questSystem.registerQuest(q));
      
      // Start and complete quest1
      questSystem.startQuest(mockPlayer, 'quest1');
      const playerQuests = questSystem.getPlayerQuests(mockPlayer.id);
      const quest1Data = playerQuests.get('quest1')!;
      quest1Data.status = 'completed';
      
      // Start quest3
      questSystem.startQuest(mockPlayer, 'quest3');
    });

    it('should get all quests', () => {
      const allQuests = questSystem.getAllQuests();
      expect(allQuests).toHaveLength(4); // Tutorial + 3 test quests
    });

    it('should get available quests', () => {
      const available = questSystem.getAvailableQuests(mockPlayer);
      expect(available.map(q => q.id)).toContain('quest2');
      expect(available.map(q => q.id)).not.toContain('quest1'); // Completed
      expect(available.map(q => q.id)).not.toContain('quest3'); // In progress
    });

    it('should get active quests', () => {
      const active = questSystem.getActiveQuests(mockPlayer);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('quest3');
    });

    it('should get completed quests', () => {
      const completed = questSystem.getCompletedQuests(mockPlayer);
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('quest1');
    });

    it('should calculate total quest points', () => {
      const points = questSystem.getTotalQuestPoints(mockPlayer);
      expect(points).toBe(1); // Only quest1 is completed
    });
  });

  describe('Serialization', () => {
    it('should serialize player quest data', () => {
      questSystem.startQuest(mockPlayer, 'tutorial');
      
      const serialized = questSystem.serialize();
      expect(serialized.playerQuests).toBeDefined();
      expect(serialized.playerQuests['player_1']).toBeDefined();
      expect(serialized.playerQuests['player_1']).toHaveLength(1);
    });

    it('should deserialize player quest data', () => {
      const data = {
        playerQuests: {
          'player_1': [
            ['tutorial', {
              questId: 'tutorial',
              status: 'completed',
              objectives: [],
              completedAt: Date.now()
            }]
          ]
        }
      };

      questSystem.deserialize(data);
      
      const progress = questSystem.getQuestProgress(mockPlayer, 'tutorial');
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('completed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent quest', () => {
      const canStart = questSystem.canStartQuest(mockPlayer, 'fake_quest');
      expect(canStart.canStart).toBe(false);
      expect(canStart.reason).toBe('Quest not found');
    });

    it('should handle missing player components gracefully', () => {
      const playerWithoutComponents = {
        ...mockPlayer,
        getComponent: vi.fn().mockReturnValue(null)
      };

      const quest: QuestDefinition = {
        id: 'component_quest',
        name: 'Component Quest',
        description: 'Test missing components',
        difficulty: 'novice',
        questPoints: 1,
        requirements: {
          skills: [{ skill: 'attack', level: 10 }],
          items: [{ itemId: 1001, quantity: 1 }]
        },
        objectives: [],
        rewards: {}
      };

      questSystem.registerQuest(quest);
      
      // Should still work but fail requirements
      const canStart = questSystem.canStartQuest(playerWithoutComponents, 'component_quest');
      expect(canStart.canStart).toBe(true); // No components means no requirements check
    });

    it('should handle missing systems gracefully when granting rewards', () => {
      // Remove systems
      world.systems = [];
      
      const quest: QuestDefinition = {
        id: 'reward_quest',
        name: 'Reward Quest',
        description: 'Test rewards without systems',
        difficulty: 'novice',
        questPoints: 1,
        objectives: [
          {
            id: 'simple',
            type: 'kill',
            description: 'Kill 1 goblin',
            target: 'npc_goblin',
            quantity: 1,
            current: 0,
            completed: false
          }
        ],
        rewards: {
          experience: [{ skill: 'attack', amount: 100 }],
          items: [{ itemId: 1001, quantity: 1 }]
        }
      };

      questSystem.registerQuest(quest);
      questSystem.startQuest(mockPlayer, 'reward_quest');
      
      // Should complete without errors
      expect(() => questSystem.handleNPCKill(mockPlayer, 'npc_goblin')).not.toThrow();
    });
  });
}); 