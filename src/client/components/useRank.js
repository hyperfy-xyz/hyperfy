import { useEffect, useState } from 'react'

export function useRank(world, player) {
  const [perms, setPerms] = useState(() => {
    const isAdmin = player.isAdmin()
    const isBuilder = player.isBuilder()
    return { isAdmin, isBuilder }
  })
  useEffect(() => {
    function update() {
      const isAdmin = player.isAdmin()
      const isBuilder = player.isBuilder()
      setPerms({ isAdmin, isBuilder })
    }
    function onSettings(changes) {
      if (changes.rank) {
        update()
      }
    }
    function onRank({ playerId }) {
      if (player.data.id === playerId) {
        update()
      }
    }
    world.settings.on('change', onSettings)
    world.on('rank', onRank)
    return () => {
      world.settings.off('change', onSettings)
      world.off('rank', onRank)
    }
  }, [])
  return perms
}
