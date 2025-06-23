import { System } from '../../core/systems/System';
import type { World } from '../../types';
import type { PlayerEntity, NPCEntity, ItemDefinition, StatsComponent, InventoryComponent } from '../types';

export interface QuestObjective {
  id: string;
  type: 'kill' | 'collect' | 'talk' | 'reach' | 'use';
  description: string;
  target?: string; // NPC ID, item ID, or location ID
  quantity?: number;
  current: number;
  completed: boolean;
}

export interface QuestReward {
  experience?: { skill: string; amount: number }[];
  items?: { itemId: number; quantity: number }[];
  unlocks?: string[]; // Quest IDs, area access, etc.
  gold?: number;
  questPoints?: number;
}

export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  difficulty: 'novice' | 'intermediate' | 'experienced' | 'master' | 'grandmaster';
  questPoints: number;
  requirements?: {
    quests?: string[];
    skills?: { skill: string; level: number }[];
    items?: { itemId: number; quantity: number }[];
  };
  startNPC?: string;
  objectives: QuestObjective[];
  rewards: QuestReward;
}

export interface PlayerQuestData {
  questId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  objectives: QuestObjective[];
  startedAt?: number;
  completedAt?: number;
}

export class QuestSystem extends System {
  private questDefinitions: Map<string, QuestDefinition> = new Map();
  private playerQuests: Map<string, Map<string, PlayerQuestData>> = new Map();
  private questStartHandlers: Map<string, (player: PlayerEntity) => boolean> = new Map();
  private questCompleteHandlers: Map<string, (player: PlayerEntity) => void> = new Map();

  constructor(world: World) {
    super(world);
    this.initializeDefaultQuests();
  }

  private initializeDefaultQuests(): void {
    // Tutorial quest
    this.registerQuest({
      id: 'tutorial',
      name: 'Tutorial Island',
      description: 'Learn the basics of combat and skills',
      difficulty: 'novice',
      questPoints: 1,
      objectives: [
        {
          id: 'talk_guide',
          type: 'talk',
          description: 'Talk to the Survival Guide',
          target: 'npc_survival_guide',
          current: 0,
          quantity: 1,
          completed: false
        },
        {
          id: 'kill_rat',
          type: 'kill',
          description: 'Kill a giant rat',
          target: 'npc_giant_rat',
          current: 0,
          quantity: 1,
          completed: false
        },
        {
          id: 'collect_logs',
          type: 'collect',
          description: 'Collect 3 logs',
          target: 'item_logs',
          current: 0,
          quantity: 3,
          completed: false
        }
      ],
      rewards: {
        experience: [
          { skill: 'attack', amount: 100 },
          { skill: 'woodcutting', amount: 100 }
        ],
        items: [
          { itemId: 1001, quantity: 1 }, // Bronze sword
          { itemId: 1002, quantity: 1 }  // Wooden shield
        ],
        questPoints: 1
      }
    });
  }

  registerQuest(definition: QuestDefinition): void {
    this.questDefinitions.set(definition.id, definition);
    this.world.events.emit('quest:registered', { questId: definition.id });
  }

  registerQuestStartHandler(questId: string, handler: (player: PlayerEntity) => boolean): void {
    this.questStartHandlers.set(questId, handler);
  }

  registerQuestCompleteHandler(questId: string, handler: (player: PlayerEntity) => void): void {
    this.questCompleteHandlers.set(questId, handler);
  }

  canStartQuest(player: PlayerEntity, questId: string): { canStart: boolean; reason?: string } {
    const quest = this.questDefinitions.get(questId);
    if (!quest) {
      return { canStart: false, reason: 'Quest not found' };
    }

    const playerQuests = this.getPlayerQuests(player.id);
    const questData = playerQuests.get(questId);
    
    if (questData && questData.status !== 'not_started') {
      return { canStart: false, reason: 'Quest already started or completed' };
    }

    // Check requirements
    if (quest.requirements) {
      // Check quest requirements
      if (quest.requirements.quests) {
        for (const reqQuestId of quest.requirements.quests) {
          const reqQuest = playerQuests.get(reqQuestId);
          if (!reqQuest || reqQuest.status !== 'completed') {
            return { canStart: false, reason: `Must complete quest: ${reqQuestId}` };
          }
        }
      }

      // Check skill requirements
      if (quest.requirements.skills) {
        const statsComponent = player.getComponent<StatsComponent>('stats');
        if (statsComponent) {
          for (const req of quest.requirements.skills) {
            const skill = (statsComponent as any)[req.skill];
            if (!skill || skill.level < req.level) {
              return { canStart: false, reason: `Requires ${req.skill} level ${req.level}` };
            }
          }
        }
      }

      // Check item requirements
      if (quest.requirements.items) {
        const inventory = player.getComponent<InventoryComponent>('inventory');
        if (inventory) {
          for (const req of quest.requirements.items) {
            const count = this.countItems(inventory.items, req.itemId);
            if (count < req.quantity) {
              return { canStart: false, reason: `Requires ${req.quantity} of item ${req.itemId}` };
            }
          }
        }
      }
    }

    // Check custom start handler
    const startHandler = this.questStartHandlers.get(questId);
    if (startHandler && !startHandler(player)) {
      return { canStart: false, reason: 'Quest cannot be started at this time' };
    }

    return { canStart: true };
  }

