import { createNode } from './createNode'

const groupTypes = ['Scene', 'Group', 'Object3D']

export function glbToNodes(glb, world) {
  function registerNode(name, data) {
    const node = createNode(name, data)
    return node
  }
  function parse(object3ds, parentNode) {
    for (const object3d of object3ds) {
      const props = object3d.userData || {}
      // Snap (custom node)
      if (props.node === 'snap') {
        const node = registerNode('snap', {
          id: object3d.name,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // LOD (custom node)
      else if (props.node === 'lod') {
        const node = registerNode('lod', {
          id: object3d.name,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // RigidBody (custom node)
      else if (props.node === 'rigidbody') {
        const node = registerNode('rigidbody', {
          id: object3d.name,
          type: props.type,
          mass: props.mass,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // Collider (custom node)
      else if (props.node === 'collider' && object3d.isMesh) {
        // NOTE: in blender if you export a single object with node:collider but it has multiple materials, it converts this into a Group with one Mesh for each material.
        // but since the Group is the one that has the collider custom property, it won't work as expected. we could hack to fix this, but i think it adds a layer of indirection.
        // colliders should not have materials on them.
        // console.error('TODO: glbToNodes collider for box/sphere in blender?')
        const node = registerNode('collider', {
          id: object3d.name,
          type: 'geometry',
          geometry: object3d.geometry,
          convex: props.convex,
          trigger: props.trigger,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // Mesh
      else if (object3d.type === 'Mesh') {
        // wind effect
        if (props.wind) {
          addWind(object3d, world)
        }
        const hasMorphTargets = object3d.morphTargetDictionary || object3d.morphTargetInfluences?.length > 0
        const node = registerNode('mesh', {
          id: object3d.name,
          type: 'geometry',
          geometry: object3d.geometry,
          material: object3d.material,
          linked: !hasMorphTargets,
          castShadow: props.castShadow,
          receiveShadow: props.receiveShadow,
          visible: props.visible, // DEPRECATED: use Node.active
          active: props.active,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        if (parentNode.name === 'lod' && props.maxDistance) {
          parentNode.insert(node, props.maxDistance)
        } else {
          parentNode.add(node)
        }
        parse(object3d.children, node)
      }
      // SkinnedMesh
      else if (object3d.type === 'SkinnedMesh') {
        // TODO
      }
      // Object3D / Group / Scene
      else if (groupTypes.includes(object3d.type)) {
        const node = registerNode('group', {
          id: object3d.name,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
    }
  }
  const root = registerNode('group', {
    id: '$root',
  })
  parse(glb.scene.children, root)
  // console.log('$root', root)
  return root
}

function addWind(mesh, world) {
  const uniforms = world.wind.uniforms
  mesh.material.onBeforeCompile = shader => {
    shader.uniforms.time = uniforms.time
    shader.uniforms.strength = uniforms.strength
    shader.uniforms.direction = uniforms.direction
    shader.uniforms.speed = uniforms.speed
    shader.uniforms.noiseScale = uniforms.noiseScale
    shader.uniforms.ampScale = uniforms.ampScale
    shader.uniforms.freqMultiplier = uniforms.freqMultiplier

    const height = mesh.geometry.boundingBox.max.y * mesh.scale.y

    shader.uniforms.height = { value: height } // prettier-ignore
    shader.uniforms.stiffness = { value: 0 }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      uniform float time;
      uniform float strength;
      uniform vec3 direction;
      uniform float speed;
      uniform float noiseScale;
      uniform float ampScale;
      uniform float freqMultiplier;
      
      uniform float height;
      uniform float stiffness;

      ${snoise}

      #include <common>
      `
    )

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>

      vec4 worldPos = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        worldPos = instanceMatrix * worldPos;
      #endif
      worldPos = modelMatrix * worldPos;

      float heightFactor = position.y / height;
      float noiseFactor = snoise(worldPos.xyz * noiseScale + time * speed);
      vec3 displacement = sin(time * freqMultiplier + worldPos.xyz) * noiseFactor * ampScale * heightFactor * (1.0 - stiffness);
      transformed += strength * displacement * direction;
      `
    )
  }
}

const snoise = `
  //	Simplex 3D Noise 
  //	by Ian McEwan, Stefan Gustavson (https://github.com/stegu/webgl-noise)
  //
  vec4 permute(vec4 x){
    return mod(((x*34.0)+1.0)*x, 289.0);
  }
  vec4 taylorInvSqrt(vec4 r){ 
    return 1.79284291400159 - 0.85373472095314 * r; 
  }

  float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
      i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
  }
`
