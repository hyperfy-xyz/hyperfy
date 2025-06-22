import { System } from '../../core/systems/System';
import type { World } from '../../types';
import { 
  CombatSession, 
  HitResult, 
  CombatComponent, 
  StatsComponent,
  CombatStyle,
  AttackType,
  RPGEntity,
  Vector3,
  HitSplat,
  Equipment,
  EquipmentSlot,
  WeaponType,
  InventoryComponent,
  MovementComponent
} from '../types';
import { HitCalculator } from './combat/HitCalculator';
import { DamageCalculator } from './combat/DamageCalculator';
import { CombatAnimationManager } from './combat/CombatAnimationManager';

export class CombatSystem extends System {
  // Core components
  private combatSessions: Map<string, CombatSession> = new Map();
  private hitCalculator: HitCalculator;
  private damageCalculator: DamageCalculator;
  private combatAnimations: CombatAnimationManager;
  
  // Configuration
  private readonly COMBAT_TICK_RATE = 600; // milliseconds
  private readonly COMBAT_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_ATTACK_RANGE = 1; // tiles
  
  private lastTickTime = 0;

  constructor(world: World) {
    super(world);
    this.hitCalculator = new HitCalculator();
    this.damageCalculator = new DamageCalculator();
    this.combatAnimations = new CombatAnimationManager(world);
  }

  /**
   * Fixed update for combat ticks
   */
  override fixedUpdate(delta: number): void {
    const now = Date.now();
    
    // Process combat ticks at fixed intervals
    if (now - this.lastTickTime >= this.COMBAT_TICK_RATE) {
      this.processCombatTick();
      this.lastTickTime = now;
    }
  }

  /**
   * Main update for visual effects
   */
  override update(delta: number): void {
    // Update hit splats
    this.updateHitSplats(delta);
    
    // Update combat animations
    this.combatAnimations.update(delta);
    
    // Check combat timeouts
    this.checkCombatTimeouts();
  }

  /**
   * Initiate an attack
   */
  initiateAttack(attackerId: string, targetId: string): boolean {
    const attacker = this.getEntity(attackerId);
    const target = this.getEntity(targetId);
    
    if (!this.canAttack(attacker, target)) {
      return false;
    }
    
    if (!attacker || !target) {
      return false;
    }
    
    // Get or create combat session
    let session = this.combatSessions.get(attackerId);
    if (!session) {
      session = this.createCombatSession(attackerId, targetId);
      this.combatSessions.set(attackerId, session);
    }
    
    // Update combat components
    const attackerCombat = attacker.getComponent<CombatComponent>('combat');
    if (attackerCombat) {
      attackerCombat.inCombat = true;
      attackerCombat.target = targetId;
    }
    
    // Set target to retaliate if auto-retaliate is on
    const targetCombat = target.getComponent<CombatComponent>('combat');
    if (targetCombat && targetCombat.autoRetaliate && !targetCombat.inCombat) {
      this.initiateAttack(targetId, attackerId);
    }
    
    // Emit combat start event
    this.emit('combat:start', { session });
    
    return true;
  }

  /**
   * Process combat tick for all active sessions
   */
  private processCombatTick(): void {
    const now = Date.now();
    
    for (const [entityId, session] of Array.from(this.combatSessions)) {
      const attacker = this.getEntity(session.attackerId);
      const target = this.getEntity(session.targetId);
      
      if (!attacker || !target) {
        this.endCombat(entityId);
        continue;
      }
      
      const combat = attacker.getComponent<CombatComponent>('combat');
      if (!combat || !combat.inCombat) {
        continue;
      }
      
      // Check if it's time to attack
      if (now - combat.lastAttackTime >= this.getAttackSpeed(attacker, combat)) {
        this.performAttack(attacker, target, session);
        combat.lastAttackTime = now;
      }
    }
  }

