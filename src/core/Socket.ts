import { readPacket, writePacket } from './packets'

interface SocketOptions {
  id: string;
  ws: any;
  network: any;
  player?: any;
}

export class Socket {
  id: string;
  ws: any;
  network: any;
  player?: any;
  alive: boolean;
  closed: boolean;
  disconnected: boolean;
  
  constructor({ id, ws, network, player }: SocketOptions) {
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

  send(name: string, data: any): void {
    // console.log('->', name, data)
    const packet = writePacket(name, data)
    this.ws.send(packet)
  }

  sendPacket(packet: any): void {
    this.ws.send(packet)
  }

  ping(): void {
    this.alive = false
    this.ws.ping()
  }

  // end(code) {
  //   this.send('end', code)
  //   this.disconnect()
  // }

  onPong = (): void => {
    this.alive = true
  }

  onMessage = (packet: any): void => {
    const [method, data] = readPacket(packet)
    this.network.enqueue(this, method, data)
    // console.log('<-', method, data)
  }

  onClose = (e: any): void => {
    this.closed = true
    this.disconnect(e?.code)
  }

  disconnect(code?: any): void {
    if (!this.closed) return this.ws.terminate()
    if (this.disconnected) return
    this.disconnected = true
    this.network.onDisconnect(this, code)
  }
}
