import * as Nodes from '../nodes'

export function createNode(name: string, data?: any): any {
  const Node = (Nodes as any)[name]
  if (!Node) console.error('unknown node:', name)
  const node = new Node(data)
  return node
}
