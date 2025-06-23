import { System } from '../../core/systems/System';
import type { World } from '../../types';
import type { PlayerEntity, ItemStack, ItemValue } from '../types';
import { ItemRegistry } from './inventory/ItemRegistry';

export interface BankTab {
  items: (ItemStack | null)[];
  name?: string;
}

export interface BankAccount {
  playerId: string;
  tabs: BankTab[];
  pin?: string;
  pinAttempts: number;
  lastPinAttempt?: number;
  totalSlots: number;
  usedSlots: number;
}

export class BankingSystem extends System {
  private static readonly DEFAULT_BANK_SIZE = 816; // 8 tabs * 102 slots per tab
  private static readonly SLOTS_PER_TAB = 102;
  private static readonly DEFAULT_TABS = 8;
  private static readonly MAX_PIN_ATTEMPTS = 3;
  private static readonly PIN_LOCKOUT_TIME = 300000; // 5 minutes in milliseconds
  
  private bankAccounts: Map<string, BankAccount> = new Map();
  private bankBooths: Set<string> = new Set();
  private playerBankOpen: Map<string, boolean> = new Map();
  private itemRegistry: ItemRegistry;

  constructor(world: World) {
    super(world);
    this.itemRegistry = new ItemRegistry();
    this.itemRegistry.loadDefaults();
    this.initializeBankBooths();
  }

  private initializeBankBooths(): void {
    // Register default bank booth locations
    this.bankBooths.add('bank_varrock_west');
    this.bankBooths.add('bank_varrock_east');
    this.bankBooths.add('bank_lumbridge');
    this.bankBooths.add('bank_falador_west');
    this.bankBooths.add('bank_falador_east');
    this.bankBooths.add('bank_edgeville');
  }

  registerBankBooth(boothId: string): void {
    this.bankBooths.add(boothId);
  }

  private getOrCreateAccount(playerId: string): BankAccount {
    if (!this.bankAccounts.has(playerId)) {
      const tabs: BankTab[] = [];
      for (let i = 0; i < BankingSystem.DEFAULT_TABS; i++) {
        tabs.push({
          items: new Array(BankingSystem.SLOTS_PER_TAB).fill(null),
          name: i === 0 ? 'Main' : undefined
        });
      }

      this.bankAccounts.set(playerId, {
        playerId,
        tabs,
        pinAttempts: 0,
        totalSlots: BankingSystem.DEFAULT_BANK_SIZE,
        usedSlots: 0
      });
    }
    return this.bankAccounts.get(playerId)!;
  }

  openBank(player: PlayerEntity, bankBoothId: string): boolean {
    if (!this.bankBooths.has(bankBoothId)) {
      this.world.events.emit('bank:error', {
        playerId: player.id,
        error: 'Invalid bank booth'
      });
      return false;
    }

    const account = this.getOrCreateAccount(player.id);

    // Check PIN
    if (account.pin && !this.isPinVerified(player.id)) {
      this.world.events.emit('bank:pin_required', {
        playerId: player.id
      });
      return false;
    }

    this.playerBankOpen.set(player.id, true);
    
    this.world.events.emit('bank:opened', {
      playerId: player.id,
      bankData: this.getBankData(account)
    });

    return true;
  }

  closeBank(player: PlayerEntity): void {
    this.playerBankOpen.delete(player.id);
    
    this.world.events.emit('bank:closed', {
      playerId: player.id
    });
  }

  isBankOpen(playerId: string): boolean {
    return this.playerBankOpen.get(playerId) || false;
  }

  depositItem(player: PlayerEntity, inventorySlot: number, quantity?: number): boolean {
    if (!this.isBankOpen(player.id)) {
      return false;
    }

    const inventory = player.getComponent('inventory') as any;
    if (!inventory) {
      return false;
    }

    const item = inventory.items[inventorySlot];
    if (!item) {
      return false;
    }

    const account = this.getOrCreateAccount(player.id);
    const depositAmount = quantity || item.quantity || 1;

    // Check if we have space
    const existingStack = this.findItemInBank(account, item.itemId);
    if (!existingStack && account.usedSlots >= account.totalSlots) {
      this.world.events.emit('bank:error', {
        playerId: player.id,
        error: 'Bank is full'
      });
      return false;
    }

    // Find inventory system to remove item
    const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem');
    if (!inventorySystem) {
      return false;
    }

    // Remove from inventory
    const removed = (inventorySystem as any).removeItem(player.id, inventorySlot, depositAmount);
    if (!removed) {
      return false;
    }

    // Add to bank
    if (existingStack) {
      existingStack.quantity = (existingStack.quantity || 1) + depositAmount;
    } else {
      // Find first empty slot
      for (const tab of account.tabs) {
        const emptyIndex = tab.items.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
          tab.items[emptyIndex] = {
            itemId: item.itemId,
            quantity: depositAmount
          };
          account.usedSlots++;
          break;
        }
      }
    }

    this.world.events.emit('bank:deposit', {
      playerId: player.id,
      itemId: item.itemId,
      quantity: depositAmount
    });

