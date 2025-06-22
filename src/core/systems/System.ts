import EventEmitter from 'eventemitter3';

import type { World, WorldOptions, System as ISystem } from '../../types/index.js';

/**
 * Base class for all game systems
 * Systems manage specific aspects of the game world (physics, rendering, entities, etc.)
 */
export abstract class System extends EventEmitter implements ISystem {
  world: World;

  constructor(world: World) {
    super();
    this.world = world;
  }

  /**
   * Initialize the system with world options
   * Called once when the world is initialized
   */
  async init(options: WorldOptions): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Start the system
   * Called after all systems have been initialized
   */
  start(): void {
    // Override in subclasses if needed
  }

  /**
   * Destroy the system and clean up resources
   */
  destroy(): void {
    // Override in subclasses if needed
  }

  // Update cycle methods - override as needed in subclasses

  /**
   * Called at the beginning of each frame
   */
  preTick(): void {
    // Override in subclasses if needed
  }

  /**
   * Called before fixed update steps
   */
  preFixedUpdate(willFixedStep: boolean): void {
    // Override in subclasses if needed
  }

  /**
   * Fixed timestep update for physics and deterministic logic
   */
  fixedUpdate(delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after fixed update steps
   */
  postFixedUpdate(delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called before main update with interpolation alpha
   */
  preUpdate(alpha: number): void {
    // Override in subclasses if needed
  }

  /**
   * Main update loop
   */
  update(delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after main update
   */
  postUpdate(delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Late update for camera and final adjustments
   */
  lateUpdate(delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after late update
   */
  postLateUpdate(delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Commit changes (e.g., render on client)
   */
  commit(): void {
    // Override in subclasses if needed
  }

  /**
   * Called at the end of each frame
   */
  postTick(): void {
    // Override in subclasses if needed
  }
} 