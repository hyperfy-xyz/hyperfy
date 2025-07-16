import { useEffect, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { Menu, MenuItemBtn, MenuItemNumber } from './Menu'

export function ContextMenu({ world, visible, position, onClose }) {
	const [fov, setFov] = useState(world?.camera?.fov || 70)
	const menuRef = useRef()

	useEffect(() => {
		if (visible && world?.camera) {
			setFov(world.camera.fov)
		}
	}, [visible, world?.camera?.fov])

	useEffect(() => {
		if (!visible) return

		const handleClickOutside = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target)) {
				onClose()
			}
		}

		const handleEscape = (e) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleEscape)

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [visible, onClose])

	if (!visible || !world) return null

	const handleFovChange = (newFov) => {
		setFov(newFov)
		if (world.camera) {
			world.camera.fov = newFov
			world.camera.updateProjectionMatrix()
			// Trigger graphics system to recalculate worldToScreenFactor
			world.graphics?.preTick()
		}
	}

	const resetFov = () => {
		handleFovChange(70)
	}

	return (
		<div
			ref={menuRef}
			className="context-menu"
			css={css`
        position: fixed;
        top: ${position.y}px;
        left: ${position.x}px;
        z-index: 1000;
        pointer-events: auto;
      `}
		>
			<Menu title="Camera Settings" blur={false}>
				<MenuItemNumber
					label="Field of View"
					hint="Adjust the camera's field of view (30-120 degrees)"
					min={30}
					max={120}
					step={1}
					value={fov}
					onChange={handleFovChange}
				/>
				<MenuItemBtn
					label="Reset to Default"
					hint="Reset FOV to default 70 degrees"
					onClick={resetFov}
				/>
			</Menu>
		</div>
	)
} 