  startQuest(player: PlayerEntity, questId: string): boolean {
    const canStart = this.canStartQuest(player, questId);
    if (!canStart.canStart) {
      this.world.events.emit('quest:start_failed', {
        playerId: player.id,
        questId,
        reason: canStart.reason
      });
      return false;
    }

    const quest = this.questDefinitions.get(questId)!;
    const questData: PlayerQuestData = {
      questId,
      status: 'in_progress',
      objectives: quest.objectives.map(obj => ({ ...obj, current: 0, completed: false })),
      startedAt: Date.now()
    };

    const playerQuests = this.getPlayerQuests(player.id);
    playerQuests.set(questId, questData);

    this.world.events.emit('quest:started', {
      playerId: player.id,
      questId,
      questName: quest.name
    });

    return true;
  }

  updateObjective(
    player: PlayerEntity, 
    questId: string, 
    objectiveId: string, 
    progress: number
  ): void {
    const playerQuests = this.getPlayerQuests(player.id);
    const questData = playerQuests.get(questId);
    
    if (!questData || questData.status !== 'in_progress') {
      return;
    }

    const objective = questData.objectives.find(obj => obj.id === objectiveId);
    if (!objective || objective.completed) {
      return;
    }

    objective.current = Math.min(progress, objective.quantity || 1);
    
    if (objective.current >= (objective.quantity || 1)) {
      objective.completed = true;
      this.world.events.emit('quest:objective_complete', {
        playerId: player.id,
        questId,
        objectiveId,
        objectiveDescription: objective.description
      });
    }

    // Check if all objectives are complete
    if (questData.objectives.every(obj => obj.completed)) {
      this.completeQuest(player, questId);
    }
  }

  private completeQuest(player: PlayerEntity, questId: string): void {
    const playerQuests = this.getPlayerQuests(player.id);
    const questData = playerQuests.get(questId);
    const quest = this.questDefinitions.get(questId);
    
    if (!questData || !quest || questData.status !== 'in_progress') {
      return;
    }

    questData.status = 'completed';
    questData.completedAt = Date.now();

    // Grant rewards
    this.grantRewards(player, quest.rewards);

    // Call complete handler if exists
    const completeHandler = this.questCompleteHandlers.get(questId);
    if (completeHandler) {
      completeHandler(player);
    }

    this.world.events.emit('quest:completed', {
      playerId: player.id,
      questId,
      questName: quest.name,
      rewards: quest.rewards
    });
  }

  private grantRewards(player: PlayerEntity, rewards: QuestReward): void {
    // Grant experience
    if (rewards.experience) {
      const skillsSystem = this.world.systems.find(s => s.constructor.name === 'SkillsSystem');
      if (skillsSystem) {
        for (const exp of rewards.experience) {
          (skillsSystem as any).addExperience(player, exp.skill, exp.amount);
        }
      }
    }

    // Grant items
    if (rewards.items) {
      const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem');
      if (inventorySystem) {
        for (const item of rewards.items) {
          (inventorySystem as any).addItem(player, item.itemId, item.quantity);
        }
      }
    }

    // Grant gold
    if (rewards.gold) {
      const inventory = player.getComponent('inventory');
      if (inventory) {
        // Add gold (assuming gold is item ID 995)
        const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem');
        if (inventorySystem) {
          (inventorySystem as any).addItem(player, 995, rewards.gold);
        }
      }
    }

    // Handle unlocks
    if (rewards.unlocks) {
      for (const unlock of rewards.unlocks) {
        this.world.events.emit('quest:unlock', {
          playerId: player.id,
          unlock
        });
      }
    }
  }

  getPlayerQuests(playerId: string): Map<string, PlayerQuestData> {
    if (!this.playerQuests.has(playerId)) {
      this.playerQuests.set(playerId, new Map());
    }
    return this.playerQuests.get(playerId)!;
  }

  getQuestProgress(player: PlayerEntity, questId: string): PlayerQuestData | null {
    const playerQuests = this.getPlayerQuests(player.id);
    return playerQuests.get(questId) || null;
  }

