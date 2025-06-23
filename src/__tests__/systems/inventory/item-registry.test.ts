import { describe, it, expect, beforeEach } from 'vitest';
import { ItemRegistry } from '../../../rpg/systems/inventory/ItemRegistry';
import { EquipmentSlot, WeaponType } from '../../../rpg/types';
import type { ItemDefinition } from '../../../rpg/types';

describe('ItemRegistry', () => {
  let registry: ItemRegistry;

  const mockSword: ItemDefinition = {
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

  const mockCoins: ItemDefinition = {
    id: 2,
    name: 'Coins',
    examine: 'Lovely money!',
    value: 1,
    weight: 0,
    stackable: true,
    equipable: false,
    tradeable: true,
    members: false,
    model: 'coins',
    icon: 'coins_icon'
  };

  const mockShield: ItemDefinition = {
    id: 3,
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

  const mockNoted: ItemDefinition = {
    id: 4,
    name: 'Bronze Sword (noted)',
    examine: 'A bronze sword.',
    value: 15,
    weight: 0,
    stackable: true,
    equipable: false,
    tradeable: true,
    members: false,
    noted: true,
    notedId: 1,
    model: 'noted_item',
    icon: 'bronze_sword_noted_icon'
  };

  beforeEach(() => {
    registry = new ItemRegistry();
  });

  describe('register', () => {
    it('should register an item', () => {
      registry.register(mockSword);
      
      expect(registry.get(1)).toEqual(mockSword);
    });

    it('should register multiple items', () => {
      registry.register(mockSword);
      registry.register(mockCoins);
      registry.register(mockShield);
      
      expect(registry.get(1)).toEqual(mockSword);
      expect(registry.get(2)).toEqual(mockCoins);
      expect(registry.get(3)).toEqual(mockShield);
    });

    it('should overwrite existing item with same ID', () => {
      registry.register(mockSword);
      
      const modifiedSword = { ...mockSword, name: 'Modified Sword' };
      registry.register(modifiedSword);
      
      expect(registry.get(1)?.name).toBe('Modified Sword');
    });

    it('should build name index', () => {
      registry.register(mockSword);
      
      expect(registry.getByName('Bronze Sword')).toEqual(mockSword);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.register(mockSword);
      registry.register(mockCoins);
    });

    it('should return item by ID', () => {
      expect(registry.get(1)).toEqual(mockSword);
      expect(registry.get(2)).toEqual(mockCoins);
    });

    it('should return null for non-existent ID', () => {
      expect(registry.get(999)).toBeNull();
    });
  });

  describe('getByName', () => {
    beforeEach(() => {
      registry.register(mockSword);
      registry.register(mockCoins);
    });

    it('should return item by exact name', () => {
      expect(registry.getByName('Bronze Sword')).toEqual(mockSword);
      expect(registry.getByName('Coins')).toEqual(mockCoins);
    });

    it('should be case sensitive', () => {
      expect(registry.getByName('bronze sword')).toBeNull();
      expect(registry.getByName('BRONZE SWORD')).toBeNull();
    });

    it('should return null for non-existent name', () => {
      expect(registry.getByName('Iron Sword')).toBeNull();
    });
  });

  describe('item property checks', () => {
    beforeEach(() => {
      registry.register(mockSword);
      registry.register(mockCoins);
      registry.register(mockShield);
      registry.register(mockNoted);
    });

    describe('isStackable', () => {
      it('should return true for stackable items', () => {
        expect(registry.isStackable(2)).toBe(true); // Coins
        expect(registry.isStackable(4)).toBe(true); // Noted sword
      });

      it('should return false for non-stackable items', () => {
        expect(registry.isStackable(1)).toBe(false); // Sword
        expect(registry.isStackable(3)).toBe(false); // Shield
      });

      it('should return false for non-existent items', () => {
        expect(registry.isStackable(999)).toBe(false);
      });
    });

    describe('isEquipable', () => {
      it('should return true for equipable items', () => {
        expect(registry.isEquipable(1)).toBe(true); // Sword
        expect(registry.isEquipable(3)).toBe(true); // Shield
      });

      it('should return false for non-equipable items', () => {
        expect(registry.isEquipable(2)).toBe(false); // Coins
        expect(registry.isEquipable(4)).toBe(false); // Noted sword
      });

      it('should return false for non-existent items', () => {
        expect(registry.isEquipable(999)).toBe(false);
      });
    });

    describe('isTradeable', () => {
      it('should return true for tradeable items', () => {
        expect(registry.isTradeable(1)).toBe(true);
        expect(registry.isTradeable(2)).toBe(true);
        expect(registry.isTradeable(3)).toBe(true);
      });

      it('should return false for non-tradeable items', () => {
        const untradeableItem: ItemDefinition = {
          ...mockSword,
          id: 5,
          tradeable: false
        };
        registry.register(untradeableItem);
        
        expect(registry.isTradeable(5)).toBe(false);
      });

      it('should return false for non-existent items', () => {
        expect(registry.isTradeable(999)).toBe(false);
      });
    });

    describe('isNoteable', () => {
      it('should return true for noteable items', () => {
        const noteableItem: ItemDefinition = {
          ...mockSword,
          id: 6,
          noteable: true
        };
        registry.register(noteableItem);
        
        expect(registry.isNoteable(6)).toBe(true);
      });

      it('should return false for non-noteable items', () => {
        expect(registry.isNoteable(1)).toBe(false);
        expect(registry.isNoteable(2)).toBe(false);
      });

      it('should return false for already noted items', () => {
        expect(registry.isNoteable(4)).toBe(false);
      });

      it('should return false for non-existent items', () => {
        expect(registry.isNoteable(999)).toBe(false);
      });
    });

    describe('isNoted', () => {
      it('should return true for noted items', () => {
        expect(registry.isNoted(4)).toBe(true);
      });

      it('should return false for regular items', () => {
        expect(registry.isNoted(1)).toBe(false);
        expect(registry.isNoted(2)).toBe(false);
      });

      it('should return false for non-existent items', () => {
        expect(registry.isNoted(999)).toBe(false);
      });
    });

    describe('getUnnoted', () => {
      it('should return unnoted version ID', () => {
        expect(registry.getUnnoted(4)).toBe(1);
      });

      it('should return null for regular items', () => {
        expect(registry.getUnnoted(1)).toBeNull();
      });

      it('should return null for non-existent items', () => {
        expect(registry.getUnnoted(999)).toBeNull();
      });
    });

    describe('getNoted', () => {
      it('should return noted version ID', () => {
        const noteableItem: ItemDefinition = {
          ...mockSword,
          id: 7,
          noteable: true,
          notedId: 8
        };
        registry.register(noteableItem);
        
        expect(registry.getNoted(7)).toBe(8);
      });

      it('should return null for non-noteable items', () => {
        expect(registry.getNoted(1)).toBeNull();
      });

      it('should return null for non-existent items', () => {
        expect(registry.getNoted(999)).toBeNull();
      });
    });

    describe('isMembers', () => {
      it('should return true for members items', () => {
        const membersItem: ItemDefinition = {
          ...mockSword,
          id: 9,
          members: true
        };
        registry.register(membersItem);
        
        expect(registry.isMembers(9)).toBe(true);
      });

      it('should return false for non-members items', () => {
        expect(registry.isMembers(1)).toBe(false);
        expect(registry.isMembers(2)).toBe(false);
      });

      it('should return false for non-existent items', () => {
        expect(registry.isMembers(999)).toBe(false);
      });
    });
  });

  describe('getAll', () => {
    it('should return all registered items', () => {
      registry.register(mockSword);
      registry.register(mockCoins);
      registry.register(mockShield);
      
      const allItems = registry.getAll();
      
      expect(allItems).toHaveLength(3);
      expect(allItems).toContainEqual(mockSword);
      expect(allItems).toContainEqual(mockCoins);
      expect(allItems).toContainEqual(mockShield);
    });

    it('should return empty array when no items registered', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      registry.register(mockSword);
      registry.register(mockCoins);
      registry.register(mockShield);
      
      // Add more weapons
      const ironSword: ItemDefinition = {
        ...mockSword,
        id: 10,
        name: 'Iron Sword'
      };
      registry.register(ironSword);
    });

    it('should return all weapons', () => {
      const weapons = registry.getByCategory('weapon');
      
      expect(weapons).toHaveLength(2);
      expect(weapons.map(w => w.name)).toContain('Bronze Sword');
      expect(weapons.map(w => w.name)).toContain('Iron Sword');
    });

    it('should return all shields', () => {
      const shields = registry.getByCategory('shield');
      
      expect(shields).toHaveLength(1);
      expect(shields[0].name).toBe('Bronze Shield');
    });

    it('should return empty array for non-existent category', () => {
      expect(registry.getByCategory('armor')).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register(mockSword);
      registry.register(mockCoins);
      registry.register(mockShield);
      
      const ironSword: ItemDefinition = {
        ...mockSword,
        id: 10,
        name: 'Iron Sword'
      };
      registry.register(ironSword);
    });

    it('should find items by partial name match', () => {
      const results = registry.search('sword');
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('Bronze Sword');
      expect(results.map(r => r.name)).toContain('Iron Sword');
    });

    it('should be case insensitive', () => {
      const results = registry.search('BRONZE');
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('Bronze Sword');
      expect(results.map(r => r.name)).toContain('Bronze Shield');
    });

    it('should return empty array for no matches', () => {
      expect(registry.search('dragon')).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      registry.register(mockSword);
      registry.register(mockCoins);
      
      registry.clear();
      
      expect(registry.get(1)).toBeNull();
      expect(registry.get(2)).toBeNull();
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return number of registered items', () => {
      expect(registry.size()).toBe(0);
      
      registry.register(mockSword);
      expect(registry.size()).toBe(1);
      
      registry.register(mockCoins);
      expect(registry.size()).toBe(2);
      
      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });
}); 