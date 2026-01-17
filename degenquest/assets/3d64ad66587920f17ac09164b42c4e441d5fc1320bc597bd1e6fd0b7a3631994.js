app.configure(() => {
  return [
    {
      key: 'sky',
      label: 'Sky',
      type: 'file',
      kind: 'texture',
      hint: 'The image to use as the background.',
    },
    {
      key: 'hdr',
      label: 'HDR',
      type: 'file',
      kind: 'hdr',
      hint: 'The HDRI to use for reflections and lighting.',
    },
    {
      key: 'rotationY',
      label: 'Rotation',
      type: 'number',
      step: 10,
      bigStep: 50,
    },
    {
      key: '002',
      type: 'section',
      label: 'Sun'
    },
    {
      key: 'horizontalRotation',
      label: 'Direction',
      type: 'number',
      min: 0,
      max: 360,
      step: 10,
      bigStep: 50,
      initial: 0,
      dp: 0,
      hint: 'The direction of the sun in degrees',
    },
    {
      key: 'verticalRotation',
      label: 'Elevation',
      type: 'number',
      min: 0,
      max: 360,
      step: 10,
      bigStep: 50,
      initial: 0,
      dp: 0,
      hint: 'The elevation of the sun in degrees',
    },
    {
      key: 'intensity',
      label: 'Intensity',
      type: 'number',
      min: 0,
      max: 10,
      step: 0.1,
      initial: 1,
      dp: 1,
    },
    {
      key: '003',
      type: 'section',
      label: 'Fog'
    },
    {
      key: 'fogColor',
      label: 'Color',
      type: 'text',
      hint: 'The fog color. Leave blank to disable fog' 
    },
    {
      key: 'fogNear',
      label: 'Near',
      type: 'number',
      dp: 0,
      min: 0,
      step: 10,
      initial: 0,
      hint: 'The near distance for fog in metres'
    },
    {
      key: 'fogFar',
      label: 'Far',
      type: 'number',
      dp: 0,
      min: 0,
      step: 10,
      initial: 1000,
      hint: 'The far distance for fog in metres'
    },
  ]
})

const sky = app.create('sky')

sky.bg = app.config.sky?.url
sky.hdr = app.config.hdr?.url
sky.rotationY = app.config.rotationY * -DEG2RAD

const sunDirection = calculateSunDirection(
  app.config.verticalRotation || 0,
  app.config.horizontalRotation || 0
)
sky.sunDirection = sunDirection
sky.sunIntensity = app.config.intensity

sky.fogNear = app.config.fogNear
sky.fogFar = app.config.fogFar
sky.fogColor = app.config.fogColor

app.add(sky)

function calculateSunDirection(verticalDegrees, horizontalDegrees) {
  const verticalRad = verticalDegrees * DEG2RAD
  const horizontalRad = horizontalDegrees * DEG2RAD
  const x = Math.sin(verticalRad) * Math.sin(horizontalRad)
  const y = -Math.cos(verticalRad) // Negative because 0° should point down
  const z = Math.sin(verticalRad) * Math.cos(horizontalRad)  
  return new Vector3(x, y, z)
}