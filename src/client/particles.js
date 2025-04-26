const emitters = {}

import { DEG2RAD } from '../core/extras/general'
import { Vector3, Quaternion, Matrix4, Color } from '../core/extras/three'

const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()
const v4 = new Vector3()
const v5 = new Vector3()
const q1 = new Quaternion()
const q2 = new Quaternion()
const q3 = new Quaternion()
const m1 = new Matrix4()
const color1 = new Color()

const xAxis = new Vector3(1, 0, 0)
const yAxis = new Vector3(0, 1, 0)
const zAxis = new Vector3(0, 0, 1)

self.onmessage = msg => {
  msg = msg.data
  switch (msg.op) {
    case 'create':
      // console.log('create!!')
      const system = createEmitter(msg)
      emitters[msg.id] = system
      break
    case 'emitting':
      emitters[msg.emitterId]?.setEmitting(msg.value)
      break
    // case 'play':
    //   emitters[msg.emitterId]?.play()
    //   break
    // case 'pause':
    //   emitters[msg.emitterId]?.pause()
    //   break
    // case 'stop':
    //   emitters[msg.emitterId]?.stop(msg)
    //   break
    case 'update':
      emitters[msg.emitterId]?.update(msg)
      break
    // case 'emitCustom':
    //   emitters[msg.emitterId]?.emitCustom(msg)
    //   break
    case 'destroy':
      emitters[msg.emitterId]?.destroy()
      emitters[msg.emitterId] = null
      break
  }
}

