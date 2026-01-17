app.configure([
  {
    key: 'text',
    type: 'textarea',
    label: 'Text',
  },
  {
    key: 'size',
    type: 'number',
    label: 'Size',
    initial: 12,
  },
  {
    key: 'color',
    type: 'text',
    label: 'Color',
    initial: 'white',
  },
  {
    key: 'align',
    type: 'switch',
    label: 'Align',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
    initial: 'center',
  },
  {
    key: 'canvas',
    type: 'section',
    label: 'Canvas'
  },
  {
    key: 'width',
    type: 'number',
    label: 'Width',
    dp: 1,
    step: 1,
    bigStep: 10,
    initial: 100,
  },
  {
    key: 'height',
    type: 'number',
    label: 'Height',
    dp: 1,
    step: 1,
    bigStep: 10,
    initial: 100,
  },
  {
    key: 'bg',
    type: 'text',
    label: 'Background',
    initial: 'black',
  },
  {
    key: 'padding',
    type: 'number',
    label: 'Padding',
    initial: 10,
  },
  {
    key: 'lit',
    type: 'toggle',
    label: 'Lit',
  },
  {
    key: 'doubleside',
    type: 'toggle',
    label: 'Doubleside',
  },
])
app.keepActive = true

const text = props.text
const size = props.size
const color = props.color || 'white'
const align = props.align
const bg = props.bg
const width = props.width
const padding = props.padding
const height = props.height
const lit = props.lit
const doubleside = props.doubleside

const surface = app.get('Surface')
app.remove(surface)

const $ui = app.create('ui', {
  pivot: 'bottom-center',
  width,
  height,
  backgroundColor: bg,
  // alignItems: 'center',
  justifyContent: 'center',
  padding,
  lit,
  doubleside,
})
const $text = app.create('uitext', {
  value: text,
  fontSize: size,
  color,
  textAlign: align,
})
$ui.add($text)
app.add($ui)


