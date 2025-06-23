import { StatsComponent, CombatStyle, AttackType } from '../../types';

export class DamageCalculator {
  /**
   * Calculate maximum hit based on stats and combat style
   */
  calculateMaxHit(
    attacker: StatsComponent,
    style: CombatStyle,
    attackType: AttackType
  ): number {
    switch (attackType) {
      case AttackType.MELEE:
        return this.calculateMeleeMaxHit(attacker, style);
      case AttackType.RANGED:
        return this.calculateRangedMaxHit(attacker, style);
      case AttackType.MAGIC:
        return this.calculateMagicMaxHit(attacker);
      default:
        return 0;
    }
  }

  /**
   * Roll damage between 0 and max hit
   */
  rollDamage(maxHit: number): number {
    // Random damage between 0 and max hit (inclusive)
    return Math.floor(Math.random() * (maxHit + 1));
  }

  /**
   * Apply damage reductions (protection prayers, etc.)
   */
  applyDamageReductions(
    damage: number, 
    target: StatsComponent,
    attackType: AttackType,
    attacker?: StatsComponent
  ): number {
    let reducedDamage = damage;
    
    // Apply protection prayers
    const protectionMultiplier = this.getProtectionPrayerMultiplier(target, attackType);
    reducedDamage = Math.floor(reducedDamage * protectionMultiplier);
    
    // Apply defensive bonuses from equipment
    const defenseReduction = this.getDefensiveDamageReduction(target, attackType);
    reducedDamage = Math.floor(reducedDamage * defenseReduction);
    
    // Apply special defensive effects (e.g., Elysian spirit shield)
    const specialReduction = this.getSpecialDefensiveReduction(target);
    reducedDamage = Math.floor(reducedDamage * specialReduction);
    
    // Minimum damage is 0
    return Math.max(0, reducedDamage);
  }
  
  /**
   * Get protection prayer damage multiplier
   */
  private getProtectionPrayerMultiplier(target: StatsComponent, attackType: AttackType): number {
    // Check if target has active protection prayers
    const prayers = (target as any).activePrayers || {};
    
    switch (attackType) {
      case AttackType.MELEE:
        if (prayers.protectFromMelee) return 0.6; // 40% damage reduction
        break;
      case AttackType.RANGED:
        if (prayers.protectFromRanged) return 0.6;
        break;
      case AttackType.MAGIC:
        if (prayers.protectFromMagic) return 0.6;
        break;
    }
    
    return 1.0; // No reduction
  }
  
  /**
   * Calculate defensive damage reduction from equipment
   */
  private getDefensiveDamageReduction(target: StatsComponent, attackType: AttackType): number {
    // High defense bonus can provide small damage reduction
    let defenseBonus = 0;
    
    switch (attackType) {
      case AttackType.MELEE:
        // Average of stab, slash, crush defense
        defenseBonus = (
          target.combatBonuses.defenseStab +
          target.combatBonuses.defenseSlash +
          target.combatBonuses.defenseCrush
        ) / 3;
        break;
      case AttackType.RANGED:
        defenseBonus = target.combatBonuses.defenseRanged;
        break;
      case AttackType.MAGIC:
        defenseBonus = target.combatBonuses.defenseMagic;
        break;
    }
    
    // Every 100 defense bonus = 1% damage reduction, max 10%
    const reduction = Math.min(0.1, defenseBonus / 1000);
    return 1.0 - reduction;
  }
  
  /**
   * Get special defensive reductions (e.g., from shields)
   */
  private getSpecialDefensiveReduction(target: StatsComponent): number {
    // Check for special equipment effects
    const equipment = (target as any).equipment || {};
    
    // Elysian spirit shield effect (25% chance to reduce damage by 25%)
    if (equipment.shield?.name === 'Elysian spirit shield') {
      if (Math.random() < 0.25) {
        return 0.75; // 25% damage reduction
      }
    }
    
    // Divine spirit shield effect (30% damage reduction, drains prayer)
    if (equipment.shield?.name === 'Divine spirit shield' && target.prayer.points > 0) {
      return 0.7; // 30% damage reduction
    }
    
    return 1.0; // No reduction
  }

  /**
   * Calculate melee max hit
   */
  private calculateMeleeMaxHit(attacker: StatsComponent, style: CombatStyle): number {
    // Get effective strength level
    const effectiveStrength = this.getEffectiveStrengthLevel(attacker, style);
    
    // Get strength bonus from equipment
    const strengthBonus = attacker.combatBonuses.meleeStrength;
    
    // RuneScape formula: 0.5 + effectiveStrength * (strengthBonus + 64) / 640
    let maxHit = 0.5 + (effectiveStrength * (strengthBonus + 64)) / 640;
    
    // Apply prayer bonus
    const prayerMultiplier = this.getMeleePrayerBonus(attacker);
    maxHit *= prayerMultiplier;
    
    // Apply other bonuses (void knight, slayer helm, etc.)
    const otherBonuses = this.getMeleeOtherBonuses(attacker);
    maxHit *= otherBonuses;
    
    return Math.floor(maxHit);
  }

