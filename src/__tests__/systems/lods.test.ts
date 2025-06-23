import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LODs, LODNode } from '../../core/systems/LODs.js';
import { createTestWorld, MockWorld } from '../test-world-factory.js';

// Mock LOD node implementation
class MockLODNode implements LODNode {
  checkCalled = 0;
  
  check(): void {
    this.checkCalled++;
  }
}

describe('LODs System', () => {
  let world: MockWorld;
  let lods: LODs;

  beforeEach(async () => {
    world = await createTestWorld();
    lods = new LODs(world);
  });

  describe('initialization', () => {
    it('should initialize with empty nodes array and zero cursor', () => {
      expect(lods.getNodeCount()).toBe(0);
      expect(lods.getCursor()).toBe(0);
    });
  });

  describe('register', () => {
    it('should add a node to the system', () => {
      const node = new MockLODNode();
      
      lods.register(node);
      
      expect(lods.getNodeCount()).toBe(1);
    });

    it('should add multiple nodes', () => {
      const node1 = new MockLODNode();
      const node2 = new MockLODNode();
      const node3 = new MockLODNode();
      
      lods.register(node1);
      lods.register(node2);
      lods.register(node3);
      
      expect(lods.getNodeCount()).toBe(3);
    });
  });

  describe('unregister', () => {
    it('should remove a registered node', () => {
      const node = new MockLODNode();
      
      lods.register(node);
      expect(lods.getNodeCount()).toBe(1);
      
      lods.unregister(node);
      expect(lods.getNodeCount()).toBe(0);
    });

    it('should handle unregistering non-existent node', () => {
      const node = new MockLODNode();
      
      // Should not throw
      expect(() => lods.unregister(node)).not.toThrow();
      expect(lods.getNodeCount()).toBe(0);
    });

    it('should adjust cursor when removing nodes', () => {
      const nodes: MockLODNode[] = [];
      
      // Add 5 nodes
      for (let i = 0; i < 5; i++) {
        const node = new MockLODNode();
        nodes.push(node);
        lods.register(node);
      }
      
      // Move cursor to end
      lods.update(0);
      expect(lods.getCursor()).toBe(0); // After processing all 5 nodes, cursor wraps to 0
      
      // Remove last nodes to make cursor out of bounds
      lods.unregister(nodes[4]);
      lods.unregister(nodes[3]);
      
      expect(lods.getNodeCount()).toBe(3);
      expect(lods.getCursor()).toBeLessThan(3);
    });
  });

  describe('update', () => {
    it('should check nodes when update is called', () => {
      const node = new MockLODNode();
      
      lods.register(node);
      lods.update(16); // 16ms delta
      
      expect(node.checkCalled).toBe(1);
    });

    it('should batch process nodes up to BATCH_SIZE', () => {
      const nodes: MockLODNode[] = [];
      const nodeCount = 100;
      
      for (let i = 0; i < nodeCount; i++) {
        const node = new MockLODNode();
        nodes.push(node);
        lods.register(node);
      }
      
      // First update should process all nodes (since 100 < BATCH_SIZE)
      lods.update(16);
      
      nodes.forEach(node => {
        expect(node.checkCalled).toBe(1);
      });
    });

    it('should handle cursor wrapping correctly', () => {
      const nodes: MockLODNode[] = [];
      const nodeCount = 5;
      
      for (let i = 0; i < nodeCount; i++) {
        const node = new MockLODNode();
        nodes.push(node);
        lods.register(node);
      }
      
      // First update processes all 5 nodes
      lods.update(16);
      expect(lods.getCursor()).toBe(0); // Wraps back to 0
      
      // Each node should have been checked once
      nodes.forEach(node => {
        expect(node.checkCalled).toBe(1);
      });
      
      // Second update should process all nodes again
      lods.update(16);
      
      nodes.forEach(node => {
        expect(node.checkCalled).toBe(2);
      });
    });

    it('should handle empty nodes array', () => {
      // Should not throw
      expect(() => lods.update(16)).not.toThrow();
    });

    it('should process nodes in batches when exceeding BATCH_SIZE', () => {
      const nodes: MockLODNode[] = [];
      const nodeCount = 2500; // More than BATCH_SIZE (1000)
      
      for (let i = 0; i < nodeCount; i++) {
        const node = new MockLODNode();
        nodes.push(node);
        lods.register(node);
      }
      
      // First update should only process BATCH_SIZE nodes
      lods.update(16);
      
      let checkedCount = 0;
      nodes.forEach(node => {
        if (node.checkCalled > 0) checkedCount++;
      });
      
      expect(checkedCount).toBe(1000); // BATCH_SIZE
      expect(lods.getCursor()).toBe(1000);
      
      // Second update should process next batch
      lods.update(16);
      
      checkedCount = 0;
      nodes.forEach(node => {
        if (node.checkCalled > 0) checkedCount++;
      });
      
      expect(checkedCount).toBe(2000);
      expect(lods.getCursor()).toBe(2000);
      
      // Third update should process remaining 500 nodes
      lods.update(16);
      
      // Cursor should be at 500 (2000 + 500 = 2500, 2500 % 2500 = 0, then + 500)
      expect(lods.getCursor()).toBe(500);
      
      // All nodes should have been checked at least once
      nodes.forEach(node => {
        expect(node.checkCalled).toBeGreaterThanOrEqual(1);
      });
      
      // Exactly 2500 nodes should have been checked
      checkedCount = 0;
      nodes.forEach(node => {
        if (node.checkCalled > 0) checkedCount++;
      });
      expect(checkedCount).toBe(2500);
    });
  });

  describe('destroy', () => {
    it('should clear all nodes and reset cursor', () => {
      const nodes: MockLODNode[] = [];
      
      for (let i = 0; i < 10; i++) {
        const node = new MockLODNode();
        nodes.push(node);
        lods.register(node);
      }
      
      // Process some nodes to move cursor
      lods.update(16);
      
      lods.destroy();
      
      expect(lods.getNodeCount()).toBe(0);
      expect(lods.getCursor()).toBe(0);
    });
  });

  describe('performance', () => {
    it('should efficiently handle large numbers of nodes', () => {
      const nodes: MockLODNode[] = [];
      const nodeCount = 10000;
      
      const startRegister = performance.now();
      
      for (let i = 0; i < nodeCount; i++) {
        const node = new MockLODNode();
        nodes.push(node);
        lods.register(node);
      }
      
      const registerTime = performance.now() - startRegister;
      
      // Registration should be fast (less than 100ms for 10k nodes)
      expect(registerTime).toBeLessThan(100);
      
      const startUpdate = performance.now();
      
      // Should only process BATCH_SIZE nodes per update
      lods.update(16);
      
      const updateTime = performance.now() - startUpdate;
      
      // Update should be fast (less than 10ms)
      expect(updateTime).toBeLessThan(10);
      
      // Only BATCH_SIZE nodes should have been checked
      let checkedCount = 0;
      nodes.forEach(node => {
        if (node.checkCalled > 0) checkedCount++;
      });
      
      expect(checkedCount).toBe(1000); // BATCH_SIZE
    });
  });

  describe('edge cases', () => {
    it('should handle single node correctly', () => {
      const node = new MockLODNode();
      
      lods.register(node);
      lods.update(16);
      
      expect(node.checkCalled).toBe(1);
      expect(lods.getCursor()).toBe(0);
      
      // Multiple updates should keep checking the single node
      lods.update(16);
      lods.update(16);
      
      expect(node.checkCalled).toBe(3);
    });

    it('should handle node removal during iteration', () => {
      const nodes: MockLODNode[] = [];
      
      for (let i = 0; i < 5; i++) {
        const node = new MockLODNode();
        nodes.push(node);
        lods.register(node);
      }
      
      // Remove a node in the middle
      lods.unregister(nodes[2]);
      
      // Update should still work correctly
      lods.update(16);
      
      expect(nodes[0].checkCalled).toBe(1);
      expect(nodes[1].checkCalled).toBe(1);
      expect(nodes[2].checkCalled).toBe(0); // Removed node
      expect(nodes[3].checkCalled).toBe(1);
      expect(nodes[4].checkCalled).toBe(1);
    });
  });
}); 