function createEmitter(config) {
  config.bursts.sort((a, b) => a.time - b.time)

  let elapsed = 0
  let duration = config.duration
  let newParticlesByTime = 0
  let newParticlesByDist = 0
  let emitting = config.emitting
  let bursts = config.bursts.slice()
  let ended = false
  let rateOverDistance = config.rateOverDistance
  let distanceRemainder = 0
  let lastWorldPos = null
  let moveDir = new Vector3()

  const particles = []

  // initialize pool
  for (let i = 0; i < config.max; i++) {
    particles.push({
      age: 0,
      life: 0,
      direction: new Vector3(),
      velocity: new Vector3(),
      distance: 0,
      speed: 10,
      finalPosition: new Vector3(),
      frameTime: 0,
      uv: [0, 0, 1, 1],

      position: new Vector3(),
      rotation: 0,
      startRotation: 0,
      size: 1,
      startSize: 1,
      color: [1, 1, 1],
      startColor: [1, 1, 1],
      alpha: 1,
      startAlpha: 1,
      emissive: 1,
      startEmissive: 1,
    })
  }

  // create starters
  const life = createNumericStarter(config.life)
  const speed = createNumericStarter(config.speed)
  const size = createNumericStarter(config.size)
  const rotation = createNumericStarter(config.rotate)
  const color = createColorStarter(config.color)
  const alpha = createNumericStarter(config.alpha)
  const emissive = createNumericStarter(config.emissive)

  const shape = createShape(config.shape)
  const spritesheet = createSpritesheet(config.spritesheet)
  const force = config.force ? new Vector3().fromArray(config.force) : null
  const velocityLinear = config.velocityLinear ? new Vector3().fromArray(config.velocityLinear) : null
  const velocityOrbital = config.velocityOrbital ? new Vector3().fromArray(config.velocityOrbital) : null
  const velocityRadial = config.velocityRadial || null

  const sizeOverLife = config.sizeOverLife ? createNumberCurve(config.sizeOverLife) : null
  const rotateOverLife = config.rotateOverLife ? createNumberCurve(config.rotateOverLife) : null
  const colorOverLife = config.colorOverLife ? createColorCurve(config.colorOverLife) : null
  const alphaOverLife = config.alphaOverLife ? createNumberCurve(config.alphaOverLife) : null
  const emissiveOverLife = config.emissiveOverLife ? createNumberCurve(config.emissiveOverLife) : null

  function emit({ amount, matrixWorld }) {
    const progress = elapsed / config.duration // ratio through this cycle (0 to 1)
    for (let i = 0; i < amount; i++) {
      const particle = particles.find(p => p.age >= p.life)
      if (!particle) break
      particle.age = 0
      particle.life = life(progress)
      particle.speed = speed(progress)
      particle.size = size(progress)
      particle.startSize = particle.size
      particle.rotation = rotation(progress)
      particle.startRotation = particle.rotation
      particle.color = color(progress)
      particle.alpha = alpha(progress)
      particle.startAlpha = particle.alpha
      particle.emissive = emissive(progress)
      particle.startEmissive = particle.emissive

      particle.frameTime = 0
      particle.uv = spritesheet(particle, 0)

      shape(particle.position, particle.direction)

      // direction randomization
      if (config.direction > 0) {
        const randomFactor = config.direction
        particle.direction.x += (Math.random() * 2 - 1) * randomFactor
        particle.direction.y += (Math.random() * 2 - 1) * randomFactor
        particle.direction.z += (Math.random() * 2 - 1) * randomFactor
        particle.direction.normalize()
      }

      // reset velocity and init based on direction and speed
      particle.velocity.copy(particle.direction).multiplyScalar(particle.speed)

      // particle.direction.set(0, 1, 0)
      particle.distance = Infinity

      // particle.position.set(Math.random(), 0, Math.random())
      if (config.space === 'world') {
        particle.position.applyMatrix4(matrixWorld)
        q1.setFromRotationMatrix(matrixWorld)
        particle.direction.applyQuaternion(q1)
        particle.velocity.applyQuaternion(q1)
      }
    }
  }

  function update({
    delta,
    camPosition,
    matrixWorld,
    aPosition,
    aRotation,
    aDirection,
    aSize,
    aColor,
    aAlpha,
    aEmissive,
    aUV,
  }) {
    delta *= config.timescale
    // console.time('update')
    // console.log('m1', matrixWorld)
    matrixWorld = m1.fromArray(matrixWorld)
    camPosition = v1.fromArray(camPosition)
    elapsed += delta
    // track move direction and distance
    const currWorldPos = v2.setFromMatrixPosition(matrixWorld)
    let distanceMoved
    if (lastWorldPos) {
      distanceMoved = currWorldPos.distanceTo(lastWorldPos)
      if (distanceMoved > 0.0001) {
        moveDir.copy(currWorldPos).sub(lastWorldPos).normalize()
      }
    } else {
      distanceMoved = 0
      lastWorldPos = currWorldPos.clone()
    }

    // const center = v2.setFromMatrixPosition(matrixWorld) // center in same space as particles
    // let distanceMoved = 0
    // if (lastPosition) {
    //   distanceMoved = center.distanceTo(lastPosition)
    // } else {
    //   lastPosition = center.clone()
    // }

    // emit over time
    if (emitting) {
      newParticlesByTime += config.rate * delta
      const amount = Math.floor(newParticlesByTime)
      if (amount > 0) emit({ amount, matrixWorld })
      newParticlesByTime -= amount
    }
    // emit over distance
    // if (emitting && rateOverDistance && distanceMoved > 0) {
    //   newParticlesByDist += rateOverDistance * distanceMoved
    //   const amount = Math.floor(newParticlesByDist)
    //   if (amount > 0) emit({ amount, matrixWorld })
    //   newParticlesByDist -= amount
    // }
    // emit over distance
    if (emitting && rateOverDistance && distanceMoved > 0) {
      // Calculate the distance interval between particles
      const distanceBetweenParticles = 1.0 / rateOverDistance

      // Add current movement to remainder from previous frames
      distanceRemainder += distanceMoved

      // Calculate how many complete particles we should emit based on distance
      const particlesToEmit = Math.floor(distanceRemainder / distanceBetweenParticles)

      if (particlesToEmit > 0) {
        // Create particles along the movement path
        for (let i = 0; i < particlesToEmit; i++) {
          // Calculate position along the movement path
          // The +1 ensures we start from the previous position, not the current one
          const lerpFactor = (i + 1) / (particlesToEmit + 1)

          // Create a position vector along the path
          const emitPosition = new Vector3().copy(lastWorldPos).lerp(currWorldPos, lerpFactor)

          // Create a temporary matrix with this position
          const tempMatrix = new Matrix4().copy(matrixWorld)
          tempMatrix.setPosition(emitPosition)

          // Emit a single particle at this position
          emit({
            amount: 1,
            matrixWorld: tempMatrix,
            // isDistanceEmission: true,
            // movementDirection,
          })
        }

        // Update remainder for next frame (keep fractional part)
        distanceRemainder -= particlesToEmit * distanceBetweenParticles
      }
    }
    // track new pos
    lastWorldPos.copy(currWorldPos)
    // emit bursts
    while (bursts.length && bursts[0].time <= elapsed) {
      const burst = bursts.shift()
      emit({ amount: burst.count, matrixWorld })
    }
    // update particles
    for (const particle of particles) {
      particle.age += delta
      // skip if dead
      if (particle.age >= particle.life) continue
      // get life progress (0 to 1)
      const progress = particle.age / particle.life
      // apply force (acceleration) to velocity
      if (force) {
        // F = ma, so a = F/m, but since we don't track mass, just use F as acceleration
        v3.copy(force).multiplyScalar(delta)
        particle.velocity.add(v3)
      }
      // linear velocity
      if (velocityLinear) {
        v3.copy(velocityLinear).multiplyScalar(delta)
        if (config.space === 'world') {
          // Linear velocity is in world space, apply directly
          particle.position.add(v3)
        } else {
          // Linear velocity is in local space, apply with emitter rotation
          v3.applyQuaternion(q1.setFromRotationMatrix(matrixWorld))
          particle.position.add(v3)
        }
      }
      // orbital velocity
      if (velocityOrbital) {
        // Calculate vector from emitter center to particle
        v3.copy(particle.position).sub(currWorldPos)
        // For each axis (X, Y, Z), rotate around that axis
        if (velocityOrbital.x !== 0) {
          // Rotate around X axis
          q2.setFromAxisAngle(xAxis, velocityOrbital.x * delta)
          v3.applyQuaternion(q2)
        }
        if (velocityOrbital.y !== 0) {
          // Rotate around Y axis
          q2.setFromAxisAngle(yAxis, velocityOrbital.y * delta)
          v3.applyQuaternion(q2)
        }
        if (velocityOrbital.z !== 0) {
          // Rotate around Z axis
          q2.setFromAxisAngle(zAxis, velocityOrbital.z * delta)
          v3.applyQuaternion(q2)
        }
        // Set particle position to emitter center + rotated offset
        particle.position.copy(currWorldPos).add(v3)
        // Update velocity to match orbital motion
        // This ensures it continues to move in the tangent direction
        if (v3.length() > 0.001) {
          const orbitSpeed =
            v3.length() *
            Math.max(Math.abs(velocityOrbital.x), Math.abs(velocityOrbital.y), Math.abs(velocityOrbital.z))
          // Calculate tangential direction
          v4.crossVectors(
            velocityOrbital.x > 0
              ? new Vector3(1, 0, 0)
              : velocityOrbital.y > 0
                ? new Vector3(0, 1, 0)
                : new Vector3(0, 0, 1),
            v3
          ).normalize()
          // Adjust velocity in the tangential direction
          v4.multiplyScalar(orbitSpeed)
          particle.velocity.copy(v4)
        }
      }
      // radial velocity (away from emitter center)
      if (velocityRadial) {
        // Get direction from emitter center to particle
        v3.copy(particle.position).sub(currWorldPos)
        if (v3.length() > 0.001) {
          // Normalize to get direction
          v3.normalize()
          // Scale by radial velocity and delta time
          v3.multiplyScalar(velocityRadial * delta)
          // Move particle along this radial direction
          particle.position.add(v3)
          // Also add to velocity for consistency
          particle.velocity.add(v3.divideScalar(delta))
        }
      }
      // move particles based on current velocity
      v3.copy(particle.velocity).multiplyScalar(delta)
      particle.position.add(v3)
      // size over life
      if (sizeOverLife) {
        const multiplier = sizeOverLife(progress)
        particle.size = particle.startSize * multiplier
      }
      // rotate over life
      if (rotateOverLife) {
        const rotation = rotateOverLife(progress)
        particle.rotation = particle.startRotation + rotation
      }
      // color over life
      if (colorOverLife) {
        particle.color = colorOverLife(progress)
      }
      // alpha over life
      if (alphaOverLife) {
        const multiplier = alphaOverLife(progress)
        particle.alpha = particle.startAlpha * multiplier
      }
      // emissive over life
      if (emissiveOverLife) {
        const multiplier = emissiveOverLife(progress)
        particle.emissive = particle.startEmissive * multiplier
      }
      // final position
      particle.finalPosition.copy(particle.position)
      if (config.space === 'local') {
        particle.finalPosition.applyMatrix4(matrixWorld)
      }
      // particle.distance = particle.worldPosition.distanceToSquared(camPosition)
      particle.distance = particle.position.distanceToSquared(camPosition)

      // spritesheet
      if (config.spritesheet) {
        particle.uv = spritesheet(particle, delta)
      }
    }
    // looping or pausing
    if (elapsed >= duration) {
      elapsed = 0
      bursts = config.bursts.slice()
      if (!config.loop) emitting = false
    }
    // on end callback
    if (!config.loop && !emitting && !ended) {
      const activeParticles = particles.filter(p => p.age < p.life).length
      // if no active particles, trigger onEnd
      if (activeParticles === 0) {
        ended = true
        self.postMessage({
          emitterId: config.id,
          op: 'end',
        })
      }
    }
    // sort if needed
    if (config.blending === 'normal') {
      particles.sort((a, b) => b.distance - a.distance)
    }
    // insert into buffers
    let n = 0
    for (const particle of particles) {
      if (particle.age >= particle.life) continue
      aPosition[n * 3 + 0] = particle.finalPosition.x
      aPosition[n * 3 + 1] = particle.finalPosition.y
      aPosition[n * 3 + 2] = particle.finalPosition.z
      aRotation[n * 1 + 0] = particle.rotation

      aDirection[n * 3 + 0] = particle.direction.x
      aDirection[n * 3 + 1] = particle.direction.y
      aDirection[n * 3 + 2] = particle.direction.z

      // // For direction billboarding, use normalized velocity if it has magnitude
      // // otherwise fall back to the initial direction
      // let dx, dy, dz
      // if (particle.velocity.lengthSq() > 0.0001) {
      //   // Use normalized velocity as direction
      //   const velLength = Math.sqrt(
      //     particle.velocity.x * particle.velocity.x +
      //       particle.velocity.y * particle.velocity.y +
      //       particle.velocity.z * particle.velocity.z
      //   )
      //   dx = particle.velocity.x / velLength
      //   dy = particle.velocity.y / velLength
      //   dz = particle.velocity.z / velLength
      // } else {
      //   // Fallback to the initial particle direction
      //   dx = particle.direction.x
      //   dy = particle.direction.y
      //   dz = particle.direction.z
      // }
      // aDirection[n * 3 + 0] = dx
      // aDirection[n * 3 + 1] = dy
      // aDirection[n * 3 + 2] = dz

      aSize[n * 1 + 0] = particle.size
      aColor[n * 3 + 0] = particle.color[0]
      aColor[n * 3 + 1] = particle.color[1]
      aColor[n * 3 + 2] = particle.color[2]
      aAlpha[n * 1 + 0] = particle.alpha
      aEmissive[n * 1 + 0] = particle.emissive
      aUV[n * 4 + 0] = particle.uv[0] // u0
      aUV[n * 4 + 1] = particle.uv[1] // v0
      aUV[n * 4 + 2] = particle.uv[2] // u1
      aUV[n * 4 + 3] = particle.uv[3] // v1
      n++
    }
    // send
    self.postMessage(
      {
        emitterId: config.id,
        op: 'update',
        n,
        aPosition,
        aRotation,
        aDirection,
        aSize,
        aColor,
        aAlpha,
        aEmissive,
        aUV,
      },
      [
        // prettier-ignore
        aPosition.buffer,
        aRotation.buffer,
        aDirection.buffer,
        aSize.buffer,
        aColor.buffer,
        aAlpha.buffer,
        aEmissive.buffer,
        aUV.buffer,
      ]
    )
    // console.timeEnd('update')
  }

  function destroy() {
    particles.length = 0
  }

  return {
    setEmitting(value) {
      emitting = value
    },
    update,
    destroy,
  }
}

