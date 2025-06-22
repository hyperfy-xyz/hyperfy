import type { World } from '../../../types';
import type { 
  NPCEntity, 
  NPCComponent, 
  Vector3,
  MovementComponent,
  CombatComponent,
  PlayerEntity,
  Entity
} from '../../types';
import { NPCBehavior, NPCState } from '../../types';

export class NPCBehaviorManager {
  private world: World;
  private movementSystem: any;
  
  // Behavior update intervals
  private readonly BEHAVIOR_UPDATE_INTERVAL = 500; // 500ms
  private lastBehaviorUpdate: Map<string, number> = new Map();
  
  constructor(world: World) {
    this.world = world;
    // Get movement system from world
    this.movementSystem = (world as any).systems?.get('movement') || {
      moveEntity: (id: string, pos: Vector3) => {
        // Fallback implementation
        const entity = world.entities.get(id);
        if (entity) {
          entity.position = pos;
        }
      }
    };
  }
  
  /**
   * Update NPC behavior
   */
  updateBehavior(npc: NPCEntity, _delta: number): void {
    const npcComponent = npc.getComponent<NPCComponent>('npc');
    if (!npcComponent) return;
    
    // Check if we should update behavior this frame
    const lastUpdate = this.lastBehaviorUpdate.get(npc.data.id) || 0;
    const now = Date.now();
    
    if (now - lastUpdate < this.BEHAVIOR_UPDATE_INTERVAL) {
      return;
    }
    
    this.lastBehaviorUpdate.set(npc.data.id, now);
    
    // Update based on behavior type
    switch (npcComponent.behavior) {
      case NPCBehavior.AGGRESSIVE:
        this.updateAggressiveBehavior(npc, npcComponent);
        break;
      case NPCBehavior.DEFENSIVE:
        this.updateDefensiveBehavior(npc, npcComponent);
        break;
      case NPCBehavior.PASSIVE:
        this.updatePassiveBehavior(npc, npcComponent);
        break;
      case NPCBehavior.FRIENDLY:
        this.updateFriendlyBehavior(npc, npcComponent);
        break;
      case NPCBehavior.PATROL:
        this.updatePatrolBehavior(npc, npcComponent);
        break;
      case NPCBehavior.WANDER:
        this.updateWanderBehavior(npc, npcComponent);
        break;
    }
    
    // Update movement if needed
    this.updateMovement(npc, npcComponent);
  }
  
  /**
   * Aggressive behavior - attacks players on sight
   */
  private updateAggressiveBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    // Check current state
    if (npcComponent.state === NPCState.COMBAT) {
      // Already in combat, check if target is still valid
      if (!this.isValidTarget(npc, npcComponent.currentTarget)) {
        this.findNewTarget(npc, npcComponent);
      }
      return;
    }
    