  /**
   * Perform an attack
   */
  private performAttack(attacker: RPGEntity, target: RPGEntity, session: CombatSession): void {
    const hit = this.calculateHit(attacker, target);
    
    // Add to session history
    session.hits.push(hit);
    session.lastAttackTime = Date.now();
    
    // Apply damage if hit
    if (hit.damage > 0) {
      this.applyDamage(target, hit.damage, attacker);
    }
    
    // Queue hit splat
    this.queueHitSplat(target, hit);
    
    // Play attack animation
    this.combatAnimations.playAttackAnimation(attacker, hit.attackType);
    
    // Emit hit event
    this.emit('combat:hit', { hit });
  }

  /**
   * Calculate hit result
   */
  calculateHit(attacker: RPGEntity, target: RPGEntity): HitResult {
    const attackerStats = attacker.getComponent<StatsComponent>('stats');
    const targetStats = target.getComponent<StatsComponent>('stats');
    const attackerCombat = attacker.getComponent<CombatComponent>('combat');
    
    if (!attackerStats || !targetStats || !attackerCombat) {
      return this.createMissResult(attacker.data.id, target.data.id);
    }
    
    // Determine attack type
    const attackType = this.getAttackType(attacker);
    
    // Calculate attack and defense rolls
    const attackRoll = this.hitCalculator.calculateAttackRoll(
      attackerStats,
      attackerCombat.combatStyle,
      attackType
    );
    
    const targetCombat = target.getComponent<CombatComponent>('combat');
    const defenseRoll = this.hitCalculator.calculateDefenseRoll(
      targetStats,
      attackType,
      targetCombat || undefined
    );
    
    // Calculate hit chance
    const hitChance = this.hitCalculator.calculateHitChance(attackRoll, defenseRoll);
    const hits = Math.random() < hitChance;
    
    if (!hits) {
      return this.createMissResult(attacker.data.id, target.data.id, attackType);
    }
    
    // Calculate damage
    const maxHit = this.damageCalculator.calculateMaxHit(
      attackerStats,
      attackerCombat.combatStyle,
      attackType
    );
    
    const damage = this.damageCalculator.rollDamage(maxHit);
    
    // Apply damage reductions
    const finalDamage = this.damageCalculator.applyDamageReductions(
      damage,
      targetStats,
      attackType,
      attackerStats
    );
    
    return {
      damage: finalDamage,
      type: 'normal',
      attackType,
      attackerId: attacker.data.id,
      targetId: target.data.id,
      timestamp: Date.now()
    };
  }

  /**
   * Apply damage to target
   */
  applyDamage(target: RPGEntity, damage: number, source: RPGEntity): void {
    const stats = target.getComponent<StatsComponent>('stats');
    if (!stats) return;
    
    // Apply damage
    stats.hitpoints.current = Math.max(0, stats.hitpoints.current - damage);
    
    // Check for death
    if (stats.hitpoints.current <= 0) {
      this.handleDeath(target, source);
    }
    
    // Emit damage event
    this.emit('combat:damage', {
      targetId: target.data.id,
      damage,
      sourceId: source.data.id,
      remaining: stats.hitpoints.current
    });
  }

  /**
   * Handle entity death
   */
  private handleDeath(entity: RPGEntity, killer: RPGEntity): void {
    // End all combat involving this entity
    this.endCombat(entity.data.id);
    
    // Remove entity from other combat sessions
    for (const [sessionId, session] of Array.from(this.combatSessions)) {
      if (session.targetId === entity.data.id) {
        this.endCombat(sessionId);
      }
    }
    
    // Emit death event
    this.emit('entity:death', {
      entityId: entity.data.id,
      killerId: killer.data.id
    });
  }

  /**
   * End combat for an entity
   */
  endCombat(entityId: string): void {
    const session = this.combatSessions.get(entityId);
    if (!session) return;
    
    // Update combat component
    const entity = this.getEntity(entityId);
    if (entity) {
      const combat = entity.getComponent<CombatComponent>('combat');
      if (combat) {
        combat.inCombat = false;
        combat.target = null;
      }
    }
    
    // Remove session
    this.combatSessions.delete(entityId);
    
    // Emit end event
    this.emit('combat:end', { session });
  }

