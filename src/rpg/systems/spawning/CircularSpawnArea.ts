import type { Vector3, SpawnArea } from '../../types';

/**
 * Circular spawn area implementation
 */
export class CircularSpawnArea implements SpawnArea {
  type = 'circle' as const;
  avoidOverlap: boolean;
  minSpacing: number;
  maxHeight: number;
  
  constructor(
    private center: Vector3,
    public radius: number,
    minSpacing: number = 1,
    avoidOverlap: boolean = true,
    maxHeight: number = 0
  ) {
    this.minSpacing = minSpacing;
    this.avoidOverlap = avoidOverlap;
    this.maxHeight = maxHeight;
  }
  
  /**
   * Get a random position within the circular area
   */
  getRandomPosition(): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * this.radius;
    
    const yOffset = this.maxHeight > 0 ? (Math.random() - 0.5) * this.maxHeight * 2 : 0;
    
    return {
      x: this.center.x + Math.cos(angle) * distance,
      y: this.center.y + yOffset,
      z: this.center.z + Math.sin(angle) * distance
    };
  }
  
  /**
   * Check if position is valid within the area
   */
  isValidPosition(position: Vector3): boolean {
    const distance = this.distance(position, this.center);
    return distance <= this.radius;
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