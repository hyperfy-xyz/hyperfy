import { isEqual, merge } from 'lodash-es';
import { System } from './System.js';
import type { World, Blueprint, Entity } from '../../types/index.js';

/**
 * Blueprints System
 *
 * - Runs on both the server and client.
 * - A central registry for app blueprints
 *
 */
export class Blueprints extends System {
  items: Map<string, Blueprint>;

  constructor(world: World) {
    super(world);
    this.items = new Map();
  }

  get(id: string): Blueprint | undefined {
    return this.items.get(id);
  }

  add(data: Blueprint, local?: boolean): void {
    this.items.set(data.id, data);
    if (local) {
      // Check if network system exists before using it
      const network = (this.world as any).network;
      if (network?.send) {
        network.send('blueprintAdded', data);
      }
    }
  }

  modify(data: Partial<Blueprint> & { id: string }): void {
    const blueprint = this.items.get(data.id);
    if (!blueprint) return;

    const modified: Blueprint = {
      ...blueprint,
      ...data,
    } as Blueprint;

    const changed = !isEqual(blueprint, modified);
    if (!changed) return;

    this.items.set(blueprint.id, modified);

    // Update all entities using this blueprint
    for (const [_, entity] of this.world.entities.items) {
      if ((entity as any).data?.blueprint === blueprint.id) {
        (entity as any).data.state = {};
        if ((entity as any).build) {
          (entity as any).build();
        }
      }
    }

    this.emit('modify', modified);
  }

  serialize(): Blueprint[] {
    const datas: Blueprint[] = [];
    this.items.forEach(data => {
      datas.push(data);
    });
    return datas;
  }

  deserialize(datas: Blueprint[]): void {
    for (const data of datas) {
      this.add(data);
    }
  }

  override destroy(): void {
    this.items.clear();
  }
} 