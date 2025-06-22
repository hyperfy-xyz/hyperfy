import type { Vector3 } from '../../types';

/**
 * Spatial index for efficient range queries
 */
export class SpatialIndex<T extends { position: Vector3 }> {
  private grid: Map<string, Set<T>>;
  private cellSize: number;
  
  constructor(cellSize: number = 50) {
    this.grid = new Map();
    this.cellSize = cellSize;
  }
  
  /**
   * Add item to spatial index
   */
  add(item: T): void {
    const key = this.getGridKey(item.position);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key)!.add(item);
  }
  
  /**
   * Remove item from spatial index
   */
  remove(item: T): void {
    const key = this.getGridKey(item.position);
    const cell = this.grid.get(key);
    if (cell) {
      cell.delete(item);
      if (cell.size === 0) {
        this.grid.delete(key);
      }
    }
  }
  
  /**
   * Get all items within range of position
   */
  getInRange(position: Vector3, range: number): T[] {
    const results: T[] = [];
    const cellRange = Math.ceil(range / this.cellSize);
    
    const centerCell = this.getCellCoords(position);
    
    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dz = -cellRange; dz <= cellRange; dz++) {
        const cellKey = `${centerCell.x + dx},${centerCell.z + dz}`;
        const cell = this.grid.get(cellKey);
        
        if (cell) {
          for (const item of cell) {
            const distance = this.distance(position, item.position);
            if (distance <= range) {
              results.push(item);
            }
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Clear all items
   */
  clear(): void {
    this.grid.clear();
  }
  
  /**
   * Get total item count
   */
  get size(): number {
    let count = 0;
    for (const cell of this.grid.values()) {
      count += cell.size;
    }
    return count;
  }
  
  /**
   * Get grid key for position
   */
  private getGridKey(position: Vector3): string {
    const cell = this.getCellCoords(position);
    return `${cell.x},${cell.z}`;
  }
  
  /**
   * Get cell coordinates for position
   */
  private getCellCoords(position: Vector3): { x: number; z: number } {
    return {
      x: Math.floor(position.x / this.cellSize),
      z: Math.floor(position.z / this.cellSize)
    };
  }
  
  /**
   * Calculate distance between two positions
   */
  private distance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
} 