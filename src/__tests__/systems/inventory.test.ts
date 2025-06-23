import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventorySystem } from '../../rpg/systems/InventorySystem';
import { ItemRegistry } from '../../rpg/systems/inventory/ItemRegistry';
import { EquipmentBonusCalculator } from '../../rpg/systems/inventory/EquipmentBonusCalculator';
import { RPGEntity } from '../../rpg/entities/RPGEntity';
import { MockWorld } from '../test-world-factory';
import { EquipmentSlot, WeaponType } from '../../rpg/types';
import type { 
  InventoryComponent, 
  StatsComponent, 
  ItemDefinition,
  CombatBonuses
} from '../../rpg/types';

// Mock items for testing
const mockItems: ItemDefinition[] = [
  {
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
  },
  {
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
  },
  {
    id: 3,
    name: 'Dragon Sword',
    examine: 'A powerful dragon sword.',
    value: 50000,
    weight: 2.2,
    stackable: false,
    equipable: true,
    tradeable: true,
    members: true,
    equipment: {
      slot: EquipmentSlot.WEAPON,
      requirements: { attack: { level: 60, xp: 0 } },
      bonuses: {
        attackStab: 40,
        attackSlash: 58,
        attackCrush: -2,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 0,
        defenseSlash: 3,
        defenseCrush: 2,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 40,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      },
      weaponType: WeaponType.SWORD,
      attackSpeed: 4
    },
    model: 'dragon_sword',
    icon: 'dragon_sword_icon'
  },
  {
    id: 4,
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
  },
  {
    id: 5,
    name: 'Dragon 2h Sword',
    examine: 'A massive two-handed dragon sword.',
    value: 100000,
    weight: 4,
    stackable: false,
    equipable: true,
    tradeable: true,
    members: true,
    equipment: {
      slot: EquipmentSlot.WEAPON,
      requirements: { attack: { level: 60, xp: 0 } },
      bonuses: {
        attackStab: 60,
        attackSlash: 93,
        attackCrush: 85,
        attackMagic: -4,
        attackRanged: 0,
        defenseStab: -4,
        defenseSlash: 2,
        defenseCrush: 1,
        defenseMagic: -4,
        defenseRanged: -4,
        meleeStrength: 87,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      },
      weaponType: WeaponType.SWORD,
      attackSpeed: 6,
      twoHanded: true
    },
    model: 'dragon_2h',
    icon: 'dragon_2h_icon'
  }
];

