const warned = new Set()
export function warn(str) {
  if (warned.has(str)) return
  console.warn(str)
  warned.add(str)
}
