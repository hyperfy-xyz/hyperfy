import { System } from './System';
import type { World } from '../World';
import { Vector3 } from 'three';

export enum TerrainType {
  GRASS = 'grass',
  DIRT = 'dirt',
  STONE = 'stone',
  WATER = 'water',
  SAND = 'sand',
  SNOW = 'snow',
  ICE = 'ice',
  LAVA = 'lava'
}

interface TerrainChunk {
  x: number;
  z: number;
  heightMap: Float32Array;
  typeMap: Uint8Array;
  resolution: number;
  size: number;
}

interface TerrainConfig {
  chunkSize?: number;
  chunkResolution?: number;
  maxHeight?: number;
  waterLevel?: number;
  defaultType?: TerrainType;
}

export class Terrain extends System {
  name = 'terrain';
  
  private chunks: Map<string, TerrainChunk>;
  private chunkSize: number;
  private chunkResolution: number;
  private maxHeight: number;
  private waterLevel: number;
  private defaultType: TerrainType;
  private terrainTypes: Map<number, TerrainType>;
  
  constructor(world: World, config: TerrainConfig = {}) {
    super(world);
    this.chunks = new Map();
    this.chunkSize = config.chunkSize || 100;
    this.chunkResolution = config.chunkResolution || 64;
    this.maxHeight = config.maxHeight || 50;
    this.waterLevel = config.waterLevel || 0;
    this.defaultType = config.defaultType || TerrainType.GRASS;
    
    // Map terrain type enum to numeric values for storage
    this.terrainTypes = new Map([
      [0, TerrainType.GRASS],
      [1, TerrainType.DIRT],
      [2, TerrainType.STONE],
      [3, TerrainType.WATER],
      [4, TerrainType.SAND],
      [5, TerrainType.SNOW],
      [6, TerrainType.ICE],
      [7, TerrainType.LAVA]
    ]);
  }
  
  async init(): Promise<void> {
    console.log(`Terrain initialized with chunk size: ${this.chunkSize}`);
  }
  
  update(_dt: number): void {
    // Terrain doesn't need regular updates
  }
  
  // Get height at world position
  getHeightAt(x: number, z: number): number {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const chunk = this.getChunk(chunkX, chunkZ);
    
    if (!chunk) {
      // Generate chunk if it doesn't exist
      this.generateChunk(chunkX, chunkZ);
      return 0; // Return default height for now
    }
    
    // Convert world coordinates to chunk-local coordinates
    const localX = x - (chunkX * this.chunkSize);
    const localZ = z - (chunkZ * this.chunkSize);
    
    // Bilinear interpolation for smooth height
    return this.interpolateHeight(chunk, localX, localZ);
  }
  
  // Get terrain type at world position
  getTypeAt(x: number, z: number): TerrainType {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const chunk = this.getChunk(chunkX, chunkZ);
    
    if (!chunk) {
      return this.defaultType;
    }
    
    const localX = x - (chunkX * this.chunkSize);
    const localZ = z - (chunkZ * this.chunkSize);
    
    const gridX = Math.floor((localX / this.chunkSize) * chunk.resolution);
    const gridZ = Math.floor((localZ / this.chunkSize) * chunk.resolution);
    const index = gridZ * chunk.resolution + gridX;
    
    const typeValue = chunk.typeMap[index];
    return this.terrainTypes.get(typeValue) || this.defaultType;
  }
  
  // Check if position is walkable
  isWalkable(x: number, z: number): boolean {
    const type = this.getTypeAt(x, z);
    return type !== TerrainType.WATER && type !== TerrainType.LAVA;
  }
  
  // Get surface normal at position
  getNormalAt(x: number, z: number): Vector3 {
    const epsilon = 0.1;
    const h = this.getHeightAt(x, z);
    const hx1 = this.getHeightAt(x + epsilon, z);
    const hx2 = this.getHeightAt(x - epsilon, z);
    const hz1 = this.getHeightAt(x, z + epsilon);
    const hz2 = this.getHeightAt(x, z - epsilon);
    
    const dx = (hx1 - hx2) / (2 * epsilon);
    const dz = (hz1 - hz2) / (2 * epsilon);
    
    const normal = new Vector3(-dx, 1, -dz);
    return normal.normalize();
  }
  
