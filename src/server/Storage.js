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
    try {
      value = JSON.parse(JSON.stringify(value))
      this.data[key] = value
      this.save()
    } catch (err) {
      console.error(err)
    }
  }

  async persist() {
    // console.time('[storage] persist')
    try {
      await fs.writeJson(this.file, this.data)
    } catch (err) {
      console.error(err)
      console.log('failed to persist storage')
    }
    // console.timeEnd('[storage] persist')
  }
}
