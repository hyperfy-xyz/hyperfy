/**
 *
 * This is a utility that allows us to sort octree nodes front-to-back
 * extremely fast, avoiding the need to create new arrays or use .sort() etc.
 *
 * It does this by precomputing all sort indice arrays into a lookup table
 * and using a much faster algo than cameraPos.distanceTo(node.center) etc.
 *
 * Thanks ChatGPT o4-mini-high
 *
 */

// ——————————————————————————————————————————————————————————
// Build a small lookup: for each of the 8 (dx,dy,dz) camera‐octants,
// we store an 8‐element array of child‐indices [0..7] sorted “nearer first”.
//
// We assume that your LooseOctreeNode.children[] were created
// in exactly this index order (x,y,z signs):
//
//   i = 0 → (sx = –1, sy = –1, sz = –1)
//   i = 1 → (sx = –1, sy = –1, sz = +1)
//   i = 2 → (sx = –1, sy = +1, sz = –1)
//   i = 3 → (sx = –1, sy = +1, sz = +1)
//   i = 4 → (sx = +1, sy = –1, sz = –1)
//   i = 5 → (sx = +1, sy = –1, sz = +1)
//   i = 6 → (sx = +1, sy = +1, sz = –1)
//   i = 7 → (sx = +1, sy = +1, sz = +1)
//
// That is exactly how your `.subdivide()` builds children (with x,y,z in ±1).
//
// We’ll encode “camera octant” as a 3-bit index camOct = (dx<<2)|(dy<<1)|dz.
//
//   dx = (camera.x >= node.center.x) ? 1 : 0
//   dy = (camera.y >= node.center.y) ? 1 : 0
//   dz = (camera.z >= node.center.z) ? 1 : 0
//
// Then, for each child‐index i, we compute bits
//   sx = (i & 4) ? 1 : 0
//   sy = (i & 2) ? 1 : 0
//   sz = (i & 1) ? 1 : 0
// and build a small “key” = (sx===dx?0:4) + (sy===dy?0:2) + (sz===dz?0:1).
// Sorting by that key yields the correct front-to-back ordering of children.
// Since there are only 8 children, sorting 8 elements is effectively constant time,
// but we’ll do it *once* at init and store 8 arrays.
//
// At startup, before any traversal:

function LooseOctreeTraverse() {
  const frontToBackTable = new Array(8)
  for (let camOct = 0; camOct < 8; camOct++) {
    // decode camOct → dx,dy,dz bits
    const dx = camOct & 4 ? 1 : 0
    const dy = camOct & 2 ? 1 : 0
    const dz = camOct & 1 ? 1 : 0
    // build an array of 8 entries { idx, key }
    const arr = []
    for (let i = 0; i < 8; i++) {
      const sx = i & 4 ? 1 : 0
      const sy = i & 2 ? 1 : 0
      const sz = i & 1 ? 1 : 0
      // “penalize” children whose sign doesn’t match the camera’s sign
      const key = (sx === dx ? 0 : 4) + (sy === dy ? 0 : 2) + (sz === dz ? 0 : 1)
      arr.push({ idx: i, key })
    }
    // sort these 8 small objects by .key (lowest key = “most front”)
    arr.sort((a, b) => a.key - b.key)
    // store only the sorted child‐indices [i0,i1,…,i7]
    frontToBackTable[camOct] = arr.map(e => e.idx)
  }

  return function sort(cameraPos, node, callback) {
    // 1) Determine which “octant” the camera is in relative to this node.center
    const dx = cameraPos.x >= node.center.x ? 1 : 0
    const dy = cameraPos.y >= node.center.y ? 1 : 0
    const dz = cameraPos.z >= node.center.z ? 1 : 0
    const camOct = (dx << 2) | (dy << 1) | dz

    // 2) Look up our precomputed 8‐child ordering
    const ordering = frontToBackTable[camOct]
    // ordering is an array of eight indices [i0, i1, …, i7]

    // 3) Walk exactly in that order—no full sort() call
    for (let k = 0; k < 8; k++) {
      const childIndex = ordering[k]
      const childNode = node.children[childIndex]
      if (childNode) {
        callback(childNode)
      }
    }
  }
}

export const looseOctreeTraverse = LooseOctreeTraverse()
