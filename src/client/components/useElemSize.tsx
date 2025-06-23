import { useEffect, useRef, useState } from 'react'

export function useElemSize(elem: HTMLElement | null) {
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (!elem) return
    const update = () => {
      setWidth(elem.offsetWidth)
      setHeight(elem.offsetHeight)
    }
    update()
    const observer = new ResizeObserver(() => {
      setWidth(elem.offsetWidth)
      setHeight(elem.offsetHeight)
    })
    observer.observe(elem)
    return () => {
      observer.disconnect()
    }
  }, [elem])
  return [width, height]
}
