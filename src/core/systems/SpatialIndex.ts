import { System } from './System';
import type { World } from '../World';
import type { Entity } from '../entities/Entity';
import { Vector3 } from 'three';

interface SpatialCell {
  entities: Set<Entity>;
}

interface SpatialQuery {
  position: Vector3;
  radius: number;
  filter?: (entity: Entity) => boolean;
  maxResults?: number;
}

export class SpatialIndex extends System {
  name = 'spatialIndex';
  
  private cellSize: number;
  private grid: Map<string, SpatialCell>;
  private entityCells: Map<Entity, Set<string>>;
  private dirtyEntities: Set<Entity>;
  private updateInterval: number;
  private lastUpdate: number;
  
  constructor(world: World, cellSize: number = 10) {
    super(world);
    this.cellSize = cellSize;
    this.grid = new Map();
    this.entityCells = new Map();
    this.dirtyEntities = new Set();
    this.updateInterval = 100; // Update every 100ms
    this.lastUpdate = 0;
  }
  
  async init(): Promise<void> {
    // Initialize spatial index
    console.log(`SpatialIndex initialized with cell size: ${this.cellSize}`);
  }
  
  update(dt: number): void {
    this.lastUpdate += dt;
    
    // Batch updates for performance
    if (this.lastUpdate >= this.updateInterval) {
      this.processDirtyEntities();
      this.lastUpdate = 0;
    }
  }
  
  // Add entity to spatial index
  addEntity(entity: Entity): void {
    if (!entity.node) return;
    
    const position = entity.node.getWorldPosition();
    const cellKeys = this.getCellKeysForPosition(position);
    
    this.entityCells.set(entity, new Set(cellKeys));
    
    for (const key of cellKeys) {
      let cell = this.grid.get(key);
      if (!cell) {
        cell = { entities: new Set() };
        this.grid.set(key, cell);
      }
      cell.entities.add(entity);
    }
  }
  
  // Remove entity from spatial index
  removeEntity(entity: Entity): void {
    const cellKeys = this.entityCells.get(entity);
    if (!cellKeys) return;
    
    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.entities.delete(entity);
        if (cell.entities.size === 0) {
          this.grid.delete(key);
        }
      }
    }
    
    this.entityCells.delete(entity);
    this.dirtyEntities.delete(entity);
  }
  
  // Mark entity as needing position update
  markDirty(entity: Entity): void {
    if (this.entityCells.has(entity)) {
      this.dirtyEntities.add(entity);
    }
  }
  
  // Update entity position in spatial index
  updateEntity(entity: Entity): void {
    if (!entity.node) return;
    
    const oldCellKeys = this.entityCells.get(entity);
    if (!oldCellKeys) {
      this.addEntity(entity);
      return;
    }
    
    const position = entity.node.getWorldPosition();
    const newCellKeys = new Set(this.getCellKeysForPosition(position));
    
    // Remove from old cells
    for (const key of oldCellKeys) {
      if (!newCellKeys.has(key)) {
        const cell = this.grid.get(key);
        if (cell) {
          cell.entities.delete(entity);
          if (cell.entities.size === 0) {
            this.grid.delete(key);
          }
        }
      }
    }
    
    // Add to new cells
    for (const key of newCellKeys) {
      if (!oldCellKeys.has(key)) {
        let cell = this.grid.get(key);
        if (!cell) {
          cell = { entities: new Set() };
          this.grid.set(key, cell);
        }
        cell.entities.add(entity);
      }
    }
    
    this.entityCells.set(entity, newCellKeys);
  }
  
  // Query entities within radius
  query(query: SpatialQuery): Entity[] {
    const results: Entity[] = [];
    const checkedEntities = new Set<Entity>();
    const radiusSquared = query.radius * query.radius;
    
    // Get all cells that could contain entities within radius
    const cellsToCheck = this.getCellsInRadius(query.position, query.radius);
    
    for (const key of cellsToCheck) {
      const cell = this.grid.get(key);
      if (!cell) continue;
      
      for (const entity of cell.entities) {
        if (checkedEntities.has(entity)) continue;
        checkedEntities.add(entity);
        
        // Filter check
        if (query.filter && !query.filter(entity)) continue;
        
        // Distance check
        if (entity.node) {
          const entityPos = entity.node.getWorldPosition();
          const distSquared = query.position.distanceToSquared(entityPos);
          
          if (distSquared <= radiusSquared) {
            results.push(entity);
            
            if (query.maxResults && results.length >= query.maxResults) {
              return results;
            }
          }
        }
      }
    }
    
    return results;
  }
  
  // Get entities in specific cell
  getEntitiesInCell(x: number, y: number, z: number): Entity[] {
    const key = this.getCellKey(x, y, z);
    const cell = this.grid.get(key);
    return cell ? Array.from(cell.entities) : [];
  }
  
  // Process all dirty entities in batch
  private processDirtyEntities(): void {
    for (const entity of this.dirtyEntities) {
      this.updateEntity(entity);
    }
    this.dirtyEntities.clear();
  }
  
  // Get cell key from coordinates
  private getCellKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
  
  // Get cell coordinates from position
  private getCellCoords(position: Vector3): { x: number; y: number; z: number } {
    return {
      x: Math.floor(position.x / this.cellSize),
      y: Math.floor(position.y / this.cellSize),
      z: Math.floor(position.z / this.cellSize)
    };
  }
  
  // Get all cell keys that an entity at position should be in
  private getCellKeysForPosition(position: Vector3): string[] {
    const coords = this.getCellCoords(position);
    return [this.getCellKey(coords.x, coords.y, coords.z)];
  }
  
  // Get all cells within radius of position
  private getCellsInRadius(position: Vector3, radius: number): string[] {
    const cells: string[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCoords = this.getCellCoords(position);
    
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          cells.push(this.getCellKey(
            centerCoords.x + dx,
            centerCoords.y + dy,
            centerCoords.z + dz
          ));
        }
      }
    }
    
    return cells;
  }
  
  // Debug visualization
  getDebugInfo(): { cellCount: number; entityCount: number; cellSize: number } {
    let entityCount = 0;
    for (const cell of this.grid.values()) {
      entityCount += cell.entities.size;
    }
    
    return {
      cellCount: this.grid.size,
      entityCount: this.entityCells.size,
      cellSize: this.cellSize
    };
  }
} 