function createNumericStarter(str) {
  if (str.includes('-')) {
    const [start, end] = str.split('-').map(n => parseFloat(n))
    return createNumericStarterLinear(start, end)
  }
  if (str.includes('~')) {
    const [from, to] = str.split('~').map(n => parseFloat(n))
    return createNumericStarterRandom(from, to)
  }
  const n = parseFloat(str)
  return createNumericStarterFixed(n)
}

function createNumericStarterLinear(start, end) {
  const fn = progress => {
    return start + (end - start) * progress
  }
  fn.kind = 'linear'
  return fn
}

function createNumericStarterRandom(from, to) {
  const fn = () => {
    return from + Math.random() * (to - from)
  }
  fn.kind = 'random'
  return fn
}

function createNumericStarterFixed(n) {
  const fn = () => {
    return n
  }
  fn.kind = 'fixed'
  return fn
}

function createColorStarter(str) {
  if (str.includes('-')) {
    const [start, end] = str.split('-').map(toRGB)
    return createColorStarterLinear(start, end)
  }
  if (str.includes('~')) {
    const [from, to] = str.split('~').map(toRGB)
    return createColorStarterRandom(from, to)
  }
  const rgb = toRGB(str)
  return createColorStarterFixed(rgb)
}

function createColorStarterLinear(start, end) {
  const fn = progress => {
    return [
      start[0] + (end[0] - start[0]) * progress,
      start[1] + (end[1] - start[1]) * progress,
      start[2] + (end[2] - start[2]) * progress,
    ]
  }
  fn.kind = 'linear'
  return fn
}

