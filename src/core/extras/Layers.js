let n = 0

const Groups = {}

const Masks = {}

export const Layers = {}

function ensure(group) {
  if (Groups[group] === undefined) {
    Groups[group] = 1 << n
    Masks[group] = 0
    n++
  }
}

function add(group, hits) {
  ensure(group)
  for (const otherGroup of hits) {
    if (!otherGroup) continue
    ensure(otherGroup)
    Masks[group] |= Groups[otherGroup]
    // Masks[otherGroup] |= Groups[group]
  }
}

const playerCollision = (process?.env.PUBLIC_PLAYER_COLLISION || globalThis.env?.PUBLIC_PLAYER_COLLISION) === 'true'

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
