# NPC System Implementation Report

## Overview

The NPC System manages all non-player characters in the game world, including hostile mobs, quest givers, shopkeepers, and other interactive NPCs. Quest givers use LLM integration to generate dynamic dialogue and quests while remaining as in-world entities rather than full Eliza agents.

## Architecture

### System Structure

```typescript
export class NPCSystem extends System {
  // Core management
  private npcs: Map<string, NPCEntity>;
  private npcDefinitions: NPCRegistry;
  private dialogueManager: DialogueManager;
  private llmQuestGenerator: LLMQuestGenerator;
  private aiController: NPCAIController;
  
  // Update cycles
  fixedUpdate(delta: number): void;
  update(delta: number): void;
  
  // NPC operations
  spawnNPC(definition: NPCDefinition, position: Vector3): NPCEntity;
  despawnNPC(npcId: string): void;
  
  // Interaction methods
  interactWithNPC(playerId: string, npcId: string): void;
  startDialogue(playerId: string, npcId: string): void;
  
  // AI methods
  updateNPCBehavior(npc: NPCEntity, delta: number): void;
  findTarget(npc: NPCEntity): Entity | null;
}
```

### Core Components

#### 1. NPC Entity Structure

```typescript
class NPCEntity extends Entity {
  // Core components
  npcComponent: NPCComponent;
  statsComponent: StatsComponent;
  combatComponent: CombatComponent;
  movementComponent: MovementComponent;
  dialogueComponent: DialogueComponent;
  
  // NPC-specific data
  spawnPoint: Vector3;
  currentTarget: string | null;
  lastInteraction: number;
  
  // AI state machine
  aiState: NPCAIState;
  stateTimer: number;
  
  // Visual elements
  nameplate: Nameplate;
  questIndicator: QuestIndicator;
}

interface NPCComponent {
  npcId: number;
  name: string;
  examine: string;
  
  // Type and behavior
  npcType: NPCType;
  behavior: NPCBehavior;
  faction: string;
  
  // Combat stats (if applicable)
  combatLevel: number;
  maxHitpoints: number;
  attackStyle: AttackStyle;
  aggressionLevel: number;
  
  // Interaction data
  interactions: NPCInteraction[];
  shop?: ShopInventory;
  questGiver?: QuestGiverData;
  
  // Spawning
  respawnTime: number;
  wanderRadius: number;
  
  // Loot (if applicable)
  lootTable?: string;
}
```

#### 2. LLM Quest Generator

```typescript
class LLMQuestGenerator {
  private llmService: LLMService;
  private questTemplates: QuestTemplateLibrary;
  private worldContext: WorldContextProvider;
  
  async generateQuest(
    npc: NPCEntity,
    player: PlayerEntity,
    context: QuestContext
  ): Promise<GeneratedQuest> {
    // Build prompt with world context
    const prompt = this.buildQuestPrompt(npc, player, context);
    
    // Generate quest using LLM
    const response = await this.llmService.generate({
      system: this.getSystemPrompt(npc),
      user: prompt,
      temperature: 0.8,
      maxTokens: 500
    });
    
    // Parse and validate quest
    const quest = this.parseQuestResponse(response);
    return this.validateQuest(quest, context);
  }
  
  private buildQuestPrompt(
    npc: NPCEntity,
    player: PlayerEntity,
    context: QuestContext
  ): string {
    return `
      Generate a quest for a level ${player.combatLevel} player.
      
      NPC: ${npc.name} (${npc.description})
      Location: ${context.location}
      Available enemies: ${context.nearbyEnemies.join(', ')}
      Available items: ${context.availableItems.join(', ')}
      Player's recent quests: ${context.recentQuests.join(', ')}
      
      Create a quest that:
      - Is appropriate for the player's level
      - Uses available world elements
      - Fits the NPC's character
      - Avoids repetition of recent quests
      
      Format the response as JSON with:
      - name: Quest title
      - description: Quest description
      - objectives: Array of objectives
      - dialogue: NPC dialogue for quest stages
      - rewards: XP and item rewards
    `;
  }
}
```

#### 3. Dialogue System

```typescript
class DialogueManager {
  private activeDialogues: Map<string, DialogueSession>;
  private llmService: LLMService;
  
  async startDialogue(
    player: PlayerEntity,
    npc: NPCEntity,
    context: DialogueContext
  ): Promise<DialogueSession> {
    const session = new DialogueSession(player, npc);
    
    // Get initial dialogue
    const dialogue = await this.getDialogue(npc, context);
    session.addDialogue(dialogue);
    
    this.activeDialogues.set(player.id, session);
    return session;
  }
  
  async processPlayerResponse(
    playerId: string,
    option: number
  ): Promise<void> {
    const session = this.activeDialogues.get(playerId);
    if (!session) return;
    
    const response = session.currentOptions[option];
    
    // Generate NPC response using LLM if dynamic
    if (session.npc.questGiver?.useLLM) {
      const npcResponse = await this.generateDynamicResponse(
        session.npc,
        response,
        session.context
      );
      session.addDialogue(npcResponse);
    } else {
      // Use scripted dialogue
      const nextDialogue = session.getNextDialogue(option);
      session.addDialogue(nextDialogue);
    }
  }
  
  private async generateDynamicResponse(
    npc: NPCEntity,
    playerInput: string,
    context: DialogueContext
  ): Promise<DialogueNode> {
    const response = await this.llmService.generate({
      system: `You are ${npc.name}, ${npc.description}. 
               Respond in character to the player's input.
               Keep responses concise and appropriate to the medieval fantasy setting.`,
      user: playerInput,
      temperature: 0.7,
      maxTokens: 150
    });
    
    return {
      text: response,
      options: this.generateResponseOptions(response, context)
    };
  }
}
```

