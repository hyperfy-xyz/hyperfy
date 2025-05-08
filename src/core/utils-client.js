/**
 *
 * Hash File
 *
 * takes a file and generates a sha256 unique hash.
 * carefully does this the same way as the server function.
 *
 */
export async function hashFile(file) {
  // --- DEBUG LOGGING --- >
  console.log(`[hashFile Debug] Received type: ${typeof file}`)
  if (file && file.constructor) {
    console.log(`[hashFile Debug] Received constructor: ${file.constructor.name}`)
  }
  console.log(`[hashFile Debug] Received value (first 100 chars):`, String(file).substring(0, 100))
  // <---------------------

  // Check specifically for Node.js Buffer first
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file)) {
    // If it's a Node Buffer, digest it directly
    const hashBuf = await crypto.subtle.digest('SHA-256', file)
    const hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return hash
  }
  // Check for browser Blob/File with arrayBuffer method
  else if (file && typeof file.arrayBuffer === 'function') {
    const buf = await file.arrayBuffer()
    const hashBuf = await crypto.subtle.digest('SHA-256', buf)
    const hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return hash
  }
  // Fallback/Error case: Handle raw ArrayBuffers or throw error
  else if (file instanceof ArrayBuffer || ArrayBuffer.isView(file)) {
    // If it's already an ArrayBuffer or TypedArray/DataView, digest directly
    const hashBuf = await crypto.subtle.digest('SHA-256', file)
    const hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return hash
  } else {
    if (file.buffer) {
      const hashBuf = await crypto.subtle.digest('SHA-256', file.buffer)
      const hash = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      return hash
    }
  }
}
