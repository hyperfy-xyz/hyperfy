import fs from 'fs-extra'
import path from 'path'
import { hashFile } from '../core/utils-server'

export class AssetsLocal {
  constructor() {
    this.url = process.env.ASSETS_BASE_URL
    this.dir = null
  }

  async init({ rootDir, worldDir }) {
    console.log('[assets] initializing')
    this.dir = path.join(worldDir, '/assets')
    // ensure assets directory exists
    await fs.ensureDir(this.dir)
    // copy over built-in assets
    await fs.copy(path.join(rootDir, 'src/world/assets'), this.dir)
  }

  async upload(file) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hash = await hashFile(buffer)
    const ext = file.name.split('.').pop().toLowerCase()
    const filename = `${hash}.${ext}`
    const assetPath = path.join(this.dir, filename)
    const exists = await fs.exists(assetPath)
    if (exists) return
    await fs.writeFile(assetPath, buffer)
  }

  async exists(filename) {
    const filePath = path.join(this.dir, filename)
    const exists = await fs.exists(filePath)
    return exists
  }

  async list() {
    const assets = new Set()
    const files = fs.readdirSync(this.dir)
    for (const file of files) {
      const filePath = path.join(this.dir, file)
      const isDirectory = fs.statSync(filePath).isDirectory()
      if (isDirectory) continue
      const relPath = path.relative(this.dir, filePath)
      // HACK: we only want to include uploaded assets (not core/assets/*) so we do a check
      // if its filename is a 64 character hash
      const isAsset = relPath.split('.')[0].length === 64
      if (!isAsset) continue
      assets.add(relPath)
    }
    return assets
  }

  async delete(assets) {
    for (const asset of assets) {
      const fullPath = path.join(this.dir, asset)
      fs.removeSync(fullPath)
    }
  }
}
