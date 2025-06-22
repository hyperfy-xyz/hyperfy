import React from 'react'
import { useEffect, useState } from 'react'
import { hasRole } from '../../core/utils'

export function usePermissions(world) {
  const [perms, setPerms] = useState(() => {
    const isAdmin = hasRole(world.entities.player?.data.roles, 'admin')
    const isBuilder = isAdmin || world.settings.public
    return { isAdmin, isBuilder }
  })
  useEffect(() => {
    function update() {
      const isAdmin = hasRole(world.entities.player?.data.roles, 'admin')
      const isBuilder = isAdmin || world.settings.public
      setPerms({ isAdmin, isBuilder })
    }
    world.settings.on('change', update)
    return () => {
      world.settings.off('change', update)
    }
  }, [])
  return perms
}