function createColorStarterRandom(from, to) {
  const fn = () => {
    const t = Math.random()
    return [from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1]), from[2] + t * (to[2] - from[2])]
  }
  fn.kind = 'random'
  return fn
}

function createColorStarterFixed(rgb) {
  const fn = () => {
    return rgb
  }
  fn.kind = 'fixed'
  return fn
}

// Helper function to convert a color string to RGB array [r, g, b] (values 0-1)
function toRGB(color) {
  try {
    color1.set(color)
    return [color1.r, color1.g, color1.b]
  } catch (error) {
    // If parsing fails, default to white and warn
    console.warn(`[particles] color '${color}' could not be parsed, using white instead.`)
    return [1, 1, 1]
  }
}

function createShape(config) {
  const [type, ...args] = config
  const v = new Vector3()
  const normal = new Vector3()

  switch (type) {
    case 'point':
      // Point shape - always at origin with upward direction
      return (pos, dir) => {
        pos.set(0, 0, 0)
        dir.set(0, 1, 0)
      }

    case 'sphere':
      // Sphere shape - position on or within sphere, direction points outward
      return (pos, dir) => {
        const [radius, thickness] = args
        // Random point on unit sphere
        const u = Math.random()
        const v = Math.random()
        const theta = 2 * Math.PI * u
        const phi = Math.acos(2 * v - 1)

        dir.set(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi))

        // Apply thickness (0 = surface only, 1 = anywhere inside)
        const radiusScale = thickness === 0 ? 1 : Math.pow(Math.random(), 1 / 3) * thickness + (1 - thickness)

        // Set position
        pos.copy(dir).multiplyScalar(radius * radiusScale)
      }

    case 'hemisphere':
      // Hemisphere shape - position on or within hemisphere, flat base on XZ plane
      return (pos, dir) => {
        const [radius, thickness] = args
        // Random point on unit hemisphere (positive Y)
        const u = Math.random()
        const cosTheta = Math.random() // Range [0,1] for upper hemisphere only
        const theta = 2 * Math.PI * u
        const phi = Math.acos(cosTheta) // Range [0,π/2]

        normal.set(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi), // This is always positive (y >= 0)
          Math.sin(phi) * Math.sin(theta)
        )

        // Apply thickness (0 = surface only, 1 = anywhere inside)
        const radiusScale = thickness === 0 ? 1 : Math.pow(Math.random(), 1 / 3) * thickness + (1 - thickness)

        // Set position
        pos.copy(normal).multiplyScalar(radius * radiusScale)
        dir.copy(normal)
      }

    case 'cone':
      // Cone shape - position on base circle, direction based on cone angle
      return (pos, dir) => {
        let [baseRadius, thickness, angleFromCenter] = args
        angleFromCenter *= DEG2RAD

        // Random angle around the circle
        const angle = Math.random() * Math.PI * 2

        // Apply thickness (0 = edges only, 1 = anywhere in circle)
        let radiusScale
        if (thickness === 0) {
          radiusScale = 1 // Edge only
        } else {
          // Square root for uniform distribution on disk
          radiusScale = Math.sqrt(Math.random()) * thickness + (1 - thickness)
        }

        const x = Math.cos(angle) * baseRadius * radiusScale
        const z = Math.sin(angle) * baseRadius * radiusScale

        // Position at base of cone
        pos.set(x, 0, z)

        // Direction follows cone angle
        dir
          .set(
            Math.sin(angleFromCenter) * Math.cos(angle),
            Math.cos(angleFromCenter),
            Math.sin(angleFromCenter) * Math.sin(angle)
          )
          .normalize()
      }

    case 'box':
      // Box shape - position on or within box, direction points outward
      return (pos, dir) => {
        const [width, height, depth, thickness, origin, spherize] = args

        // Handle different origin types: volume, edge, or shell
        if (origin === 'volume') {
          // Full volume sampling with thickness consideration
          if (thickness === 0 || Math.random() > thickness) {
            // Surface point
            const face = Math.floor(Math.random() * 6)
            switch (face) {
              case 0: // +X face
                pos.set(width / 2, (Math.random() - 0.5) * height, (Math.random() - 0.5) * depth)
                if (!spherize) dir.set(1, 0, 0)
                break
              case 1: // -X face
                pos.set(-width / 2, (Math.random() - 0.5) * height, (Math.random() - 0.5) * depth)
                if (!spherize) dir.set(-1, 0, 0)
                break
              case 2: // +Y face
                pos.set((Math.random() - 0.5) * width, height / 2, (Math.random() - 0.5) * depth)
                if (!spherize) dir.set(0, 1, 0)
                break
              case 3: // -Y face
                pos.set((Math.random() - 0.5) * width, -height / 2, (Math.random() - 0.5) * depth)
                if (!spherize) dir.set(0, -1, 0)
                break
              case 4: // +Z face
                pos.set((Math.random() - 0.5) * width, (Math.random() - 0.5) * height, depth / 2)
                if (!spherize) dir.set(0, 0, 1)
                break
              case 5: // -Z face
                pos.set((Math.random() - 0.5) * width, (Math.random() - 0.5) * height, -depth / 2)
                if (!spherize) dir.set(0, 0, -1)
                break
            }

            // Apply spherize if enabled
            if (spherize) {
              dir.copy(pos).normalize()
              if (dir.length() === 0) {
                // Handle the case when pos is at exact center
                dir.set(0, 1, 0)
              }
            }
          } else {
            // Interior point with proper thickness consideration
            // First pick a random position within the box
            const randomX = (Math.random() - 0.5) * width
            const randomY = (Math.random() - 0.5) * height
            const randomZ = (Math.random() - 0.5) * depth

            // Calculate distances from each face as a proportion of max possible distance
            const distToRight = (width / 2 - Math.abs(randomX)) / (width / 2)
            const distToTop = (height / 2 - Math.abs(randomY)) / (height / 2)
            const distToFront = (depth / 2 - Math.abs(randomZ)) / (depth / 2)

            // Find minimum distance to any face (0 = on surface, 1 = at center)
            const minDist = Math.min(distToRight, distToTop, distToFront)

            // Only use this point if it's within our thickness threshold
            // For thickness t, we want points where minDist <= t
            if (minDist <= thickness) {
              pos.set(randomX, randomY, randomZ)

              // Direction depends on spherize parameter
              if (spherize) {
                // Direction points outward from center
                dir.copy(pos).normalize()
                if (dir.length() === 0) {
                  // Handle the case when pos is at exact center
                  dir.set(0, 1, 0)
                }
              } else {
                // Direction points outward from nearest face
                if (distToRight === minDist) dir.set(Math.sign(randomX), 0, 0)
                else if (distToTop === minDist) dir.set(0, Math.sign(randomY), 0)
                else if (distToFront === minDist) dir.set(0, 0, Math.sign(randomZ))
              }
            } else {
              // If point is too far from surface, recursively try again
              // Using a safer approach to avoid infinite recursion
              return createShape(['box', width, height, depth, thickness, origin, spherize])(pos, dir)
            }
          }
        } else if (origin === 'edge') {
          // Only generate particles along the 12 edges of the box
          const edge = Math.floor(Math.random() * 12)
          let x, y, z

          // Select one of the 12 edges
          switch (edge) {
            // Bottom edges
            case 0: // Bottom X-aligned edge (front)
              x = (Math.random() - 0.5) * width
              y = -height / 2
              z = depth / 2
              break
            case 1: // Bottom X-aligned edge (back)
              x = (Math.random() - 0.5) * width
              y = -height / 2
              z = -depth / 2
              break
            case 2: // Bottom Z-aligned edge (left)
              x = -width / 2
              y = -height / 2
              z = (Math.random() - 0.5) * depth
              break
            case 3: // Bottom Z-aligned edge (right)
              x = width / 2
              y = -height / 2
              z = (Math.random() - 0.5) * depth
              break

            // Top edges
            case 4: // Top X-aligned edge (front)
              x = (Math.random() - 0.5) * width
              y = height / 2
              z = depth / 2
              break
            case 5: // Top X-aligned edge (back)
              x = (Math.random() - 0.5) * width
              y = height / 2
              z = -depth / 2
              break
            case 6: // Top Z-aligned edge (left)
              x = -width / 2
              y = height / 2
              z = (Math.random() - 0.5) * depth
              break
            case 7: // Top Z-aligned edge (right)
              x = width / 2
              y = height / 2
              z = (Math.random() - 0.5) * depth
              break

            // Vertical edges
            case 8: // Vertical Y-aligned edge (front left)
              x = -width / 2
              y = (Math.random() - 0.5) * height
              z = depth / 2
              break
            case 9: // Vertical Y-aligned edge (front right)
              x = width / 2
              y = (Math.random() - 0.5) * height
              z = depth / 2
              break
            case 10: // Vertical Y-aligned edge (back left)
              x = -width / 2
              y = (Math.random() - 0.5) * height
              z = -depth / 2
              break
            case 11: // Vertical Y-aligned edge (back right)
              x = width / 2
              y = (Math.random() - 0.5) * height
              z = -depth / 2
              break
          }

          pos.set(x, y, z)

          if (spherize) {
            // Direction points outward from center
            dir.copy(pos).normalize()
            if (dir.length() === 0) {
              // Handle the case when pos is at exact center
              dir.set(0, 1, 0)
            }
          } else {
            // Direction points outward perpendicular to the edge
            // For simplicity, we'll use the two coordinates that are at their extremes
            if (Math.abs(x) === width / 2 && Math.abs(z) === depth / 2) {
              // Corner edge - use diagonal direction
              dir.set(Math.sign(x), 0, Math.sign(z)).normalize()
            } else if (Math.abs(x) === width / 2) {
              // Edge along X face
              dir.set(Math.sign(x), 0, 0)
            } else if (Math.abs(y) === height / 2) {
              // Edge along Y face
              dir.set(0, Math.sign(y), 0)
            } else if (Math.abs(z) === depth / 2) {
              // Edge along Z face
              dir.set(0, 0, Math.sign(z))
            }
          }
        }
      }

    case 'circle':
      // Circle shape - position on or within circle in XZ plane
      return (pos, dir) => {
        const [radius, thickness, spherize] = args

        // Random angle around the circle
        const angle = Math.random() * Math.PI * 2

        // Apply thickness (0 = edges only, 1 = anywhere in circle)
        let radiusScale
        if (thickness === 0) {
          radiusScale = 1 // Edge only
        } else {
          // Square root for uniform distribution on disk
          radiusScale = Math.sqrt(Math.random()) * thickness + (1 - thickness)
        }

        const x = Math.cos(angle) * radius * radiusScale
        const z = Math.sin(angle) * radius * radiusScale

        pos.set(x, 0, z)

        // Set direction based on spherize parameter
        if (spherize) {
          // Direction points outward from center
          dir.set(x, 0, z).normalize()
          if (dir.length() === 0) {
            // Handle the case when position is at exact center
            dir.set(0, 1, 0)
          }
        } else {
          // Default upward direction
          dir.set(0, 1, 0)
        }
      }

    case 'rectangle':
      // Rectangle shape - position on rectangular plane in XZ plane
      return (pos, dir) => {
        const [width, depth, thickness, spherize = false] = args

        // Determine if on edge or inside based on thickness
        const useEdge = thickness === 0 || Math.random() > thickness

        let x, z

        if (useEdge) {
          // Position on edge
          const edge = Math.floor(Math.random() * 4)
          switch (edge) {
            case 0: // +X edge
              x = width / 2
              z = (Math.random() - 0.5) * depth
              break
            case 1: // -X edge
              x = -width / 2
              z = (Math.random() - 0.5) * depth
              break
            case 2: // +Z edge
              x = (Math.random() - 0.5) * width
              z = depth / 2
              break
            case 3: // -Z edge
              x = (Math.random() - 0.5) * width
              z = -depth / 2
              break
          }
        } else {
          // Position inside rectangle
          x = (Math.random() - 0.5) * width
          z = (Math.random() - 0.5) * depth
        }

        pos.set(x, 0, z)

        // Set direction based on spherize parameter
        if (spherize) {
          // Direction from center (adjusted for 2D rectangle)
          dir.set(x, 0, z).normalize()
          if (dir.length() === 0) {
            // Handle center case
            dir.set(0, 1, 0)
          }
        } else {
          // Default upward direction
          dir.set(0, 1, 0)
        }
      }

    default:
      console.warn(`[particles] unknown shape: ${type}, using 'point' as fallback`)
      return createShape('point', dimensions, thickness)
  }
}