  // Get chunk at chunk coordinates
  private getChunk(chunkX: number, chunkZ: number): TerrainChunk | undefined {
    const key = `${chunkX},${chunkZ}`;
    return this.chunks.get(key);
  }
  
  // Generate terrain chunk
  private generateChunk(chunkX: number, chunkZ: number): TerrainChunk {
    const resolution = this.chunkResolution;
    const size = resolution * resolution;
    const heightMap = new Float32Array(size);
    const typeMap = new Uint8Array(size);
    
    // Simple procedural generation (can be replaced with noise functions)
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const index = z * resolution + x;
        const worldX = chunkX * this.chunkSize + (x / resolution) * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize + (z / resolution) * this.chunkSize;
        
        // Simple height generation
        const height = this.generateHeight(worldX, worldZ);
        heightMap[index] = height;
        
        // Determine terrain type based on height
        typeMap[index] = this.getTerrainTypeValue(height);
      }
    }
    
    const chunk: TerrainChunk = {
      x: chunkX,
      z: chunkZ,
      heightMap,
      typeMap,
      resolution,
      size: this.chunkSize
    };
    
    const key = `${chunkX},${chunkZ}`;
    this.chunks.set(key, chunk);
    
    return chunk;
  }
  
  // Generate height for world position
  private generateHeight(x: number, z: number): number {
    // Simple sine wave terrain for demonstration
    // Replace with proper noise function (Perlin/Simplex) in production
    const frequency = 0.02;
    const amplitude = 10;
    const height = Math.sin(x * frequency) * Math.cos(z * frequency) * amplitude;
    return height;
  }
  
  // Get terrain type value based on height
  private getTerrainTypeValue(height: number): number {
    if (height < this.waterLevel) return 3; // Water
    if (height < this.waterLevel + 2) return 4; // Sand
    if (height > 20) return 5; // Snow
    if (height > 15) return 2; // Stone
    return 0; // Grass
  }
  
  // Bilinear interpolation for smooth height
  private interpolateHeight(chunk: TerrainChunk, localX: number, localZ: number): number {
    const gridX = (localX / chunk.size) * (chunk.resolution - 1);
    const gridZ = (localZ / chunk.size) * (chunk.resolution - 1);
    
    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, chunk.resolution - 1);
    const z1 = Math.min(z0 + 1, chunk.resolution - 1);
    
    const fx = gridX - x0;
    const fz = gridZ - z0;
    
    const h00 = chunk.heightMap[z0 * chunk.resolution + x0];
    const h10 = chunk.heightMap[z0 * chunk.resolution + x1];
    const h01 = chunk.heightMap[z1 * chunk.resolution + x0];
    const h11 = chunk.heightMap[z1 * chunk.resolution + x1];
    
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
  }
  
  // Ray cast against terrain
  raycast(origin: Vector3, direction: Vector3, maxDistance: number = 1000): Vector3 | null {
    const step = 0.5;
    const dir = direction.clone().normalize();
    
    for (let t = 0; t < maxDistance; t += step) {
      const point = origin.clone().add(dir.clone().multiplyScalar(t));
      const terrainHeight = this.getHeightAt(point.x, point.z);
      
      if (point.y <= terrainHeight) {
        // Refine intersection point
        let tMin = t - step;
        let tMax = t;
        
        for (let i = 0; i < 5; i++) {
          const tMid = (tMin + tMax) / 2;
          const midPoint = origin.clone().add(dir.clone().multiplyScalar(tMid));
          const midHeight = this.getHeightAt(midPoint.x, midPoint.z);
          
          if (midPoint.y <= midHeight) {
            tMax = tMid;
          } else {
            tMin = tMid;
          }
        }
        
        const finalT = (tMin + tMax) / 2;
        const finalPoint = origin.clone().add(dir.clone().multiplyScalar(finalT));
        finalPoint.y = this.getHeightAt(finalPoint.x, finalPoint.z);
        return finalPoint;
      }
    }
    
    return null;
  }
  
  // Clear all chunks (for cleanup)
  clearChunks(): void {
    this.chunks.clear();
  }
  
  // Get debug info
  getDebugInfo(): { chunkCount: number; totalVertices: number } {
    let totalVertices = 0;
    for (const chunk of this.chunks.values()) {
      totalVertices += chunk.resolution * chunk.resolution;
    }
    
    return {
      chunkCount: this.chunks.size,
      totalVertices
    };
  }
} 