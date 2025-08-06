# Props/Fields System Architecture

This document explains how the props/fields system in Hyperfy connects app scripts, core systems, and UI components to provide configurable parameters for apps.

## Overview

The props/fields system allows app developers to expose configurable UI fields that users can interact with to customize app behavior without writing code. The system follows a unidirectional data flow pattern.

## Core Components

### 1. Script Definition (`prim-switcher.js` and other app scripts)
Apps define their configurable fields using `app.configure()`:

```javascript
app.configure([
  {
    type: 'switch',      // Field type
    key: 'primType',     // Property key in props object
    label: 'Primitive Type',
    options: [
      { label: 'Box', value: 'box' },
      { label: 'Sphere', value: 'sphere' }
    ],
    initial: 'box'       // Default value
  }
])
```

### 2. Core System (`src/core/systems/Apps.js`)
The Apps system processes field configurations:
- Stores field definitions in `entity.fields` when `app.configure()` is called
- Applies initial values to `blueprint.props` if not already set
- Manages callbacks for field updates via `entity.onFields`

### 3. Entity State (`src/core/entities/App.js`)
The App entity maintains:
- `fields`: Array of field definitions from `app.configure()`
- `onFields`: Callback function for notifying UI of field changes

### 4. UI Controller (`src/client/components/MenuApp.js`)
Connects the core system to UI components:
- Subscribes to field updates via `app.onFields`
- Maps field definitions to appropriate UI components
- Handles prop modifications and blueprint updates

### 5. UI Components (`src/client/components/Fields.js`)
Individual field components that:
- Render appropriate input controls based on field type
- Handle local state for immediate UI feedback
- Trigger updates on blur/commit

## Data Flow

```
1. Script defines fields via app.configure()
        ↓
2. Apps system stores in entity.fields
        ↓
3. Initial values applied to blueprint.props
        ↓
4. MenuApp subscribes to field updates
        ↓
5. Fields component renders UI inputs
        ↓
6. User interacts with UI
        ↓
7. onChange triggers blueprint modification
        ↓
8. Blueprint rebuild + network sync
        ↓
9. All apps using blueprint are updated
```

## Blueprint Structure

Blueprints store the app configuration including user-set prop values:

```javascript
{
  id: "uuid",
  name: "App Name",
  model: "asset://model.glb",
  script: "asset://script.js",
  props: {
    // User-configured values
    primType: 'box',
    scaleX: 1.5,
    color: '#ff0000'
  },
  // ... other metadata
}
```

## Available Field Types

1. **text** - Single-line text input
2. **textarea** - Multi-line text input
3. **number** - Numeric input with math expression support
4. **range** - Slider with min/max/step
5. **toggle** - Boolean yes/no switch
6. **switch** - Multiple choice selector
7. **file** - Asset upload (models, textures, audio, etc.)
8. **curve** - Animation curve editor
9. **vec3** - 3D vector input (x, y, z)
10. **button** - Action trigger button

## Adding a New Field Type

To add a new field type:

1. **Create the UI component** in `Fields.js`:
   ```javascript
   function FieldCustom({ value, onChange }) {
     // Implement your custom field UI
   }
   ```

2. **Add to the switch statement** in `Fields.js`:
   ```javascript
   case 'custom':
     return <FieldCustom {...commonProps} />
   ```

3. **Define the field** in your app script:
   ```javascript
   app.configure([
     {
       type: 'custom',
       key: 'myCustomProp',
       label: 'Custom Field',
       initial: defaultValue
     }
   ])
   ```

## Key Implementation Details

### Local State Management
Field components maintain local state for immediate UI feedback:
```javascript
const [localValue, setLocalValue] = useState(value)
// Update local state immediately, commit on blur
```

### Blueprint Modification
Updates flow through the blueprint system:
```javascript
const modify = (key, value) => {
  blueprint.props[key] = value
  world.blueprints.modify(world.getBlueprint(blueprint))
}
```

### Network Synchronization
Blueprint modifications are broadcast to all clients:
- `blueprintModified` packets sync changes
- All apps using the modified blueprint are rebuilt
- Props persist across sessions via blueprint storage

## Props Access in Scripts

Scripts access configured values via the global `props` object:
```javascript
// In app script
const color = props.color || '#ffffff'
const scale = props.scale || 1
```

## Best Practices

1. **Always provide initial values** - Ensures predictable behavior
2. **Use appropriate field types** - Better UX and validation
3. **Keep keys consistent** - Changing keys breaks existing configurations
4. **Document prop usage** - Help users understand what each field does
5. **Validate in scripts** - Don't assume prop values are always valid

## Example: Complete Flow

1. **Script Definition**:
   ```javascript
   app.configure([
     { type: 'text', key: 'message', label: 'Message', initial: 'Hello World' }
   ])
   ```

2. **UI Renders**:
   - MenuApp reads field definition
   - Renders FieldText component
   - Shows current value from blueprint.props.message

3. **User Types**:
   - FieldText updates local state
   - On blur: calls onChange('New Message')

4. **State Updates**:
   - MenuApp modifies blueprint
   - Triggers rebuild of all apps using this blueprint
   - Syncs to server and other clients

5. **Script Uses Value**:
   ```javascript
   const message = props.message // 'New Message'
   ```

This architecture provides a clean separation of concerns while maintaining real-time synchronization across all connected clients.