function createSpritesheet(options) {
  // no spritesheet, return full UVs
  if (!options) {
    return () => [0, 0, 1, 1]
  }
  const [rows, cols, frameRate, loop] = options
  const totalFrames = rows * cols
  // pre-calculate all uv frames
  const uvFrames = []
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    // calc grid position (reading order: left-to-right, top-to-bottom)
    const col = frameIndex % cols
    const row = Math.floor(frameIndex / cols)
    // calc UV coords with inverted row calculation for top-to-bottom order
    // V coords in textures start at bottom (0) and go to top (1)
    const u0 = col / cols
    const v0 = (rows - row - 1) / rows // inverted to start from top
    const u1 = (col + 1) / cols
    const v1 = (rows - row) / rows // inverted to start from top
    uvFrames.push([u0, v0, u1, v1])
  }
  return (particle, delta) => {
    particle.frameTime += delta
    const frameDuration = 1 / frameRate
    const rawFrame = particle.frameTime / frameDuration
    let idx
    if (loop) {
      idx = Math.floor(rawFrame) % totalFrames
    } else {
      idx = Math.min(Math.floor(rawFrame), totalFrames - 1)
    }
    return uvFrames[idx]
  }
}

function createNumberCurve(str) {
  // Parse the string format: `alpha1,value1|alpha2,value2|...`
  // Each point is defined by an alpha (0-1) and a corresponding value
  //
  // Split the string by '|' to get individual points
  const pointsStr = str.split('|')
  // Parse each point into [alpha, value] pairs
  const points = pointsStr.map(point => {
    const [alpha, value] = point.split(',').map(parseFloat)
    return { alpha, value }
  })
  // Sort points by alpha (just in case they're not in order)
  points.sort((a, b) => a.alpha - b.alpha)
  // Return a function that takes an alpha value and returns interpolated value
  return function (alpha) {
    // Handle edge cases
    if (alpha <= points[0].alpha) return points[0].value
    if (alpha >= points[points.length - 1].alpha) return points[points.length - 1].value
    // Find the two points to interpolate between
    let i = 0
    while (i < points.length - 1 && alpha > points[i + 1].alpha) {
      i++
    }
    const p1 = points[i]
    const p2 = points[i + 1]
    // Calculate interpolation factor (t) between the two points
    const t = (alpha - p1.alpha) / (p2.alpha - p1.alpha)
    // Linear interpolation between the two values
    return p1.value + t * (p2.value - p1.value)
  }
}

