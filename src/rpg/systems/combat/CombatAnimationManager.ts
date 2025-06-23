import type { World } from '../../../types';
import { AttackType, RPGEntity, CombatStyle, InventoryComponent, EquipmentSlot, WeaponType } from '../../types';

interface AnimationTask {
  id: string;
  entityId: string;
  targetId?: string;
  animationName: string;
  duration: number;
  attackType: AttackType;
  style: CombatStyle;
  damage?: number;
  startTime: number;
  progress: number;
  cancelled?: boolean;
}

export class CombatAnimationManager {
  private world: World;
  private activeAnimations: Map<string, AnimationTask> = new Map();
  private animationQueue: AnimationTask[] = [];
  
  // Animation definitions
  private readonly animations = {
    // Melee animations
    'melee_slash': { duration: 600, file: 'slash.glb' },
    'melee_stab': { duration: 600, file: 'stab.glb' },
    'melee_crush': { duration: 600, file: 'crush.glb' },
    
    // Ranged animations
    'ranged_bow': { duration: 900, file: 'bow_shoot.glb' },
    'ranged_crossbow': { duration: 700, file: 'crossbow_shoot.glb' },
    'ranged_thrown': { duration: 600, file: 'throw.glb' },
    
    // Magic animations
    'magic_cast': { duration: 1200, file: 'magic_cast.glb' },
    'magic_strike': { duration: 600, file: 'magic_strike.glb' },
    
    // Defense animations
    'block': { duration: 400, file: 'block.glb' },
    'dodge': { duration: 500, file: 'dodge.glb' },
    
    // Death animation
    'death': { duration: 2000, file: 'death.glb' },
    
    // Hit reactions
    'hit_reaction': { duration: 300, file: 'hit_reaction.glb' }
  };

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Update animation states
   */
  update(delta: number): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
    // Check for completed animations
    for (const [entityId, task] of Array.from(this.activeAnimations)) {
      if (now - task.startTime >= task.duration) {
        toRemove.push(entityId);
      }
    }
    
