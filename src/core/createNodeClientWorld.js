import { World } from './World'

import { NodeClient } from './systems/NodeClient'
import { ClientControls } from './systems/ClientControls'
import { ClientNetwork } from './systems/ClientNetwork'
import { ServerLoader } from './systems/ServerLoader'
import { NodeEnvironment } from './systems/NodeEnvironment'
// import { ClientActions } from './systems/ClientActions'
// import { LODs } from './systems/LODs'
// import { Nametags } from './systems/Nametags'

export function createNodeClientWorld() {
  const world = new World()
  world.register('client', NodeClient)
  world.register('controls', ClientControls)
  world.register('network', ClientNetwork)
  world.register('loader', ServerLoader) // TODO: ClientLoader should be named BrowserLoader and ServerLoader should be called NodeLoader
  world.register('environment', NodeEnvironment)
  // world.register('actions', ClientActions)
  // world.register('lods', LODs)
  // world.register('nametags', Nametags)
  return world
}
