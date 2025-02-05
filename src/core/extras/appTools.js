export async function exportApp(blueprint, resolveFile) {
  // get all asset urls
  const assets = []
  if (blueprint.model) {
    assets.push({
      type: blueprint.model.endsWith('.vrm') ? 'avatar' : 'model',
      url: blueprint.model,
      file: await resolveFile(blueprint.model),
    })
  }
  if (blueprint.script) {
    assets.push({
      type: 'script',
      url: blueprint.script,
      file: await resolveFile(blueprint.script),
    })
  }
  for (const key in blueprint.props) {
    const value = blueprint.props[key]
    if (value?.url) {
      assets.push({
        type: value.type,
        url: value.url,
        file: await resolveFile(value.url),
      })
    }
  }

  // create header
  const header = {
    version: process.env.PUBLIC_VERSION,
    blueprint,
    assets: assets.map(asset => {
      return {
        type: asset.type,
        url: asset.url,
        size: asset.file.size,
        mime: asset.file.type,
      }
    }),
  }

  // convert header to Uint8Array
  const headerBytes = str2ab(JSON.stringify(header))

  // create header size prefix (4 bytes)
  const headerSize = new Uint8Array(4)
  new DataView(headerSize.buffer).setUint32(0, headerBytes.length, true)

  // combine all file data
  const fileBlobs = await Promise.all(assets.map(asset => asset.file.arrayBuffer()))

  // create final blob with header size + header + files
  const file = new File([headerSize, headerBytes, ...fileBlobs], `app.hyp`, {
    type: 'application/octet-stream',
  })

  return file
}

export async function importApp(file) {
  // read as ArrayBuffer
  const buffer = await file.arrayBuffer()
  const view = new DataView(buffer)

  // read header size (first 4 bytes)
  const headerSize = view.getUint32(0, true)

  // read header
  const bytes = new Uint8Array(buffer.slice(4, 4 + headerSize))
  const header = JSON.parse(ab2str(bytes))

  // extract files
  let position = 4 + headerSize
  const assets = []

  for (const assetInfo of header.assets) {
    const data = buffer.slice(position, position + assetInfo.size)
    const file = new File([data], assetInfo.url.split('/').pop(), {
      type: assetInfo.mime,
    })
    assets.push({
      type: assetInfo.type,
      url: assetInfo.url,
      file,
    })
    position += assetInfo.size
  }

  return {
    version: header.version,
    blueprint: header.blueprint,
    assets,
  }
}

function str2ab(str) {
  // convert string to Uint8Array
  const buf = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i)
  }
  return buf
}

function ab2str(buf) {
  // convert Uint8Array to string
  return String.fromCharCode.apply(null, buf)
}

export function isAppCompatible(appVersion) {
  let currentVersion = process.env.PUBLIC_VERSION
  // strip any -dev suffix
  currentVersion = currentVersion.replace('-dev', '')
  appVersion = appVersion.replace('-dev', '')
  // split versions into numeric parts
  const current = currentVersion.split('.').map(Number)
  const required = appVersion.split('.').map(Number)
  // compare each part
  for (let i = 0; i < 3; i++) {
    if (current[i] > required[i]) return true
    if (current[i] < required[i]) return false
  }
  // if we get here, versions are equal
  return true
}

export function isDevBuild() {
  return process.env.PUBLIC_VERSION.endsWith('-dev')
}
