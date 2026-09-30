import * as Nodes from '../nodes'

const registry = { ...Nodes }

// plugins add node types here; the name is what scripts pass to app.create()
export function registerNode(name, Node) {
  registry[name] = Node
}

export function createNode(name, data) {
  const Node = registry[name]
  if (!Node) console.error('unknown node:', name)
  const node = new Node(data)
  return node
}
