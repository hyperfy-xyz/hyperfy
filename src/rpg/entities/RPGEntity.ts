import { Entity } from '../../core/entities/Entity';
import type { World } from '../../types';
import type { Component } from '../types';

/**
 * RPG-specific entity that extends the base Entity class
 * with additional RPG functionality
 */
export class RPGEntity extends Entity {
  components: Map<string, Component>;
  
  // Declare inherited properties for TypeScript
  declare world: World;
  declare data: any;

  constructor(world: World, type: string, data: any) {
    // Ensure data has required fields for Entity
    const entityData = {
      id: data.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: data.name || type,
      position: data.position ? [data.position.x, data.position.y, data.position.z] : [0, 0, 0],
      quaternion: data.quaternion || [0, 0, 0, 1],
      ...data
    };
    
    super(world, entityData);
    this.components = new Map();
  }

  /**
   * Add a component to the entity
   */
  override addComponent(type: string, data?: any): Component {
    const component = { type, entity: this, data } as Component;
    this.components.set(type, component);
    return component;
  }

  /**
   * Get a component by type
   */
  override getComponent<T extends Component>(type: string): T | null {
    return this.components.get(type) as T || null;
  }

  /**
   * Remove a component by type
   */
  override removeComponent(type: string): void {
    this.components.delete(type);
  }

  /**
   * Check if entity has a component
   */
  override hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  /**
   * Get all components
   */
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  /**
   * Update entity - called every frame
   */
  override update(_delta: number): void {
    // Update logic can be implemented here
  }

  /**
   * Fixed update - called at fixed intervals
   */
  override fixedUpdate(_delta: number): void {
    // Fixed update logic can be implemented here
  }

  /**
   * Late update - called after all updates
   */
  override lateUpdate(_delta: number): void {
    // Late update logic can be implemented here
  }

  /**
   * Serialize entity data
   */
  override serialize(): any {
    const data = super.serialize();
    
    // Add component data
    const componentData: any = {};
    this.components.forEach((component, type) => {
      componentData[type] = component;
    });
    
    return {
      ...data,
      components: componentData
    };
  }

  override destroy(local?: boolean): void {
    // Clean up components
    for (const [type, _] of this.components) {
      this.removeComponent(type);
    }
    
    // Call parent destroy
    super.destroy(local);
  }
} 