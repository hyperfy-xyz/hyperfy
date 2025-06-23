import React, { createContext, useMemo, useState } from 'react'

interface HintContextType {
  hint: string | null;
  setHint: (hint: string | null) => void;
}

export const HintContext = createContext<HintContextType | undefined>(undefined)

interface HintProviderProps {
  children: React.ReactNode;
}

export function HintProvider({ children }: HintProviderProps) {
  const [hint, setHint] = useState<string | null>(null)
  const api = useMemo(() => {
    return { hint, setHint }
  }, [hint])
  return <HintContext.Provider value={api}>{children}</HintContext.Provider>
}
