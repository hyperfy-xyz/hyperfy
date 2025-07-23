# Props

Apps can expose a list of custom UI fields allowing non-technical people to configure or change the way your apps work.

## Configure

To generate custom UI for your app, configure the fields at the top of your app's script like this:

```jsx
app.configure([
  {
    key: 'name',
    type: 'text',
    label: 'Name',
  }
])
```

The example above will create a text input for you to enter a name.

## Props

Apps have a global `props` variable for you to read back the values entered in custom fields.

```jsx
props.name
```

## Fields

### Text

A text input

```jsx
{
  type: 'text',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  placeholder: String,   // an optional placeholder displayed inside the input
  initial: String,       // the initial value to set if not configured
}
```

### Textarea

A multi-line textarea input

```jsx
{
  type: 'textarea',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  placeholder: String,   // an optional placeholder displayed inside the input
  initial: String,       // the initial value to set if not configured
}
```

### Number

A number input. Also supports math entry and up/down stepping.

```jsx
{
  type: 'number',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  dp: Number,            // the number of decimal places allowed (default = 0)
  min: Number,           // the minimum value allowed (default = -Infinity)
  max: Number,           // the maximum value allowed (default = Infinity)
  step: Number,          // the amount incremented/decrement when pressing up/down arrows (default = 1)
  initial: Number,       // the initial value to set if not configured (default = 0)
}
```

### Range

A range slider input

```jsx
{
  type: 'range',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the slider
  min: Number,           // the minimum value allowed (default = 0)
  max: Number,           // the maximum value allowed (default = 1)
  step: Number,          // the step amount when sliding (default= 0.05)
  initial: Number,       // the initial value to set if not configured (default = 0)
}
```

### Toggle

A boolean toggle field

```jsx
{
  type: 'toggle',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  trueLabel: String,     // optional, defaults to "Yes"
  falseLabel: String,    // optional, defaults to "No"
  initial: String,       // the initial value to set if not configured
}
```

### Switch

A switch field with many options

```jsx
{
  type: 'switch',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  options: [
    {
      label: String,     // the label to show on this switch item
      value: String,     // the value to set on the props when selected
    }
  ],
  initial: String,       // the initial value to set if not configured
}
```

### File

A file field for selecting and uploading additional assets that can be used by your app.

```jsx
{
  type: 'file',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  kind: String,          // the kind of file, must be one of: avatar, emote, model, texture, hdr, audio
}
```

Note that the value set on props is an object that looks like this:

```jsx
{
  type: String,         // the type of file (avatar, emote, model, texture, hdr, audio)
  name: String,         // the original files name
  url: String,          // the url to the file
}
```

The type of file you collect depends on how you would use it. For example you can use audio files with an audio node:

```jsx
const audio = app.create('audio', {
  src: props.audio?.url
})
audio.play()
```

### Button

Displays a button that when clicked, executes something in the running app.

```jsx
{
  type: 'button',
  key: String,           // a unique `key` for this button
  label: String,         // the label for the button
  onClick: Function,
}
```