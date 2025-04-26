import { clamp } from 'lodash'
import * as d3 from 'd3'

import { Curve } from './Curve'

export function curveManager({ curve, width, height, xLabel, yLabel, yMin = 0, yMax = 1 }) {
  const boundFirstLast = false
  if (!curve) {
    curve = new Curve()
      .add({ time: 0, value: 0, inTangent: 0, outTangent: 0 })
      .add({ time: 1, value: 1, inTangent: 0, outTangent: 0 })
  }

  const margin = {
    right: 10,
  }

  const x = d3.scaleLinear().domain([0, 1]).range([0, width])
  const xAxis = d3.axisBottom().scale(x).ticks(10, '.1f').tickSizeInner(-height)

  const y = d3.scaleLinear().domain([yMax, yMin]).range([0, height])
  const yAxis = d3.axisLeft().scale(y).ticks(10, '.1f').tickSizeInner(-width)

  const line = d3.line()

  const svg = d3
    .create('svg')
    .attr('cursor', 'pointer')
    .attr('viewBox', [0, 0, width, height])
    .style('max-width', `${width}px`)
    .style('overflow', 'visible')

  svg
    .append('g')
    .attr('transform', `translate(0, ${height})`)
    .call(xAxis)
    .call(g => g.selectAll('line').attr('class', 'axis_line').attr('stroke', 'rgba(255, 255, 255, 0.3)'))
    .call(g => g.select('.domain').remove())

  svg
    .append('g')
    .call(yAxis)
    .call(g => g.selectAll('line').attr('class', 'axis_line').attr('stroke', 'rgba(255, 255, 255, 0.3)'))
    .call(g => g.select('.domain').remove())

  svg
    .append('text')
    .attr('class', 'x label')
    .attr('text-anchor', 'middle')
    .attr('fill', 'currentColor')
    .attr('font-size', 13)
    .attr('x', width / 2)
    .attr('y', height + 25)
    .text(xLabel)

  svg
    .append('text')
    .attr('class', 'y label')
    .attr('text-anchor', 'middle')
    .attr('x', -height / 2)
    .attr('y', -35)
    .attr('dy', '.75em')
    .attr('transform', 'rotate(-90)')
    .attr('font-size', 13)
    .attr('fill', 'currentColor')
    .text(yLabel)

  let g = svg
    .append('g')
    .attr('fill', 'none')
    .attr('stroke', 'black')
    .attr('stroke-width', 1.5)
    .attr('stroke-linecap', 'round')

  // Updated to use d3.pointer instead of d3.mouse
  svg.on('click', function (event) {
    if (event.defaultPrevented) return
    const pointer = d3.pointer(event, this)
    curve.add({
      time: x.invert(pointer[0]),
      value: y.invert(pointer[1]),
    })
    updateValue()
    update(true)
  })

  function updateValue() {
    // editor.value = t => curve.evaluate(t)
    // editor.dispatchEvent(new CustomEvent('input'))
  }

  function update(runTransition) {
    g.selectAll('path')
      .data([t => curve.ogEvaluate(t)])
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', 'white')
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .transition()
      .duration(runTransition ? 500 : 0)
      .attr('d', e => line(d3.ticks(0, 1, width).map(t => [x(t), y(e(t))])))

    g.selectAll('.tangentesCont')
      .data(curve.keyframes, (d, i) => d.id)
      .join(enter =>
        enter
          .append('g')
          .attr('class', 'tangentesCont')
          .each(function (d) {
            d3.select(this)
              .append('line')
              .attr('opacity', d => (d.id === curve.firstKeyframe.id ? 0 : 1))
              .attr('class', 'inTangLine')
              .attr('fill', 'none')
              .attr('stroke', '#008ec4')

            d3.select(this)
              .append('line')
              .attr('class', 'outTangLine')
              .attr('opacity', d => (d.id === curve.lastKeyframe.id ? 0 : 1))
              .attr('fill', 'none')
              .attr('stroke', '#008ec4')

            d3.select(this)
              .append('circle')
              .attr('stroke', 'black')
              .attr('opacity', d => (d.id === curve.firstKeyframe.id ? 0 : 1))
              .attr('class', 'inTangKey')
              .attr('stroke', '#008ec4')
              .attr('fill', '#008ec4')
              .attr('r', 5)
              .attr('cursor', 'move')
              .call(d3.drag().on('start', dragstartedKey).on('drag', draggedTangIn).on('end', dragendedKey))

            d3.select(this)
              .append('circle')
              .attr('stroke', 'black')
              .attr('opacity', d => (d.id === curve.lastKeyframe.id ? 0 : 1))
              .attr('class', 'outTangKey')
              .attr('stroke', '#008ec4')
              .attr('fill', '#008ec4')
              .attr('r', 5)
              .attr('cursor', 'move')
              .call(d3.drag().on('start', dragstartedKey).on('drag', draggedTangOut).on('end', dragendedKey))

            d3.select(this)
              .append('circle')
              .attr('class', 'keyframe')
              .attr('stroke', 'black')
              .attr('fill', 'white')
              .attr('r', 5)
              .attr('cursor', 'move')
              .on('contextmenu', (event, d) => {
                event.preventDefault()
                curve.removeAtTime(d.time)
                updateValue()
                update(true)
              })
              .call(d3.drag().on('start', dragstartedKey).on('drag', draggedKey).on('end', dragendedKey))
          })
      )
      .each(function (d) {
        d3.select(this).select('.keyframe').attr('cx', x(d.time)).attr('cy', y(d.value)).attr('cursor', 'move')

        d3.select(this)
          .select('.inTangKey')
          .attr('cx', x(d.getHandles().in.x))
          .attr('cy', y(d.getHandles().in.y))
          .attr('cursor', 'move')

        d3.select(this).select('.outTangKey').attr('cx', x(d.getHandles().out.x)).attr('cy', y(d.getHandles().out.y))

        d3.select(this)
          .select('.inTangLine')
          .attr('stroke-width', '1')
          .attr('x1', x(d.getHandles().in.x))
          .attr('y1', y(d.getHandles().in.y))
          .attr('x2', x(d.time))
          .attr('y2', y(d.value))

        d3.select(this)
          .select('.outTangLine')
          .attr('stroke-width', '1')
          .attr('x1', x(d.time))
          .attr('y1', y(d.value))
          .attr('x2', x(d.getHandles().out.x))
          .attr('y2', y(d.getHandles().out.y))
      })
  }

  // Updated drag functions to use D3 v6+ event handling
  function dragstartedKey(event, d) {
    d3.select(this).raise().attr('r', 6)
  }

  function draggedKey(event, d) {
    const pointer = d3.pointer(event, this)
    const xPos = clamp(x.invert(pointer[0]), 0, 1)
    const yPos = clamp(y.invert(pointer[1]), yMin, yMax)

    curve.move(d, xPos, yPos, boundFirstLast)
    update()
  }

  function dragendedKey(event, d) {
    d3.select(this).raise().attr('r', 5)
    updateValue()
    update()
  }

  function draggedTangIn(event, d) {
    const pointer = d3.pointer(event, this)
    d.setInTangentFromHandle(x.invert(pointer[0]), y.invert(pointer[1]))
    update()
  }

  function draggedTangOut(event, d) {
    const pointer = d3.pointer(event, this)
    d.setOutTangentFromHandle(x.invert(pointer[0]), y.invert(pointer[1]))
    update()
  }

  updateValue()
  update()

  return {
    elem: svg.node(),
  }
}
