import { useEffect, useRef } from 'react'
import { css } from '@firebolt-dev/css'
import * as d3 from 'd3'

export function CurvePreview({ curve, yMin = 0, yMax = 1 }) {
  const elemRef = useRef()
  useEffect(() => {
    const elem = elemRef.current
    const width = elem.offsetWidth
    const height = elem.offsetHeight
    const x = d3.scaleLinear().domain([0, 1]).range([0, width])
    const y = d3.scaleLinear().domain([yMax, yMin]).range([0, height])
    const line = d3.line()
    const svg = d3
      .create('svg')
      .attr('cursor', 'pointer')
      .attr('viewBox', [0, 0, width, height])
      .style('max-width', `${width}px`)
      .style('overflow', 'visible')
    const g = svg
      .append('g')
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
    g.selectAll('path')
      .data([t => curve.evaluate(t)])
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .transition()
      .duration(0)
      .attr('d', e => line(d3.ticks(0, 1, width).map(t => [x(t), y(e(t))])))
    const node = svg.node()
    elem.appendChild(node)
    return () => {
      elem.removeChild(node)
    }
  }, [curve])
  return (
    <div
      ref={elemRef}
      className='CurvePreview'
      css={css`
        position: absolute;
        inset: 1px;
      `}
    />
  )
}
