import { System } from './System.js';
import type { World, Events as IEvents } from '../../types/index.js';

type EventCallback = (data?: any, extra?: any) => void;

/**
 * Events System
 *
 * - Runs on both the server and client.
 * - Used to notify apps of world events like player enter/leave
 *
 */
export class Events extends System implements IEvents {
  private eventListeners: Map<string | symbol, Set<EventCallback>>;

  constructor(world: World) {
    super(world);
    this.eventListeners = new Map();
  }

  emit<T extends string | symbol>(event: T, ...args: any[]): boolean {
    // Extract data and extra from args for backward compatibility
    const [data, extra] = args;
    const callbacks = this.eventListeners.get(event);
    if (!callbacks) return false;
    
    for (const callback of callbacks) {
      try {
        callback(data, extra);
      } catch (err) {
        console.error(`Error in event listener for '${String(event)}':`, err);
      }
    }
    return true;
  }

  on<T extends string | symbol>(event: T, fn: (...args: any[]) => void, context?: any): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    // Wrap the function to handle the context if provided
    const handler = context ? fn.bind(context) : fn;
    this.eventListeners.get(event)!.add(handler);
    return this;
  }

  off<T extends string | symbol>(event: T, fn?: (...args: any[]) => void, context?: any, once?: boolean): this {
    if (!fn) {
      // Remove all listeners for this event
      this.eventListeners.delete(event);
      return this;
    }
    
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      // If context was provided, we need to find the bound version
      // For simplicity, just remove the function as-is
      callbacks.delete(fn);
      if (callbacks.size === 0) {
        this.eventListeners.delete(event);
      }
    }
    return this;
  }

  override destroy(): void {
    this.eventListeners.clear();
  }
} 