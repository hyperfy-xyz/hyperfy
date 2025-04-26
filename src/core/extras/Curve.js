import { clamp } from '../utils'

let ids = 0

const arr1 = []

export class Curve {
  constructor() {
    this.keyframes = []
  }

  deserialize(data) {
    if (!data) return this
    this.data = data
    this.keyframes = data.split('|').map(kData => {
      return new Keyframe().deserialize(kData)
    })
    this.sort()
    return this
  }

  serialize() {
    return this.keyframes
      .map(keyframe => {
        return keyframe.serialize()
      })
      .join('|')
  }

  add(opts) {
    const keyframe = new Keyframe().set(opts)
    const foundIndex = this.keyframes.findIndex(k => k.time === keyframe.time)
    // if (foundIndex === 0) return console.warn('cant replace first keyframe')
    // if (foundIndex === this.keyframes.length -1) return console.warn('cant replace end keyframe') // prettier-ignore
    if (foundIndex === -1) {
      this.keyframes.push(keyframe)
    } else {
      this.keyframes[foundIndex] = keyframe
    }
    this.sort()
    return this
  }

  remove(keyframeId) {
    const idx = this.keyframes.findIndex(keyframe => keyframe.id === keyframeId)
    if (idx !== -1) this.keyframes.splice(idx, 1)
  }

  removeAtTime(time) {
    const idx = this.keyframes.findIndex(keyframe => keyframe.time === time)
    if (idx !== -1) this.keyframes.splice(idx, 1)
  }

  getClosest(t) {
    t = Math.max(0, Math.min(1, t))
    let lo = -1
    let hi = this.keyframes.length
    while (hi - lo > 1) {
      let mid = Math.round((lo + hi) / 2)
      if (this.keyframes[mid].time <= t) lo = mid
      else hi = mid
    }
    if (this.keyframes[lo].time === t) hi = lo
    if (lo === hi) {
      if (lo === 0) hi++
      else lo--
    }
    arr1[0] = lo
    arr1[1] = hi
    return arr1
  }

