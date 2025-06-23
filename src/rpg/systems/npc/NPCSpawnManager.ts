import type { World } from '../../../types';
import type { NPCSystem } from '../NPCSystem';
import type { Vector3 } from '../../types';

interface SpawnPoint {
  id: string;
  position: Vector3;
  npcId: number;
  maxCount: number;
  respawnTime: number;
  radius: number;
  active: boolean;
  currentCount: number;
  lastSpawnTime: number;
}

interface RespawnTask {
  spawnerId: string;
  npcId: number;
  respawnTime: number;
  scheduledTime: number;
}

export class NPCSpawnManager {
  private world: World;
  private npcSystem: NPCSystem;
  private spawnPoints: Map<string, SpawnPoint> = new Map();
  private respawnQueue: RespawnTask[] = [];
  
  constructor(world: World, npcSystem: NPCSystem) {
    this.world = world;
    this.npcSystem = npcSystem;
    this.registerDefaultSpawnPoints();
  }
  
  /**
   * Update spawn points and respawn queue
   */
  update(delta: number): void {
    const now = Date.now();
    
    // Process respawn queue
    const tasksToProcess = this.respawnQueue.filter(task => now >= task.scheduledTime);
    for (const task of tasksToProcess) {
      this.processRespawn(task);
    }
    
    // Remove processed tasks
    this.respawnQueue = this.respawnQueue.filter(task => now < task.scheduledTime);
    
    // Check spawn points
    for (const [id, spawnPoint] of this.spawnPoints) {
      if (!spawnPoint.active) continue;
      
      // Check if we need to spawn more NPCs
      if (spawnPoint.currentCount < spawnPoint.maxCount) {
        // Check if enough time has passed
        if (now - spawnPoint.lastSpawnTime >= spawnPoint.respawnTime) {
          this.spawnAtPoint(spawnPoint);
        }
      }
    }
  }
  
  /**
   * Register a spawn point
   */
  registerSpawnPoint(config: {
    id: string;
    position: Vector3;
    npcId: number;
    maxCount?: number;
    respawnTime?: number;
    radius?: number;
  }): void {
    const spawnPoint: SpawnPoint = {
      id: config.id,
      position: config.position,
      npcId: config.npcId,
      maxCount: config.maxCount || 1,
      respawnTime: config.respawnTime || 60000, // 1 minute default
      radius: config.radius || 5,
      active: true,
      currentCount: 0,
      lastSpawnTime: 0
    };
    
    this.spawnPoints.set(config.id, spawnPoint);
    
    // Initial spawn
    for (let i = 0; i < spawnPoint.maxCount; i++) {
      this.spawnAtPoint(spawnPoint);
    }
  }
  
  /**
   * Schedule a respawn
   */
  scheduleRespawn(spawnerId: string, npcId: number, respawnTime: number): void {
    const task: RespawnTask = {
      spawnerId,
      npcId,
      respawnTime,
      scheduledTime: Date.now() + respawnTime
    };
    
    this.respawnQueue.push(task);
    
    // Update spawn point count
    const spawnPoint = this.spawnPoints.get(spawnerId);
    if (spawnPoint) {
      spawnPoint.currentCount = Math.max(0, spawnPoint.currentCount - 1);
    }
  }
  
  /**
   * Activate/deactivate spawn point
   */
  setSpawnPointActive(spawnerId: string, active: boolean): void {
    const spawnPoint = this.spawnPoints.get(spawnerId);
    if (spawnPoint) {
      spawnPoint.active = active;
    }
  }
  
  /**
   * Get all spawn points
   */
  getSpawnPoints(): SpawnPoint[] {
    return Array.from(this.spawnPoints.values());
  }
  
  /**
   * Spawn NPC at spawn point
   */
  private spawnAtPoint(spawnPoint: SpawnPoint): void {
    // Calculate random position within radius
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * spawnPoint.radius;
    
    const position: Vector3 = {
      x: spawnPoint.position.x + Math.cos(angle) * distance,
      y: spawnPoint.position.y,
      z: spawnPoint.position.z + Math.sin(angle) * distance
    };
    
    // Spawn NPC
    const npc = this.npcSystem.spawnNPC(spawnPoint.npcId, position, spawnPoint.id);
    
    if (npc) {
      spawnPoint.currentCount++;
      spawnPoint.lastSpawnTime = Date.now();
      
      // Emit spawn event
      this.world.events.emit('spawn:npc', {
        spawnerId: spawnPoint.id,
        npcId: (npc as any).id || npc.data?.id,
        position
      });
    }
  }
  
  /**
   * Process respawn task
   */
  private processRespawn(task: RespawnTask): void {
    const spawnPoint = this.spawnPoints.get(task.spawnerId);
    if (!spawnPoint || !spawnPoint.active) return;
    
    // Spawn the NPC
    this.spawnAtPoint(spawnPoint);
  }
  
  /**
   * Register default spawn points
   */
  private registerDefaultSpawnPoints(): void {
    // Goblin spawns
    this.registerSpawnPoint({
      id: 'goblin_spawn_1',
      position: { x: 100, y: 0, z: 100 },
      npcId: 1, // Goblin
      maxCount: 3,
      respawnTime: 30000, // 30 seconds
      radius: 10
    });
    
    this.registerSpawnPoint({
      id: 'goblin_spawn_2',
      position: { x: 150, y: 0, z: 120 },
      npcId: 1, // Goblin
      maxCount: 2,
      respawnTime: 30000,
      radius: 8
    });
    
    // Guard posts
    this.registerSpawnPoint({
      id: 'guard_post_1',
      position: { x: 0, y: 0, z: 50 },
      npcId: 2, // Guard
      maxCount: 2,
      respawnTime: 60000, // 1 minute
      radius: 2
    });
    
    this.registerSpawnPoint({
      id: 'guard_post_2',
      position: { x: 0, y: 0, z: -50 },
      npcId: 2, // Guard
      maxCount: 2,
      respawnTime: 60000,
      radius: 2
    });
    
    // Shopkeeper spawn (doesn't respawn)
    this.registerSpawnPoint({
      id: 'shop_spawn',
      position: { x: -20, y: 0, z: 0 },
      npcId: 100, // Bob the shopkeeper
      maxCount: 1,
      respawnTime: 300000, // 5 minutes
      radius: 0
    });
    
    // Quest giver spawn
    this.registerSpawnPoint({
      id: 'quest_giver_spawn',
      position: { x: 10, y: 0, z: 10 },
      npcId: 200, // Elder Grimwald
      maxCount: 1,
      respawnTime: 300000,
      radius: 0
    });
  }
} 