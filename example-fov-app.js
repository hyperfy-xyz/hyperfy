// FOV Demo App
// Demonstrates camera FOV manipulation through direct camera access

// Configuration for the app
app.configure([
	{
		key: 'initialFov',
		type: 'number',
		label: 'Initial FOV',
		hint: 'Starting field of view in degrees (30-120)',
		min: 30,
		max: 120,
		initial: 70
	},
	{
		key: 'showUI',
		type: 'switch',
		label: 'Show UI',
		hint: 'Whether to show the FOV control UI',
		options: [
			{ label: 'Show', value: 'show', hint: 'Display FOV controls' },
			{ label: 'Hide', value: 'hide', hint: 'Hide FOV controls' }
		],
		initial: 'show'
	}
]);

app.keepActive = true;

// Variables to track state
let control, ui, fovText, currentFov;

// Initialize the app
if (world.isClient) {
	// Set initial FOV directly on camera
	currentFov = props.initialFov || 70;
	if (world.camera) {
		world.camera.fov = currentFov;
		world.camera.updateProjectionMatrix();
	}

	console.log('FOV Demo loaded! Current FOV:', currentFov);

	// Set up keyboard controls for FOV adjustment
	control = app.control();
	control.keyF.onPress = () => {
		currentFov = Math.min(120, currentFov + 10);
		if (world.camera) {
			world.camera.fov = currentFov;
			world.camera.updateProjectionMatrix();
		}
		console.log('FOV increased to:', currentFov);
		updateFovDisplay();
	};

	control.keyG.onPress = () => {
		currentFov = Math.max(30, currentFov - 10);
		if (world.camera) {
			world.camera.fov = currentFov;
			world.camera.updateProjectionMatrix();
		}
		console.log('FOV decreased to:', currentFov);
		updateFovDisplay();
	};

	control.keyR.onPress = () => {
		currentFov = 70;
		if (world.camera) {
			world.camera.fov = currentFov;
			world.camera.updateProjectionMatrix();
		}
		console.log('FOV reset to:', currentFov);
		updateFovDisplay();
	};

	// Create UI if enabled
	if (props.showUI === 'show') {
		createUI();
	}

	// Display instructions
	app.chat('FOV Demo loaded! Press F to increase FOV, G to decrease, R to reset');
}

// Create UI for FOV display and controls
function createUI() {
	// Create UI container
	ui = app.create('ui', {
		width: 200,
		height: 120,
		backgroundColor: 'rgba(0,15,30,0.9)',
		borderRadius: 8,
		padding: 10,
		justifyContent: 'center',
		gap: 8,
		alignItems: 'center'
	});
	ui.billboard = 'y'; // Face camera on Y-axis
	ui.position.set(0, 1, 0); // Position above app

	// Create FOV display text
	fovText = app.create('uitext', {
		value: `FOV: ${currentFov}°`,
		fontSize: 18,
		color: '#ffffff',
		textAlign: 'center'
	});

	// Create instructions text
	const instructionsText = app.create('uitext', {
		value: 'F: +10°\nG: -10°\nR: Reset',
		fontSize: 14,
		color: '#cccccc',
		textAlign: 'center'
	});

	// Add text to UI container
	ui.add(fovText);
	ui.add(instructionsText);

	// Add UI to app
	app.add(ui);
}

// Update FOV display
function updateFovDisplay() {
	if (fovText) {
		fovText.value = `FOV: ${currentFov}°`;
	}
}

// Update loop
app.on('update', () => {
	// Keep the app active and update FOV display
	if (fovText && world.camera) {
		// Update display with current FOV from camera
		const cameraFov = Math.round(world.camera.fov);
		if (cameraFov !== currentFov) {
			currentFov = cameraFov;
			updateFovDisplay();
		}
	}
});

// Clean up when app is destroyed
app.on('destroy', () => {
	if (control) {
		control.release();
	}
}); 