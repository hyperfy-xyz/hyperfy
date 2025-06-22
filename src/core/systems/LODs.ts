import { System } from './System.js';
import type { World } from '../../types/index.js';

const BATCH_SIZE = 1000;

/**
 * LOD System
 *
 * - Runs on both the server and client.
 * - Uses a cursor to iterate and switch a maximum of X lods per frame
 *
 */

export interface LODNode {
  check(): void;
}

export class LODs extends System {
  private nodes: LODNode[];
  private cursor: number;

  constructor(world: World) {
    super(world);
    this.nodes = [];
    this.cursor = 0;
  }

  register(node: LODNode): void {
    this.nodes.push(node);
  }

  unregister(node: LODNode): void {
    const idx = this.nodes.indexOf(node);
    if (idx === -1) return;
    this.nodes.splice(idx, 1);
    
    // Adjust cursor if necessary to prevent out of bounds
    if (this.cursor >= this.nodes.length && this.nodes.length > 0) {
      this.cursor = this.cursor % this.nodes.length;
    }
  }

  override update(delta: number): void {
    if (this.nodes.length === 0) return;
    
    // check if lods need to switch (batched over multiple frames)
    const size = Math.min(this.nodes.length, BATCH_SIZE);
    for (let i = 0; i < size; i++) {
      const idx = (this.cursor + i) % this.nodes.length;
      const node = this.nodes[idx];
      if (!node) continue;
      node.check();
    }
    
    if (size) {
      this.cursor = (this.cursor + size) % this.nodes.length;
    }
  }

  override destroy(): void {
    this.nodes = [];
    this.cursor = 0;
  }

  // Helper methods for testing and debugging
  getNodeCount(): number {
    return this.nodes.length;
  }

  getCursor(): number {
    return this.cursor;
  }
} 