    return true;
  }

  depositAll(player: PlayerEntity): void {
    if (!this.isBankOpen(player.id)) {
      return;
    }

    const inventory = player.getComponent('inventory') as any;
    if (!inventory) {
      return;
    }

    // Deposit all items from inventory
    for (let i = inventory.items.length - 1; i >= 0; i--) {
      if (inventory.items[i]) {
        this.depositItem(player, i);
      }
    }
  }

  withdrawItem(player: PlayerEntity, tabIndex: number, slotIndex: number, quantity?: number): boolean {
    if (!this.isBankOpen(player.id)) {
      return false;
    }

    const account = this.getOrCreateAccount(player.id);
    
    if (tabIndex < 0 || tabIndex >= account.tabs.length) {
      return false;
    }

    const tab = account.tabs[tabIndex];
    const item = tab.items[slotIndex];
    
    if (!item) {
      return false;
    }

    const withdrawAmount = Math.min(quantity || item.quantity || 1, item.quantity || 1);

    // Find inventory system to add item
    const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem');
    if (!inventorySystem) {
      return false;
    }

    // Try to add to inventory
    const added = (inventorySystem as any).addItem(player.id, item.itemId, withdrawAmount);
    if (!added) {
      this.world.events.emit('bank:error', {
        playerId: player.id,
        error: 'Inventory full'
      });
      return false;
    }

    // Remove from bank
    if (item.quantity && item.quantity > withdrawAmount) {
      item.quantity -= withdrawAmount;
    } else {
      tab.items[slotIndex] = null;
      account.usedSlots--;
    }

    this.world.events.emit('bank:withdraw', {
      playerId: player.id,
      itemId: item.itemId,
      quantity: withdrawAmount
    });

    return true;
  }

  withdrawAll(player: PlayerEntity, tabIndex: number, slotIndex: number): boolean {
    if (!this.isBankOpen(player.id)) {
      return false;
    }

    const account = this.getOrCreateAccount(player.id);
    const tab = account.tabs[tabIndex];
    const item = tab.items[slotIndex];
    
    if (!item) {
      return false;
    }

    return this.withdrawItem(player, tabIndex, slotIndex, item.quantity);
  }

  searchBank(player: PlayerEntity, searchTerm: string): ItemStack[] {
    const account = this.getOrCreateAccount(player.id);
    const results: ItemStack[] = [];
    const lowerSearch = searchTerm.toLowerCase();

    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item) {
          // In a real implementation, we'd search by item name
          // For now, we'll just search by item ID
          if (item.itemId.toString().includes(lowerSearch)) {
            results.push({ ...item });
          }
        }
      }
    }

    return results;
  }

  moveItem(
    player: PlayerEntity, 
    fromTab: number, 
    fromSlot: number, 
    toTab: number, 
    toSlot: number
  ): boolean {
    if (!this.isBankOpen(player.id)) {
      return false;
    }

    const account = this.getOrCreateAccount(player.id);
    
    // Validate indices
    if (fromTab < 0 || fromTab >= account.tabs.length ||
        toTab < 0 || toTab >= account.tabs.length ||
        fromSlot < 0 || fromSlot >= BankingSystem.SLOTS_PER_TAB ||
        toSlot < 0 || toSlot >= BankingSystem.SLOTS_PER_TAB) {
      return false;
    }

    const fromItem = account.tabs[fromTab].items[fromSlot];
    if (!fromItem) {
      return false;
    }

    const toItem = account.tabs[toTab].items[toSlot];

    // Swap items
    account.tabs[fromTab].items[fromSlot] = toItem;
    account.tabs[toTab].items[toSlot] = fromItem;

    this.world.events.emit('bank:item_moved', {
      playerId: player.id,
      fromTab,
      fromSlot,
      toTab,
      toSlot
    });

    return true;
  }

  setTabName(player: PlayerEntity, tabIndex: number, name: string): boolean {
    if (!this.isBankOpen(player.id)) {
      return false;
    }

    const account = this.getOrCreateAccount(player.id);
    
    if (tabIndex < 0 || tabIndex >= account.tabs.length) {
      return false;
    }

    account.tabs[tabIndex].name = name.substring(0, 20); // Limit name length

    this.world.events.emit('bank:tab_renamed', {
      playerId: player.id,
      tabIndex,
      name: account.tabs[tabIndex].name
    });

    return true;
  }

  // PIN Management
  setPin(player: PlayerEntity, pin: string): boolean {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      this.world.events.emit('bank:error', {
        playerId: player.id,
        error: 'PIN must be 4 digits'
      });
      return false;
    }

    const account = this.getOrCreateAccount(player.id);
    account.pin = pin;
    account.pinAttempts = 0;

    this.world.events.emit('bank:pin_set', {
      playerId: player.id
    });

    return true;
  }

  verifyPin(player: PlayerEntity, pin: string): boolean {
    const account = this.getOrCreateAccount(player.id);
    
    if (!account.pin) {
      return true;
    }

    // Check lockout
    if (account.pinAttempts >= BankingSystem.MAX_PIN_ATTEMPTS) {
      const timeSinceLastAttempt = Date.now() - (account.lastPinAttempt || 0);
      if (timeSinceLastAttempt < BankingSystem.PIN_LOCKOUT_TIME) {
        const remainingTime = Math.ceil((BankingSystem.PIN_LOCKOUT_TIME - timeSinceLastAttempt) / 1000);
        this.world.events.emit('bank:error', {
          playerId: player.id,
          error: `PIN locked. Try again in ${remainingTime} seconds`
        });
        return false;
      } else {
        // Reset attempts after lockout
        account.pinAttempts = 0;
      }
    }

    if (pin === account.pin) {
      account.pinAttempts = 0;
      this.world.events.emit('bank:pin_verified', {
        playerId: player.id
      });
      return true;
    } else {
      account.pinAttempts++;
      account.lastPinAttempt = Date.now();
      
      const remainingAttempts = BankingSystem.MAX_PIN_ATTEMPTS - account.pinAttempts;
      
      this.world.events.emit('bank:pin_failed', {
        playerId: player.id,
        remainingAttempts
      });
      
      return false;
    }
  }

  removePin(player: PlayerEntity, currentPin: string): boolean {
    const account = this.getOrCreateAccount(player.id);
    
    if (!account.pin) {
      return true;
    }

    if (currentPin !== account.pin) {
      this.world.events.emit('bank:error', {
        playerId: player.id,
        error: 'Incorrect PIN'
      });
      return false;
    }

    account.pin = undefined;
    account.pinAttempts = 0;

    this.world.events.emit('bank:pin_removed', {
      playerId: player.id
    });

    return true;
  }

  private isPinVerified(playerId: string): boolean {
    // In a real implementation, this would track PIN verification per session
    // For now, we'll assume PIN is always verified once entered
    return true;
  }

  // Helper methods
  private findItemInBank(account: BankAccount, itemId: number): ItemStack | null {
    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item && item.itemId === itemId) {
          return item;
        }
      }
    }
    return null;
  }

  private getBankData(account: BankAccount): any {
    return {
      tabs: account.tabs.map(tab => ({
        name: tab.name,
        items: tab.items
      })),
      usedSlots: account.usedSlots,
      totalSlots: account.totalSlots
    };
  }

  getBankValue(player: PlayerEntity): number {
    const account = this.getOrCreateAccount(player.id);
    let totalValue = 0;

    // Calculate total value using item registry
    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item) {
          const itemDef = this.itemRegistry.get(item.itemId);
          if (itemDef) {
            // Use high alchemy value (item.value * 0.6) or shop value
            const itemValue = Math.floor(itemDef.value * 0.6);
            totalValue += itemValue * (item.quantity || 1);
          }
        }
      }
    }

    return totalValue;
  }

  getTotalItems(player: PlayerEntity): number {
    const account = this.getOrCreateAccount(player.id);
    let total = 0;

    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item) {
          total += item.quantity || 1;
        }
      }
    }

    return total;
  }

  update(deltaTime: number): void {
    // Banking system doesn't need regular updates
  }

  serialize(): any {
    const data: any = {
      bankAccounts: {}
    };

    for (const [playerId, account] of Array.from(this.bankAccounts)) {
      data.bankAccounts[playerId] = {
        ...account,
        // Don't serialize PIN for security
        pin: account.pin ? '****' : undefined
      };
    }

    return data;
  }

  deserialize(data: any): void {
    if (data.bankAccounts) {
      for (const [playerId, accountData] of Object.entries(data.bankAccounts)) {
        this.bankAccounts.set(playerId, accountData as BankAccount);
      }
    }
  }

  /**
   * Calculate bank value (for death costs)
   */
  calculateBankValue(entityId: string): number {
    const bank = this.bankAccounts.get(entityId);
    if (!bank) return 0;
    
    let totalValue = 0;
    
    // Add up all item values
    for (const tab of bank.tabs.values()) {
      for (const stack of tab.items) {
        if (stack) {
          const itemDef = this.itemRegistry.get(stack.itemId);
          if (itemDef) {
            // Use high alchemy value (item.value * 0.6) or shop value
            const itemValue = Math.floor(itemDef.value * 0.6);
            totalValue += itemValue * stack.quantity;
          }
        }
      }
    }
    
    return totalValue;
  }
  
  /**
   * Get most valuable items (for death mechanics)
   */
  getMostValuableItems(entityId: string, count: number): ItemValue[] {
    const bank = this.bankAccounts.get(entityId);
    if (!bank) return [];
    
    const itemValues: ItemValue[] = [];
    
    // Collect all items with values
    for (const tab of bank.tabs.values()) {
      for (const stack of tab.items) {
        if (stack) {
          const itemDef = this.itemRegistry.get(stack.itemId);
          if (itemDef) {
            const itemValue = Math.floor(itemDef.value * 0.6);
            itemValues.push({
              stack,
              value: itemValue * stack.quantity
            });
          }
        }
      }
    }
    
    // Sort by value descending
    itemValues.sort((a, b) => b.value - a.value);
    
    return itemValues.slice(0, count);
  }
} 