export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const value = bytes / Math.pow(k, i)
  const dp = i <= 1 ? 0 : 1 // bytes no dp
  return `${value.toFixed(dp)} ${units[i]}`
}
