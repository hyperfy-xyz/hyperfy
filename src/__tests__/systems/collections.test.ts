import { describe, it, expect, beforeEach } from 'vitest';
import { Collections } from '../../core/systems/Collections.js';
import { createTestWorld } from '../test-world-factory.js';

describe('Collections System', () => {
  let world: any;
  let collections: Collections;

  beforeEach(async () => {
    world = await createTestWorld();
    collections = new Collections(world);
  });

  describe('Basic Operations', () => {
    it('should initialize with empty collections', () => {
      expect(collections.getAll()).toEqual([]);
      expect(collections.items.size).toBe(0);
    });

    it('should add a collection', () => {
      const collection = {
        id: 'test-collection',
        name: 'Test Collection',
        description: 'A test collection',
        items: ['item1', 'item2']
      };

      collections.add(collection);

      expect(collections.get('test-collection')).toEqual(collection);
      expect(collections.items.get('test-collection')).toEqual(collection);
      expect(collections.getAll()).toHaveLength(1);
    });

    it('should update existing collection', () => {
      const original = {
        id: 'update-test',
        name: 'Original',
        items: ['a']
      };

      const updated = {
        id: 'update-test',
        name: 'Updated',
        items: ['a', 'b', 'c']
      };

      collections.add(original);
      collections.add(updated);

      expect(collections.get('update-test')).toEqual(updated);
      expect(collections.getAll()).toHaveLength(1);
    });

    it('should remove a collection', () => {
      const collection = {
        id: 'remove-test',
        name: 'To Remove'
      };

      collections.add(collection);
      expect(collections.get('remove-test')).toBeDefined();

      const removed = collections.remove('remove-test');
      
      expect(removed).toBe(true);
      expect(collections.get('remove-test')).toBeUndefined();
      expect(collections.items.has('remove-test')).toBe(false);
    });

    it('should return false when removing non-existent collection', () => {
      const removed = collections.remove('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Multiple Collections', () => {
    it('should manage multiple collections', () => {
      const collections_data = [
        { id: 'weapons', name: 'Weapons', items: ['sword', 'bow'] },
        { id: 'armor', name: 'Armor', items: ['helmet', 'shield'] },
        { id: 'potions', name: 'Potions', items: ['health', 'mana'] }
      ];

      for (const coll of collections_data) {
        collections.add(coll);
      }

      expect(collections.getAll()).toHaveLength(3);
      expect(collections.get('weapons')?.name).toBe('Weapons');
      expect(collections.get('armor')?.name).toBe('Armor');
      expect(collections.get('potions')?.name).toBe('Potions');
    });

    it('should return all collections as array', () => {
      collections.add({ id: '1', name: 'One' });
      collections.add({ id: '2', name: 'Two' });
      collections.add({ id: '3', name: 'Three' });

      const all = collections.getAll();
      
      expect(all).toHaveLength(3);
      expect(all).toBeInstanceOf(Array);
      expect(all.map(c => c.id)).toEqual(['1', '2', '3']);
    });
  });

  describe('Serialization', () => {
    it('should serialize collections', () => {
      const testData = [
        { id: 'a', name: 'Collection A' },
        { id: 'b', name: 'Collection B' }
      ];

      for (const coll of testData) {
        collections.add(coll);
      }

      const serialized = collections.serialize();
      expect(serialized).toEqual(testData);
    });

    it('should deserialize collections', () => {
      const data = [
        { id: 'imported-1', name: 'Imported 1', data: { custom: true } },
        { id: 'imported-2', name: 'Imported 2', tags: ['tag1', 'tag2'] }
      ];

      collections.deserialize(data);

      expect(collections.getAll()).toEqual(data);
      expect(collections.items.size).toBe(2);
      expect(collections.get('imported-1')?.data?.custom).toBe(true);
      expect(collections.get('imported-2')?.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle empty deserialization', () => {
      collections.add({ id: 'existing', name: 'Existing' });
      
      collections.deserialize([]);
      
      expect(collections.getAll()).toEqual([]);
      expect(collections.items.size).toBe(0);
    });

    it('should handle null deserialization', () => {
      collections.add({ id: 'existing', name: 'Existing' });
      
      collections.deserialize(null as any);
      
      expect(collections.getAll()).toEqual([]);
      expect(collections.items.size).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should clear all collections on destroy', () => {
      collections.add({ id: '1', name: 'One' });
      collections.add({ id: '2', name: 'Two' });
      
      collections.destroy();
      
      expect(collections.getAll()).toEqual([]);
      expect(collections.items.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle collections with extra properties', () => {
      const complexCollection = {
        id: 'complex',
        name: 'Complex Collection',
        metadata: {
          created: Date.now(),
          author: 'Test',
          version: '1.0.0'
        },
        items: [
          { id: 'item1', type: 'weapon', damage: 10 },
          { id: 'item2', type: 'armor', defense: 5 }
        ],
        customField: 'custom value'
      };

      collections.add(complexCollection);
      const retrieved = collections.get('complex');

      expect(retrieved).toEqual(complexCollection);
      expect(retrieved?.metadata?.author).toBe('Test');
      expect(retrieved?.items?.[0].damage).toBe(10);
      expect(retrieved?.customField).toBe('custom value');
    });

    it('should find collection by id efficiently', () => {
      // Add many collections
      for (let i = 0; i < 100; i++) {
        collections.add({ id: `coll-${i}`, name: `Collection ${i}` });
      }

      // Should find quickly using Map
      const found = collections.get('coll-50');
      expect(found?.name).toBe('Collection 50');

      // Map lookup should be instant
      const fromMap = collections.items.get('coll-50');
      expect(fromMap).toEqual(found);
    });
  });
}); 