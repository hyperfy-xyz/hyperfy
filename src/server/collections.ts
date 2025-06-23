import fs from 'fs-extra'
import path from 'path'
import { importApp } from '../core/extras/appTools'
import { isArray } from 'lodash-es'

interface CollectionOptions {
  collectionsDir: string;
  assetsDir: string;
}

export async function initCollections({ collectionsDir, assetsDir }: CollectionOptions) {
  const collections: any[] = []
  const dirs = await fs.readdir(collectionsDir)
  for (const dir of dirs) {
    const dirPath = path.join(collectionsDir, dir)
    const stat = await fs.stat(dirPath)
    if (!stat.isDirectory()) continue
    const manifestPath = path.join(dirPath, 'manifest.json')
    if (!(await fs.exists(manifestPath))) continue
    const manifest = await fs.readJson(manifestPath)
    if (!isArray(manifest.items)) continue
    for (const item of manifest.items) {
      if (!item.file) continue
      const filePath = path.join(dirPath, item.file)
      const fileData = await fs.readFile(filePath, 'utf8')
      const data = JSON.parse(fileData)
      const collection = {
        name: dir,
        type: data.type,
        data,
      }
      collections.push(collection)
    }
  }
  return collections
}
