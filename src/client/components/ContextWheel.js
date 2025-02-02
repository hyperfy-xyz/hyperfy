import { css } from '@firebolt-dev/css'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { cls } from '../utils'

export function ContextWheel({ x, y, actions }) {
  // Update actions to handle frozen state
  const updatedActions = actions.map(action => {
    if (action.type === 'move') {
      return {
        ...action,
        disabled: action.frozen
      }
    }
    return action
  })

  const ref = useRef()
  return (
    <div
      ref={ref}
      css={css`
        position: absolute;
        top: ${y}px;
        left: ${x}px;
        transform: translateX(-50%) translateY(-50%);
        pointer-events: none;
        user-select: none;
      `}
    >
      <ContextRadial innerRadius={50} outerRadius={150} actions={updatedActions} gapAngle={6} />
    </div>
  )
}

function ContextRadial({ innerRadius, outerRadius, actions, gapAngle }) {
  const svgRef = useRef()

  const hoverScale = 1.05
  const size = outerRadius * 2 * hoverScale
  const centerX = size / 2
  const centerY = size / 2

  const buttons = useMemo(() => {
    actions = actions.filter(a => a.visible)
    while (actions.length < 4) {
      actions.push({
        label: null,
        icon: null,
        disabled: true,
        onClick: null,
      })
    }
    const buttons = []
    const angleSize = 360 / actions.length
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const button = {}
      button.label = action.label
      button.icon = action.icon
      button.disabled = action.disabled
      button.onClick = action.onClick
      button.startDegree = i * angleSize
      button.endDegree = button.startDegree + angleSize
      buttons.push(button)
    }
    return buttons
  }, [actions])

  useLayoutEffect(() => {
    const svg = svgRef.current
    requestAnimationFrame(() => {
      svg.style.transform = 'scale(1) rotate(0deg)'
      svg.style.opacity = 1
    })
  }, [])

  let offsetDegree = -90 // buttons start from polar right so we adjust to top
  offsetDegree -= 360 / buttons.length / 2 // make the first button centered at top

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      css={css`
        transition: all 0.1s ease-out;
        transform: scale(0.5);
        opacity: 0;
        .radial-button {
          pointer-events: auto;
          transform-origin: 50%;
          transition: transform 0.1s ease-out;
          color: white;
          &.disabled {
            color: rgba(255, 255, 255, 0.3);
            pointer-events: none;
            path {
              fill: rgba(0, 0, 0, 0.3);
            }
          }
          &:hover:not(.disabled) {
            cursor: pointer;
            transform: scale(${hoverScale});
          }
        }
      `}
      onContextMenu={e => e.preventDefault()}
    >
      {buttons.map((button, index) => (
        <ContextButton
          key={index}
          centerX={centerX}
          centerY={centerY}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startDegree={button.startDegree}
          endDegree={button.endDegree}
          offsetDegree={offsetDegree}
          gapAngle={gapAngle}
          label={button.label}
          icon={button.icon}
          disabled={button.disabled}
          onClick={button.onClick}
        />
      ))}
    </svg>
  )
}

function ContextButton({
  centerX,
  centerY,
  startDegree,
  endDegree,
  offsetDegree,
  innerRadius,
  outerRadius,
  gapAngle,
  label,
  icon: Icon,
  disabled,
  onClick,
}) {
  // shape
  const outerGapAngle = gapAngle * (innerRadius / outerRadius)
  const adjustedStartDegreeInner = startDegree + offsetDegree + gapAngle / 2
  const adjustedEndDegreeInner = endDegree + offsetDegree - gapAngle / 2
  const adjustedStartDegreeOuter = startDegree + offsetDegree + outerGapAngle / 2
  const adjustedEndDegreeOuter = endDegree + offsetDegree - outerGapAngle / 2
  const startXInner = centerX + innerRadius * Math.cos(adjustedStartDegreeInner * (Math.PI / 180)) // prettier-ignore
  const startYInner = centerY + innerRadius * Math.sin(adjustedStartDegreeInner * (Math.PI / 180)) // prettier-ignore
  const endXInner = centerX + innerRadius * Math.cos(adjustedEndDegreeInner * (Math.PI / 180)) // prettier-ignore
  const endYInner = centerY + innerRadius * Math.sin(adjustedEndDegreeInner * (Math.PI / 180)) // prettier-ignore
  const startXOuter = centerX + outerRadius * Math.cos(adjustedStartDegreeOuter * (Math.PI / 180)) // prettier-ignore
  const startYOuter = centerY + outerRadius * Math.sin(adjustedStartDegreeOuter * (Math.PI / 180)) // prettier-ignore
  const endXOuter = centerX + outerRadius * Math.cos(adjustedEndDegreeOuter * (Math.PI / 180)) // prettier-ignore
  const endYOuter = centerY + outerRadius * Math.sin(adjustedEndDegreeOuter * (Math.PI / 180)) // prettier-ignore
  const largeArcFlagInner = adjustedEndDegreeInner - adjustedStartDegreeInner <= 180 ? '0' : '1' // prettier-ignore
  const largeArcFlagOuter = adjustedEndDegreeOuter - adjustedStartDegreeOuter <= 180 ? '0' : '1' // prettier-ignore
  const pathData = `
      M ${startXInner} ${startYInner}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlagInner} 1 ${endXInner} ${endYInner}
      L ${endXOuter} ${endYOuter}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlagOuter} 0 ${startXOuter} ${startYOuter}
      Z
    `

  // icon + text
  const adjustedStartDegree = startDegree + offsetDegree + gapAngle / 2
  const adjustedEndDegree = endDegree + offsetDegree - gapAngle / 2
  const midpointDegree = (adjustedStartDegree + adjustedEndDegree) / 2
  const verticalRadius = outerRadius - innerRadius
  const angularWidth = adjustedEndDegree - adjustedStartDegree
  const horizontalRadius = ((outerRadius + innerRadius) / 2) * Math.tan(((angularWidth / 2) * Math.PI) / 180) // prettier-ignore
  const squareSize = Math.min(verticalRadius, horizontalRadius * 2)
  const squareCenterRadius = (outerRadius + innerRadius) / 2
  const squareX = centerX + squareCenterRadius * Math.cos(midpointDegree * (Math.PI / 180)) // prettier-ignore
  const squareY = centerY + squareCenterRadius * Math.sin(midpointDegree * (Math.PI / 180)) // prettier-ignore
  const iconSize = 24
  const textSize = 14
  const gapSize = 8

  const click = () => {
    if (disabled) return
    onClick()
  }

  return (
    <g className={cls('radial-button', { disabled })} onClick={click}>
      <path d={pathData} fill='rgba(0, 0, 0, 0.5)' />
      {Icon && (
        <Icon
          size={iconSize}
          x={squareX - iconSize / 2}
          y={squareY - iconSize / 2 - textSize / 2 - gapSize / 2}
          width={iconSize}
          height={iconSize}
          stroke='currentColor'
        />
      )}
      {label && (
        <text
          x={squareX}
          y={squareY + iconSize / 2 + gapSize / 2}
          fill='currentColor'
          textAnchor='middle'
          alignmentBaseline='central'
          fontSize={textSize}
        >
          {label}
        </text>
      )}
      {/* <rect
          x={squareX - squareSize / 2}
          y={squareY - squareSize / 2}
          width={squareSize}
          height={squareSize}
          fill='rgba(255, 255, 255, 0.3)' // Semi-transparent for visibility
        /> */}
    </g>
  )
}
