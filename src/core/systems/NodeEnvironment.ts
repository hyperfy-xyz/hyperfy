import * as THREE from '../extras/three'

import { System } from './System'

import { isNumber, isString } from 'lodash-es'
import type { World } from '../../types'

export class NodeEnvironment extends System {
  model: any = null
  skys: any[] = []
  sky: any = null
  skyN: number = 0
  bgUrl: string | null = null
  hdrUrl: string | null = null
  base: any
  constructor(world: World) {
    super(world)

    this.model = null
    this.skys = []
    this.sky = null
    this.skyN = 0
    this.bgUrl = null
    this.hdrUrl = null
  }

  async init(options: any): Promise<void> {
    this.base = options.baseEnvironment
  }
}