#### 4. NPC AI Controller

```typescript
class NPCAIController {
  // State machine for NPC behavior
  updateAI(npc: NPCEntity, delta: number): void {
    switch (npc.aiState) {
      case NPCAIState.IDLE:
        this.handleIdleState(npc, delta);
        break;
      case NPCAIState.WANDERING:
        this.handleWanderingState(npc, delta);
        break;
      case NPCAIState.CHASING:
        this.handleChasingState(npc, delta);
        break;
      case NPCAIState.ATTACKING:
        this.handleAttackingState(npc, delta);
        break;
      case NPCAIState.FLEEING:
        this.handleFleeingState(npc, delta);
        break;
      case NPCAIState.RETURNING:
        this.handleReturningState(npc, delta);
        break;
    }
  }
  
  private handleIdleState(npc: NPCEntity, delta: number): void {
    // Check for nearby threats if aggressive
    if (npc.behavior === NPCBehavior.AGGRESSIVE) {
      const target = this.findNearestTarget(npc);
      if (target && this.isInAggressionRange(npc, target)) {
        npc.currentTarget = target.id;
        this.changeState(npc, NPCAIState.CHASING);
        return;
      }
    }
    
    // Random chance to start wandering
    if (Math.random() < 0.01 * delta) {
      this.changeState(npc, NPCAIState.WANDERING);
    }
  }
  
  private handleChasingState(npc: NPCEntity, delta: number): void {
    const target = this.world.entities.get(npc.currentTarget);
    if (!target || !this.isValidTarget(npc, target)) {
      this.changeState(npc, NPCAIState.RETURNING);
      return;
    }
    
    const distance = this.getDistance(npc, target);
    
    // Check if in attack range
    if (distance <= npc.attackRange) {
      this.changeState(npc, NPCAIState.ATTACKING);
      return;
    }
    
    // Check if too far from spawn
    if (this.isTooFarFromSpawn(npc)) {
      this.changeState(npc, NPCAIState.RETURNING);
      return;
    }
    
    // Move towards target
    this.moveTowards(npc, target.position);
  }
}
```

### NPC Types and Behaviors

#### 1. Combat NPCs

```typescript
interface CombatNPC {
  // Combat stats
  attackBonus: number;
  strengthBonus: number;
  defenseBonus: number;
  maxHit: number;
  attackSpeed: number;
  
  // Combat behavior
  aggressionRange: number;
  deaggressionDistance: number;
  multiCombat: boolean;
  
  // Special abilities
  specialAttacks?: SpecialAttack[];
  immunities?: DamageType[];
}

// Example: Goblin
const goblinDefinition: NPCDefinition = {
  id: 1,
  name: "Goblin",
  examine: "An ugly green creature.",
  npcType: NPCType.MONSTER,
  behavior: NPCBehavior.AGGRESSIVE,
  combatLevel: 2,
  maxHitpoints: 5,
  
  combat: {
    attackBonus: 1,
    strengthBonus: 1,
    defenseBonus: 1,
    maxHit: 1,
    attackSpeed: 4,
    aggressionRange: 3,
    deaggressionDistance: 10
  },
  
  lootTable: "goblin_drops",
  respawnTime: 30000 // 30 seconds
};
```

#### 2. Quest Giver NPCs

```typescript
interface QuestGiverNPC {
  questGiverData: {
    // Static quests
    quests?: string[];
    
    // Dynamic quest generation
    useLLM: boolean;
    questTypes?: QuestType[];
    personality?: string;
    backstory?: string;
    
    // Quest constraints
    minLevel?: number;
    maxLevel?: number;
    questCooldown?: number;
  };
  
  // Visual indicators
  questIndicator: {
    available: "yellow_exclamation";
    inProgress: "gray_question";
    complete: "yellow_question";
  };
}

// Example: Village Elder (LLM-powered)
const villageElderDefinition: NPCDefinition = {
  id: 100,
  name: "Elder Grimwald",
  examine: "A wise old man with years of experience.",
  npcType: NPCType.QUEST_GIVER,
  behavior: NPCBehavior.FRIENDLY,
  
  questGiver: {
    useLLM: true,
    questTypes: [QuestType.KILL, QuestType.GATHER, QuestType.DELIVERY],
    personality: "Wise, caring, concerned about village safety",
    backstory: "Former adventurer who settled down to lead the village",
    minLevel: 1,
    maxLevel: 20,
    questCooldown: 3600000 // 1 hour
  },
  
  dialogue: {
    greeting: "Welcome, young adventurer. Our village could use your help.",
    idle: ["The wolves have been getting bolder lately...", 
           "I remember when I was young like you..."],
  }
};
```

