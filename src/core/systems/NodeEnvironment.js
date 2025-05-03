import * as THREE from '../extras/three'

import { System } from './System'

import { isNumber, isString } from 'lodash-es'

export class NodeEnvironment extends System {
  constructor(world) {
    super(world)

    this.model = null
    this.skys = []
    this.sky = null
    this.skyN = 0
    this.bgUrl = null
    this.hdrUrl = null
  }

  init({ baseEnvironment }) {
    this.base = baseEnvironment
  }
}
