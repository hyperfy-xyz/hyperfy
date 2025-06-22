import { System } from '../../core/systems/System';
import type { World } from '../../types';
import type { 
  SkillType, 
  StatsComponent, 
  Entity, 
  SkillData,
  PlayerEntity,
  InventoryComponent
} from '../types';

interface XPDrop {
  entityId: string;
  skill: SkillType;
  amount: number;
  timestamp: number;
}

interface SkillMilestone {
  level: number;
  name: string;
  message: string;
}

export class SkillsSystem extends System {
  private static readonly MAX_LEVEL = 99;
  private static readonly MAX_XP = 200_000_000; // 200M XP cap
  private static readonly COMBAT_SKILLS: SkillType[] = [
    'attack', 'strength', 'defense', 'ranged', 'magic', 'hitpoints', 'prayer'
  ];
  
  private xpTable: number[] = [];
  private xpDrops: XPDrop[] = [];
  private skillMilestones: Map<SkillType, SkillMilestone[]> = new Map();

  constructor(world: World) {
    super(world);
    this.generateXPTable();
    this.setupSkillMilestones();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for XP gain events from other systems
    this.world.events.on('combat:kill', this.handleCombatKill.bind(this));
    this.world.events.on('skill:action', this.handleSkillAction.bind(this));
    this.world.events.on('quest:complete', this.handleQuestComplete.bind(this));
  }

  update(deltaTime: number): void {
    // Clean up old XP drops (for UI)
    const currentTime = Date.now();
    this.xpDrops = this.xpDrops.filter(drop => 
      currentTime - drop.timestamp < 3000 // Keep for 3 seconds
    );
  }

  /**
   * Grant XP to a specific skill
   */
  public grantXP(entityId: string, skill: SkillType, amount: number): void {
    const entity = this.world.entities.get(entityId);
    if (!entity) return;

    const stats = entity.getComponent<StatsComponent>('stats');
    if (!stats) return;

    const skillData = stats[skill] as SkillData;
    if (!skillData) {
      console.warn(`Skill ${skill} not found on entity ${entityId}`);
      return;
    }

    // Apply XP modifiers (e.g., from equipment, prayers, etc.)
    const modifiedAmount = this.calculateModifiedXP(entity, skill, amount);

    // Check XP cap
    const oldXP = skillData.xp;
    const newXP = Math.min(oldXP + modifiedAmount, SkillsSystem.MAX_XP);
    const actualGain = newXP - oldXP;

    if (actualGain <= 0) return;

    // Update XP
    skillData.xp = newXP;

    // Check for level up
    const oldLevel = skillData.level;
    const newLevel = this.getLevelForXP(newXP);

    if (newLevel > oldLevel) {
      this.handleLevelUp(entity, skill, oldLevel, newLevel);
    }

    // Update combat level if it's a combat skill
    if (SkillsSystem.COMBAT_SKILLS.includes(skill)) {
      this.updateCombatLevel(entity, stats);
    }

    // Update total level
    this.updateTotalLevel(entity, stats);

    // Add XP drop for UI
    this.xpDrops.push({
      entityId,
      skill,
      amount: actualGain,
      timestamp: Date.now()
    });

    // Emit XP gained event
    this.world.events.emit('xp:gained', {
      entityId,
      skill,
      amount: actualGain,
      totalXP: newXP,
      level: skillData.level
    });
  }

  /**
   * Get the level for a given amount of XP
   */
  public getLevelForXP(xp: number): number {
    for (let level = SkillsSystem.MAX_LEVEL; level >= 1; level--) {
      if (xp >= this.xpTable[level]) {
        return level;
      }
    }
    return 1;
  }

  /**
   * Get the XP required for a specific level
   */
  public getXPForLevel(level: number): number {
    if (level < 1) return 0;
    if (level > SkillsSystem.MAX_LEVEL) return this.xpTable[SkillsSystem.MAX_LEVEL];
    return this.xpTable[level];
  }

