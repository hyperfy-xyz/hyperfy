import { System } from './System'
import { createMobProxy } from '../extras/createMobProxy'

/**
 * Mobs System
 *
 * - Runs on both the server and client
 * - Manages mob-specific runtime hooks and API methods
 * - Integrates with Apps system to extend mob functionality
 * - Provides Degen-branded AI methods
 *
 */
export class Mobs extends System {
  constructor(world) {
    super(world)
    this.mobs = []
    this.ready = false
  }

  init(options) {
    try {
      // Deserialize mobs data
      if (!options.mobs) {
        console.log('[mobs] No mobs data in options, skipping')
        this.ready = true
        return
      }

      this.deserialize(options.mobs)

      // Validate Apps system is ready
      if (!this.world.apps) {
        throw new Error('Apps system not initialized')
      }

      // Get mob proxy methods
      const { mobGetters, mobMethods, degenMethods } = createMobProxy()

      // Inject into Apps system with error handling
      try {
        this.world.apps.inject({
          app: {
            // Health system getters
            health: mobGetters.health,
            maxHealth: mobGetters.maxHealth,
            aiState: mobGetters.aiState,

            // Health system methods
            takeDamage: mobMethods.takeDamage,
            heal: mobMethods.heal,

            // Degen-branded AI methods (namespaced)
            degen: {
              get(entity) {
                // Create degen proxy that binds all methods to the entity
                if (!entity._degenProxy) {
                  entity._degenProxy = new Proxy(
                    {},
                    {
                      get: (target, prop) => {
                        if (prop in degenMethods) {
                          return (...args) => degenMethods[prop](entity, ...args)
                        }
                        return undefined
                      },
                    }
                  )
                }
                return entity._degenProxy
              },
            },
          },
        })
      } catch (error) {
        throw new Error(`Failed to inject mob methods: ${error.message}`)
      }

      this.ready = true
      console.log('[mobs] ✓ System ready')

    } catch (error) {
      console.error('[mobs] Initialization failed:', error)
      throw error
    }
  }

  getMobBlueprints() {
    if (!this.ready) {
      console.warn('[mobs] getMobBlueprints called before ready')
      return []
    }

    const blueprints = []
    for (const mobCollection of this.mobs) {
      blueprints.push(...mobCollection.blueprints)
    }
    return blueprints
  }

  deserialize(data) {
    if (!Array.isArray(data)) {
      throw new Error('Mobs data must be an array')
    }

    this.mobs = data

    const blueprintCount = this.getMobBlueprintsUnsafe().length
    if (blueprintCount === 0) {
      throw new Error('No mob blueprints in deserialized data')
    }

    console.log(`[mobs] deserialized ${blueprintCount} blueprint(s)`)
  }

  getMobBlueprintsUnsafe() {
    const blueprints = []
    for (const mobCollection of this.mobs) {
      blueprints.push(...mobCollection.blueprints)
    }
    return blueprints
  }

  serialize() {
    return this.mobs
  }

  destroy() {
    this.mobs = []
    this.ready = false
  }
}
