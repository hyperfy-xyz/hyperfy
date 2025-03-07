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
    ensure(otherGroup)
    Masks[group] |= Groups[otherGroup]
    // Masks[otherGroup] |= Groups[group]
  }
}

add('camera', ['environment'])
add('player', ['environment', 'prop', 'player'])
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
