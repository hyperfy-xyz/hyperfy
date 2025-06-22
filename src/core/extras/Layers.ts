let n = 0

const Groups: Record<string, number> = {}

const Masks: Record<string, number> = {}

interface Layer {
  group: number
  mask: number
}

interface LayersType {
  camera?: Layer
  player?: Layer
  environment?: Layer
  prop?: Layer
  tool?: Layer
  [key: string]: Layer | undefined
}

export const Layers: LayersType = {}

function ensure(group: string) {
  if (Groups[group] === undefined) {
    Groups[group] = 1 << n
    Masks[group] = 0
    n++
  }
}

function add(group: string, hits: (string | null | undefined)[]) {
  ensure(group)
  for (const otherGroup of hits) {
    if (!otherGroup) continue
    ensure(otherGroup)
    Masks[group] |= Groups[otherGroup]
    // Masks[otherGroup] |= Groups[group]
  }
}

const playerCollision = (process?.env.PUBLIC_PLAYER_COLLISION || (globalThis as any).env?.PUBLIC_PLAYER_COLLISION) === 'true'

add('camera', ['environment'])
add('player', ['environment', 'prop', playerCollision ? 'player' : null])
add('environment', ['camera', 'player', 'environment', 'prop', 'tool'])
add('prop', ['environment', 'prop'])
add('tool', ['environment', 'prop'])

for (const key in Groups) {
  Layers[key] = {
    group: Groups[key],
    mask: Masks[key],
  }
}

// console.log('Layers', Layers)
