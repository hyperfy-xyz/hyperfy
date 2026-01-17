import { App } from './App'

/**
 * Mob Entity
 *
 * - Extends App with server-authoritative AI and health systems
 * - Server always controls movement (data.mover = 'server')
 * - Emits aiUpdate events for server-side AI controllers
 * - Includes health system with damage/heal/death mechanics
 *
 */
export class Mob extends App {
  constructor(world, data, local) {
    super(world, data, local)
    this.isMob = true

    // Server authority - mobs are always server-controlled
    if (world.network.isServer && !this.data.mover) {
      this.data.mover = 'server'
    }

    // Initialize health system
    this.data.health = this.data.health ?? 100
    this.data.maxHealth = this.data.maxHealth ?? 100

    // AI state management
    this.aiState = {
      mode: 'idle', // idle, patrol, chase, flee
      target: null,
      waypoints: [],
      waypointIndex: 0,
      lastUpdate: 0,
    }
  }

  fixedUpdate(delta) {
    super.fixedUpdate(delta)

    // AI updates only run on server
    if (this.world.network.isServer) {
      this.emit('aiUpdate', delta)
    }
  }

  modify(data) {
    super.modify(data)

    // Handle health modifications
    if (data.hasOwnProperty('health')) {
      const oldHealth = this.data.health
      this.data.health = Math.max(0, Math.min(data.health, this.data.maxHealth))

      // Emit health changed event
      this.emit('healthChanged', this.data.health, oldHealth)

      // Check for death
      if (this.data.health === 0 && oldHealth > 0) {
        this.emit('death')
      }
    }

    if (data.hasOwnProperty('maxHealth')) {
      this.data.maxHealth = data.maxHealth
      // Clamp current health to new max
      if (this.data.health > this.data.maxHealth) {
        this.data.health = this.data.maxHealth
      }
    }
  }

  takeDamage(amount, source) {
    if (!this.world.network.isServer) {
      console.warn('[Mob.takeDamage] can only be called on server')
      return
    }

    if (this.data.health <= 0) return // already dead

    const oldHealth = this.data.health
    this.data.health = Math.max(0, this.data.health - amount)

    // Broadcast health change
    this.world.network.send('entityModified', {
      id: this.data.id,
      health: this.data.health,
    })

    // Emit local events
    this.emit('damaged', { amount, source, health: this.data.health })
    this.emit('healthChanged', this.data.health, oldHealth)

    // Check for death
    if (this.data.health === 0 && oldHealth > 0) {
      this.emit('death')
    }
  }

  heal(amount) {
    if (!this.world.network.isServer) {
      console.warn('[Mob.heal] can only be called on server')
      return
    }

    if (this.data.health <= 0) return // can't heal the dead
    if (this.data.health >= this.data.maxHealth) return // already full health

    const oldHealth = this.data.health
    this.data.health = Math.min(this.data.maxHealth, this.data.health + amount)

    // Broadcast health change
    this.world.network.send('entityModified', {
      id: this.data.id,
      health: this.data.health,
    })

    // Emit local event
    this.emit('healthChanged', this.data.health, oldHealth)
  }
}
