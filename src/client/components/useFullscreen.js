import { useEffect, useMemo, useState } from 'react'
import { isBoolean } from 'lodash-es'

export function useFullscreen(targetRef) {
  const [enabled, setEnabled] = useState(false)

  const supported = useMemo(() => {
    const docEl = document.documentElement
    return !!(
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen
    )
  }, [])

  const toggle = value => {
    const element = targetRef?.current || document.documentElement
    const shouldEnable = isBoolean(value) ? value : !enabled

    if (!supported) return

    if (shouldEnable) {
      const request =
        element.requestFullscreen ||
        element.webkitRequestFullscreen ||
        element.mozRequestFullScreen ||
        element.msRequestFullscreen

      request?.call(element)
    } else {
      const exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen

      exit?.call(document)
    }
  }

  useEffect(() => {
    const handleChange = () => {
      const isFullscreen =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement

      setEnabled(!!isFullscreen)
    }

    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    document.addEventListener('mozfullscreenchange', handleChange)
    document.addEventListener('MSFullscreenChange', handleChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
      document.removeEventListener('mozfullscreenchange', handleChange)
      document.removeEventListener('MSFullscreenChange', handleChange)
    }
  }, [])

  return [supported, enabled, toggle]
}
