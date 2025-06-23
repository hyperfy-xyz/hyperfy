const warned = new Set<string>()
export function warn(str: string): void {
  if (warned.has(str)) return
  console.warn(str)
  warned.add(str)
}
