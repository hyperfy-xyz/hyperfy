import { Packr } from 'msgpackr'

const packr = new Packr({ structuredClone: true })

// prettier-ignore
const names = [
  'snapshot',
  'command',
  'chatAdded',
  'chatCleared',
  'blueprintAdded',
  'blueprintModified',
  'entityAdded',
  'entityModified',
  'entityEvent',
  'entityRemoved',
  'playerTeleport',
  'playerPush',
  'playerSessionAvatar',
  'settingsModified',
  'spawnModified',
  'kick',
  'ping',
  'pong',
]

interface PacketInfo {
  id: number;
  name: string;
  method: string;
}

const byName: Record<string, PacketInfo> = {}
const byId: Record<number, PacketInfo> = {}

let ids = -1

for (const name of names) {
  const id = ++ids
  const info: PacketInfo = {
    id,
    name,
    method: `on${capitalize(name)}`, // eg 'connect' -> 'onConnect'
  }
  byName[name] = info
  byId[id] = info
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function writePacket(name: string, data: any): any {
  const info = byName[name]
  if (!info) throw new Error(`writePacket failed: ${name} (name not found)`)
  const packet = packr.pack([info.id, data])
  return packet
}

export function readPacket(packet: any): [string, any] | [] {
  try {
    const [id, data] = packr.unpack(packet)
    const info = byId[id]
    if (!info) throw new Error(`readPacket failed: ${id} (id not found)`)
    return [info.method, data]
  } catch (err) {
    console.error(err)
    return []
  }
}
