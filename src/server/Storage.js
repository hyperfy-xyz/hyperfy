import fs from 'fs-extra'
import { cloneDeep, throttle } from 'lodash-es'

export class Storage {
  constructor(file) {
    this.file = file
    try {
      this.data = fs.readJsonSync(this.file)
    } catch (err) {
      this.data = {}
    }
    this.save = throttle(() => this.persist(), 1000, { leading: true, trailing: true })
  }

  get(key) {
    return this.data[key]
  }

  set(key, value) {
    this.data[key] = cloneDeep(value)
    this.save()
  }

  async persist() {
    // console.time('[storage] persist')
    try {
      await fs.writeJson(this.file, this.data)
    } catch (err) {
      console.log('failed to persist storage')
      console.error(err)
    }
    // console.timeEnd('[storage] persist')
  }
}
