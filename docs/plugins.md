# Plugins

Plugins add node types, systems, script APIs, sidebar panes and app collections without changing the engine. They are listed in `hyperfy.config.js` and bundled into the client and the server at build time.

```js
// hyperfy.config.js
export default {
  plugins: ['./src/plugins/webview', ['./my-plugins/voxels', { cell: 0.5 }]],
}
```

Each entry is a folder relative to the config file, holding an optional `client.js` and/or `server.js`. An entry can also be `[folder, options]`. Plugins run in this order, after the core systems are registered and before `world.init()`. The build watches the config, so `npm run dev` picks up changes.

## Writing a plugin

`client.js` and `server.js` each default-export a function:

```js
// my-plugins/voxels/client.js
import { registerNode } from '@hyperfy/core/extras/createNode'
import { System } from '@hyperfy/core/systems/System'
import { Voxels } from './Voxels'
import { VoxelsPane } from './VoxelsPane'
import { CubeIcon } from 'lucide-react'

export default function (world, ctx, options) {
  registerNode('voxels', Voxels)
  world.register('voxels', class extends System {})
  world.inject({ world: { voxels: (entity, ...args) => {} } })
  world.ui.register({ id: 'voxels', section: 'world', label: 'Voxels', icon: CubeIcon, component: VoxelsPane })
}
```

- `world` has every core system registered.
- `ctx` on the client is the init config (`viewport`, `cssLayer`, `ui`, `wsUrl`, `baseEnvironment`); on the server it is `{ fastify, db, assets, storage, collections, worldDir, rootDir }`.
- `options` is the second item of the config entry (`{}` by default).

Engine code is imported through the `@hyperfy/core/*` and `@hyperfy/client/*` aliases (`src/core/*` and `src/client/*`).

## What a plugin can register

**Node types**: `registerNode(name, Class)`. Scripts then call `app.create(name)`. Register on both sides, since the server also builds apps, and guard client-only work with `if (this.ctx.world.network.isServer) return` like the built-in nodes do.

**Systems**: `world.register(key, System)`. Lifecycle hooks (`init`, `start`, `update`, `commit`...) run after the core systems, and the system is available as `world[key]`.

**Script API**: `world.inject({ world: {...}, app: {...} })` adds methods and `{ get, set }` accessors to the `world` and `app` objects scripts see. Methods receive `(entity, ...args)`.

**Sidebar panes** (client): `world.ui.register({ id, section, label, icon, component })`. `section` is `main`, `world` (builders only) or `app` (an app is selected). `component` receives `{ world, ui, hidden }` and should render a `Pane` from `@hyperfy/client/components/Sidebar`. Open it with `world.ui.togglePane(id)`.

**Collections** (server): `ctx.collections.add(folder)` installs a folder holding a `manifest.json` and `.hyp` files, like `src/world/collections/default`.

**Routes** (server): `ctx.fastify.get(...)` and friends.

## Notes

- `src/plugins/webview` is the WebView node and its CSS3D system, shipped as a plugin. Remove it from the config to build without it.
- `src/plugins/world-info` adds `GET /api/world`, the world's title, description and image for directories and hosts that list worlds.
- The viewer and node-client builds do not load plugins.
- Scripts and the engine run under SES lockdown: a dependency that patches built-in prototypes will throw at import.
