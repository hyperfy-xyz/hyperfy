import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

/**
 * Plugins
 *
 * hyperfy.config.js lists plugin folders. Each side (client/server) imports a virtual
 * `hyperfy:plugins` module that exports `[plugin, options]` pairs for the folders that
 * have a `<side>.js`. Plugins import the engine through the `@hyperfy/core/*` alias.
 * See docs/plugins.md
 */

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../')
const configPath = path.join(rootDir, 'hyperfy.config.js')

export const alias = {
  '@hyperfy/core': path.join(rootDir, 'src/core'),
  '@hyperfy/client': path.join(rootDir, 'src/client'),
}

export function pluginsPlugin(side) {
  return {
    name: 'hyperfy-plugins',
    setup(build) {
      build.onResolve({ filter: /^hyperfy:plugins$/ }, args => ({ path: args.path, namespace: 'hyperfy' }))
      build.onLoad({ filter: /.*/, namespace: 'hyperfy' }, async () => {
        // the query defeats the module cache so watch-mode rebuilds see config edits
        const config = (await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)).default
        const imports = []
        const entries = []
        config.plugins.forEach((entry, i) => {
          const [folder, options = {}] = Array.isArray(entry) ? entry : [entry]
          const file = path.join(rootDir, folder, `${side}.js`)
          if (!fs.existsSync(file)) return
          imports.push(`import plugin${i} from ${JSON.stringify(file)}`)
          entries.push(`[plugin${i}, ${JSON.stringify(options)}]`)
        })
        const contents = `${imports.join('\n')}\nexport default [${entries.join(', ')}]\n`
        return { contents, resolveDir: rootDir, watchFiles: [configPath] }
      })
    },
  }
}