  /**
   * Get XP remaining to next level
   */
  public getXPToNextLevel(skill: SkillData): number {
    if (skill.level >= SkillsSystem.MAX_LEVEL) return 0;
    
    const nextLevelXP = this.getXPForLevel(skill.level + 1);
    return nextLevelXP - skill.xp;
  }

  /**
   * Get XP progress percentage to next level
   */
  public getXPProgress(skill: SkillData): number {
    if (skill.level >= SkillsSystem.MAX_LEVEL) return 100;
    
    const currentLevelXP = this.getXPForLevel(skill.level);
    const nextLevelXP = this.getXPForLevel(skill.level + 1);
    const progressXP = skill.xp - currentLevelXP;
    const requiredXP = nextLevelXP - currentLevelXP;
    
    return (progressXP / requiredXP) * 100;
  }

  /**
   * Check if entity meets skill requirements
   */
  public meetsRequirements(entity: Entity, requirements: Partial<Record<SkillType, number>>): boolean {
    const stats = entity.getComponent<StatsComponent>('stats');
    if (!stats) return false;

    for (const [skill, requiredLevel] of Object.entries(requirements)) {
      const skillData = stats[skill as SkillType] as SkillData;
      if (!skillData || skillData.level < requiredLevel) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get combat level for an entity
   */
  public getCombatLevel(stats: StatsComponent): number {
    // RuneScape combat level formula
    const base = 0.25 * (
      stats.defense.level + 
      stats.hitpoints.level + 
      Math.floor(stats.prayer.level / 2)
    );
    
    const melee = 0.325 * (stats.attack.level + stats.strength.level);
    const ranged = 0.325 * Math.floor(stats.ranged.level * 1.5);
    const magic = 0.325 * Math.floor(stats.magic.level * 1.5);
    
    return Math.floor(base + Math.max(melee, ranged, magic));
  }

  /**
   * Get total level (sum of all skill levels)
   */
  public getTotalLevel(stats: StatsComponent): number {
    let total = 0;
    
    // Sum all skill levels
    const skills: SkillType[] = [
      'attack', 'strength', 'defense', 'ranged', 'magic', 
      'prayer', 'hitpoints', 'mining', 'smithing', 'fishing',
      'cooking', 'woodcutting', 'firemaking', 'crafting', 'herblore',
      'agility', 'thieving', 'slayer', 'farming', 'runecrafting',
      'hunter', 'construction'
    ];

    for (const skill of skills) {
      const skillData = stats[skill] as SkillData;
      if (skillData) {
        total += skillData.level;
      }
    }

    return total;
  }

  /**
   * Get total XP across all skills
   */
  public getTotalXP(stats: StatsComponent): number {
    let total = 0;
    
    const skills: SkillType[] = [
      'attack', 'strength', 'defense', 'ranged', 'magic', 
      'prayer', 'hitpoints', 'mining', 'smithing', 'fishing',
      'cooking', 'woodcutting', 'firemaking', 'crafting', 'herblore',
      'agility', 'thieving', 'slayer', 'farming', 'runecrafting',
      'hunter', 'construction'
    ];

    for (const skill of skills) {
      const skillData = stats[skill] as SkillData;
      if (skillData) {
        total += skillData.xp;
      }
    }

    return total;
  }

  /**
   * Reset a skill to level 1
   */
  public resetSkill(entityId: string, skill: SkillType): void {
    const entity = this.world.entities.get(entityId);
    if (!entity) return;

    const stats = entity.getComponent<StatsComponent>('stats');
    if (!stats) return;

    const skillData = stats[skill] as SkillData;
    if (!skillData) return;

    skillData.level = 1;
    skillData.xp = 0;

    // Update combat level if needed
    if (SkillsSystem.COMBAT_SKILLS.includes(skill)) {
      this.updateCombatLevel(entity, stats);
    }

    this.updateTotalLevel(entity, stats);

    this.world.events.emit('skill:reset', {
      entityId,
      skill
    });
  }

  /**
   * Set skill level directly (for admin commands)
   */
  public setSkillLevel(entityId: string, skill: SkillType, level: number): void {
    if (level < 1 || level > SkillsSystem.MAX_LEVEL) {
      console.warn(`Invalid level ${level} for skill ${skill}`);
      return;
    }

    const entity = this.world.entities.get(entityId);
    if (!entity) return;

    const stats = entity.getComponent<StatsComponent>('stats');
    if (!stats) return;

    const skillData = stats[skill] as SkillData;
    if (!skillData) return;

    const oldLevel = skillData.level;
    skillData.level = level;
    skillData.xp = this.getXPForLevel(level);

    if (level > oldLevel) {
      this.handleLevelUp(entity, skill, oldLevel, level);
    }

    // Update combat level if needed
    if (SkillsSystem.COMBAT_SKILLS.includes(skill)) {
      this.updateCombatLevel(entity, stats);
    }

    this.updateTotalLevel(entity, stats);
  }

  private generateXPTable(): void {
    this.xpTable = [0, 0]; // Levels 0 and 1
    
    for (let level = 2; level <= SkillsSystem.MAX_LEVEL; level++) {
      const xp = Math.floor(
        (level - 1) + 300 * Math.pow(2, (level - 1) / 7)
      ) / 4;
      this.xpTable.push(Math.floor(this.xpTable[level - 1] + xp));
    }
  }

  private setupSkillMilestones(): void {
    // Define special milestones for each skill
    const commonMilestones: SkillMilestone[] = [
      { level: 50, name: 'Halfway', message: 'Halfway to mastery!' },
      { level: 92, name: 'Half XP', message: 'Halfway to 99 in XP!' },
      { level: 99, name: 'Mastery', message: 'Skill mastered!' }
    ];

    // Apply common milestones to all skills
    const skills: SkillType[] = [
      'attack', 'strength', 'defense', 'ranged', 'magic', 
      'prayer', 'hitpoints', 'mining', 'smithing', 'fishing',
      'cooking', 'woodcutting', 'firemaking', 'crafting', 'herblore',
      'agility', 'thieving', 'slayer', 'farming', 'runecrafting',
      'hunter', 'construction'
    ];

    for (const skill of skills) {
      this.skillMilestones.set(skill, [...commonMilestones]);
    }

    // Add skill-specific milestones
    const combatMilestones = this.skillMilestones.get('attack')!;
    combatMilestones.push(
      { level: 40, name: 'Rune Weapons', message: 'You can now wield rune weapons!' },
      { level: 60, name: 'Dragon Weapons', message: 'You can now wield dragon weapons!' }
    );
  }

  private handleLevelUp(entity: Entity, skill: SkillType, oldLevel: number, newLevel: number): void {
    const stats = entity.getComponent<StatsComponent>('stats');
    if (!stats) return;

    const skillData = stats[skill] as SkillData;
    skillData.level = newLevel;

    // Check for milestones
    const milestones = this.skillMilestones.get(skill) || [];
    for (const milestone of milestones) {
      if (milestone.level > oldLevel && milestone.level <= newLevel) {
        this.world.events.emit('skill:milestone', {
          entityId: entity.id,
          skill,
          milestone
        });
      }
    }

    // Special handling for HP level up
    if (skill === 'hitpoints') {
      const newMax = this.calculateMaxHitpoints(newLevel);
      stats.hitpoints.max = newMax;
      // Heal to full on HP level up
      stats.hitpoints.current = newMax;
    }

    // Special handling for Prayer level up
    if (skill === 'prayer') {
      const newMax = newLevel;
      stats.prayer.maxPoints = newMax;
    }

    this.world.events.emit('skill:levelup', {
      entityId: entity.id,
      skill,
      oldLevel,
      newLevel,
      totalLevel: stats.totalLevel
    });
  }

  private calculateMaxHitpoints(level: number): number {
    // RuneScape formula: 10 + level
    return 10 + level;
  }

  private updateCombatLevel(entity: Entity, stats: StatsComponent): void {
    const oldCombatLevel = stats.combatLevel;
    const newCombatLevel = this.getCombatLevel(stats);

    if (newCombatLevel !== oldCombatLevel) {
      stats.combatLevel = newCombatLevel;
      
      this.world.events.emit('combat:levelChanged', {
        entityId: entity.id,
        oldLevel: oldCombatLevel,
        newLevel: newCombatLevel
      });
    }
  }

  private updateTotalLevel(entity: Entity, stats: StatsComponent): void {
    const oldTotalLevel = stats.totalLevel;
    const newTotalLevel = this.getTotalLevel(stats);

    if (newTotalLevel !== oldTotalLevel) {
      stats.totalLevel = newTotalLevel;
      
      this.world.events.emit('total:levelChanged', {
        entityId: entity.id,
        oldLevel: oldTotalLevel,
        newLevel: newTotalLevel
      });
    }
  }

  private calculateModifiedXP(entity: Entity, skill: SkillType, baseXP: number): number {
    let modifier = 1.0;

    // Check for XP-boosting equipment
    const inventory = entity.getComponent<InventoryComponent>('inventory');
    if (inventory && inventory.equipment) {
      // Example: Wisdom amulet gives 5% XP boost
      if ((inventory.equipment.amulet as any)?.name === 'wisdom_amulet') {
        modifier += 0.05;
      }
    }

    // Check for active XP events
    const activeEvents = (this.world as any).getSystem?.('events')?.getActiveEvents() || [];
    for (const event of activeEvents) {
      if (event.type === 'double_xp') {
        modifier *= 2;
      } else if (event.type === 'bonus_xp' && event.skills?.includes(skill)) {
        modifier += event.bonusRate || 0.5;
      }
    }

    return Math.floor(baseXP * modifier);
  }

  // Event handlers
  private handleCombatKill(data: { 
    attackerId: string; 
    targetId: string; 
    damageDealt: number;
    attackStyle: string;
  }): void {
    const { attackerId, targetId, damageDealt, attackStyle } = data;
    
    const target = this.world.entities.get(targetId);
    if (!target) return;

    const targetStats = target.getComponent<StatsComponent>('stats');
    if (!targetStats) return;

    // Calculate XP based on target's hitpoints
    const baseXP = targetStats.hitpoints.max * 4; // 4 XP per hitpoint
    
    // Grant XP based on attack style
    switch (attackStyle) {
      case 'accurate':
        this.grantXP(attackerId, 'attack', baseXP);
        break;
      case 'aggressive':
        this.grantXP(attackerId, 'strength', baseXP);
        break;
      case 'defensive':
        this.grantXP(attackerId, 'defense', baseXP);
        break;
      case 'controlled':
        // Split XP between attack, strength, and defense
        this.grantXP(attackerId, 'attack', baseXP / 3);
        this.grantXP(attackerId, 'strength', baseXP / 3);
        this.grantXP(attackerId, 'defense', baseXP / 3);
        break;
      case 'ranged':
        this.grantXP(attackerId, 'ranged', baseXP);
        break;
      case 'magic':
        this.grantXP(attackerId, 'magic', baseXP);
        break;
    }

    // Always grant HP XP
    this.grantXP(attackerId, 'hitpoints', baseXP / 3);
  }

  private handleSkillAction(data: {
    entityId: string;
    skill: SkillType;
    xp: number;
  }): void {
    this.grantXP(data.entityId, data.skill, data.xp);
  }

  private handleQuestComplete(data: {
    playerId: string;
    questId: string;
    rewards: {
      xp?: Record<SkillType, number>;
    };
  }): void {
    if (!data.rewards.xp) return;

    for (const [skill, xp] of Object.entries(data.rewards.xp)) {
      this.grantXP(data.playerId, skill as SkillType, xp);
    }
  }

  // Public getters
  public getXPDrops(): XPDrop[] {
    return [...this.xpDrops];
  }

  public getSkillData(entityId: string, skill: SkillType): SkillData | null {
    const entity = this.world.entities.get(entityId);
    if (!entity) return null;

    const stats = entity.getComponent<StatsComponent>('stats');
    if (!stats) return null;

    return stats[skill] as SkillData || null;
  }
} 