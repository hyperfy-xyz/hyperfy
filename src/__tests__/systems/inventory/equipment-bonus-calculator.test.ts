import { describe, it, expect, beforeEach } from 'vitest';
import { EquipmentBonusCalculator } from '../../../rpg/systems/inventory/EquipmentBonusCalculator';
import { ItemRegistry } from '../../../rpg/systems/inventory/ItemRegistry';
import { EquipmentSlot, WeaponType } from '../../../rpg/types';
import type { Equipment, StatsComponent, CombatBonuses } from '../../../rpg/types';

describe('EquipmentBonusCalculator', () => {
  let calculator: EquipmentBonusCalculator;
  let itemRegistry: ItemRegistry;

  const mockBronzeSword: Equipment = {
    id: 1,
    name: 'Bronze Sword',
    examine: 'A bronze sword.',
    value: 15,
    weight: 2.2,
    stackable: false,
    equipable: true,
    tradeable: true,
    members: false,
    equipment: {
      slot: EquipmentSlot.WEAPON,
      requirements: { attack: { level: 1, xp: 0 } },
      bonuses: {
        attackStab: 4,
        attackSlash: 5,
        attackCrush: -2,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 0,
        defenseSlash: 1,
        defenseCrush: 0,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 4,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      },
      weaponType: WeaponType.SWORD,
      attackSpeed: 4
    },
    model: 'bronze_sword',
    icon: 'bronze_sword_icon'
  };

  const mockBronzeShield: Equipment = {
    id: 2,
    name: 'Bronze Shield',
    examine: 'A bronze shield.',
    value: 20,
    weight: 3,
    stackable: false,
    equipable: true,
    tradeable: true,
    members: false,
    equipment: {
      slot: EquipmentSlot.SHIELD,
      requirements: { defense: { level: 1, xp: 0 } },
      bonuses: {
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: -6,
        attackRanged: -2,
        defenseStab: 4,
        defenseSlash: 5,
        defenseCrush: 6,
        defenseMagic: -1,
        defenseRanged: 4,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      }
    },
    model: 'bronze_shield',
    icon: 'bronze_shield_icon'
  };

  const mockBronzeHelmet: Equipment = {
    id: 3,
    name: 'Bronze Helmet',
    examine: 'A bronze helmet.',
    value: 25,
    weight: 2,
    stackable: false,
    equipable: true,
    tradeable: true,
    members: false,
    equipment: {
      slot: EquipmentSlot.HEAD,
      requirements: { defense: { level: 1, xp: 0 } },
      bonuses: {
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: -6,
        attackRanged: -2,
        defenseStab: 3,
        defenseSlash: 4,
        defenseCrush: 5,
        defenseMagic: -1,
        defenseRanged: 3,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      }
    },
    model: 'bronze_helmet',
    icon: 'bronze_helmet_icon'
  };

  const mockPrayerAmulet: Equipment = {
    id: 4,
    name: 'Amulet of Glory',
    examine: 'A very powerful amulet.',
    value: 50000,
    weight: 0.1,
    stackable: false,
    equipable: true,
    tradeable: true,
    members: false,
    equipment: {
      slot: EquipmentSlot.AMULET,
      requirements: {},
      bonuses: {
        attackStab: 10,
        attackSlash: 10,
        attackCrush: 10,
        attackMagic: 3,
        attackRanged: 10,
        defenseStab: 3,
        defenseSlash: 3,
        defenseCrush: 3,
        defenseMagic: 3,
        defenseRanged: 3,
        meleeStrength: 6,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 3
      }
    },
    model: 'glory_amulet',
    icon: 'glory_amulet_icon'
  };

  const mockPlayerStats: StatsComponent = {
    type: 'stats',
    entity: {} as any,
    data: {},
    hitpoints: { current: 10, max: 10, level: 10, xp: 1154 },
    attack: { level: 1, xp: 0, bonus: 0 },
    strength: { level: 1, xp: 0, bonus: 0 },
    defense: { level: 1, xp: 0, bonus: 0 },
    ranged: { level: 1, xp: 0, bonus: 0 },
    magic: { level: 1, xp: 0, bonus: 0 },
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
    },
    combatLevel: 3,
    totalLevel: 32
  };

  beforeEach(() => {
    itemRegistry = new ItemRegistry();
    calculator = new EquipmentBonusCalculator(itemRegistry);
  });

  describe('calculateTotalBonuses', () => {
    it('should return zero bonuses for empty equipment', () => {
      const equipment = {
        [EquipmentSlot.HEAD]: null,
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: null,
        [EquipmentSlot.WEAPON]: null,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: null,
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null
      };

      const bonuses = calculator.calculateTotalBonuses(equipment);

      expect(bonuses.attackStab).toBe(0);
      expect(bonuses.attackSlash).toBe(0);
      expect(bonuses.defenseStab).toBe(0);
      expect(bonuses.meleeStrength).toBe(0);
      expect(bonuses.prayerBonus).toBe(0);
    });

    it('should calculate bonuses for single item', () => {
      const equipment = {
        [EquipmentSlot.HEAD]: null,
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: null,
        [EquipmentSlot.WEAPON]: mockBronzeSword,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: null,
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null
      };

      const bonuses = calculator.calculateTotalBonuses(equipment);

      expect(bonuses.attackStab).toBe(4);
      expect(bonuses.attackSlash).toBe(5);
      expect(bonuses.attackCrush).toBe(-2);
      expect(bonuses.meleeStrength).toBe(4);
    });

    it('should sum bonuses from multiple items', () => {
      const equipment = {
        [EquipmentSlot.HEAD]: mockBronzeHelmet,
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: mockPrayerAmulet,
        [EquipmentSlot.WEAPON]: mockBronzeSword,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: mockBronzeShield,
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null
      };

      const bonuses = calculator.calculateTotalBonuses(equipment);

      // Attack bonuses
      expect(bonuses.attackStab).toBe(14); // 4 + 10
      expect(bonuses.attackSlash).toBe(15); // 5 + 10
      expect(bonuses.attackCrush).toBe(8); // -2 + 10
      expect(bonuses.attackMagic).toBe(-9); // 0 + 3 + -6 + -6
      expect(bonuses.attackRanged).toBe(6); // 0 + 10 + -2 + -2

      // Defense bonuses
      expect(bonuses.defenseStab).toBe(10); // 0 + 3 + 4 + 3
      expect(bonuses.defenseSlash).toBe(13); // 1 + 3 + 5 + 4
      expect(bonuses.defenseCrush).toBe(14); // 0 + 3 + 6 + 5

      // Other bonuses
      expect(bonuses.meleeStrength).toBe(10); // 4 + 6
      expect(bonuses.prayerBonus).toBe(3); // 0 + 3
    });

    it('should handle negative bonuses correctly', () => {
      const equipment = {
        [EquipmentSlot.HEAD]: mockBronzeHelmet, // -6 magic attack
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: null,
        [EquipmentSlot.WEAPON]: null,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: mockBronzeShield, // -6 magic attack
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null
      };

      const bonuses = calculator.calculateTotalBonuses(equipment);

      expect(bonuses.attackMagic).toBe(-12); // -6 + -6
    });
  });

  describe('meetsRequirements', () => {
    it('should return true when player meets all requirements', () => {
      const playerWithHighStats: StatsComponent = {
        ...mockPlayerStats,
        attack: { level: 60, xp: 273742, bonus: 0 },
        defense: { level: 60, xp: 273742, bonus: 0 }
      };

      const dragonSword: Equipment = {
        ...mockBronzeSword,
        equipment: {
          ...mockBronzeSword.equipment!,
          requirements: { attack: { level: 60, xp: 0 } }
        }
      };

      expect(calculator.meetsRequirements(dragonSword, playerWithHighStats)).toBe(true);
    });

    it('should return false when player does not meet requirements', () => {
      const dragonSword: Equipment = {
        ...mockBronzeSword,
        equipment: {
          ...mockBronzeSword.equipment!,
          requirements: { attack: { level: 60, xp: 0 } }
        }
      };

      expect(calculator.meetsRequirements(dragonSword, mockPlayerStats)).toBe(false);
    });

    it('should return true for items with no requirements', () => {
      const noReqItem: Equipment = {
        ...mockBronzeSword,
        equipment: {
          ...mockBronzeSword.equipment!,
          requirements: {}
        }
      };

      expect(calculator.meetsRequirements(noReqItem, mockPlayerStats)).toBe(true);
    });

    it('should check multiple skill requirements', () => {
      const multiReqItem: Equipment = {
        ...mockBronzeSword,
        equipment: {
          ...mockBronzeSword.equipment!,
          requirements: {
            attack: { level: 40, xp: 0 },
            strength: { level: 40, xp: 0 }
          }
        }
      };

      const playerWithMixedStats: StatsComponent = {
        ...mockPlayerStats,
        attack: { level: 50, xp: 100000, bonus: 0 },
        strength: { level: 30, xp: 50000, bonus: 0 }
      };

      expect(calculator.meetsRequirements(multiReqItem, playerWithMixedStats)).toBe(false);
    });

    it('should handle non-equipable items', () => {
      const nonEquipable: Equipment = {
        ...mockBronzeSword,
        equipable: false,
        equipment: undefined
      };

      expect(calculator.meetsRequirements(nonEquipable, mockPlayerStats)).toBe(true);
    });
  });

  describe('getEquipmentWeight', () => {
    it('should return 0 for empty equipment', () => {
      const equipment = {
        [EquipmentSlot.HEAD]: null,
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: null,
        [EquipmentSlot.WEAPON]: null,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: null,
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null
      };

      expect(calculator.getEquipmentWeight(equipment)).toBe(0);
    });

    it('should calculate total weight of equipped items', () => {
      const equipment = {
        [EquipmentSlot.HEAD]: mockBronzeHelmet, // 2
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: mockPrayerAmulet, // 0.1
        [EquipmentSlot.WEAPON]: mockBronzeSword, // 2.2
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: mockBronzeShield, // 3
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null
      };

      expect(calculator.getEquipmentWeight(equipment)).toBeCloseTo(7.3);
    });

    it('should handle decimal weights correctly', () => {
      const lightItem: Equipment = {
        ...mockPrayerAmulet,
        weight: 0.05
      };

      const equipment = {
        [EquipmentSlot.HEAD]: null,
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: lightItem,
        [EquipmentSlot.WEAPON]: null,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: null,
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null
      };

      expect(calculator.getEquipmentWeight(equipment)).toBe(0.05);
    });
  });

  describe('createEmptyBonuses', () => {
    it('should create bonuses object with all values set to 0', () => {
      const bonuses = calculator.createEmptyBonuses();

      expect(bonuses.attackStab).toBe(0);
      expect(bonuses.attackSlash).toBe(0);
      expect(bonuses.attackCrush).toBe(0);
      expect(bonuses.attackMagic).toBe(0);
      expect(bonuses.attackRanged).toBe(0);
      expect(bonuses.defenseStab).toBe(0);
      expect(bonuses.defenseSlash).toBe(0);
      expect(bonuses.defenseCrush).toBe(0);
      expect(bonuses.defenseMagic).toBe(0);
      expect(bonuses.defenseRanged).toBe(0);
      expect(bonuses.meleeStrength).toBe(0);
      expect(bonuses.rangedStrength).toBe(0);
      expect(bonuses.magicDamage).toBe(0);
      expect(bonuses.prayerBonus).toBe(0);
    });
  });
}); 