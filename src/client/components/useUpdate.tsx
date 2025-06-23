import { useState } from 'react'

export function useUpdate(): () => void {
  const [, setV] = useState(0)
  return () => setV(v => v + 1)
}