  /**
   * Calculate ranged max hit
   */
  private calculateRangedMaxHit(attacker: StatsComponent, style: CombatStyle): number {
    // Get effective ranged level
    const effectiveRanged = this.getEffectiveRangedLevel(attacker, style);
    
    // Get ranged strength bonus from equipment
    const rangedStrength = attacker.combatBonuses.rangedStrength;
    
    // Similar formula to melee
    let maxHit = 0.5 + (effectiveRanged * (rangedStrength + 64)) / 640;
    
    // Apply prayer bonus
    const prayerMultiplier = this.getRangedPrayerBonus(attacker);
    maxHit *= prayerMultiplier;
    
    // Apply other bonuses (void knight, ava's, etc.)
    const otherBonuses = this.getRangedOtherBonuses(attacker);
    maxHit *= otherBonuses;
    
    return Math.floor(maxHit);
  }

  /**
   * Calculate magic max hit
   */
  private calculateMagicMaxHit(attacker: StatsComponent): number {
    const magicLevel = attacker.magic.level;
    const magicDamage = attacker.combatBonuses.magicDamage;
    
    // Get spell damage from equipped spell
    const baseSpellDamage = this.getEquippedSpellDamage(attacker);
    
    // Apply magic damage bonus
    let maxHit = baseSpellDamage * (1 + magicDamage / 100);
    
    // Apply magic level bonus (small bonus for higher magic levels)
    const levelBonus = 1 + (magicLevel - 1) / 200; // Up to 50% at 99 magic
    maxHit *= levelBonus;
    
    // Apply prayer bonus
    const prayerMultiplier = this.getMagicPrayerBonus(attacker);
    maxHit *= prayerMultiplier;
    
    return Math.floor(maxHit);
  }
  
  /**
   * Get base damage for equipped spell
   */
  private getEquippedSpellDamage(attacker: StatsComponent): number {
    // Check equipped spell
    const equippedSpell = (attacker as any).equippedSpell;
    
    if (!equippedSpell) {
      // Default to wind strike if no spell equipped
      return 2;
    }
    
    // Spell damage by spell type
    const spellDamages: Record<string, number> = {
      // Strike spells
      'wind_strike': 2,
      'water_strike': 4,
      'earth_strike': 6,
      'fire_strike': 8,
      
      // Bolt spells
      'wind_bolt': 9,
      'water_bolt': 10,
      'earth_bolt': 11,
      'fire_bolt': 12,
      
      // Blast spells
      'wind_blast': 13,
      'water_blast': 14,
      'earth_blast': 15,
      'fire_blast': 16,
      
      // Wave spells
      'wind_wave': 17,
      'water_wave': 18,
      'earth_wave': 19,
      'fire_wave': 20,
      
      // Surge spells
      'wind_surge': 21,
      'water_surge': 22,
      'earth_surge': 23,
      'fire_surge': 24,
      
      // Ancient spells
      'ice_rush': 16,
      'ice_burst': 22,
      'ice_blitz': 26,
      'ice_barrage': 30,
      
      'blood_rush': 15,
      'blood_burst': 21,
      'blood_blitz': 25,
      'blood_barrage': 29,
    };
    
    return spellDamages[equippedSpell] || 10;
  }
  
  /**
   * Get melee prayer bonus multiplier
   */
  private getMeleePrayerBonus(attacker: StatsComponent): number {
    const prayers = (attacker as any).activePrayers || {};
    
    // Strength prayers
    if (prayers.piety) return 1.23; // 23% strength bonus
    if (prayers.chivalry) return 1.18; // 18% strength bonus
    if (prayers.ultimateStrength) return 1.15; // 15% strength bonus
    if (prayers.superhumanStrength) return 1.10; // 10% strength bonus
    if (prayers.burstOfStrength) return 1.05; // 5% strength bonus
    
    return 1.0;
  }
  
  /**
   * Get ranged prayer bonus multiplier
   */
  private getRangedPrayerBonus(attacker: StatsComponent): number {
    const prayers = (attacker as any).activePrayers || {};
    
    // Ranged prayers
    if (prayers.rigour) return 1.23; // 23% ranged strength
    if (prayers.eagleEye) return 1.15; // 15% ranged strength
    if (prayers.hawkEye) return 1.10; // 10% ranged strength
    if (prayers.sharpEye) return 1.05; // 5% ranged strength
    
    return 1.0;
  }
  