    // Look for players in aggression range
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggressionRange);
    
    for (const player of nearbyPlayers) {
      // Check if we can attack this player
      if (this.canAttackPlayer(npc, player)) {
        const playerId = player.data?.id || (player as any).id;
        this.startCombat(npc, npcComponent, playerId);
        break;
      }
    }
    
    // If no targets, wander
    if (npcComponent.state === NPCState.IDLE) {
      this.startWandering(npc, npcComponent);
    }
  }
  
  /**
   * Defensive behavior - only attacks when attacked
   */
  private updateDefensiveBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    // Check if in combat
    if (npcComponent.state === NPCState.COMBAT) {
      // Validate target
      if (!this.isValidTarget(npc, npcComponent.currentTarget)) {
        // Return to idle
        npcComponent.state = NPCState.IDLE;
        npcComponent.currentTarget = null;
      }
      return;
    }
    
    // Return to spawn point if too far
    const npcPos = this.getEntityPosition(npc);
    if (npcPos && this.getDistance(npcPos, npcComponent.spawnPoint) > npcComponent.wanderRadius * 2) {
      this.moveToPosition(npc, npcComponent.spawnPoint);
    }
  }
  
  /**
   * Passive behavior - never attacks
   */
  private updatePassiveBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    // If being attacked, flee
    const combat = npc.getComponent<CombatComponent>('combat');
    if (combat?.inCombat) {
      this.flee(npc, npcComponent);
      return;
    }
    
    // Wander peacefully
    if (npcComponent.state === NPCState.IDLE) {
      this.startWandering(npc, npcComponent);
    }
  }
  
  /**
   * Friendly behavior - interactable NPCs
   */
  private updateFriendlyBehavior(npc: NPCEntity, _npcComponent: NPCComponent): void {
    // Face nearby players
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    const nearbyPlayers = this.getPlayersInRange(npcPos, 5);
    if (nearbyPlayers.length > 0) {
      // Face the closest player
      const closest = this.getClosestPlayer(npcPos, nearbyPlayers);
      if (closest) {
        const closestPos = this.getEntityPosition(closest);
        if (closestPos) {
          this.faceEntity(npc, { position: closestPos });
        }
      }
    }
  }
  
  /**
   * Patrol behavior - follows waypoints
   */
  private updatePatrolBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    this.executePatrol(npc, npcComponent);
  }
  
  /**
   * Wander behavior - random movement
   */
  private updateWanderBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    const movement = npc.getComponent<MovementComponent>('movement');
    if (!movement) return;
    
    // Check if we need a new destination
    if (!movement.destination || this.hasReachedDestination(npc, movement)) {
      // Pick random point within wander radius
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * npcComponent.wanderRadius;
      
      const newDestination: Vector3 = {
        x: npcComponent.spawnPoint.x + Math.cos(angle) * distance,
        y: npcComponent.spawnPoint.y,
        z: npcComponent.spawnPoint.z + Math.sin(angle) * distance
      };
      
      movement.destination = newDestination;
      npcComponent.state = NPCState.WANDERING;
    }
  }
  
  /**
   * Update movement towards destination
   */
  private updateMovement(npc: NPCEntity, npcComponent: NPCComponent): void {
    const movement = npc.getComponent<MovementComponent>('movement');
    if (!movement || !movement.destination) return;
    
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    // Calculate direction
    const dx = movement.destination.x - npcPos.x;
    const dz = movement.destination.z - npcPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Check if reached destination
    if (distance < 0.5) {
      movement.destination = null;
      movement.isMoving = false;
      
      if (npcComponent.state === NPCState.WANDERING) {
        npcComponent.state = NPCState.IDLE;
      }
      return;
    }
    
    // Move towards destination
    const speed = movement.moveSpeed * 0.016; // Convert to per-frame
    const moveX = (dx / distance) * speed;
    const moveZ = (dz / distance) * speed;
    
    // Update position on entity
    const newPosition = {
      x: npcPos.x + moveX,
      y: npcPos.y,
      z: npcPos.z + moveZ
    };
    
    // Update position on movement component
    movement.position = newPosition;
    
    // Update entity data position if available
    if (npc.data) {
      // Handle both array and Vector3 formats
      if (Array.isArray(npc.data.position)) {
        npc.data.position = [newPosition.x, newPosition.y, newPosition.z];
      } else {
        (npc.data as any).position = newPosition;
      }
    }
    
    movement.isMoving = true;
  }
  
  /**
   * Start combat with a target
   */
  private startCombat(npc: NPCEntity, npcComponent: NPCComponent, targetId: string): void {
    npcComponent.currentTarget = targetId;
    npcComponent.state = NPCState.COMBAT;
    
    // Emit combat start event
    this.world.events.emit('combat:start', {
      attackerId: npc.data.id,
      targetId: targetId
    });
  }
  
  /**
   * Find a new target
   */
  private findNewTarget(npc: NPCEntity, npcComponent: NPCComponent): void {
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggressionRange);
    
    for (const player of nearbyPlayers) {
      if (this.canAttackPlayer(npc, player)) {
        const playerId = player.data?.id || (player as any).id;
        npcComponent.currentTarget = playerId;
        return;
      }
    }
    
    // No valid targets
    npcComponent.currentTarget = null;
    npcComponent.state = NPCState.IDLE;
  }
  
  /**
   * Make NPC flee from danger
   */
  private flee(npc: NPCEntity, npcComponent: NPCComponent): void {
    const combat = npc.getComponent<CombatComponent>('combat');
    if (!combat || !combat.lastAttack) return;
    
    // Get attacker position - check if target exists
    if (!combat.target) return;
    
    const attacker = this.getEntity(combat.target);
    if (!attacker) return;
    
    const npcPos = this.getEntityPosition(npc);
    const attackerPos = this.getEntityPosition(attacker);
    if (!npcPos || !attackerPos) return;
    
    // Calculate flee direction (opposite of attacker)
    const dx = npcPos.x - attackerPos.x;
    const dz = npcPos.z - attackerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance === 0) return;
    
    // Flee to a point away from attacker
    const fleeDistance = 10;
    const fleePoint: Vector3 = {
      x: npcPos.x + (dx / distance) * fleeDistance,
      y: npcPos.y,
      z: npcPos.z + (dz / distance) * fleeDistance
    };
    
    this.moveToPosition(npc, fleePoint);
    npcComponent.state = NPCState.FLEEING;
  }
  
  /**
   * Move to a specific position
   */
  private moveToPosition(npc: NPCEntity, position: Vector3): void {
    const movement = npc.getComponent<MovementComponent>('movement');
    if (!movement) return;
    
    movement.destination = { ...position };
    movement.isMoving = true;
  }
  
  /**
   * Make NPC face another entity
   */
  private faceEntity(npc: NPCEntity, _target: { position: Vector3 }): void {
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    // Calculate direction to target
    const target = _target;
    const dx = target.position.x - npcPos.x;
    const dz = target.position.z - npcPos.z;
    
    // Calculate rotation and apply it
    const angle = Math.atan2(dz, dx);
    
    // Apply rotation to NPC
    const movement = npc.getComponent<MovementComponent>('movement');
    if (movement) {
      movement.facingDirection = angle;
    }
    
    // Update visual rotation if mesh exists
    const mesh = (npc as any).mesh;
    if (mesh) {
      mesh.rotation.y = angle;
    }
  }
  
  /**
   * Start wandering behavior
   */
  private startWandering(npc: NPCEntity, npcComponent: NPCComponent): void {
    // Small chance to start wandering
    if (Math.random() < 0.1) {
      npcComponent.state = NPCState.WANDERING;
      this.updateWanderBehavior(npc, npcComponent);
    }
  }
  
  /**
   * Check if target is valid
   */
  private isValidTarget(npc: NPCEntity, targetId: string | null): boolean {
    if (!targetId) return false;
    
    const target = this.getEntity(targetId);
    if (!target) return false;
    
    // Check if target is alive
    const stats = target.getComponent('stats');
    if (stats && stats.hitpoints.current <= 0) return false;
    
    // Check distance
    const npcPos = this.getEntityPosition(npc);
    const targetPos = this.getEntityPosition(target);
    if (!npcPos || !targetPos) return false;
    
    const distance = this.getDistance(npcPos, targetPos);
    if (distance > 20) return false; // Max chase distance
    
    return true;
  }
  
  /**
   * Check if NPC can attack player
   */
  private canAttackPlayer(npc: NPCEntity, player: PlayerEntity): boolean {
    // Check if player is alive
    const stats = player.getComponent<any>('stats');
    if (stats && stats.hitpoints.current <= 0) return false;
    
    // Check combat level difference for aggression
    const npcComponent = npc.getComponent<NPCComponent>('npc');
    if (!npcComponent) return false;
    
    const playerLevel = stats?.combatLevel || 1;
    const levelDiff = playerLevel - npcComponent.combatLevel;
    
    // Don't attack players too high level
    if (levelDiff > npcComponent.aggressionLevel * 10) return false;
    
    return true;
  }
  
  /**
   * Check if reached destination
   */
  private hasReachedDestination(npc: NPCEntity, movement: MovementComponent): boolean {
    if (!movement.destination) return true;
    
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return true;
    
    const distance = this.getDistance(npcPos, movement.destination);
    return distance < 0.5;
  }
  
  /**
   * Get players in range
   */
  private getPlayersInRange(position: Vector3, range: number): PlayerEntity[] {
    // Use spatial query for efficiency when available
    const nearbyEntities = this.spatialQuery(position, range);
    const players: PlayerEntity[] = [];
    
    for (const entity of nearbyEntities) {
      if (this.isPlayer(entity)) {
        players.push(entity as unknown as PlayerEntity);
      }
    }
    
    return players;
  }
  
  /**
   * Get closest player from list
   */
  private getClosestPlayer(position: Vector3, players: PlayerEntity[]): PlayerEntity | null {
    let closest: PlayerEntity | null = null;
    let minDistance = Infinity;
    
    for (const player of players) {
      const playerPos = this.getEntityPosition(player);
      if (playerPos) {
        const distance = this.getDistance(position, playerPos);
        if (distance < minDistance) {
          minDistance = distance;
          closest = player;
        }
      }
    }
    
    return closest;
  }
  
  /**
   * Get entity position
   */
  private getEntityPosition(entity: any): Vector3 | null {
    // Try different ways to get position
    if (entity.position && typeof entity.position === 'object') {
      return entity.position;
    }
    
    if (entity.data?.position) {
      // If position is an array, convert to Vector3
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
   * Get entity from world
   */
  private getEntity(entityId: string): any {
    if (this.world.entities.items instanceof Map) {
      return this.world.entities.items.get(entityId);
    }
    return this.world.entities.get?.(entityId);
  }
  
  /**
   * Check if entity is a player
   */
  private isPlayer(entity: any): boolean {
    return entity.type === 'player' || entity.data?.type === 'player';
  }
  
  /**
   * Calculate distance between positions
   */
  private getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Execute patrol behavior
   */
  private executePatrol(npc: NPCEntity, component: NPCComponent): void {
    // Check if NPC has waypoints defined
    const waypoints = (component as any).waypoints || this.generateDefaultWaypoints(component.spawnPoint);
    
    if (waypoints.length === 0) return;
    
    // Get current waypoint index
    let waypointIndex = (component as any).currentWaypointIndex || 0;
    const currentWaypoint = waypoints[waypointIndex];
    
    // Check distance to current waypoint
    const distance = this.getDistance(npc.position, currentWaypoint);
    
    if (distance < 1.0) {
      // Reached waypoint, move to next
      waypointIndex = (waypointIndex + 1) % waypoints.length;
      (component as any).currentWaypointIndex = waypointIndex;
      
      // Optional: pause at waypoint
      if ((component as any).waypointPauseTime) {
        component.state = NPCState.IDLE;
        setTimeout(() => {
          component.state = NPCState.PATROLLING;
        }, (component as any).waypointPauseTime);
        return;
      }
    }
    
    // Move towards current waypoint
    const nextWaypoint = waypoints[waypointIndex];
    this.movementSystem.moveEntity(npc.data.id, nextWaypoint);
    
    // Update facing direction
    this.updateFacingDirection(npc, nextWaypoint);
  }
  
  /**
   * Generate default waypoints around spawn point
   */
  private generateDefaultWaypoints(spawnPoint: Vector3): Vector3[] {
    const waypoints: Vector3[] = [];
    const radius = 5; // Default patrol radius
    const points = 4; // Number of waypoints
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      waypoints.push({
        x: spawnPoint.x + Math.cos(angle) * radius,
        y: spawnPoint.y,
        z: spawnPoint.z + Math.sin(angle) * radius
      });
    }
    
    return waypoints;
  }
  
  /**
   * Update NPC facing direction
   */
  private updateFacingDirection(npc: NPCEntity, targetPosition: Vector3): void {
    const direction = {
      x: targetPosition.x - npc.position.x,
      z: targetPosition.z - npc.position.z
    };
    
    const angle = Math.atan2(direction.z, direction.x);
    
    // Apply rotation to NPC
    const movement = npc.getComponent<MovementComponent>('movement');
    if (movement) {
      movement.facingDirection = angle;
    }
    
    // Update visual rotation if mesh exists
    const mesh = (npc as any).mesh;
    if (mesh) {
      mesh.rotation.y = angle;
    }
  }
  
  /**
   * Flank the target from the side
   */
  private executeFlank(npc: NPCEntity, target: Entity): void {
    const angle = Math.atan2(
      target.position.z - npc.position.z,
      target.position.x - npc.position.x
    );
    
    // Flank to the right
    const flankAngle = angle + Math.PI / 2;
    const flankDistance = 3;
    
    const flankPosition = {
      x: target.position.x + Math.cos(flankAngle) * flankDistance,
      y: target.position.y,
      z: target.position.z + Math.sin(flankAngle) * flankDistance
    };
    
    this.movementSystem.moveEntity(npc.data.id, flankPosition);
  }
  
  /**
   * Check if there are allies nearby
   */
  private hasNearbyAllies(npc: NPCEntity, radius: number): boolean {
    const component = npc.getComponent<NPCComponent>('npc');
    if (!component) return false;
    
    // Use spatial query to find nearby NPCs
    const nearbyEntities = this.spatialQuery(npc.position, radius);
    
    for (const entity of nearbyEntities) {
      if (entity.data.id === npc.data.id) continue;
      
      const otherNpc = entity.getComponent<NPCComponent>('npc');
      if (otherNpc && otherNpc.faction === component.faction) {
        // Check if ally is in combat
        const combat = entity.getComponent<CombatComponent>('combat');
        if (!combat || !combat.inCombat) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Perform spatial query to find entities within radius
   */
  private spatialQuery(position: Vector3, radius: number): Entity[] {
    const results: Entity[] = [];
    
    // Check if world has spatial index
    const spatialIndex = (this.world as any).spatialIndex;
    if (spatialIndex) {
      // Use optimized spatial query
      return spatialIndex.query(position, radius);
    }
    
    // Fallback to brute force search
    const radiusSquared = radius * radius;
    
    for (const entity of this.world.entities.items.values()) {
      if (!entity.position) continue;
      
      const dx = entity.position.x - position.x;
      const dy = entity.position.y - position.y;
      const dz = entity.position.z - position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      if (distanceSquared <= radiusSquared) {
        results.push(entity);
      }
    }
    
    return results;
  }
} 