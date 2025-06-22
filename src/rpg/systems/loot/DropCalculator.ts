import { LootTable, LootDrop, RPGEntity, StatsComponent } from '../../types';

export class DropCalculator {
  /**
   * Calculate drops from a loot table
   */
  calculateDrops(lootTable: LootTable, _killer?: RPGEntity | null): LootDrop[] {
    const drops: LootDrop[] = [];
    
    // Add always drops
    for (const drop of lootTable.drops) {
      if (drop.rarity === 'always') {
        drops.push(this.createDrop(drop));
      }
    }
    
    // Roll for other drops
    const regularDrops = lootTable.drops.filter(d => d.rarity !== 'always');
    if (regularDrops.length > 0) {
      const rolled = this.rollWeightedDrop(regularDrops);
      if (rolled) {
        drops.push(this.createDrop(rolled));
      }
    }
    
    // Check for rare drop table access
    if (lootTable.rareDropTable && Math.random() < 0.01) { // 1% chance
      // Would roll on rare drop table here
      console.log('[DropCalculator] Rare drop table access!');
    }
    
    return drops;
  }
  
  /**
   * Roll for a weighted drop
   */
  private rollWeightedDrop(drops: LootDrop[]): LootDrop | null {
    const totalWeight = drops.reduce((sum, drop) => sum + drop.weight, 0);
    if (totalWeight === 0) return null;
    
    let roll = Math.random() * totalWeight;
    
    for (const drop of drops) {
      roll -= drop.weight;
      if (roll <= 0) {
        // Check rarity chance
        if (this.checkRarity(drop.rarity)) {
          return drop;
        }
        break;
      }
    }
    
    return null;
  }
  
  /**
   * Check if rarity roll succeeds
   */
  private checkRarity(rarity: string): boolean {
    const rarityChances: Record<string, number> = {
      'common': 1.0,
      'uncommon': 0.25,
      'rare': 0.05,
      'very_rare': 0.01,
      'ultra_rare': 0.001
    };
    
    const chance = rarityChances[rarity] || 1.0;
    return Math.random() < chance;
  }
  
  /**
   * Create a drop with rolled quantity
   */
  private createDrop(template: LootDrop): LootDrop {
    // LootDrop already has quantity as a number, no need to roll
    return {
      itemId: template.itemId,
      quantity: template.quantity,
      weight: template.weight,
      rarity: template.rarity
    };
  }
  
  /**
   * Roll quantity within range (for future use with range-based drops)
   */
  // private rollQuantity(range: { min: number; max: number }): number {
  //   if (range.min === range.max) return range.min;
  //   return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  // }
  
  /**
   * Apply drop modifiers (e.g., ring of wealth)
   */
  applyModifiers(drops: LootDrop[], killer?: RPGEntity | null): LootDrop[] {
    if (!killer) return drops;
    
    // Check for drop modifiers
    const stats = killer.getComponent<StatsComponent>('stats');
    if (!stats) return drops;
    
    // Apply drop modifiers including ring of wealth
    return this.applyDropModifiers(drops, killer);
  }
  
  /**
   * Apply drop modifiers (ring of wealth, etc.)
   */
  private applyDropModifiers(drops: LootDrop[], killer?: RPGEntity): LootDrop[] {
    // Check for ring of wealth, etc.
    if (killer) {
      const hasRingOfWealth = this.hasRingOfWealth(killer);
      
      if (hasRingOfWealth) {
        // Ring of wealth effects:
        // 1. Removes empty drops from rare drop table
        drops = drops.filter(drop => drop.itemId !== 0);
        
        // 2. Slightly improves chances for rare drops
        drops = drops.map(drop => {
          // Check if it's a rare drop (you might want to add rarity to ItemDrop)
          const isRareDrop = this.isRareDrop(drop.itemId);
          if (isRareDrop) {
            // Add 1-2 extra quantity to rare drops occasionally
            if (Math.random() < 0.1) { // 10% chance
              return {
                ...drop,
                quantity: drop.quantity + Math.floor(Math.random() * 2) + 1
              };
            }
          }
          return drop;
        });
      }
      
      // Check for other drop modifiers
      const hasLootingEnchant = this.hasLootingEnchantment(killer);
      if (hasLootingEnchant) {
        // Increase quantity of drops
        drops = drops.map(drop => ({
          ...drop,
          quantity: Math.floor(drop.quantity * 1.2) // 20% increase
        }));
      }
    }
    
    return drops;
  }
  
  /**
   * Check if player has ring of wealth equipped
   */
  private hasRingOfWealth(entity: RPGEntity): boolean {
    const inventory = entity.getComponent<any>('inventory');
    if (!inventory) return false;
    
    const ring = inventory.equipment?.ring;
    return ring && (
      ring.name === 'Ring of wealth' || 
      ring.name === 'Ring of wealth (i)'
    );
  }
  
  /**
   * Check if player has looting enchantment
   */
  private hasLootingEnchantment(entity: RPGEntity): boolean {
    const inventory = entity.getComponent<any>('inventory');
    if (!inventory) return false;
    
    const weapon = inventory.equipment?.weapon;
    return weapon && weapon.enchantments?.includes('looting');
  }
  
  /**
   * Check if item is considered a rare drop
   */
  private isRareDrop(itemId: number): boolean {
    // Define rare item IDs (you might want to load this from config)
    const rareItems = [
      1249, // Dragon spear
      4087, // Dragon platelegs
      4585, // Dragon plateskirt
      11840, // Dragon boots
      6571, // Uncut onyx
      2577, // Ranger boots
      // Add more rare item IDs
    ];
    
    return rareItems.includes(itemId);
  }
} 