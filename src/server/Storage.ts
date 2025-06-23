import fs from 'fs-extra'
import { throttle } from 'lodash-es'

export class Storage {
  private file: string
  private data: Record<string, any>
  private save: () => void

  constructor(file: string) {
    this.file = file
    try {
      this.data = fs.readJsonSync(this.file)
    } catch (err) {
      this.data = {}
    }
    this.save = throttle(() => this.persist(), 1000, { leading: true, trailing: true })
  }

  get(key: string): any {
    return this.data[key]
  }

  set(key: string, value: any): void {
    // TODO: enforce types
    if (value !== undefined) {
      this.data[key] = value
      this.save()
    }
  }

  async persist(): Promise<void> {
    // console.time('[storage] persist')
    try {
      await fs.writeJson(this.file, this.data)
    } catch (err) {
      console.error('failed to persist storage', err)
    }
    // console.timeEnd('[storage] persist')
  }
}