  evaluate(time) {
    if (time <= this.keyframes[0].time) {
      return this.keyframes[0].value
    }

    if (time >= this.keyframes[this.keyframes.length - 1].time) {
      return this.keyframes[this.keyframes.length - 1].value
    }

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      // prettier-ignore
      if (time >= this.keyframes[i].time && time <= this.keyframes[i + 1].time) { 
        const t = (time - this.keyframes[i].time) / (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
        const p0 = this.keyframes[i].value;
        const p1 = this.keyframes[i + 1].value;
        const m0 = this.keyframes[i].outTangent * (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
        const m1 = this.keyframes[i + 1].inTangent * (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
      }
    }
  }

  // evaluate(time) {
  //   if (time <= this.keyframes[0].time) {
  //     return this.keyframes[0].value
  //   }

  //   if (time >= this.keyframes[this.keyframes.length - 1].time) {
  //     return this.keyframes[this.keyframes.length - 1].value
  //   }

  //   for (let i = 0; i < this.keyframes.length - 1; i++) {
  //     // prettier-ignore
  //     if (time >= this.keyframes[i].time && time <= this.keyframes[i + 1].time) {
  //       const t = (time - this.keyframes[i].time) / (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
  //       const p0 = this.keyframes[i].value
  //       const p1 = this.keyframes[i + 1].value
  //       const m0 = this.keyframes[i].outMagnitude * (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
  //       const m1 = this.keyframes[i + 1].inMagnitude * (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
  //       const t2 = t * t
  //       const t3 = t2 * t

  //       const a = 2 * t3 - 3 * t2 + 1
  //       const b = t3 - 2 * t2 + t
  //       const c = -2 * t3 + 3 * t2
  //       const d = t3 - t2

  //       return a * p0 + b * m0 + c * p1 + d * m1
  //     }
  //   }
  // }

  //   evaluate(t) {
  //     const keyframes = this.keyframes
  //     const n = keyframes.length
  //     const lo = this.getClosest(t)[0]
  //     let i0 = lo
  //     let i1 = i0 + 1

  //     if (i0 > n - 1) throw new Error('Out of bounds')
  //     if (i0 === n - 1) i1 = i0

  //     let scale = keyframes[i1].time - keyframes[i0].time

  //     t = (t - keyframes[i0].time) / scale

  //     let t2 = t * t
  //     let it = 1 - t
  //     let it2 = it * it
  //     let tt = 2 * t
  //     let h00 = (1 + tt) * it2
  //     let h10 = t * it2
  //     let h01 = t2 * (3 - tt)
  //     let h11 = t2 * (t - 1)

  //     const x =
  //       h00 * keyframes[i0].time +
  //       h10 * keyframes[i0].outTangent * scale +
  //       h01 * keyframes[i1].time +
  //       h11 * keyframes[i1].inTangent * scale

  //     const y =
  //       h00 * keyframes[i0].value +
  //       h10 * keyframes[i0].outTangent * scale +
  //       h01 * keyframes[i1].value +
  //       h11 * keyframes[i1].inTangent * scale

  //     return y
  //   }

  ogEvaluate(t) {
    return this.hermite(t, this.keyframes).y
  }

  hermite(t, keyframes) {
    const n = keyframes.length

    const [lo, hi] = this.getClosest(t)

    var i0 = lo
    var i1 = i0 + 1

    if (i0 > n - 1) throw new Error('Out of bounds')
    if (i0 === n - 1) i1 = i0

    var scale = keyframes[i1].time - keyframes[i0].time

    t = (t - keyframes[i0].time) / scale

    var t2 = t * t
    var it = 1 - t
    var it2 = it * it
    var tt = 2 * t
    var h00 = (1 + tt) * it2
    var h10 = t * it2
    var h01 = t2 * (3 - tt)
    var h11 = t2 * (t - 1)

    const x =
      h00 * keyframes[i0].time +
      h10 * keyframes[i0].outTangent * scale +
      h01 * keyframes[i1].time +
      h11 * keyframes[i1].inTangent * scale

    const y =
      h00 * keyframes[i0].value +
      h10 * keyframes[i0].outTangent * scale +
      h01 * keyframes[i1].value +
      h11 * keyframes[i1].inTangent * scale

    return { x, y }
  }

  sort() {
    this.keyframes.sort((a, b) => a.time - b.time)
    this.firstKeyframe = this.keyframes[0]
    this.lastKeyframe = this.keyframes[this.keyframes.length - 1]
  }

  move(keyframe, time, value, boundFirstLast) {
    const keyIndex = this.keyframes.indexOf(keyframe)

    if (keyIndex <= 0 || keyIndex >= this.keyframes.length - 1) {
      if (!boundFirstLast) {
        keyframe.value = value
      }
      return
    }
    keyframe.value = value
    keyframe.time = Math.max(0.001, Math.min(time, 0.999))

    this.sort()
  }

  clone() {
    return new Curve().deserialize(this.serialize())
  }
}

export class Keyframe {
  constructor() {
    this.id = ++ids
    this.time = 0
    this.value = 0
    this.inTangent = 0
    this.outTangent = 0
    this.inMagnitude = -0.1
    this.outMagnitude = 0.1
  }

  set({ time, value, inTangent, outTangent }) {
    this.time = clamp(time, 0, 1)
    this.value = value || 0
    this.inTangent = inTangent || 0
    this.outTangent = outTangent || 0
    return this
  }

  deserialize(data) {
    const [time, value, inTangent, outTangent] = data.split(',')
    this.time = parseFloat(time) || 0
    this.value = parseFloat(value) || 0
    this.inTangent = parseFloat(inTangent) || 0
    this.outTangent = parseFloat(outTangent) || 0
    this.id = ++ids
    this.inMagnitude = -0.1
    this.outMagnitude = 0.1
    return this
  }

  serialize() {
    return [
      numToString(this.time),
      numToString(this.value),
      numToString(this.inTangent),
      numToString(this.outTangent),
    ].join(',')
  }

  getHandles() {
    return { in: this.getInHandle(), out: this.getOutHandle() }
  }

  getInHandle() {
    return {
      x: this.time + this.inMagnitude,
      y: this.value + this.inMagnitude * this.inTangent,
    }
  }

  getOutHandle() {
    return {
      x: this.time + this.outMagnitude,
      y: this.value + this.outMagnitude * this.outTangent,
    }
  }

  setTangentsFromHandles(tangents) {
    this.setInTangentFromHandle(tangents.in.x, tangents.in.y)
    this.setOutTangentFromHandle(tangents.out.x, tangents.out.y)
  }

  setInTangentFromHandle(x, y) {
    if (x >= this.time) return
    this.inMagnitude = x - this.time
    this.inTangent = (y - this.value) / this.inMagnitude
  }

  setOutTangentFromHandle(x, y) {
    if (x <= this.time) return
    this.outMagnitude = x - this.time
    this.outTangent = (y - this.value) / this.outMagnitude
  }
}

function numToString(num) {
  if (Number.isInteger(num)) return num.toString()
  return num.toFixed(3)
}
