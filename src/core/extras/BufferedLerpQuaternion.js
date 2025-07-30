// note: buffer rule of thumb should be >= one update per interval, eg 1 / sendRate, example: 5Hz = 1 / 5 = 0.2s buffer + jitter
export class BufferedLerpQuaternion {
  constructor(value, buffer = 0.2) {
    this.value = value // this gets written-to each update
    this.buffer = buffer
    this.localTime = 0
    this.snapToken = null

    // fixed‐size ring of 3 { time, value } samples:
    this.samples = []
    for (let i = 0; i < 3; i++) {
      this.samples.push({
        time: 0,
        value: value.clone(),
      })
    }
    this.writeIndex = 0
  }

  push(inV, snapToken = null) {
    // if snapshot changed, reset all three to new value
    if (this.snapToken !== snapToken) {
      this.snapToken = snapToken
      for (let samp of this.samples) {
        if (Array.isArray(inV)) {
          samp.value.fromArray(inV)
        } else {
          samp.value.copy(inV)
        }
        samp.time = this.localTime
      }
      this.writeIndex = 0
    } else {
      // rotate to next slot
      this.writeIndex = (this.writeIndex + 1) % 3
      const samp = this.samples[this.writeIndex]
      if (Array.isArray(inV)) {
        samp.value.fromArray(inV)
      } else {
        samp.value.copy(inV)
      }
      samp.time = this.localTime
    }
  }

  /**
   * Call once per frame with your frame‐delta in seconds.
   */
  update(delta) {
    this.localTime += delta
    const tRender = this.localTime - this.buffer

    // find the two samples that straddle tRender:
    let older = null,
      newer = null
    let tOlder = -Infinity,
      tNewer = Infinity

    for (let samp of this.samples) {
      const t = samp.time
      if (t <= tRender && t > tOlder) {
        tOlder = t
        older = samp
      }
      if (t >= tRender && t < tNewer) {
        tNewer = t
        newer = samp
      }
    }

    if (older && newer && newer !== older && tNewer > tOlder) {
      let alpha = (tRender - tOlder) / (tNewer - tOlder)
      alpha = Math.min(Math.max(alpha, 0), 1)
      this.value.slerpQuaternions(older.value, newer.value, alpha)
    } else if (older) {
      // too far in the past → hold at oldest
      this.value.copy(older.value)
    } else if (newer) {
      // too far in the future → snap to newest
      this.value.copy(newer.value)
    }

    return this
  }

  /**
   * Instantly jump your localTime to latest+buffer
   */
  snap() {
    // find the sample with max time
    let latest = this.samples[0]
    for (let samp of this.samples) {
      if (samp.time > latest.time) latest = samp
    }
    this.localTime = latest.time + this.buffer
    this.value.copy(latest.value)
  }
}

// export class BufferedLerpQuaternion {
//   constructor(value, buffer = 0.2) {
//     this.value = value
//     this.previous = value.clone()
//     this.current = value.clone()
//     this.prevTime = 0
//     this.currTime = 0
//     this.localTime = 0
//     this.buffer = buffer
//     this.snapToken = null
//   }

//   push(value, snapToken = null) {
//     if (this.snapToken !== snapToken) {
//       this.snapToken = snapToken
//       if (Array.isArray(value)) {
//         this.previous.fromArray(value)
//         this.current.fromArray(value)
//       } else {
//         this.previous.copy(value)
//         this.current.copy(value)
//       }
//       this.prevTime = this.currTime = this.localTime
//     } else {
//       // shift current → previous
//       this.previous.copy(this.current)
//       this.prevTime = this.currTime
//       // set new current & timestamp it
//       if (Array.isArray(value)) {
//         this.current.fromArray(value)
//       } else {
//         this.current.copy(value)
//       }
//       this.currTime = this.localTime
//     }
//   }

//   update(delta) {
//     this.localTime += delta
//     // where in time we should render
//     const tRender = this.localTime - this.buffer
//     // if our two samples are at the same time, just snap
//     const span = this.currTime - this.prevTime
//     let alpha
//     if (span <= 0) {
//       alpha = 1
//     } else {
//       alpha = (tRender - this.prevTime) / span
//       alpha = Math.min(Math.max(alpha, 0), 1)
//     }
//     this.value.slerpQuaternions(this.previous, this.current, alpha)
//     return this
//   }

//   snapToLatest() {
//     this.localTime = this.currTime + this.buffer
//     this.value.copy(this.current)
//   }
// }
