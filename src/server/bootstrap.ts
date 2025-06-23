import sourceMapSupport from 'source-map-support'
import path from 'path'
import { fileURLToPath } from 'url'

// read .env files
import 'dotenv-flow/config'

// support node source maps
sourceMapSupport.install()

// support `__dirname` in ESM
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url))
