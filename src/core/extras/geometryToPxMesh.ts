import * as THREE from './three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Global PHYSX declaration
declare const PHYSX: any;

interface CacheItem {
  id: string;
  pmesh: any;
  refs: number;
}

const cache = new Map<string, CacheItem>() // id -> { id, pmesh, refs }

class PMeshHandle {
  value: any;
  item: CacheItem;
  released: boolean;
  
  constructor(item: CacheItem) {
    this.value = item.pmesh
    this.item = item
    this.item.refs++
    this.released = false
  }

  release() {
    if (this.released) return
    this.item.refs--
    if (this.item.refs === 0) {
      this.item.pmesh.release()
      cache.delete(this.item.id)
      // console.log('DESTROY', this.item.id)
    }
    this.released = true
    this.value = null
  }
}

export function geometryToPxMesh(world: any, geometry: THREE.BufferGeometry, convex: boolean): PMeshHandle | null {
  const id = `${geometry.uuid}_${convex ? 'convex' : 'triangles'}`

  // check and return cached if already cooked
  let item = cache.get(id)
  if (item) {
    return new PMeshHandle(item)
  }

  const cookingParams = world.physics.cookingParams

  // geometry = BufferGeometryUtils.mergeVertices(geometry)
  // geometry = geometry.toNonIndexed()
  // geometry.computeVertexNormals()

  // console.log('geometry', geometry)
  // console.log('convex', convex)

  let position = geometry.attributes.position
  const index = geometry.index

  if ('isInterleavedBufferAttribute' in position && position.isInterleavedBufferAttribute) {
    // deinterleave!
    const deinterleaved = BufferGeometryUtils.deinterleaveAttribute(position as any) as any
    position = new THREE.BufferAttribute(new Float32Array(deinterleaved.array), deinterleaved.itemSize, false)
  }

  // console.log('position', position)
  // console.log('index', index)

  const positions = position.array as Float32Array
  const floatBytes = positions.length * positions.BYTES_PER_ELEMENT
  const pointsPtr = PHYSX._webidl_malloc(floatBytes)
  PHYSX.HEAPF32.set(positions, pointsPtr >> 2)

  let desc
  let pmesh

  if (convex) {
    desc = new PHYSX.PxConvexMeshDesc()
    desc.points.count = positions.length / 3
    desc.points.stride = 12 // size of PhysX.PxVec3 in bytes
    desc.points.data = pointsPtr
    desc.flags.raise(PHYSX.PxConvexFlagEnum.eCOMPUTE_CONVEX) // eCHECK_ZERO_AREA_TRIANGLES
    pmesh = PHYSX.CreateConvexMesh(cookingParams, desc)
  } else {
    desc = new PHYSX.PxTriangleMeshDesc()

    desc.points.count = positions.length / 3
    desc.points.stride = 12
    desc.points.data = pointsPtr

    // console.log('points.count', desc.points.count)
    // console.log('points.stride', desc.points.stride)

    let indices = index!.array // Uint16Array or Uint32Array

    // for some reason i'm seeing Uint8Arrays in some glbs, specifically the vipe rooms.
    // so we just coerce these up to u16
    if (indices instanceof Uint8Array) {
      indices = new Uint16Array(index!.array.length)
      for (let i = 0; i < index!.array.length; i++) {
        indices[i] = index!.array[i]
      }
    }

    const indexBytes = indices.length * indices.BYTES_PER_ELEMENT
    const indexPtr = PHYSX._webidl_malloc(indexBytes)
    if (indices instanceof Uint16Array) {
      PHYSX.HEAPU16.set(indices, indexPtr >> 1)
      desc.triangles.stride = 6 // 3 × 2 bytes per triangle
      desc.flags.raise(PHYSX.PxTriangleMeshFlagEnum.e16_BIT_INDICES)
    } else {
      // note: this is here for brevity but no longer used as we force everything to 16 bit
      PHYSX.HEAPU32.set(indices, indexPtr >> 2)
      desc.triangles.stride = 12 // 3 × 4 bytes per triangle
    }
    desc.triangles.count = indices.length / 3
    desc.triangles.data = indexPtr

    // console.log('triangles.count', desc.triangles.count)
    // console.log('triangles.stride', desc.triangles.stride)

    // if (!desc.isValid()) {
    //   throw new Error('Invalid mesh description')
    // }

    try {
      pmesh = PHYSX.CreateTriangleMesh(cookingParams, desc)
    } catch (err) {
      console.error('geometryToPxMesh failed...')
      console.error(err)
    } finally {
      PHYSX._webidl_free(indexPtr)
    }
  }

  PHYSX._webidl_free(pointsPtr)
  PHYSX.destroy(desc)

  if (!pmesh) return null

  item = { id, pmesh, refs: 0 }
  cache.set(id, item)
  return new PMeshHandle(item)
}