  /**
   * Get magic prayer bonus multiplier
   */
  private getMagicPrayerBonus(attacker: StatsComponent): number {
    const prayers = (attacker as any).activePrayers || {};
    
    // Magic prayers
    if (prayers.augury) return 1.25; // 25% magic damage
    if (prayers.mysticMight) return 1.15; // 15% magic damage
    if (prayers.mysticLore) return 1.10; // 10% magic damage
    if (prayers.mysticWill) return 1.05; // 5% magic damage
    
    return 1.0;
  }
  
  /**
   * Get other melee bonuses (void, slayer helm, etc.)
   */
  private getMeleeOtherBonuses(attacker: StatsComponent): number {
    let multiplier = 1.0;
    const equipment = (attacker as any).equipment || {};
    const effects = (attacker as any).effects || {};
    
    // Void knight melee set
    if (this.hasVoidMeleeSet(equipment)) {
      multiplier *= 1.10; // 10% damage bonus
    }
    
    // Slayer helm on task
    if (equipment.head?.name?.includes('Slayer helm') && effects.onSlayerTask) {
      multiplier *= 1.1667; // 16.67% damage bonus
    }
    
    // Berserker necklace with obsidian weapons
    if (equipment.amulet?.name === 'Berserker necklace' &&
        equipment.weapon?.name?.includes('Obsidian')) {
      multiplier *= 1.20; // 20% damage bonus
    }
    
    // Dragon hunter lance vs dragons
    if (equipment.weapon?.name === 'Dragon hunter lance' && effects.targetIsDragon) {
      multiplier *= 1.20; // 20% damage bonus
    }
    
    return multiplier;
  }
  
  /**
   * Get other ranged bonuses
   */
  private getRangedOtherBonuses(attacker: StatsComponent): number {
    let multiplier = 1.0;
    const equipment = (attacker as any).equipment || {};
    const effects = (attacker as any).effects || {};
    
    // Void knight ranged set
    if (this.hasVoidRangedSet(equipment)) {
      multiplier *= 1.10; // 10% damage bonus
    }
    
    // Elite void ranged
    if (this.hasEliteVoidRangedSet(equipment)) {
      multiplier *= 1.125; // 12.5% damage bonus
    }
    
    // Slayer helm (i) on task
    if (equipment.head?.name?.includes('Slayer helm') && effects.onSlayerTask) {
      multiplier *= 1.15; // 15% damage bonus
    }
    
    // Twisted bow scaling (simplified)
    if (equipment.weapon?.name === 'Twisted bow' && effects.targetMagicLevel) {
      const magicLevel = effects.targetMagicLevel;
      const damageBoost = Math.min(2.50, 1 + (magicLevel / 100));
      multiplier *= damageBoost;
    }
    
    return multiplier;
  }
  
  /**
   * Check if player has void melee set
   */
  private hasVoidMeleeSet(equipment: any): boolean {
    return equipment.head?.name === 'Void melee helm' &&
           equipment.body?.name === 'Void knight top' &&
           equipment.legs?.name === 'Void knight robe' &&
           equipment.gloves?.name === 'Void knight gloves';
  }
  
  /**
   * Check if player has void ranged set
   */
  private hasVoidRangedSet(equipment: any): boolean {
    return equipment.head?.name === 'Void ranger helm' &&
           equipment.body?.name === 'Void knight top' &&
           equipment.legs?.name === 'Void knight robe' &&
           equipment.gloves?.name === 'Void knight gloves';
  }
  
  /**
   * Check if player has elite void ranged set
   */
  private hasEliteVoidRangedSet(equipment: any): boolean {
    return equipment.head?.name === 'Void ranger helm' &&
           equipment.body?.name === 'Elite void top' &&
           equipment.legs?.name === 'Elite void robe' &&
           equipment.gloves?.name === 'Void knight gloves';
  }

  /**
   * Get effective strength level with style bonuses
   */
  private getEffectiveStrengthLevel(attacker: StatsComponent, style: CombatStyle): number {
    let styleBonus = 0;
    
    switch (style) {
      case CombatStyle.AGGRESSIVE:
        styleBonus = 3; // +3 strength levels
        break;
      case CombatStyle.CONTROLLED:
        styleBonus = 1; // +1 to all
        break;
    }
    
    // Effective level = level + style bonus + 8
    return attacker.strength.level + styleBonus + 8;
  }

  /**
   * Get effective ranged level with style bonuses
   */
  private getEffectiveRangedLevel(attacker: StatsComponent, style: CombatStyle): number {
    let styleBonus = 0;
    
    // Ranged styles don't typically give strength bonus
    // But rapid gives attack speed bonus (handled elsewhere)
    
    // Effective level = level + style bonus + 8
    return attacker.ranged.level + styleBonus + 8;
  }
} 