import type { ItemDefinition, EquipmentSlot } from '../../types';
import { WeaponType } from '../../types';

export class ItemRegistry {
  private items: Map<number, ItemDefinition> = new Map();
  private nameIndex: Map<string, ItemDefinition> = new Map();

  /**
   * Register an item definition
   */
  register(item: ItemDefinition): void {
    this.items.set(item.id, item);
    this.nameIndex.set(item.name, item);
  }

  /**
   * Get item by ID
   */
  get(itemId: number): ItemDefinition | null {
    return this.items.get(itemId) || null;
  }

  /**
   * Get item by exact name
   */
  getByName(name: string): ItemDefinition | null {
    return this.nameIndex.get(name) || null;
  }

  /**
   * Check if item is stackable
   */
  isStackable(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? item.stackable : false;
  }

  /**
   * Check if item is equipable
   */
  isEquipable(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? item.equipable : false;
  }

  /**
   * Check if item is tradeable
   */
  isTradeable(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? item.tradeable : false;
  }

  /**
   * Check if item can be noted
   */
  isNoteable(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? (item.noteable === true && !item.noted) : false;
  }

  /**
   * Check if item is noted
   */
  isNoted(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? (item.noted === true) : false;
  }

  /**
   * Get unnoted version ID
   */
  getUnnoted(itemId: number): number | null {
    const item = this.get(itemId);
    return (item && item.noted && item.notedId) ? item.notedId : null;
  }

  /**
   * Get noted version ID
   */
  getNoted(itemId: number): number | null {
    const item = this.get(itemId);
    return (item && item.noteable && item.notedId) ? item.notedId : null;
  }

  /**
   * Check if item is members only
   */
  isMembers(itemId: number): boolean {
    const item = this.get(itemId);
    return item ? item.members : false;
  }

  /**
   * Get all registered items
   */
  getAll(): ItemDefinition[] {
    return Array.from(this.items.values());
  }

  /**
   * Get items by category (equipment slot)
   */
  getByCategory(category: string): ItemDefinition[] {
    const results: ItemDefinition[] = [];
    
    for (const item of this.items.values()) {
      if (item.equipment) {
        const slot = item.equipment.slot.toLowerCase();
        if (slot === category.toLowerCase()) {
          results.push(item);
        }
      }
    }
    
    return results;
  }

  /**
   * Search items by name (case insensitive partial match)
   */
  search(query: string): ItemDefinition[] {
    const lowerQuery = query.toLowerCase();
    const results: ItemDefinition[] = [];
    
    for (const item of this.items.values()) {
      if (item.name.toLowerCase().includes(lowerQuery)) {
        results.push(item);
      }
    }
    
    return results;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear();
    this.nameIndex.clear();
  }

  /**
   * Get number of registered items
   */
  size(): number {
    return this.items.size;
  }

  /**
   * Load default items (called by InventorySystem)
   */
  loadDefaults(): void {
    // Bronze tier weapons
    this.register({
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
        slot: 'weapon' as EquipmentSlot,
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
    });

    // Currency
    this.register({
      id: 995,
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
    });

    // Food
    this.register({
      id: 315,
      name: 'Shrimps',
      examine: 'Some nicely cooked shrimps.',
      value: 5,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'shrimps',
      icon: 'shrimps_icon'
    });

    // Bones (always dropped by NPCs)
    this.register({
      id: 526,
      name: 'Bones',
      examine: 'These would be good for prayer training.',
      value: 1,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'bones',
      icon: 'bones_icon'
    });
  }
} 