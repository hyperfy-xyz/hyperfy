import { System } from './System.js';
import type { World, Collections as ICollections } from '../../types/index.js';

interface Collection {
  id: string;
  name?: string;
  description?: string;
  items?: any[];
  [key: string]: any;
}

/**
 * Collections System
 * 
 * Manages collections of items/assets in the world
 */
export class Collections extends System implements ICollections {
  items: Map<string, any>;
  private collections: Collection[];

  constructor(world: World) {
    super(world);
    this.collections = [];
    this.items = new Map();
  }

  get(id: string): Collection | undefined {
    return this.collections.find(coll => coll.id === id);
  }

  add(collection: Collection): void {
    const existing = this.get(collection.id);
    if (existing) {
      // Update existing collection
      const index = this.collections.indexOf(existing);
      this.collections[index] = collection;
    } else {
      // Add new collection
      this.collections.push(collection);
    }
    this.items.set(collection.id, collection);
  }

  remove(id: string): boolean {
    const collection = this.get(id);
    if (collection) {
      const index = this.collections.indexOf(collection);
      this.collections.splice(index, 1);
      this.items.delete(id);
      return true;
    }
    return false;
  }

  getAll(): Collection[] {
    return [...this.collections];
  }

  deserialize(data: Collection[]): void {
    this.collections = data || [];
    this.items.clear();
    for (const collection of this.collections) {
      this.items.set(collection.id, collection);
    }
  }

  serialize(): Collection[] {
    return this.collections;
  }

  override destroy(): void {
    this.collections = [];
    this.items.clear();
  }
} 