function createColorCurve(str) {
  // Parse the string format: `alpha1,color1|alpha2,color2|...`
  const pointsStr = str.split('|')
  const points = []
  // Parse each point into {alpha,color} pairs
  for (const point of pointsStr) {
    const parts = point.split(',')
    const alpha = parseFloat(parts[0])
    const color = toRGB(parts[1])
    points.push({
      alpha,
      color,
    })
  }
  // Sort points by position (just in case they're not in order)
  points.sort((a, b) => a.alpha - b.alpha)
  // Return interpolation function as before
  return function (alpha) {
    if (points.length === 0) return [1, 1, 1] // Default to white
    if (alpha <= points[0].alpha) return [...points[0].color]
    if (alpha >= points[points.length - 1].alpha) return [...points[points.length - 1].color]
    let i = 0
    while (i < points.length - 1 && alpha > points[i + 1].alpha) {
      i++
    }
    const p1 = points[i]
    const p2 = points[i + 1]
    const t = (alpha - p1.alpha) / (p2.alpha - p1.alpha)
    return [
      p1.color[0] + t * (p2.color[0] - p1.color[0]),
      p1.color[1] + t * (p2.color[1] - p1.color[1]),
      p1.color[2] + t * (p2.color[2] - p1.color[2]),
    ]
  }
}
