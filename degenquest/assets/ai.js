app.remove(app.get('Block'))

app.configure([
  {
    key: 'prompt',
    type: 'text',
    label: 'Prompt',
    hidden: true,
  },
  {
    key: 'createdAt',
    type: 'number',
    label: 'Created At',
    hidden: true,
  },
])

if (world.isServer) return

const $ui = app.create('ui', {
  width: 200,
  height: 200,
  size: 0.01,
  position: [0, 1, 0],
  billboard: 'y',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: [0, 0, 2, 0],
})
const $bubble = app.create('uiview', {
  backgroundColor: 'rgba(0,0,0,0.95)',
  borderRadius: 16,
  padding: 16,
})
let prompt = app.config.prompt
if (prompt.length > 100) prompt = prompt.slice(0, 100) + '...'
const $text = app.create('uitext', {
  value: prompt,
  fontSize: 14,
  fontWeight: 400,
  color: 'white',
  textAlign: 'center',
  margin: [0, 0, 10, 0],
})
const $time = app.create('uitext', {
  value: '4s',
  fontSize: 10,
  fontWeight: 200,
  color: 'rgba(255,255,255,0.6)',
  textAlign: 'center',
})
$ui.add($bubble)
$bubble.add($text)
$bubble.add($time)
const $line = app.create('uiview', {
  width: 1,
  backgroundColor: 'white',
  flexGrow: 1,
})
const $dot = app.create('uiview', {
  width: 5,
  height: 5,
  borderRadius: 10,
  backgroundColor: 'black',
})
$ui.add($line)
$ui.add($dot)
app.add($ui)

const createdAt = app.config.createdAt
app.on('update', () => {
  const elapsed = world.getTime() - createdAt
  $time.value = elapsed.toFixed(0) + 's'
})
