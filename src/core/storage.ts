import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

class LocalStorage {
  get(key: string, defaultValue: any = null): any {
    const data = localStorage.getItem(key)
    if (data === null) return defaultValue
    let value: any
    try {
      value = JSON.parse(data)
    } catch (err) {
      console.error('error reading storage key:', key)
      value = null
    }
    if (value === undefined) return defaultValue
    return value || defaultValue
  }

  set(key: string, value: any): void {
    if (value === undefined || value === null) {
      localStorage.removeItem(key)
    } else {
      const data = JSON.stringify(value)
      localStorage.setItem(key, data)
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key)
  }
}

class NodeStorage {
  file: string;
  data: Record<string, any>;
  
  constructor() {
    const dirname = path.dirname(fileURLToPath(import.meta.url))
    const rootDir = path.join(dirname, '../')
    this.file = path.join(rootDir, 'localstorage.json')
    try {
      const data = fs.readFileSync(this.file, 'utf8')
      this.data = JSON.parse(data)
    } catch (err) {
      this.data = {}
    }
  }

  save(): void {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
    } catch (err) {
      console.error('error writing to storage file:', err)
    }
  }

  get(key: string, defaultValue: any = null): any {
    const value = this.data[key]
    if (value === undefined) return defaultValue
    return value || defaultValue
  }

  set(key: string, value: any): void {
    if (value === undefined || value === null) {
      delete this.data[key]
    } else {
      this.data[key] = value
    }
    this.save()
  }

  remove(key: string): void {
    delete this.data[key]
    this.save()
  }
}

const isBrowser = typeof window !== 'undefined'
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node

let storage: LocalStorage | NodeStorage | undefined

if (isBrowser) {
  storage = new LocalStorage() // todo: some browser environments (eg safari incognito) have no local storage so we need a MemoryStorage fallback
} else if (isNode) {
  storage = new NodeStorage()
} else {
  console.warn('no storage')
}

export { storage }
