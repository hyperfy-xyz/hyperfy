import type { 
  Equipment, 
  StatsComponent, 
  CombatBonuses, 
  ItemDefinition 
} from '../../types';
import { EquipmentSlot } from '../../types';
import { ItemRegistry } from './ItemRegistry';

export class EquipmentBonusCalculator {
  constructor(private itemRegistry: ItemRegistry) {}

  /**
   * Calculate total bonuses from all equipped items
   */
  calculateTotalBonuses(equipment: { [K in EquipmentSlot]: Equipment | null }): CombatBonuses {
    const totalBonuses = this.createEmptyBonuses();

    for (const slot in equipment) {
      const item = equipment[slot as EquipmentSlot];
      if (item && item.equipment && item.equipment.bonuses) {
        const bonuses = item.equipment.bonuses;
        
        // Add each bonus
        totalBonuses.attackStab += bonuses.attackStab;
        totalBonuses.attackSlash += bonuses.attackSlash;
        totalBonuses.attackCrush += bonuses.attackCrush;
        totalBonuses.attackMagic += bonuses.attackMagic;
        totalBonuses.attackRanged += bonuses.attackRanged;
        
        totalBonuses.defenseStab += bonuses.defenseStab;
        totalBonuses.defenseSlash += bonuses.defenseSlash;
        totalBonuses.defenseCrush += bonuses.defenseCrush;
        totalBonuses.defenseMagic += bonuses.defenseMagic;
        totalBonuses.defenseRanged += bonuses.defenseRanged;
        
        totalBonuses.meleeStrength += bonuses.meleeStrength;
        totalBonuses.rangedStrength += bonuses.rangedStrength;
        totalBonuses.magicDamage += bonuses.magicDamage;
        totalBonuses.prayerBonus += bonuses.prayerBonus;
      }
    }

    return totalBonuses;
  }

  /**
   * Check if player meets requirements to equip an item
   */
  meetsRequirements(item: ItemDefinition | Equipment, stats: StatsComponent): boolean {
    // Non-equipable items have no requirements
    if (!item.equipable || !item.equipment) {
      return true;
    }

    const requirements = item.equipment.requirements;
    if (!requirements || Object.keys(requirements).length === 0) {
      return true;
    }

    // Check each skill requirement
    for (const skill in requirements) {
      const required = requirements[skill];
      if (!required) continue; // Skip if no requirement for this skill
      
      const playerSkill = stats[skill as keyof StatsComponent];
      
      if (!playerSkill || typeof playerSkill !== 'object' || !('level' in playerSkill)) {
        return false;
      }

      if (playerSkill.level < required.level) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate total weight of equipped items
   */
  getEquipmentWeight(equipment: { [K in EquipmentSlot]: Equipment | null }): number {
    let totalWeight = 0;

    for (const slot in equipment) {
      const item = equipment[slot as EquipmentSlot];
      if (item) {
        totalWeight += item.weight;
      }
    }

    return totalWeight;
  }

  /**
   * Create an empty bonuses object with all values set to 0
   */
  createEmptyBonuses(): CombatBonuses {
    return {
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
    };
  }

  /**
   * Get equipment set bonuses (e.g., Barrows sets)
   */
  getSetBonuses(equipment: Record<EquipmentSlot, Equipment | null>): CombatBonuses {
    // Initialize empty bonuses
    const setBonuses: CombatBonuses = {
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
    };

    // Check for complete sets
    const equippedItems = Object.values(equipment).filter(item => item !== null) as Equipment[];
    
    // Example: Dharok's set
    if (this.hasCompleteSet(equippedItems, 'dharok')) {
      // Dharok's set effect is handled separately in combat
      // No direct stat bonuses
    }
    
    // Example: Void knight set
    if (this.hasVoidSet(equippedItems)) {
      // Void provides accuracy and damage bonuses
      // These are percentage-based and handled in combat calculations
    }
    
    return setBonuses;
  }

  /**
   * Check if player has a complete armor set
   */
  private hasCompleteSet(items: Equipment[], setName: string): boolean {
    const setItems = items.filter(item => 
      item.name.toLowerCase().includes(setName)
    );
    
    // Most sets require 4 pieces (helm, body, legs, weapon/shield)
    return setItems.length >= 4;
  }

  /**
   * Check for void knight set
   */
  private hasVoidSet(items: Equipment[]): boolean {
    const voidItems = items.filter(item => 
      item.name.toLowerCase().includes('void')
    );
    
    // Void requires: top, bottom, gloves, and helm
    const hasTop = voidItems.some(item => item.name.includes('top'));
    const hasBottom = voidItems.some(item => item.name.includes('robe'));
    const hasGloves = voidItems.some(item => item.name.includes('gloves'));
    const hasHelm = voidItems.some(item => 
      item.name.includes('helm') || 
      item.name.includes('hood')
    );
    
    return hasTop && hasBottom && hasGloves && hasHelm;
  }

  /**
   * Calculate weight reduction from equipment
   */
  calculateWeightReduction(equipment: Record<EquipmentSlot, Equipment | null>): number {
    let reduction = 0;
    
    // Graceful outfit pieces
    const gracefulPieces = Object.values(equipment).filter(item => 
      item && item.name.toLowerCase().includes('graceful')
    ).length;
    
    // Each graceful piece reduces weight by 3kg, full set gives extra 3kg
    reduction += gracefulPieces * 3;
    if (gracefulPieces >= 6) {
      reduction += 3; // Full set bonus
    }
    
    // Spotted/spottier cape
    const cape = equipment[EquipmentSlot.CAPE];
    if (cape) {
      if (cape.name.toLowerCase().includes('spottier')) {
        reduction += 5;
      } else if (cape.name.toLowerCase().includes('spotted')) {
        reduction += 3;
      }
    }
    
    // Boots of lightness
    const boots = equipment[EquipmentSlot.BOOTS];
    if (boots && boots.name.toLowerCase().includes('lightness')) {
      reduction += 4;
    }
    
    return reduction;
  }

  /**
   * Get prayer drain reduction from equipment
   */
  getPrayerDrainReduction(equipment: Record<EquipmentSlot, Equipment | null>): number {
    let reduction = 0;
    
    // Check for prayer bonus items
    for (const slot in equipment) {
      const item = equipment[slot as EquipmentSlot];
      if (item && item.equipment?.bonuses?.prayerBonus) {
        // Each prayer bonus point reduces drain by 3.33%
        reduction += (item.equipment.bonuses.prayerBonus * 3.33) / 100;
      }
    }
    
    return Math.min(reduction, 0.5); // Cap at 50% reduction
  }
} 