describe('InventorySystem', () => {
  let world: MockWorld;
  let inventorySystem: InventorySystem;
  let player: RPGEntity;
  let playerStats: StatsComponent;

  beforeEach(async () => {
    world = new MockWorld();
    inventorySystem = new InventorySystem(world as any);
    
    // Initialize the system
    await inventorySystem.init({});
    
    // Create a player entity
    player = new RPGEntity(world as any, 'player', {
      id: 'player-1',
      name: 'Test Player',
      position: { x: 0, y: 0, z: 0 }
    });
    
    // Add the player to the world's entities map so InventorySystem can find it
    world.entities.items.set(player.data.id, player);
    
    // Add stats component
    playerStats = {
      type: 'stats',
      entity: player as any,
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
    player.addComponent('stats', playerStats);
    
    // Trigger entity created event
    world.events.emit('entity:created', { entityId: player.data.id });
    
    // Register mock items
    const itemRegistry = (inventorySystem as any).itemRegistry as ItemRegistry;
    mockItems.forEach(item => itemRegistry.register(item));
  });

  describe('initialization', () => {
    it('should create inventory component for player entities', () => {
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory).toBeDefined();
      expect(inventory?.items.length).toBe(28);
      expect(inventory?.maxSlots).toBe(28);
      expect(inventory?.totalWeight).toBe(0);
    });

    it('should initialize equipment slots', () => {
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipment).toBeDefined();
      expect(inventory?.equipment[EquipmentSlot.WEAPON]).toBeNull();
      expect(inventory?.equipment[EquipmentSlot.SHIELD]).toBeNull();
      expect(inventory?.equipment[EquipmentSlot.HEAD]).toBeNull();
    });
  });

  describe('addItem', () => {
    it('should add non-stackable item to inventory', () => {
      const result = inventorySystem.addItem(player.data.id, 1, 1); // Bronze sword
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toEqual({ itemId: 1, quantity: 1 });
    });

    it('should add stackable items to same slot', () => {
      inventorySystem.addItem(player.data.id, 2, 100); // 100 coins
      const result = inventorySystem.addItem(player.data.id, 2, 50); // 50 more coins
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toEqual({ itemId: 2, quantity: 150 });
      expect(inventory?.items[1]).toBeNull();
    });

    it('should add multiple non-stackable items to different slots', () => {
      inventorySystem.addItem(player.data.id, 1, 3); // 3 bronze swords
      
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toEqual({ itemId: 1, quantity: 1 });
      expect(inventory?.items[1]).toEqual({ itemId: 1, quantity: 1 });
      expect(inventory?.items[2]).toEqual({ itemId: 1, quantity: 1 });
      expect(inventory?.items[3]).toBeNull();
    });

    it('should return false when inventory is full', () => {
      // Fill inventory with bronze swords
      for (let i = 0; i < 28; i++) {
        inventorySystem.addItem(player.data.id, 1, 1);
      }
      
      const result = inventorySystem.addItem(player.data.id, 1, 1);
      expect(result).toBe(false);
    });

    it('should emit item-added event', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      inventorySystem.addItem(player.data.id, 1, 1);
      
      expect(eventSpy).toHaveBeenCalledWith('inventory:item-added', {
        entityId: player.data.id,
        itemId: 1,
        quantity: 1,
        slot: 0
      });
    });

    it('should update inventory weight', () => {
      inventorySystem.addItem(player.data.id, 1, 1); // Bronze sword (2.2 weight)
      inventorySystem.addItem(player.data.id, 4, 1); // Bronze shield (3 weight)
      
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.totalWeight).toBe(5.2);
    });
  });

  describe('removeItem', () => {
    beforeEach(() => {
      inventorySystem.addItem(player.data.id, 2, 100); // Add 100 coins to slot 0
      inventorySystem.addItem(player.data.id, 1, 1);   // Add bronze sword to slot 1
    });

    it('should remove entire item stack', () => {
      const removed = inventorySystem.removeItem(player.data.id, 1);
      
      expect(removed).toEqual({ itemId: 1, quantity: 1 });
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[1]).toBeNull();
    });

    it('should remove partial stack', () => {
      const removed = inventorySystem.removeItem(player.data.id, 0, 30);
      
      expect(removed).toEqual({ itemId: 2, quantity: 30 });
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toEqual({ itemId: 2, quantity: 70 });
    });

    it('should return null for empty slot', () => {
      const removed = inventorySystem.removeItem(player.data.id, 5);
      expect(removed).toBeNull();
    });

    it('should emit item-removed event', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      inventorySystem.removeItem(player.data.id, 0, 50);
      
      expect(eventSpy).toHaveBeenCalledWith('inventory:item-removed', {
        entityId: player.data.id,
        itemId: 2,
        quantity: 50,
        slot: 0
      });
    });

    it('should update weight after removal', () => {
      inventorySystem.removeItem(player.data.id, 1); // Remove bronze sword
      
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.totalWeight).toBe(0); // Only coins left (0 weight)
    });
  });

  describe('moveItem', () => {
    beforeEach(() => {
      inventorySystem.addItem(player.data.id, 1, 1); // Bronze sword in slot 0
      inventorySystem.addItem(player.data.id, 2, 100); // Coins in slot 1
    });

    it('should swap items between slots', () => {
      const result = inventorySystem.moveItem(player.data.id, 0, 1);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toEqual({ itemId: 2, quantity: 100 });
      expect(inventory?.items[1]).toEqual({ itemId: 1, quantity: 1 });
    });

    it('should move item to empty slot', () => {
      const result = inventorySystem.moveItem(player.data.id, 0, 5);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toBeNull();
      expect(inventory?.items[5]).toEqual({ itemId: 1, quantity: 1 });
    });

    it('should return false for invalid slots', () => {
      expect(inventorySystem.moveItem(player.data.id, -1, 0)).toBe(false);
      expect(inventorySystem.moveItem(player.data.id, 0, 28)).toBe(false);
      expect(inventorySystem.moveItem(player.data.id, 30, 0)).toBe(false);
    });

    it('should emit item-moved event', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      inventorySystem.moveItem(player.data.id, 0, 5);
      
      expect(eventSpy).toHaveBeenCalledWith('inventory:item-moved', {
        entityId: player.data.id,
        fromSlot: 0,
        toSlot: 5
      });
    });
  });

  describe('equipItem', () => {
    beforeEach(() => {
      inventorySystem.addItem(player.data.id, 1, 1); // Bronze sword in slot 0
    });

    it('should equip item from inventory', () => {
      const result = inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toBeNull();
      expect(inventory?.equipment[EquipmentSlot.WEAPON]?.id).toBe(1);
    });

    it('should update combat bonuses when equipping', () => {
      inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON);
      
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipmentBonuses.attackSlash).toBe(5);
      expect(inventory?.equipmentBonuses.meleeStrength).toBe(4);
      
      // Should also update stats component
      expect(playerStats.combatBonuses.attackSlash).toBe(5);
      expect(playerStats.combatBonuses.meleeStrength).toBe(4);
    });

    it('should check level requirements', () => {
      inventorySystem.addItem(player.data.id, 3, 1); // Dragon sword (requires 60 attack)
      
      const result = inventorySystem.equipItem(player, 1, EquipmentSlot.WEAPON);
      
      expect(result).toBe(false);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[1]).toEqual({ itemId: 3, quantity: 1 });
      expect(inventory?.equipment[EquipmentSlot.WEAPON]).toBeNull();
    });

    it('should swap equipped items', () => {
      // Equip bronze sword
      inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON);
      
      // Add dragon sword and make player high level
      playerStats.attack.level = 60;
      inventorySystem.addItem(player.data.id, 3, 1);
      
      // Equip dragon sword
      const result = inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipment[EquipmentSlot.WEAPON]?.id).toBe(3);
      expect(inventory?.items[0]).toEqual({ itemId: 1, quantity: 1 }); // Bronze sword back in inventory
    });

    it('should handle two-handed weapons with shield', () => {
      // Equip shield first
      inventorySystem.addItem(player.data.id, 4, 1); // Bronze shield
      inventorySystem.equipItem(player, 1, EquipmentSlot.SHIELD);
      
      // Try to equip two-handed weapon
      playerStats.attack.level = 60;
      inventorySystem.addItem(player.data.id, 5, 1); // Dragon 2h
      
      const result = inventorySystem.equipItem(player, 1, EquipmentSlot.WEAPON);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipment[EquipmentSlot.WEAPON]?.id).toBe(5);
      expect(inventory?.equipment[EquipmentSlot.SHIELD]).toBeNull();
      // Find where the shield was placed
      let shieldSlot = -1;
      for (let i = 0; i < inventory!.items.length; i++) {
        if (inventory!.items[i]?.itemId === 4) {
          shieldSlot = i;
          break;
        }
      }
      expect(shieldSlot).toBeGreaterThanOrEqual(0); // Shield should be somewhere in inventory
      expect(inventory?.items[shieldSlot]).toEqual({ itemId: 4, quantity: 1 }); // Shield back in inventory
    });

    it('should prevent shield with two-handed weapon', () => {
      // Equip two-handed weapon
      playerStats.attack.level = 60;
      inventorySystem.addItem(player.data.id, 5, 1); // Dragon 2h
      inventorySystem.equipItem(player, 1, EquipmentSlot.WEAPON);
      
      // Try to equip shield
      inventorySystem.addItem(player.data.id, 4, 1); // Bronze shield
      const result = inventorySystem.equipItem(player, 1, EquipmentSlot.SHIELD);
      
      expect(result).toBe(false);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipment[EquipmentSlot.SHIELD]).toBeNull();
    });

    it('should emit item-equipped event', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON);
      
      expect(eventSpy).toHaveBeenCalledWith('inventory:item-equipped', {
        entityId: player.data.id,
        itemId: 1,
        slot: EquipmentSlot.WEAPON
      });
    });
  });

  describe('unequipItem', () => {
    beforeEach(() => {
      inventorySystem.addItem(player.data.id, 1, 1);
      inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON);
    });

    it('should unequip item to inventory', () => {
      const result = inventorySystem.unequipItem(player, EquipmentSlot.WEAPON);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipment[EquipmentSlot.WEAPON]).toBeNull();
      expect(inventory?.items[0]).toEqual({ itemId: 1, quantity: 1 });
    });

    it('should update bonuses when unequipping', () => {
      inventorySystem.unequipItem(player, EquipmentSlot.WEAPON);
      
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipmentBonuses.attackSlash).toBe(0);
      expect(inventory?.equipmentBonuses.meleeStrength).toBe(0);
    });

    it('should return false when inventory is full', () => {
      // Fill inventory with non-stackable items
      for (let i = 0; i < 28; i++) {
        inventorySystem.addItem(player.data.id, 1, 1); // Bronze swords
      }
      
      const result = inventorySystem.unequipItem(player, EquipmentSlot.WEAPON);
      
      expect(result).toBe(false);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipment[EquipmentSlot.WEAPON]?.id).toBe(1);
    });

    it('should emit item-unequipped event', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      inventorySystem.unequipItem(player, EquipmentSlot.WEAPON);
      
      expect(eventSpy).toHaveBeenCalledWith('inventory:item-unequipped', {
        entityId: player.data.id,
        itemId: 1,
        slot: EquipmentSlot.WEAPON
      });
    });
  });

  describe('dropItem', () => {
    beforeEach(() => {
      inventorySystem.addItem(player.data.id, 2, 100); // 100 coins
    });

    it('should drop entire stack', () => {
      const result = inventorySystem.dropItem(player.data.id, 0);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toBeNull();
    });

    it('should drop partial stack', () => {
      const result = inventorySystem.dropItem(player.data.id, 0, 30);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]).toEqual({ itemId: 2, quantity: 70 });
    });

    it('should emit item-dropped event with position', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      inventorySystem.dropItem(player.data.id, 0, 50);
      
      expect(eventSpy).toHaveBeenCalledWith('inventory:item-dropped', {
        entityId: player.data.id,
        itemId: 2,
        quantity: 50,
        position: { x: 0, y: 0, z: 0 }
      });
    });
  });

  describe('utility methods', () => {
    it('should calculate total weight correctly', () => {
      inventorySystem.addItem(player.data.id, 1, 2); // 2 bronze swords (2.2 each)
      inventorySystem.addItem(player.data.id, 4, 1); // 1 bronze shield (3)
      inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON); // Equip one sword
      
      const weight = inventorySystem.getWeight(player.data.id);
      expect(weight).toBe(7.4); // 2.2 + 2.2 + 3
    });

    it('should count free slots', () => {
      inventorySystem.addItem(player.data.id, 1, 5); // 5 items
      
      const freeSlots = inventorySystem.getFreeSlots(player.data.id);
      expect(freeSlots).toBe(23);
    });

    it('should find item in inventory', () => {
      inventorySystem.addItem(player.data.id, 1, 1); // Bronze sword in slot 0
      inventorySystem.addItem(player.data.id, 2, 100); // Coins in slot 1
      
      expect(inventorySystem.findItem(player.data.id, 2)).toBe(1);
      expect(inventorySystem.findItem(player.data.id, 3)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle invalid entity IDs', () => {
      expect(inventorySystem.addItem('invalid-id', 1, 1)).toBe(false);
      expect(inventorySystem.removeItem('invalid-id', 0)).toBeNull();
      expect(inventorySystem.moveItem('invalid-id', 0, 1)).toBe(false);
      // Since equipItem takes RPGEntity, we can't test with invalid string - create a dummy entity instead
      const invalidPlayer = { data: { id: 'invalid-id' } } as any as RPGEntity;
      expect(inventorySystem.equipItem(invalidPlayer, 0, EquipmentSlot.WEAPON)).toBe(false);
      // unequipItem expects RPGEntity, not string - so we can't test invalid string here
      // Instead, test that unequipping from an empty slot returns false
      expect(inventorySystem.unequipItem(player, EquipmentSlot.WEAPON)).toBe(false); // Nothing equipped
    });

    it('should handle stack overflow gracefully', () => {
      const MAX_INT = 2147483647;
      inventorySystem.addItem(player.data.id, 2, MAX_INT);
      
      const result = inventorySystem.addItem(player.data.id, 2, 1);
      
      expect(result).toBe(true);
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.items[0]?.quantity).toBe(MAX_INT);
      expect(inventory?.items[1]).toEqual({ itemId: 2, quantity: 1 });
    });

    it('should handle equipment without bonuses', () => {
      const itemWithoutBonuses: ItemDefinition = {
        id: 99,
        name: 'Test Item',
        examine: 'A test item',
        value: 1,
        weight: 1,
        stackable: false,
        equipable: true,
        tradeable: true,
        members: false,
        equipment: {
          slot: EquipmentSlot.CAPE,
          requirements: {},
          bonuses: {
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
        },
        model: 'test',
        icon: 'test'
      };
      
      const itemRegistry = (inventorySystem as any).itemRegistry as ItemRegistry;
      itemRegistry.register(itemWithoutBonuses);
      
      inventorySystem.addItem(player.data.id, 99, 1);
      inventorySystem.equipItem(player, 0, EquipmentSlot.WEAPON);
      
      const inventory = player.getComponent<InventoryComponent>('inventory');
      expect(inventory?.equipment[EquipmentSlot.CAPE]?.id).toBe(99);
    });
  });

  describe('network synchronization', () => {
    it('should emit sync event on inventory changes', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      inventorySystem.addItem(player.data.id, 1, 1);
      
      expect(eventSpy).toHaveBeenCalledWith('inventory:sync', expect.objectContaining({
        entityId: player.data.id,
        items: expect.any(Array),
        equipment: expect.any(Object),
        weight: expect.any(Number),
        bonuses: expect.any(Object)
      }));
    });
  });

  describe('system messages', () => {
    it('should send system messages for errors', () => {
      const eventSpy = vi.spyOn(world.events, 'emit');
      
      // Fill inventory
      for (let i = 0; i < 28; i++) {
        inventorySystem.addItem(player.data.id, 1, 1);
      }
      
      // Try to add another item
      inventorySystem.addItem(player.data.id, 1, 1);
      
      expect(eventSpy).toHaveBeenCalledWith('chat:system', {
        targetId: player.data.id,
        message: 'Your inventory is full.'
      });
    });
  });
});

