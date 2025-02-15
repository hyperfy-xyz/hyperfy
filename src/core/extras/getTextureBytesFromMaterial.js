const slots = [
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'map',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
]

export function getTextureBytesFromMaterial(material) {
  let bytes = 0
  if (material) {
    const checked = new Set()
    for (const slot of slots) {
      const texture = material[slot]
      if (texture && texture.image && !checked.has(texture.uuid)) {
        checked.add(texture.uuid)
        bytes += texture.image.width * texture.image.height * 4
      }
    }
  }
  return bytes
}
