import { StatsComponent, CombatStyle, AttackType, CombatComponent } from '../../types';

export class HitCalculator {
  /**
   * Calculate attack roll based on stats and combat style
   */
  calculateAttackRoll(
    attacker: StatsComponent,
    style: CombatStyle,
    attackType: AttackType
  ): number {
    // Get effective level based on attack type
    const effectiveLevel = this.getEffectiveAttackLevel(attacker, style, attackType);
    
    // Get equipment bonus based on attack type
    const equipmentBonus = this.getAttackBonus(attacker, attackType);
    
    // RuneScape formula: effectiveLevel * (equipmentBonus + 64)
    return effectiveLevel * (equipmentBonus + 64);
  }

  /**
   * Calculate defense roll
   */
  calculateDefenseRoll(
    defender: StatsComponent,
    incomingAttackType: AttackType,
    defenderCombatComponent?: CombatComponent
  ): number {
    // Get effective defense level
    const effectiveDefense = this.getEffectiveDefenseLevel(defender, defenderCombatComponent?.combatStyle || CombatStyle.DEFENSIVE);
    
    // Get equipment defense bonus against attack type
    const defenseBonus = this.getDefenseBonus(defender, incomingAttackType);
    
    // Defense roll = effective level * (bonus + 64)
    return effectiveDefense * (defenseBonus + 64);
  }

  /**
   * Calculate hit chance from attack and defense rolls
   */
  calculateHitChance(attackRoll: number, defenseRoll: number): number {
    if (attackRoll > defenseRoll) {
      return 1 - (defenseRoll + 2) / (2 * (attackRoll + 1));
    } else {
      return attackRoll / (2 * (defenseRoll + 1));
    }
  }

  /**
   * Get effective attack level with style bonuses
   */
  private getEffectiveAttackLevel(
    attacker: StatsComponent,
    style: CombatStyle,
    attackType: AttackType
  ): number {
    let level = 0;
    let styleBonus = 0;
    
    // Get base level based on attack type
    switch (attackType) {
      case AttackType.MELEE:
        level = attacker.attack.level;
        break;
      case AttackType.RANGED:
        level = attacker.ranged.level;
        break;
      case AttackType.MAGIC:
        level = attacker.magic.level;
        break;
    }
    
    // Apply style bonuses
    switch (style) {
      case CombatStyle.ACCURATE:
        styleBonus = 3; // +3 attack levels
        break;
      case CombatStyle.CONTROLLED:
        styleBonus = 1; // +1 to all
        break;
    }
    
    // Effective level = level + style bonus + 8
    return level + styleBonus + 8;
  }

  /**
   * Get effective defense level with style bonuses
   */
  private getEffectiveDefenseLevel(defender: StatsComponent, style: CombatStyle): number {
    const defenseLevel = defender.defense.level;
    const styleBonus = this.getDefenderStyleBonus(style);
    
    // Include prayer bonus
    const prayerBonus = this.getDefencePrayerBonus(defender);
    
    // Effective level = (level + style bonus) * prayer bonus + 8
    return Math.floor((defenseLevel + styleBonus) * prayerBonus) + 8;
  }

  /**
   * Get defender style bonus
   */
  private getDefenderStyleBonus(style: CombatStyle): number {
    switch (style) {
      case CombatStyle.DEFENSIVE:
        return 3; // +3 defence levels
      case CombatStyle.CONTROLLED:
        return 1; // +1 to all combat skills
      case CombatStyle.LONGRANGE:
        return 3; // +3 defence levels for ranged
      default:
        return 0; // No defence bonus
    }
  }
  
  /**
   * Get defence prayer bonus multiplier
   */
  private getDefencePrayerBonus(defender: StatsComponent): number {
    const prayers = (defender as any).activePrayers || {};
    
    // Defence prayers
    if (prayers.piety) return 1.25; // 25% defence bonus
    if (prayers.rigour) return 1.25; // 25% defence bonus
    if (prayers.augury) return 1.25; // 25% defence bonus
    if (prayers.chivalry) return 1.20; // 20% defence bonus
    if (prayers.steelSkin) return 1.15; // 15% defence bonus
    if (prayers.rockSkin) return 1.10; // 10% defence bonus
    if (prayers.thickSkin) return 1.05; // 5% defence bonus
    
    return 1.0;
  }

  /**
   * Get attack bonus based on attack type
   */
  private getAttackBonus(attacker: StatsComponent, attackType: AttackType): number {
    const bonuses = attacker.combatBonuses;
    
    switch (attackType) {
      case AttackType.MELEE:
        // For melee, we'd need to know the attack style (stab/slash/crush)
        // For now, use the highest
        return Math.max(
          bonuses.attackStab,
          bonuses.attackSlash,
          bonuses.attackCrush
        );
      case AttackType.RANGED:
        return bonuses.attackRanged;
      case AttackType.MAGIC:
        return bonuses.attackMagic;
      default:
        return 0;
    }
  }

  /**
   * Get defense bonus against attack type
   */
  private getDefenseBonus(defender: StatsComponent, attackType: AttackType): number {
    const bonuses = defender.combatBonuses;
    
    switch (attackType) {
      case AttackType.MELEE:
        // For melee, we'd need to know the specific style
        // For now, average the defenses
        return Math.floor(
          (bonuses.defenseStab + bonuses.defenseSlash + bonuses.defenseCrush) / 3
        );
      case AttackType.RANGED:
        return bonuses.defenseRanged;
      case AttackType.MAGIC:
        return bonuses.defenseMagic;
      default:
        return 0;
    }
  }
} 