import { World } from '../core/World'
import type { World as WorldType } from '../types'

// Import only the systems we need for testing
import { CombatSystem } from '../rpg/systems/CombatSystem'
import { InventorySystem } from '../rpg/systems/InventorySystem'
import { NPCSystem } from '../rpg/systems/NPCSystem'
import { LootSystem } from '../rpg/systems/LootSystem'
import { SpawningSystem } from '../rpg/systems/SpawningSystem'
import { SkillsSystem } from '../rpg/systems/SkillsSystem'
import { QuestSystem } from '../rpg/systems/QuestSystem'
import { BankingSystem } from '../rpg/systems/BankingSystem'
import { MovementSystem } from '../rpg/systems/MovementSystem'

export interface TestWorldOptions {
  enablePhysics?: boolean
  configPath?: string
}

/**
 * Creates a minimal test world with RPG systems for testing
 * Avoids server systems that have Three.js dependencies
 */
export async function createTestWorld(options: TestWorldOptions = {}): Promise<WorldType> {
  const world = new World()
  
  // Register only RPG systems (no Three.js dependencies)
  world.register('combat', CombatSystem)
  world.register('inventory', InventorySystem)
  world.register('npc', NPCSystem)
  world.register('loot', LootSystem)
  world.register('spawning', SpawningSystem)
  world.register('skills', SkillsSystem)
  world.register('quest', QuestSystem)
  world.register('banking', BankingSystem)
  world.register('movement', MovementSystem)
  
  // Initialize world with minimal configuration
  await world.init({
    physics: options.enablePhysics ?? false,
    renderer: 'headless',
    networkRate: 60,
    maxDeltaTime: 1/30,
    fixedDeltaTime: 1/60,
    assetsDir: './world/assets',
    assetsUrl: 'http://localhost/assets'
  })
  
  // Start the world
  world.start()
  
  return world as WorldType
}

/**
 * Helper to run world for a specified duration
 */
export async function runWorldFor(world: WorldType, ms: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < ms) {
    world.tick(Date.now())
    await new Promise(resolve => setTimeout(resolve, 16)) // 60fps
  }
}

/**
 * Helper to run world until condition is met
 */
export async function runWorldUntil(
  world: WorldType, 
  condition: () => boolean, 
  timeout = 5000
): Promise<void> {
  const start = Date.now()
  while (!condition() && Date.now() - start < timeout) {
    world.tick(Date.now())
    await new Promise(resolve => setTimeout(resolve, 16))
  }
  if (!condition()) {
    throw new Error('Condition not met within timeout')
  }
} 