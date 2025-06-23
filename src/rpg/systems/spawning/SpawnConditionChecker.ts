import type { World } from '../../../types';
import type { PlayerEntity, StatsComponent } from '../../types';

interface Spawner {
  id: string;
  position: { x: number; y: number; z: number };
  conditions?: SpawnConditions;
  activationRange: number;
}

interface SpawnConditions {
  // Time-based conditions
  timeOfDay?: {
    start: number;  // 0-24
    end: number;
  };
  
  // Player conditions
  minPlayers?: number;
  maxPlayers?: number;
  playerLevel?: {
    min: number;
    max: number;
  };
  
  // Custom conditions
  customCondition?: (spawner: Spawner, world: World) => boolean;
}

/**
 * Checks spawn conditions for spawners
 */
export class SpawnConditionChecker {
  /**
   * Check if all conditions are met for spawning
   */
  checkConditions(spawner: Spawner, world: World): boolean {
    const conditions = spawner.conditions;
    if (!conditions) return true;
    
    // Check time of day
    if (conditions.timeOfDay) {
      const currentTime = this.getTimeOfDay(world);
      const { start, end } = conditions.timeOfDay;
      
      if (start <= end) {
        if (currentTime < start || currentTime > end) return false;
      } else {
        // Handles overnight periods
        if (currentTime < start && currentTime > end) return false;
      }
    }
    
    // Check player count
    if (conditions.minPlayers !== undefined || conditions.maxPlayers !== undefined) {
      const playerCount = this.getPlayersInRange(spawner, world).length;
      
      if (conditions.minPlayers !== undefined && playerCount < conditions.minPlayers) {
        return false;
      }
      if (conditions.maxPlayers !== undefined && playerCount > conditions.maxPlayers) {
        return false;
      }
    }
    
    // Check player level
    if (conditions.playerLevel) {
      const players = this.getPlayersInRange(spawner, world);
      if (players.length === 0) return false;
      
      const avgLevel = this.getAveragePlayerLevel(players);
      const { min, max } = conditions.playerLevel;
      
      if (min !== undefined && avgLevel < min) return false;
      if (max !== undefined && avgLevel > max) return false;
    }
    
    // Check custom condition
    if (conditions.customCondition) {
      if (!conditions.customCondition(spawner, world)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get current time of day (0-24)
   */
  private getTimeOfDay(world: World): number {
    // Check if world has time system
    const timeSystem = (world as any).timeSystem;
    if (timeSystem && typeof timeSystem.getHour === 'function') {
      return timeSystem.getHour();
    }
    
    // Check if world has day/night cycle
    const dayNightCycle = (world as any).dayNightCycle;
    if (dayNightCycle && typeof dayNightCycle.getCurrentHour === 'function') {
      return dayNightCycle.getCurrentHour();
    }
    
    // Fallback to real time
    const now = new Date();
    return now.getHours() + (now.getMinutes() / 60);
  }
  
  /**
   * Get players in range of spawner
   */
  private getPlayersInRange(spawner: Spawner, world: World): PlayerEntity[] {
    const players: PlayerEntity[] = [];
    
    // Get all entities in range
    const entities = (world as any).getEntitiesInRange?.(spawner.position, spawner.activationRange) || [];
    
    for (const entity of entities) {
      // Check both entity.type and entity.data.type for compatibility
      if (entity.type === 'player' || entity.data?.type === 'player') {
        players.push(entity as PlayerEntity);
      }
    }
    
    return players;
  }
  
  /**
   * Get average level of players
   */
  private getAveragePlayerLevel(players: PlayerEntity[]): number {
    if (players.length === 0) return 0;
    
    let totalLevel = 0;
    for (const player of players) {
      const stats = player.getComponent?.('stats') as StatsComponent | undefined;
      if (stats?.combatLevel) {
        totalLevel += stats.combatLevel;
      }
    }
    
    return totalLevel / players.length;
  }
} 