    // Remove completed animations
    toRemove.forEach(id => {
      const animation = this.activeAnimations.get(id);
      if (animation) {
        this.onAnimationComplete(id, animation);
      }
      this.activeAnimations.delete(id);
    });
  }

  /**
   * Play attack animation based on attack type
   */
  playAttackAnimation(attacker: RPGEntity, attackType: AttackType, style: CombatStyle = CombatStyle.ACCURATE): void {
    // Use the determineAnimation method to get the correct animation
    const animationName = this.determineAnimation(attacker, attackType, style);
    this.playAnimation(attacker.data.id, animationName);
  }

  /**
   * Play block/defense animation
   */
  playDefenseAnimation(defender: RPGEntity): void {
    this.playAnimation(defender.data.id, 'block');
  }

  /**
   * Play hit reaction animation
   */
  playHitReaction(entity: RPGEntity): void {
    this.playAnimation(entity.data.id, 'hit_reaction');
  }

  /**
   * Play death animation
   */
  playDeathAnimation(entity: RPGEntity): void {
    this.playAnimation(entity.data.id, 'death');
  }

  /**
   * Play a specific animation
   */
  private playAnimation(entityId: string, animationName: string): void {
    const animation = this.animations[animationName as keyof typeof this.animations];
    if (!animation) {
      console.warn(`Unknown animation: ${animationName}`);
      return;
    }
    
    // Cancel current animation if playing
    if (this.activeAnimations.has(entityId)) {
      this.cancelAnimation(entityId);
    }
    
    // Create animation task
    const task: AnimationTask = {
      id: `anim_${Date.now()}_${Math.random()}`,
      entityId,
      targetId: undefined,
      animationName,
      duration: animation.duration,
      attackType: AttackType.MELEE, // Default for legacy animations
      style: CombatStyle.ACCURATE, // Default for legacy animations
      damage: undefined,
      startTime: Date.now(),
      progress: 0,
      cancelled: false
    };
    
    this.activeAnimations.set(entityId, task);
    
    // Broadcast animation to clients
    this.broadcastAnimation(entityId, animationName);
  }

  /**
   * Cancel animation
   */
  cancelAnimation(entityId: string): void {
    const currentAnimation = this.activeAnimations.get(entityId);
    if (!currentAnimation) return;
    
    // Cancel the animation
    currentAnimation.cancelled = true;
    
    // Broadcast animation cancellation
    const network = (this.world as any).network;
    if (network) {
      network.broadcast('animation:cancelled', {
        entityId,
        animationId: currentAnimation.id,
        timestamp: Date.now()
      });
    }
    
    // Clean up
    this.activeAnimations.delete(entityId);
  }

  /**
   * Handle animation completion
   */
  private onAnimationComplete(entityId: string, animation: AnimationTask): void {
    // Handle animation completion
    const entity = this.world.entities.get(entityId);
    if (entity) {
      // Reset entity animation state
      const visual = entity.getComponent<any>('visual');
      if (visual) {
        visual.currentAnimation = 'idle';
        visual.animationTime = 0;
      }
    }
    
    // Use actual network system
    const network = (this.world as any).network;
    if (network) {
      network.broadcast('animation:complete', {
        entityId,
        animationId: animation.id,
        animationType: animation.animationName,
        timestamp: Date.now()
      });
    }
    
    // Emit event through world
    this.world.events.emit('animation:complete', {
      entityId,
      animation: animation.animationName
    });
  }

  /**
   * Broadcast animation to all clients
   */
  private broadcastAnimation(entityId: string, animationName: string): void {
    // Use actual network system
    const network = (this.world as any).network;
    if (network) {
      network.broadcast('animation:play', {
        entityId,
        animationName,
        timestamp: Date.now()
      });
    } else {
      // Fallback to event system
      this.world.events.emit('animation:play', {
        entityId,
        animationName,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check if entity is playing an animation
   */
  isAnimating(entityId: string): boolean {
    return this.activeAnimations.has(entityId);
  }

  /**
   * Get current animation for entity
   */
  getCurrentAnimation(entityId: string): string | null {
    const task = this.activeAnimations.get(entityId);
    return task ? task.animationName : null;
  }

  /**
   * Determine specific animation based on attack type and weapon
   */
  private determineAnimation(entity: RPGEntity, attackType: AttackType, style: CombatStyle): string {
    switch (attackType) {
      case AttackType.MELEE:
        // Determine specific melee style based on weapon
        const weapon = this.getEquippedWeapon(entity);
        if (weapon) {
          const weaponType = weapon.equipment?.weaponType;
          switch (weaponType) {
            case WeaponType.DAGGER:
              return style === CombatStyle.AGGRESSIVE ? 'stab_aggressive' : 'stab';
            case WeaponType.SWORD:
            case WeaponType.SCIMITAR:
              return style === CombatStyle.AGGRESSIVE ? 'slash_aggressive' : 
                     style === CombatStyle.DEFENSIVE ? 'slash_defensive' : 'slash';
            case WeaponType.MACE:
            case WeaponType.AXE:
              return style === CombatStyle.AGGRESSIVE ? 'crush_aggressive' : 'crush';
            case WeaponType.SPEAR:
            case WeaponType.HALBERD:
              return style === CombatStyle.CONTROLLED ? 'stab_controlled' : 'stab_2h';
            default:
              return 'punch';
          }
        }
        return 'punch'; // Unarmed
        
      case AttackType.RANGED:
        // Determine bow vs crossbow based on weapon
        const rangedWeapon = this.getEquippedWeapon(entity);
        if (rangedWeapon) {
          const weaponType = rangedWeapon.equipment?.weaponType;
          if (weaponType === WeaponType.CROSSBOW) {
            return 'crossbow_shoot';
          }
        }
        return 'bow_shoot'; // Default to bow
        
      case AttackType.MAGIC:
        return style === CombatStyle.DEFENSIVE ? 'cast_defensive' : 'cast_standard';
        
      default:
        return 'idle';
    }
  }
  
  /**
   * Get equipped weapon
   */
  private getEquippedWeapon(entity: RPGEntity): any {
    const inventory = entity.getComponent<InventoryComponent>('inventory');
    if (!inventory) return null;
    
    return inventory.equipment[EquipmentSlot.WEAPON];
  }

  /**
   * Queue animation for entity
   */
  queueAnimation(
    entityId: string,
    attackType: AttackType,
    style: CombatStyle,
    damage?: number,
    targetId?: string
  ): void {
    const entity = this.world.entities.get(entityId);
    const animationName = entity ? 
      this.determineAnimation(entity as RPGEntity, attackType, style) :
      this.getDefaultAnimationName(attackType);
    const duration = this.getAnimationDuration(animationName);
    
    const task: AnimationTask = {
      id: `anim_${Date.now()}_${Math.random()}`,
      entityId,
      targetId,
      animationName,
      duration,
      attackType,
      style,
      damage,
      startTime: Date.now(),
      progress: 0,
      cancelled: false
    };
    
    this.animationQueue.push(task);
  }

  /**
   * Get default animation name for attack type
   */
  private getDefaultAnimationName(attackType: AttackType): string {
    switch (attackType) {
      case AttackType.MELEE:
        return 'melee_slash';
      case AttackType.RANGED:
        return 'ranged_bow';
      case AttackType.MAGIC:
        return 'magic_cast';
      default:
        return 'idle';
    }
  }
  
  /**
   * Get animation duration
   */
  private getAnimationDuration(animationName: string): number {
    const animation = this.animations[animationName as keyof typeof this.animations];
    if (animation) {
      return animation.duration;
    }
    
    // Check for custom animations
    const customAnimations: Record<string, number> = {
      'stab': 600,
      'stab_aggressive': 500,
      'slash': 600,
      'slash_aggressive': 500,
      'slash_defensive': 700,
      'crush': 700,
      'crush_aggressive': 600,
      'stab_controlled': 650,
      'stab_2h': 800,
      'punch': 400,
      'crossbow_shoot': 700,
      'bow_shoot': 900,
      'cast_standard': 1200,
      'cast_defensive': 1400,
      'idle': 0
    };
    
    return customAnimations[animationName] || 600; // Default 600ms
  }
} 