describe('EquipmentBonusCalculator', () => {
  let calculator: EquipmentBonusCalculator;
  let itemRegistry: ItemRegistry;
  let equipment: { [K in EquipmentSlot]: ItemDefinition | null };
  
  beforeEach(() => {
    itemRegistry = new ItemRegistry();
    calculator = new EquipmentBonusCalculator(itemRegistry);
    
    // Register test items with bonuses
    const helmet: ItemDefinition = {
      id: 100,
      name: 'Rune Full Helm',
      examine: '',
      value: 21000,
      weight: 2.7,
      stackable: false,
      equipable: true,
      tradeable: true,
      members: false,
      equipment: {
        slot: EquipmentSlot.HEAD,
        requirements: {},
        bonuses: {
          attackStab: 0,
          attackSlash: 0,
          attackCrush: 0,
          attackMagic: -6,
          attackRanged: -2,
          defenseStab: 30,
          defenseSlash: 32,
          defenseCrush: 27,
          defenseMagic: -1,
          defenseRanged: 30,
          meleeStrength: 0,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        }
      },
      model: '',
      icon: ''
    };
    
    const platebody: ItemDefinition = {
      id: 101,
      name: 'Rune Platebody',
      examine: '',
      value: 65000,
      weight: 9.5,
      stackable: false,
      equipable: true,
      tradeable: true,
      members: false,
      equipment: {
        slot: EquipmentSlot.BODY,
        requirements: {},
        bonuses: {
          attackStab: 0,
          attackSlash: 0,
          attackCrush: 0,
          attackMagic: -30,
          attackRanged: -10,
          defenseStab: 82,
          defenseSlash: 80,
          defenseCrush: 72,
          defenseMagic: -6,
          defenseRanged: 80,
          meleeStrength: 0,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        }
      },
      model: '',
      icon: ''
    };
    
    const legs: ItemDefinition = {
      id: 102,
      name: 'Rune Platelegs',
      examine: '',
      value: 64000,
      weight: 9.0,
      stackable: false,
      equipable: true,
      tradeable: true,
      members: false,
      equipment: {
        slot: EquipmentSlot.LEGS,
        requirements: {},
        bonuses: {
          attackStab: 0,
          attackSlash: 0,
          attackCrush: 0,
          attackMagic: -21,
          attackRanged: -7,
          defenseStab: 51,
          defenseSlash: 49,
          defenseCrush: 47,
          defenseMagic: -4,
          defenseRanged: 49,
          meleeStrength: 0,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        }
      },
      model: '',
      icon: ''
    };
    
    itemRegistry.register(helmet);
    itemRegistry.register(platebody);
    itemRegistry.register(legs);
    
    equipment = {
      [EquipmentSlot.HEAD]: helmet,
      [EquipmentSlot.CAPE]: null,
      [EquipmentSlot.AMULET]: null,
      [EquipmentSlot.WEAPON]: null,
      [EquipmentSlot.BODY]: platebody,
      [EquipmentSlot.SHIELD]: null,
      [EquipmentSlot.LEGS]: legs,
      [EquipmentSlot.GLOVES]: null,
      [EquipmentSlot.BOOTS]: null,
      [EquipmentSlot.RING]: null,
      [EquipmentSlot.AMMO]: null
    };
  });
  
  describe('Bonus Calculation', () => {
    it('should calculate total equipment bonuses', () => {
      const bonuses = calculator.calculateTotalBonuses(equipment);
      
      // Sum of all equipped items
      expect(bonuses.attackStab).toBe(0);
      expect(bonuses.attackMagic).toBe(-57); // -6 + -30 + -21
      expect(bonuses.defenseStab).toBe(163); // 30 + 82 + 51
      expect(bonuses.defenseSlash).toBe(161); // 32 + 80 + 49
      expect(bonuses.defenseCrush).toBe(146); // 27 + 72 + 47
    });
    
    it('should handle empty equipment slots', () => {
      equipment[EquipmentSlot.HEAD] = null;
      equipment[EquipmentSlot.BODY] = null;
      equipment[EquipmentSlot.LEGS] = null;
      
      const bonuses = calculator.calculateTotalBonuses(equipment);
      
      // All bonuses should be 0
      Object.values(bonuses).forEach(bonus => {
        expect(bonus).toBe(0);
      });
    });
    
    it('should calculate weight from equipment', () => {
      const weight = calculator.getEquipmentWeight(equipment);
      
      expect(weight).toBeCloseTo(21.2); // 2.7 + 9.5 + 9.0
    });
  });
});

