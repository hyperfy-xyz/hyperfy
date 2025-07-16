// Example app demonstrating FOV manipulation
// This app shows how to control camera FOV through the app.control() API

export default {
	name: 'FOV Demo',
	version: '1.0.0',

	// App lifecycle
	start() {
		// Get control of the camera
		this.control = app.control()

		// Set initial FOV to 90 degrees (wide angle)
		this.control.camera.fov = 90
		this.control.camera.write = true

		// Log current FOV
		console.log('Current FOV:', this.control.camera.fov)

		// Set up keyboard controls for FOV adjustment
		this.control.keyF.onPress = () => {
			// Increase FOV (wider angle)
			this.control.camera.fov = Math.min(120, this.control.camera.fov + 10)
			console.log('FOV increased to:', this.control.camera.fov)
		}

		this.control.keyG.onPress = () => {
			// Decrease FOV (narrower angle)
			this.control.camera.fov = Math.max(30, this.control.camera.fov - 10)
			console.log('FOV decreased to:', this.control.camera.fov)
		}

		this.control.keyR.onPress = () => {
			// Reset to default FOV
			this.control.camera.fov = 70
			console.log('FOV reset to:', this.control.camera.fov)
		}

		// Display instructions
		app.chat('FOV Demo loaded! Press F to increase FOV, G to decrease, R to reset')
	},

	// Clean up when app is destroyed
	destroy() {
		if (this.control) {
			this.control.release()
		}
	}
} 