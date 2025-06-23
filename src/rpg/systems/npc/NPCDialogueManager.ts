import type { World } from '../../../types';
import type { NPCEntity, PlayerEntity, NPCComponent } from '../../types';

interface DialogueSession {
  playerId: string;
  npcId: string;
  currentNode: string;
  startTime: number;
  variables: Map<string, any>;
}

interface DialogueNode {
  id: string;
  text: string;
  options?: DialogueOption[];
  action?: () => void;
  condition?: () => boolean;
}

interface DialogueOption {
  text: string;
  nextNode: string;
  condition?: () => boolean;
  action?: () => void;
}

export class NPCDialogueManager {
  private world: World;
  private sessions: Map<string, DialogueSession> = new Map();
  private dialogues: Map<string, Map<string, DialogueNode>> = new Map();
  
  constructor(world: World) {
    this.world = world;
    this.registerDefaultDialogues();
  }
  
  /**
   * Update dialogue sessions
   */
  update(delta: number): void {
    // Clean up old sessions
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.startTime > 300000) { // 5 minute timeout
        this.endDialogue(session.playerId);
      }
    }
  }
  
  /**
   * Start dialogue between player and NPC
   */
  startDialogue(playerId: string, npcId: string): void {
    // Check if player already in dialogue
    if (this.sessions.has(playerId)) {
      this.endDialogue(playerId);
    }
    
    // Get NPC component
    const npc = this.getNPC(npcId);
    if (!npc) return;
    
    const npcComponent = npc.getComponent<NPCComponent>('npc');
    if (!npcComponent || !npcComponent.dialogue) return;
    
    // Create session
    const session: DialogueSession = {
      playerId,
      npcId,
      currentNode: 'start',
      startTime: Date.now(),
      variables: new Map()
    };
    
    this.sessions.set(playerId, session);
    
    // Send first dialogue
    this.sendDialogueNode(playerId, session);
    
    // Emit event
    this.world.events.emit('dialogue:start', {
      playerId,
      npcId
    });
  }
  
  /**
   * Handle player dialogue choice
   */
  handleChoice(playerId: string, optionIndex: number): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    
    const dialogue = this.getDialogue(session.npcId, session.currentNode);
    if (!dialogue || !dialogue.options || optionIndex >= dialogue.options.length) {
      this.endDialogue(playerId);
      return;
    }
    
    const option = dialogue.options[optionIndex];
    if (!option) {
      this.endDialogue(playerId);
      return;
    }
    
    // Check condition
    if (option.condition && !option.condition()) {
      this.sendMessage(playerId, "You can't do that right now.");
      return;
    }
    
    // Execute action
    if (option.action) {
      option.action();
    }
    
    // Move to next node
    if (option.nextNode === 'end') {
      this.endDialogue(playerId);
    } else {
      session.currentNode = option.nextNode;
      this.sendDialogueNode(playerId, session);
    }
  }
  
  /**
   * End dialogue session
   */
  endDialogue(playerId: string): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    
    this.sessions.delete(playerId);
    
    // Emit event
    this.world.events.emit('dialogue:end', {
      playerId,
      npcId: session.npcId
    });
  }
  
  /**
   * Send dialogue node to player
   */
  private sendDialogueNode(playerId: string, session: DialogueSession): void {
    const dialogue = this.getDialogue(session.npcId, session.currentNode);
    if (!dialogue) {
      this.endDialogue(playerId);
      return;
    }
    
    // Check condition
    if (dialogue.condition && !dialogue.condition()) {
      this.endDialogue(playerId);
      return;
    }
    
    // Execute action
    if (dialogue.action) {
      dialogue.action();
    }
    
    // Format options
    const options = dialogue.options?.filter(opt => 
      !opt.condition || opt.condition()
    ).map(opt => opt.text) || [];
    
    // Send to player
    this.world.events.emit('dialogue:node', {
      playerId,
      npcId: session.npcId,
      text: dialogue.text,
      options
    });
  }
  
  /**
   * Register dialogue for an NPC
   */
  registerDialogue(npcId: string, dialogues: Map<string, DialogueNode>): void {
    this.dialogues.set(npcId, dialogues);
  }
  
  /**
   * Get dialogue node
   */
  private getDialogue(npcId: string, nodeId: string): DialogueNode | undefined {
    const npcDialogues = this.dialogues.get(npcId);
    return npcDialogues?.get(nodeId);
  }
  
  /**
   * Get NPC entity
   */
  private getNPC(npcId: string): NPCEntity | undefined {
    if (this.world.entities.items instanceof Map) {
      const entity = this.world.entities.items.get(npcId);
      if (entity && typeof entity.getComponent === 'function') {
        return entity as unknown as NPCEntity;
      }
    }
    
    const entity = this.world.entities.get?.(npcId);
    if (entity && typeof entity.getComponent === 'function') {
      return entity as unknown as NPCEntity;
    }
    
    return undefined;
  }
  
  /**
   * Send message to player
   */
  private sendMessage(playerId: string, message: string): void {
    this.world.events.emit('chat:system', {
      targetId: playerId,
      message
    });
  }
  
  /**
   * Register default dialogues
   */
  private registerDefaultDialogues(): void {
    // Shopkeeper dialogue
    const shopkeeperDialogue = new Map<string, DialogueNode>();
    shopkeeperDialogue.set('start', {
      id: 'start',
      text: 'Welcome to my shop! Would you like to see my wares?',
      options: [
        {
          text: 'Yes, show me what you have.',
          nextNode: 'shop',
          action: () => {
            // Open shop interface
            this.world.events.emit('shop:open', {
              npcId: '100' // Bob's shop
            });
          }
        },
        {
          text: 'No thanks.',
          nextNode: 'end'
        }
      ]
    });
    
    shopkeeperDialogue.set('shop', {
      id: 'shop',
      text: 'Take your time browsing!',
      options: [
        {
          text: 'Thanks!',
          nextNode: 'end'
        }
      ]
    });
    
    this.registerDialogue('100', shopkeeperDialogue);
    
    // Quest giver dialogue
    const questGiverDialogue = new Map<string, DialogueNode>();
    questGiverDialogue.set('start', {
      id: 'start',
      text: 'Greetings, adventurer. Our village faces many threats.',
      options: [
        {
          text: 'What kind of threats?',
          nextNode: 'threats'
        },
        {
          text: 'Do you have any quests for me?',
          nextNode: 'quests'
        },
        {
          text: 'Goodbye.',
          nextNode: 'end'
        }
      ]
    });
    
    questGiverDialogue.set('threats', {
      id: 'threats',
      text: 'Goblins have been raiding our farms, and strange creatures lurk in the nearby caves.',
      options: [
        {
          text: 'I can help with the goblins.',
          nextNode: 'goblin_quest'
        },
        {
          text: 'Tell me about the caves.',
          nextNode: 'cave_info'
        },
        {
          text: 'I see.',
          nextNode: 'start'
        }
      ]
    });
    
    questGiverDialogue.set('quests', {
      id: 'quests',
      text: 'I have several tasks that need doing. Which interests you?',
      options: [
        {
          text: 'The goblin problem.',
          nextNode: 'goblin_quest'
        },
        {
          text: 'Exploring the caves.',
          nextNode: 'cave_quest'
        },
        {
          text: 'Maybe later.',
          nextNode: 'end'
        }
      ]
    });
    
    questGiverDialogue.set('goblin_quest', {
      id: 'goblin_quest',
      text: 'Excellent! Please eliminate 10 goblins from the area. They can be found east of here.',
      action: () => {
        // Start goblin quest
        this.world.events.emit('quest:start', {
          questId: 'goblin_menace',
          npcId: '200'
        });
      },
      options: [
        {
          text: 'I\'ll get right on it!',
          nextNode: 'end'
        }
      ]
    });
    
    this.registerDialogue('200', questGiverDialogue);
  }
} 