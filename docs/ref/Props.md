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

A text input.

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

A multi-line textarea input.

```jsx
{
  type: 'textarea',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the textarea input
  placeholder: String,   // an optional placeholder displayed inside the textarea
  initial: String,       // the initial value to set if not configured
}
```

### Number

A number input. Also supports math entry and up/down stepping.

```jsx
{
  type: 'number',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the number input
  dp: Number,            // the number of decimal places allowed (default = 0)
  min: Number,           // the minimum value allowed (default = -Infinity)
  max: Number,           // the maximum value allowed (default = Infinity)
  step: Number,          // the amount incremented/decrement when pressing up/down arrows (default = 1)
  initial: Number,       // the initial value to set if not configured (default = 0)
}
```

### Range

A range slider input.

```jsx
{
  type: 'range',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the slider
  min: Number,           // the minimum value allowed (default = 0)
  max: Number,           // the maximum value allowed (default = 1)
  step: Number,          // the step amount when sliding (default = 0.05)
  initial: Number,       // the initial value to set if not configured (default = 0)
}
```

### Switch

A switch input.

```jsx
{
  type: 'switch',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the switch input
  options: [
    {
      label: String,     // the label to show on this switch item
      value: String,     // the value to set on `props` when selected
    }
  ],
  initial: String,       // the initial value to set if not configured
}
```

### Dropdown

A dropdown menu.

```jsx
{
  type: 'dropdown',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the dropdown
  options: [
    {
      label: String,     // the label to show on this item
      value: String,     // the value to set on `props` when selected
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
  label: String,         // the label for the file input
  kind: String,          // the kind of file, must be one of: avatar, emote, model, texture, hdr, audio
}
```

The value set on `props` is an object that looks like this:

```jsx
{
  type: String,         // the type of file (avatar, emote, model, texture, hdr, audio)
  name: String,         // the original file's name
  url: String,          // the URL to the file
}
```

For example, you can use an audio file like this:

```jsx
const audio = app.create('audio', {
  src: props.audio?.url
})
audio.play()
```

### Section

A simple section header to help group fields together.

```jsx
{
  type: 'section',
  key: String,           // a unique key to represent this section
  label: String,         // the label for the section header
}
```

### Buttons

Displays one or more buttons that, when clicked, execute something in the running app.

```jsx
{
  type: 'buttons',
  key: String,           // a unique key for this button group
  label: String,         // the label for the buttons
  buttons: [
    {
      label: String,     // the label to show on the button
      onClick: Function, // the function to execute when clicked
    },
    // ... additional buttons if needed
  ]
}
```

---

## Advanced Field Types

In addition to the basic field types above, you can also create more complex configurations:

### Array (Text Array)

An array input for editing multiple text entries. This renders a list of text inputs, one for each element of the array.

```jsx
{
  type: 'array',
  key: String,            // the key on `props` to set this value
  label: String,          // the label for the array input
  placeholder: String,    // an optional placeholder for each text input
  initial: Array[String]  // the initial value (default is an empty array)
}
```

### Array File

An array input for selecting and uploading multiple files. This renders a list of file inputs, similar to the single File field.

```jsx
{
  type: 'arrayFile',
  key: String,            // the key on `props` to set this value
  label: String,          // the label for the file inputs
  kind: String,           // the kind of file, e.g., avatar, emote, model, texture, hdr, audio
  initial: Array         // the initial value (default is an empty array)
}
```

The value for each file is an object structured like the single File field.

### Array Number

An array input for editing multiple numbers. This renders a list of number inputs for each element in the array.

```jsx
{
  type: 'arrayNumber',
  key: String,            // the key on `props` to set this value
  label: String,          // the label for the array input
  dp: Number,             // the number of decimal places allowed
  min: Number,            // the minimum value allowed
  max: Number,            // the maximum value allowed
  step: Number,           // the increment/decrement step value
  initial: Array[Number]  // the initial value (default is an empty array)
}
```

### Vector3

A vector input for editing a 3D vector. This renders three number inputs—one each for `x`, `y`, and `z`.

```jsx
{
  type: 'vector3',
  key: String,                     // the key on `props` to set this value
  label: String,                   // the label for the vector input
  dp: Number,                      // the number of decimal places allowed for each component
  min: Number,                     // the minimum value allowed for each component
  max: Number,                     // the maximum value allowed for each component
  step: Number,                    // the increment/decrement step value
  initial: { x: Number, y: Number, z: Number }  // the initial vector value (default is { x: 0, y: 0, z: 0 })
}
```

You can then access the components as `props.position.x`, `props.position.y`, and `props.position.z`.

### Array Range

An array input for editing multiple range values. This renders a list of range sliders for each element of the array.

```jsx
{
  type: 'arrayRange',
  key: String,            // the key on `props` to set this value
  label: String,          // the label for the array input
  min: Number,            // the minimum value for each slider (default = 0)
  max: Number,            // the maximum value for each slider (default = 1)
  step: Number,           // the step amount when sliding (default = 0.05)
  initial: Number         // the initial value (default is an empty array)
}
```

Each slider value in the array will correspond to one element in `props`.