import { World } from './World'

// Core server systems
import { Server } from './systems/Server'
import { ServerLiveKit } from './systems/ServerLiveKit'
import { ServerNetwork } from './systems/ServerNetwork'
import { ServerLoader } from './systems/ServerLoader'
import { ServerEnvironment } from './systems/ServerEnvironment'
import { ServerMonitor } from './systems/ServerMonitor'

// RPG systems
import { CombatSystem } from '../rpg/systems/CombatSystem'
import { InventorySystem } from '../rpg/systems/InventorySystem'
import { NPCSystem } from '../rpg/systems/NPCSystem'
import { LootSystem } from '../rpg/systems/LootSystem'
import { SpawningSystem } from '../rpg/systems/SpawningSystem'
import { SkillsSystem } from '../rpg/systems/SkillsSystem'
import { QuestSystem } from '../rpg/systems/QuestSystem'
import { BankingSystem } from '../rpg/systems/BankingSystem'
import { MovementSystem } from '../rpg/systems/MovementSystem'

export function createRPGServerWorld() {
  const world = new World()
  
  // Register core server systems
  world.register('server', Server)
  world.register('livekit', ServerLiveKit)
  world.register('network', ServerNetwork)
  world.register('loader', ServerLoader)
  world.register('environment', ServerEnvironment)
  world.register('monitor', ServerMonitor)
  
  // Register RPG systems
  world.register('combat', CombatSystem)
  world.register('inventory', InventorySystem)
  world.register('npc', NPCSystem)
  world.register('loot', LootSystem)
  world.register('spawning', SpawningSystem)
  world.register('skills', SkillsSystem)
  world.register('quest', QuestSystem)
  world.register('banking', BankingSystem)
  world.register('movement', MovementSystem)
  
  console.log('[RPGServerWorld] Created world with RPG systems')
  
  return world
} 