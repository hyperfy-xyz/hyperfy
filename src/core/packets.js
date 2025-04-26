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

const byName = {}
const byId = {}

let ids = -1

for (const name of names) {
  const id = ++ids
  const info = {
    id,
    name,
    method: `on${capitalize(name)}`, // eg 'connect' -> 'onConnect'
  }
  byName[name] = info
  byId[id] = info
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function writePacket(name, data) {
  const info = byName[name]
  if (!info) throw new Error(`writePacket failed: ${name} (name not found)`)
  const packet = packr.pack([info.id, data])
  return packet
}

export function readPacket(packet) {
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
