# Particles

Creates a particle emitter that can be used for VFX such as rain, fire, magic, etc.

```jsx
const particles = app.create('particles', {
  shape: ['cone', 1, 25, 1],
})
app.add(particles)
```

## Properties

### `.emitting`: Boolean

Whether the emitter should be emitting particles. Defaults to `true`.

### `.shape`: Array

The shape that particles are emitted from

**Point**: Emits from a single point (`['point']`)

**Sphere**: Emits from the surface/volume of a sphere (`['sphere', radius, thickness]`)

**Hemishphere**: Emits from the surface/volume of a half sphere (`['hemisphere', radius, thickness]`)

**Cone**: Emits from cone radius at an angle (`['cone', radius, thickness, angle]`)

**Box**: Emits from box volume/edge (`['box', width, height, depth, thickness, origin('volume|edge'), spherize]`)

**Circle**: Emits from a flat circle (`['circle', radius, thickness, spherize]`)

**Rectangle**: Emits from a flat rectangle (`['rectangle', width, depth, thickness, spherize]`)


NOTE: `thickness` is a ratio from surface to full volume, where `0` will emit from the surface of the shape and `1` will emit anywhere in the whole volume of the shape

NOTE: `spherize` determines whether the direction of the particles is based on the face (false) or the center origin (true)

Defaults to `['cone', 1, 1, 25]`.

### `.direction`: Number

Adds randomization to the initial direction of the particle emitted from a shape. Can be any number between 0 and 1. A value of `0` will add no randomization and a value of `1` means particles can potentially go in any direction.

This is useful to add minor variation to particle directions with smaller values like `0.2`.

Defaults to `0`.

### `.rate`: Number

The number of particles to emit per second.

Defaults to `10`

### `.bursts`: Array

An optional list of particle bursts to run at specific times. Useful for explosions etc.

The following example will immediately emit 10 particles and then half a second later emit 30 more.

```jsx
particles.bursts = [
  { time: 0, count: 10 },
  { time: 0.5, count: 30 },
]
```

### `.duration`: Number

How long particles emit for in a single cycle. Defaults to `5`.

### `.loop`: Boolean

Whether cycles (controlled by `duration`) loop. When set to `false` particles will stop emitting at the end of `duration` and also call `onEnd` if set. 

Defaults to `true`.

### `.max`: Number

The absolute maximum number of particles that can exist at one time. If the emitter runs out of particles it will stop emitting until more become available. Defaults to `1000`.

### `.timescale`: Number

A simple override to speed up or slow down the entire simulation. Defaults to `1`.

### `.life`: String

How long a particle will live before it is released. This property is a string because it supports the following syntax:

**Fixed**: Particles all have the same life, eg `1` for 1s
**Linear**: Particles have a from and to range that is based on the progress of the cycle defined by `duration` eg `1-5` means the first particles will have a life of 1s and towards the end of the cycle particles will have a life of 5s
**Random**: Particles have a min and max range and a value is randomly chosen for each particle, eg `1~5`

Defaults to `5`.


### `.speed`: String

The starting speed of a particle. This property is a string because it supports the same syntax as `life` (see above).

Defaults to `1`.

### `.size`: String

The starting size of a particle. This property is a string because it supports the same syntax as `life` (see above).

Defaults to `1`.

### `.rotate`: String

The starting rotation of a particle in degrees. This property is a string because it supports the same syntax as `life` (see above).

Defaults to `0`.

### `.color`: String

The starting color of a particle. This property is a string because it supports the same syntax as `life` (see above).

Defaults to `white`.

### `.alpha`: String

The starting alpha (opacity) of a particle. This property is a string because it supports the same syntax as `life` (see above).

Defaults to `1`.

### `.emissive`: String

The starting emissive (glow) of a particle. This property is a string because it supports the same syntax as `life` (see above).

Defaults to `1`.

### `.image`: String

The URL to the image used as the particle texture.

```jsx
app.configure([
  {
    key: 'image',
    type: 'file',
    kind: 'texture',
    label: 'Image',
  }
])

// ...

particles.image = props.image?.url
```

### `.spritesheet`: Array|null

Optional, allows you to split the image into sprites that animate like a flipbook.

```jsx
particles.spritesheet = [
  2, // rows
  4, // columns
  16, // fps
  true, // loop (if disabled will stop on last frame)
]
```

### `.blending`: String

Whether the particles uses `normal` or `additive` blending. Additive blending is more performant as it can skip sorting particles by distance each frame.

Defaults to `normal`.

### `.lit`: Boolean

Determines whether the particle is affected by PBR lighting. Defaults to `false`.

### `.billboard`: String

Either `full`, `y` or `direction`. Defaults to `full`.

### `.space`: String

Whether particles are in `local` or `world` space. Local particles will move with the emitter where-as World particles will not. Defaults to `world`.

### `.force`: Vector3|null

Optional, allows you to apply a constant force to particles such as gravity, wind, levitation etc.

```jsx
particles.force = new Vector3(0, -9.81, 0) // gravity
```

### `.velocityLinear`: Vector3|null

Linear velocity constantly applied to particles on specific axis. Optional.

### `.velocityOrbital`: Vector3|null

Orbital velocity constantly applied to particles on specific axis. This can be useful to make particles "spin" and is usually paired with `velocityLinear` and `velocityRadial` for more control. Optional.

### `.velocityRadial`: Number|null

Radial velocity helps push particles away from the center. Optional.

### `.rateOverDistance`: Number

Emits particles based on the distance moved since the last frame. This is useful for things like contrails or dust left behind by moving objects.

### `.sizeOverLife`: String

Optional, allows particles to change size over their lifetime. This property is a string as it supports the following syntax:

```jsx
// 1) particle starts life (0) at size 1x size
// 2) at half age (0.5) the particle should be 2x size
// 3) at the end of its life (1) it should be back to 1x size
particles.sizeOverLife = '0,1|0.5,2|1,1'
```

A smooth transition is automatically created between all points.


### `.rotateOverLife`: String

Optional, allows particles to rotate over their lifetime. This property uses the same lifetime syntax as seen in `.sizeOverLife` (see above). Rotation values are in degrees.

### `.colorOverLife`: String

Optional, allows particles to change color over their lifetime. This property uses the same lifetime syntax as seen in `.sizeOverLife` (see above). Colors can be named eg `red` or hex `#ff0000`.

### `.alphaOverLife`: String

Optional, allows particles to change alpha (opacity) over their lifetime. This property uses the same lifetime syntax as seen in `.sizeOverLife` (see above). Alpha values should be from 0 to 1.

### `.emissiveOverLife`: String

Optional, allows particles to change emissive (glow/bloom) over their lifetime. This property uses the same lifetime syntax as seen in `.sizeOverLife` (see above).

### `.onEnd`: Function

Allows you to be notified when all particles have completely despawned when `loop` is set to false. This is useful for knowing when you can remove the emitter from the world or execute some other logic.

```jsx
particles.onEnd = () => {
  // cleanup
  world.remove(particles)
}
```

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

