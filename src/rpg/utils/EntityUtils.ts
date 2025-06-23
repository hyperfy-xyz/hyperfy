import type { World, Entity } from '../../types';
import type { RPGEntity } from '../types';

/**
 * Utility functions for consistent entity access across RPG systems
 */
export class EntityUtils {
  /**
   * Get entity from world with proper type checking
   */
  static getEntity(world: World, entityId: string): Entity | undefined {
    // Check if entities.items is a Map (test environment)
    if (world.entities.items instanceof Map) {
      return world.entities.items.get(entityId);
    }
    
    // Use standard entities.get method
    if (world.entities.get) {
      const entity = world.entities.get(entityId);
      return entity || undefined;
    }
    
    return undefined;
  }
  
  /**
   * Get all entities from world
   */
  static getAllEntities(world: World): Entity[] {
    // Check if entities.items is a Map
    if (world.entities.items instanceof Map) {
      return Array.from(world.entities.items.values());
    }
    
    // Check if entities.items is iterable
    if (world.entities.items && typeof (world.entities.items as any).values === 'function') {
      return Array.from((world.entities.items as any).values());
    }
    
    return [];
  }
  
  /**
   * Check if entity exists
   */
  static hasEntity(world: World, entityId: string): boolean {
    if (world.entities.items instanceof Map) {
      return world.entities.items.has(entityId);
    }
    
    if (world.entities.has) {
      return world.entities.has(entityId);
    }
    
    return false;
  }
  
  /**
   * Add entity to world
   */
  static addEntity(world: World, entity: Entity): void {
    if (world.entities.items instanceof Map) {
      world.entities.items.set(entity.id, entity);
    } else if (world.entities.create) {
      // Use create method if available
      world.entities.create(entity.type, entity);
    } else {
      console.warn('Unable to add entity to world - no suitable method found');
    }
  }
  
  /**
   * Remove entity from world
   */
  static removeEntity(world: World, entityId: string): void {
    if (world.entities.items instanceof Map) {
      world.entities.items.delete(entityId);
    } else if (world.entities.destroyEntity) {
      world.entities.destroyEntity(entityId);
    } else {
      console.warn('Unable to remove entity from world - no suitable method found');
    }
  }
  
  /**
   * Convert entity to RPGEntity if it has required methods
   */
  static asRPGEntity(entity: Entity | undefined): RPGEntity | undefined {
    if (!entity) return undefined;
    
    // Check if entity has RPGEntity methods
    if (typeof entity.getComponent === 'function' && 
        typeof entity.hasComponent === 'function') {
      return entity as unknown as RPGEntity;
    }
    
    return undefined;
  }
  
  /**
   * Get entities in range of a position
   */
  static getEntitiesInRange(world: World, position: { x: number; y: number; z: number }, range: number): Entity[] {
    const results: Entity[] = [];
    const rangeSquared = range * range;
    
    for (const entity of EntityUtils.getAllEntities(world)) {
      if (!entity.position) continue;
      
      const dx = entity.position.x - position.x;
      const dy = entity.position.y - position.y;
      const dz = entity.position.z - position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      if (distanceSquared <= rangeSquared) {
        results.push(entity);
      }
    }
    
    return results;
  }
  
  /**
   * Calculate distance between two positions
   */
  static distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Get entity position (handles both direct position and data.position)
   */
  static getPosition(entity: Entity): { x: number; y: number; z: number } | null {
    // Direct position property
    if (entity.position) {
      return entity.position;
    }
    
    // Position in data (for compatibility)
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
    
    // Check component
    const movementComponent = entity.getComponent?.('movement');
    if (movementComponent && (movementComponent as any).position) {
      return (movementComponent as any).position;
    }
    
    return null;
  }
} 