  getAllQuests(): QuestDefinition[] {
    return Array.from(this.questDefinitions.values());
  }

  getAvailableQuests(player: PlayerEntity): QuestDefinition[] {
    return this.getAllQuests().filter(quest => {
      const playerQuests = this.getPlayerQuests(player.id);
      const questData = playerQuests.get(quest.id);
      return !questData || questData.status === 'not_started';
    });
  }

  getActiveQuests(player: PlayerEntity): QuestDefinition[] {
    const playerQuests = this.getPlayerQuests(player.id);
    return Array.from(playerQuests.values())
      .filter(data => data.status === 'in_progress')
      .map(data => this.questDefinitions.get(data.questId)!)
      .filter(quest => quest !== undefined);
  }

  getCompletedQuests(player: PlayerEntity): QuestDefinition[] {
    const playerQuests = this.getPlayerQuests(player.id);
    return Array.from(playerQuests.values())
      .filter(data => data.status === 'completed')
      .map(data => this.questDefinitions.get(data.questId)!)
      .filter(quest => quest !== undefined);
  }

  getTotalQuestPoints(player: PlayerEntity): number {
    const completedQuests = this.getCompletedQuests(player);
    return completedQuests.reduce((total, quest) => total + quest.questPoints, 0);
  }

  private countItems(items: any[], itemId: number): number {
    let count = 0;
    for (const item of items) {
      if (item && item.id === itemId) {
        count += item.quantity || 1;
      }
    }
    return count;
  }

  // Event handlers for quest progress
  handleNPCKill(player: PlayerEntity, npcId: string): void {
    const activeQuests = this.getActiveQuests(player);
    
    for (const quest of activeQuests) {
      const questData = this.getQuestProgress(player, quest.id)!;
      
      for (const objective of questData.objectives) {
        if (objective.type === 'kill' && objective.target === npcId && !objective.completed) {
          this.updateObjective(player, quest.id, objective.id, objective.current + 1);
        }
      }
    }
  }

  handleItemCollected(player: PlayerEntity, itemId: string, quantity: number): void {
    const activeQuests = this.getActiveQuests(player);
    
    for (const quest of activeQuests) {
      const questData = this.getQuestProgress(player, quest.id)!;
      
      for (const objective of questData.objectives) {
        if (objective.type === 'collect' && objective.target === itemId && !objective.completed) {
          const inventory = player.getComponent<InventoryComponent>('inventory');
          if (inventory) {
            const currentCount = this.countItems(inventory.items, parseInt(itemId.replace('item_', '')));
            this.updateObjective(player, quest.id, objective.id, currentCount);
          }
        }
      }
    }
  }

  handleNPCTalk(player: PlayerEntity, npcId: string): void {
    const activeQuests = this.getActiveQuests(player);
    
    for (const quest of activeQuests) {
      const questData = this.getQuestProgress(player, quest.id)!;
      
      for (const objective of questData.objectives) {
        if (objective.type === 'talk' && objective.target === npcId && !objective.completed) {
          this.updateObjective(player, quest.id, objective.id, 1);
        }
      }
    }
  }

  handleLocationReached(player: PlayerEntity, locationId: string): void {
    const activeQuests = this.getActiveQuests(player);
    
    for (const quest of activeQuests) {
      const questData = this.getQuestProgress(player, quest.id)!;
      
      for (const objective of questData.objectives) {
        if (objective.type === 'reach' && objective.target === locationId && !objective.completed) {
          this.updateObjective(player, quest.id, objective.id, 1);
        }
      }
    }
  }

  handleItemUsed(player: PlayerEntity, itemId: string, targetId?: string): void {
    const activeQuests = this.getActiveQuests(player);
    
    for (const quest of activeQuests) {
      const questData = this.getQuestProgress(player, quest.id)!;
      
      for (const objective of questData.objectives) {
        if (objective.type === 'use' && objective.target === itemId && !objective.completed) {
          this.updateObjective(player, quest.id, objective.id, objective.current + 1);
        }
      }
    }
  }

  update(deltaTime: number): void {
    // Quest system doesn't need regular updates
  }

  serialize(): any {
    const data: any = {
      playerQuests: {}
    };

    for (const [playerId, quests] of this.playerQuests) {
      data.playerQuests[playerId] = Array.from(quests.entries());
    }

    return data;
  }

  deserialize(data: any): void {
    if (data.playerQuests) {
      for (const [playerId, questsArray] of Object.entries(data.playerQuests)) {
        const questMap = new Map<string, PlayerQuestData>(questsArray as any);
        this.playerQuests.set(playerId, questMap);
      }
    }
  }
} 