describe('ItemRegistry', () => {
  let registry: ItemRegistry;
  
  beforeEach(() => {
    registry = new ItemRegistry();
  });
  
  describe('Item Registration', () => {
    it('should register and retrieve items', () => {
      const item: ItemDefinition = {
        id: 1001,
        name: 'Test Item',
        examine: '',
        value: 10,
        weight: 1,
        stackable: false,
        equipable: true,
        tradeable: true,
        members: false,
        equipment: {
          slot: EquipmentSlot.CAPE,
          requirements: {},
          bonuses: {
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
        },
        model: '',
        icon: ''
      };
      
      registry.register(item);
      
      expect(registry.get(1001)).toEqual(item);
      expect(registry.get(1001) !== null).toBe(true);
    });
    
    it('should handle non-existent items', () => {
      expect(registry.get(9999)).toBe(null);
      expect(registry.get(9999) !== null).toBe(false);
    });
    
    it('should register multiple items', () => {
      const items: ItemDefinition[] = [
        {
          id: 1002,
          name: 'Item 1',
          examine: '',
          value: 10,
          weight: 1,
          stackable: false,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.CAPE,
            requirements: {},
            bonuses: {
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
          },
          model: '',
          icon: ''
        },
        {
          id: 1003,
          name: 'Item 2',
          examine: '',
          value: 5,
          weight: 0.1,
          stackable: true,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.CAPE,
            requirements: {},
            bonuses: {
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
          },
          model: '',
          icon: ''
        }
      ];
      
      items.forEach(item => registry.register(item));
      
      expect(registry.get(1002) !== null).toBe(true);
      expect(registry.get(1003) !== null).toBe(true);
    });
  });
  
  describe('Item Queries', () => {
    beforeEach(() => {
      const items: ItemDefinition[] = [
        {
          id: 2001,
          name: 'Sword',
          examine: '',
          value: 100,
          weight: 2,
          stackable: false,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.WEAPON,
            requirements: {},
            bonuses: {
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
          },
          model: '',
          icon: ''
        },
        {
          id: 2002,
          name: 'Shield',
          examine: '',
          value: 80,
          weight: 3,
          stackable: false,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.SHIELD,
            requirements: {},
            bonuses: {
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
          },
          model: '',
          icon: ''
        },
        {
          id: 2003,
          name: 'Bread',
          examine: '',
          value: 5,
          weight: 0.5,
          stackable: false,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.CAPE,
            requirements: {},
            bonuses: {
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
          },
          model: '',
          icon: ''
        },
        {
          id: 995,
          name: 'Coins',
          examine: '',
          value: 1,
          weight: 0,
          stackable: true,
          equipable: true,
          tradeable: true,
          members: false,
          equipment: {
            slot: EquipmentSlot.CAPE,
            requirements: {},
            bonuses: {
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
          },
          model: '',
          icon: ''
        }
      ];
      
      items.forEach(item => registry.register(item));
    });
    
    it('should get items by type', () => {
      const weapons = registry.getByCategory('weapon');
      const capes = registry.getByCategory('cape');
      
      expect(weapons).toHaveLength(1);
      expect(weapons[0].id).toBe(2001);
      expect(capes).toHaveLength(2); // bread and coins both have cape slot
      expect(capes.find(i => i.id === 2003)).toBeDefined();
    });
    
    it('should get all items', () => {
      const allItems = registry.getAll();
      
      expect(allItems).toHaveLength(4);
      expect(allItems.map(i => i.id)).toContain('sword');
      expect(allItems.map(i => i.id)).toContain('shield');
      expect(allItems.map(i => i.id)).toContain('bread');
      expect(allItems.map(i => i.id)).toContain('coins');
    });
  });
}); 