#### 3. Shop NPCs

```typescript
interface ShopNPC {
  shop: {
    name: string;
    stock: ShopItem[];
    currency: "coins" | "tokens" | "custom";
    buyModifier: number; // Price when buying from shop
    sellModifier: number; // Price when selling to shop
    restock: boolean;
    restockTime: number;
  };
}

interface ShopItem {
  itemId: number;
  stock: number; // -1 for infinite
  price?: number; // Override default price
}
```

### Interaction System

```typescript
class NPCInteractionHandler {
  handleInteraction(player: PlayerEntity, npc: NPCEntity): void {
    const distance = this.getDistance(player, npc);
    
    if (distance > INTERACTION_RANGE) {
      this.sendMessage(player, "You're too far away.");
      return;
    }
    
    // Check NPC type
    switch (npc.npcType) {
      case NPCType.QUEST_GIVER:
        this.handleQuestGiverInteraction(player, npc);
        break;
      case NPCType.SHOP:
        this.handleShopInteraction(player, npc);
        break;
      case NPCType.BANKER:
        this.handleBankerInteraction(player, npc);
        break;
      case NPCType.SKILL_MASTER:
        this.handleSkillMasterInteraction(player, npc);
        break;
      default:
        this.handleGenericInteraction(player, npc);
    }
  }
  
  private async handleQuestGiverInteraction(
    player: PlayerEntity,
    npc: NPCEntity
  ): Promise<void> {
    const questGiver = npc.questGiver;
    
    // Check for quest completion
    const completableQuest = this.getCompletableQuest(player, npc);
    if (completableQuest) {
      await this.completeQuest(player, npc, completableQuest);
      return;
    }
    
    // Check for quest in progress
    const activeQuest = this.getActiveQuest(player, npc);
    if (activeQuest) {
      await this.showQuestProgress(player, npc, activeQuest);
      return;
    }
    
    // Generate new quest if using LLM
    if (questGiver.useLLM) {
      const quest = await this.llmQuestGenerator.generateQuest(
        npc,
        player,
        this.buildQuestContext(player, npc)
      );
      
      await this.offerQuest(player, npc, quest);
    } else {
      // Offer static quest
      const availableQuest = this.getAvailableStaticQuest(player, npc);
      if (availableQuest) {
        await this.offerQuest(player, npc, availableQuest);
      }
    }
  }
}
```

### Visual Elements

```typescript
interface NPCVisuals {
  // Model and animations
  model: string;
  animations: {
    idle: string[];
    walk: string;
    run: string;
    attack: string[];
    death: string;
    interact: string;
  };
  
  // UI elements
  nameplate: {
    color: string; // Based on level difference
    showLevel: boolean;
    showHealth: boolean;
    icon?: string; // Quest/shop indicator
  };
  
  // Effects
  spawnEffect?: string;
  deathEffect?: string;
  
  // Scale based on type
  scale?: number;
}
```

## Network Synchronization

```typescript
// NPC spawn broadcast
world.network.broadcast('npc:spawn', {
  npcId: npc.id,
  definition: npc.definition,
  position: npc.position,
  state: npc.aiState
});

// NPC state updates
world.network.broadcast('npc:state', {
  npcId: npc.id,
  position: npc.position,
  target: npc.currentTarget,
  health: npc.currentHealth,
  aiState: npc.aiState
});

// Dialogue sync
world.network.send(playerId, 'npc:dialogue', {
  npcId: npc.id,
  dialogue: dialogueNode,
  options: responseOptions
});
```

## Performance Optimization

1. **AI Update Frequency**
   - Update AI every 200ms instead of every frame
   - Stagger updates across NPCs
   - Skip updates for distant NPCs

2. **Spatial Partitioning**
   - Use quadtree for 2D position queries
   - Only process NPCs near players
   - Cull NPCs outside view distance

3. **LLM Optimization**
   - Cache generated quests for reuse
   - Pre-generate quest pools during low activity
   - Use smaller models for simple dialogue

## Development Phases

### Phase 1: Basic NPCs (Week 1)
- NPC entity structure
- Basic AI states (idle, wander)
- Simple combat NPCs

### Phase 2: Combat AI (Week 2)
- Aggression system
- Combat behavior
- Loot drops

### Phase 3: Interactive NPCs (Week 3)
- Dialogue system
- Shop NPCs
- Static quest givers

### Phase 4: LLM Integration (Week 4)
- Dynamic quest generation
- LLM-powered dialogue
- Context-aware responses

## Configuration

```typescript
interface NPCConfig {
  maxNPCsPerArea: number; // Performance limit
  aiUpdateInterval: number; // Milliseconds
  maxAggressionRange: number; // Tiles
  dialogueTimeout: number; // Auto-close dialogue
  llmRequestTimeout: number; // LLM response timeout
  questGenerationCooldown: number; // Per player per NPC
}
``` 