  /**
   * Check if attacker can attack target
   */
  private canAttack(attacker: RPGEntity | undefined, target: RPGEntity | undefined): boolean {
    if (!attacker || !target) return false;
    
    // Check if entities are alive
    const attackerStats = attacker.getComponent<StatsComponent>('stats');
    const targetStats = target.getComponent<StatsComponent>('stats');
    
    if (!attackerStats || !targetStats) return false;
    if (attackerStats.hitpoints.current <= 0 || targetStats.hitpoints.current <= 0) return false;
    
    // Check range
    const distance = this.getDistance(attacker, target);
    if (distance > this.getAttackRange(attacker)) return false;
    
    // Check if in safe zone
    if (this.isInSafeZone(attacker) || this.isInSafeZone(target)) {
      this.emit('combat:denied', { 
        reason: 'safe_zone',
        attackerId: attacker.data.id,
        targetId: target.data.id
      });
      return false;
    }
    
    // Check if target is attackable in wilderness
    if (this.isInWilderness(attacker) && this.isInWilderness(target)) {
      const attackerWildLevel = this.getWildernessLevel(attacker);
      const targetWildLevel = this.getWildernessLevel(target);
      const combatLevelDiff = Math.abs(
        attackerStats.combatLevel - targetStats.combatLevel
      );
      
      // Wilderness level restriction
      const maxLevelDiff = Math.min(attackerWildLevel, targetWildLevel);
      if (combatLevelDiff > maxLevelDiff) {
        this.emit('combat:denied', { 
          reason: 'wilderness_level',
          attackerId: attacker.data.id,
          targetId: target.data.id
        });
        return false;
      }
    }
    
    // Check multi-combat area
    const inMulti = this.isInMultiCombat(attacker);
    if (!inMulti) {
      // Single combat - check if either is already in combat with someone else
      const attackerSession = this.combatSessions.get(attacker.data.id);
      const targetSession = this.getTargetSession(target.data.id);
      
      if (attackerSession && attackerSession.targetId !== target.data.id) {
        return false;
      }
      if (targetSession && targetSession.attackerId !== attacker.data.id) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if entity is in a safe zone
   */
  private isInSafeZone(entity: RPGEntity): boolean {
    const position = this.getEntityPosition(entity);
    if (!position) return false;
    
    // Check configured safe zones
    const safeZones = (this.world as any).safeZones || [
      // Default safe zones
      { type: 'rectangle', min: { x: -50, y: -10, z: -50 }, max: { x: 50, y: 50, z: 50 } }, // Spawn area
      { type: 'circle', center: { x: 0, y: 0, z: 0 }, radius: 100 } // Town center
    ];
    
    for (const zone of safeZones) {
      if (this.isPositionInZone(position, zone)) {
        return true;
      }
    }
    
    // Check entity-specific safe zone flag
    const zoneComponent = entity.getComponent<any>('zone');
    if (zoneComponent?.isSafe) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if entity is in wilderness
   */
  private isInWilderness(entity: RPGEntity): boolean {
    const position = this.getEntityPosition(entity);
    if (!position) return false;
    
    // Wilderness starts at y > 3520 in OSRS coordinates
    // Adjust for your world coordinates
    const wildernessStart = (this.world as any).wildernessStart || { x: -1000, y: 0, z: 1000 };
    return position.z > wildernessStart.z;
  }
  
  /**
   * Get wilderness level for entity
   */
  private getWildernessLevel(entity: RPGEntity): number {
    const position = this.getEntityPosition(entity);
    if (!position || !this.isInWilderness(entity)) return 0;
    
    const wildernessStart = (this.world as any).wildernessStart || { x: -1000, y: 0, z: 1000 };
    const level = Math.floor((position.z - wildernessStart.z) / 8) + 1;
    return Math.min(Math.max(level, 1), 56); // Max wilderness level is 56
  }
  
  /**
   * Check if position is in multi-combat area
   */
  private isInMultiCombat(entity: RPGEntity): boolean {
    const position = this.getEntityPosition(entity);
    if (!position) return false;
    
    // Check configured multi-combat zones
    const multiZones = (this.world as any).multiCombatZones || [
      // Default multi-combat zones
      { type: 'rectangle', min: { x: 100, y: -10, z: 100 }, max: { x: 200, y: 50, z: 200 } }, // Boss area
    ];
    
    for (const zone of multiZones) {
      if (this.isPositionInZone(position, zone)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if position is within a zone
   */
  private isPositionInZone(position: Vector3, zone: any): boolean {
    if (zone.type === 'rectangle') {
      return position.x >= zone.min.x && position.x <= zone.max.x &&
             position.y >= zone.min.y && position.y <= zone.max.y &&
             position.z >= zone.min.z && position.z <= zone.max.z;
    } else if (zone.type === 'circle') {
      const distance = Math.sqrt(
        Math.pow(position.x - zone.center.x, 2) +
        Math.pow(position.y - zone.center.y, 2) +
        Math.pow(position.z - zone.center.z, 2)
      );
      return distance <= zone.radius;
    }
    return false;
  }
  
  /**
   * Get session where entity is the target
   */
  private getTargetSession(targetId: string): CombatSession | null {
    for (const [_, session] of this.combatSessions) {
      if (session.targetId === targetId) {
        return session;
      }
    }
    return null;
  }

  /**
   * Create combat session
   */
  private createCombatSession(attackerId: string, targetId: string): CombatSession {
    return {
      id: `combat_${attackerId}_${Date.now()}`,
      attackerId,
      targetId,
      startTime: Date.now(),
      lastAttackTime: Date.now(),
      combatTimer: this.COMBAT_TIMEOUT,
      hits: []
    };
  }

  /**
   * Create miss result
   */
  private createMissResult(attackerId: string, targetId: string, attackType: AttackType = AttackType.MELEE): HitResult {
    return {
      damage: 0,
      type: 'miss',
      attackType,
      attackerId,
      targetId,
      timestamp: Date.now()
    };
  }

  /**
   * Queue hit splat for display
   */
  private queueHitSplat(target: RPGEntity, hit: HitResult): void {
    const combat = target.getComponent<CombatComponent>('combat');
    const movement = target.getComponent<any>('movement'); // MovementComponent
    
    if (!combat || !movement) return;
    
    const hitSplat: HitSplat = {
      damage: hit.damage,
      type: hit.type === 'miss' ? 'miss' : 'normal',
      position: { ...movement.position },
      timestamp: Date.now(),
      duration: 1000
    };
    
    combat.hitSplatQueue.push(hitSplat);
  }

  /**
   * Update hit splats
   */
  private updateHitSplats(delta: number): void {
    const now = Date.now();
    
    // Update all entities with combat components
    for (const [entityId, entity] of Array.from(this.world.entities.items)) {
      const rpgEntity = this.asRPGEntity(entity);
      if (!rpgEntity) continue;
      
      const combat = rpgEntity.getComponent<CombatComponent>('combat');
      
      if (!combat) continue;
      
      // Remove expired hit splats
      combat.hitSplatQueue = combat.hitSplatQueue.filter(
        splat => now - splat.timestamp < splat.duration
      );
    }
  }

  /**
   * Check for combat timeouts
   */
  private checkCombatTimeouts(): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
    for (const [entityId, session] of Array.from(this.combatSessions)) {
      if (now - session.lastAttackTime > this.COMBAT_TIMEOUT) {
        toRemove.push(entityId);
      }
    }
    
    toRemove.forEach(id => this.endCombat(id));
  }

  /**
   * Get attack speed in milliseconds
   */
  private getAttackSpeed(entity: RPGEntity, combat: CombatComponent): number {
    // Base attack speed (4 ticks = 2.4 seconds)
    let speed = combat.attackSpeed * this.COMBAT_TICK_RATE;
    
    // Apply weapon speed modifiers
    const weapon = this.getEquippedWeapon(entity);
    if (weapon?.equipment?.attackSpeed) {
      speed = weapon.equipment.attackSpeed * this.COMBAT_TICK_RATE;
    }
    
    // Apply combat style modifiers
    if (combat.combatStyle === CombatStyle.RAPID) {
      // Rapid style reduces attack interval by 1 tick
      speed = Math.max(this.COMBAT_TICK_RATE, speed - this.COMBAT_TICK_RATE);
    }
    
    // Apply haste effects (e.g., from prayers or potions)
    const effects = entity.getComponent<any>('effects');
    if (effects?.haste) {
      speed *= 0.9; // 10% faster attacks
    }
    
    return speed;
  }

  /**
   * Get attack type based on equipment
   */
  private getAttackType(entity: RPGEntity): AttackType {
    const weapon = this.getEquippedWeapon(entity);
    
    if (!weapon) {
      // Unarmed is melee
      return AttackType.MELEE;
    }
    
    // Check weapon type
    const weaponType = weapon.equipment?.weaponType;
    switch (weaponType) {
      case WeaponType.BOW:
      case WeaponType.CROSSBOW:
        return AttackType.RANGED;
      case WeaponType.STAFF:
      case WeaponType.WAND:
        return AttackType.MAGIC;
      default:
        return AttackType.MELEE;
    }
  }

  /**
   * Get attack range based on weapon
   */
  private getAttackRange(entity: RPGEntity): number {
    const weapon = this.getEquippedWeapon(entity);
    
    if (!weapon) {
      // Unarmed melee range
      return this.MAX_ATTACK_RANGE;
    }
    
    // Get weapon-specific range
    const weaponType = weapon.equipment?.weaponType;
    switch (weaponType) {
      case WeaponType.HALBERD:
        return 2; // Halberds can attack 2 tiles away
      case WeaponType.BOW:
        return 7; // Shortbow range
      case WeaponType.CROSSBOW:
        return 8; // Crossbow range
      case WeaponType.STAFF:
      case WeaponType.WAND:
        return 10; // Magic range
      default:
        return this.MAX_ATTACK_RANGE; // Standard melee
    }
  }
  
  /**
   * Get equipped weapon
   */
  private getEquippedWeapon(entity: RPGEntity): Equipment | null {
    const inventory = entity.getComponent<InventoryComponent>('inventory');
    if (!inventory) return null;
    
    return inventory.equipment[EquipmentSlot.WEAPON];
  }

  /**
   * Calculate distance between entities
   */
  private getDistance(entity1: RPGEntity, entity2: RPGEntity): number {
    const pos1 = this.getEntityPosition(entity1);
    const pos2 = this.getEntityPosition(entity2);
    
    if (!pos1 || !pos2) return Infinity;
    
    // Use grid-based distance for tile-based combat
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    const dz = Math.abs(pos1.z - pos2.z);
    
    // Chebyshev distance (king's move in chess) for tile-based games
    return Math.max(dx, dy, dz);
  }
  
  /**
   * Get entity position from movement component
   */
  private getEntityPosition(entity: RPGEntity): Vector3 | null {
    // Try movement component first
    const movement = entity.getComponent<MovementComponent>('movement');
    if (movement?.position) {
      return movement.position;
    }
    
    // Fall back to entity position
    if (entity.position) {
      return entity.position;
    }
    
    // Try data position
    if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        return {
          x: entity.data.position[0] || 0,
          y: entity.data.position[1] || 0,
          z: entity.data.position[2] || 0
        };
      }
      return entity.data.position;
    }
    
    return null;
  }

  /**
   * Get entity from world and cast to RPGEntity
   */
  private getEntity(entityId: string): RPGEntity | undefined {
    const entity = this.world.entities.items.get(entityId);
    if (!entity) return undefined;
    
    // For now, assume all entities are RPGEntities
    // In a real implementation, we'd check if it has the required methods
    return this.asRPGEntity(entity);
  }

  /**
   * Safely cast entity to RPGEntity
   */
  private asRPGEntity(entity: any): RPGEntity | undefined {
    // Check if entity has required RPGEntity methods
    if (entity && typeof entity.getComponent === 'function') {
      return entity as RPGEntity;
    }
    return undefined;
  }

  /**
   * Check if entity is in combat
   */
  isInCombat(entityId: string): boolean {
    return this.combatSessions.has(entityId);
  }

  /**
   * Get combat session for entity
   */
  getCombatSession(entityId: string): CombatSession | null {
    return this.combatSessions.get(entityId) || null;
  }

  /**
   * Force end combat (admin command)
   */
  forceEndCombat(entityId: string): void {
    this.endCombat(entityId);
  }
} 