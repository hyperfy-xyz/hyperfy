import React from 'react'
import { css } from '@firebolt-dev/css'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface CurvePreviewProps {
  curve: any;
  yMin?: number;
  yMax?: number;
}

export function CurvePreview({ curve, yMin = 0, yMax = 1 }: CurvePreviewProps) {
  const elemRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const elem = elemRef.current
    if (!elem) return
    const width = elem.offsetWidth
    const height = elem.offsetHeight
    const margin = { top: 2, right: 2, bottom: 2, left: 2 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth])
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0])

    const svg = d3.create('svg').attr('width', width).attr('height', height)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const line = d3
      .line<[number, number]>()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(d3.curveLinear)

    const data: [number, number][] = d3.range(0, 1.01, 0.01).map(t => [t, curve.evaluate(t)])
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('d', line)

    const node = svg.node()
    if (node) {
      elem.appendChild(node)
      return () => {
        elem.removeChild(node)
      }
    }
  }, [curve, yMin, yMax])

  return (
    <div
      ref={elemRef}
      css={css`
        width: 100%;
        height: 100%;
      `}
    />
  )
}
