import { readPacket, writePacket } from './packets'

export class Socket {
  constructor({ id, ws, network, player }) {
    this.id = id
    this.ws = ws
    this.network = network

    this.player = player

    this.alive = true
    this.closed = false
    this.disconnected = false

    this.ws.on('message', this.onMessage)
    this.ws.on('pong', this.onPong)
    this.ws.on('close', this.onClose)
  }

  send(name, data) {
    // console.log('->', name, data)
    const packet = writePacket(name, data)
    this.ws.send(packet)
  }

  sendPacket(packet) {
    this.ws.send(packet)
  }

  ping() {
    this.alive = false
    this.ws.ping()
  }

  // end(code) {
  //   this.send('end', code)
  //   this.disconnect()
  // }

  onPong = () => {
    this.alive = true
  }

  onMessage = packet => {
    const [method, data] = readPacket(packet)
    this.network.enqueue(this, method, data)
    // console.log('<-', method, data)
  }

  onClose = e => {
    this.closed = true
    this.disconnect(e?.code)
  }

  disconnect(code) {
    if (!this.closed) return this.ws.terminate()
    if (this.disconnected) return
    this.disconnected = true
    this.network.onDisconnect(this, code)
  }
}
