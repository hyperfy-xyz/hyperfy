app.configure([
  {
    key: 'collision',
    type: 'toggle',
    label: 'Collision',
    initial: true,
    hint: 'Forces all meshes to have collision. Disable this if your model already has embedded collision.'
  },
])

const collision = props.collision

if (collision) {
  const m1 = new Matrix4()
  const appInverseMatrix = app.matrixWorld.clone().invert()
  const body = app.create('rigidbody')
  app.traverse(node => {
    if (node.name === 'mesh') {
      const collider = app.create('collider')
      collider.type = 'geometry'
      collider.geometry = node.geometry
      m1.copy(node.matrixWorld).premultiply(appInverseMatrix).decompose(
        collider.position,
        collider.quaternion,
        collider.scale
      )
      body.add(collider)
    }
  })
  body.position.copy(app.position)
  body.quaternion.copy(app.quaternion)
  body.scale.copy(app.scale)
  world.add(body)
}