# Controller

A controller manages user interactions and orchestrates the behavior of entities and components within the world. 
It handles input events, executes actions based on those inputs, and ensures smooth and responsive experiences for users.

## Properties

### `.type`: String

Specifies the type of controller. Common types include `input`, `camera`, and `AI`. Defaults to `input`.

### `.active`: Boolean

Determines whether the controller is currently active and processing inputs. Defaults to `true`.

### `.target`: Node

The node that the controller is managing or controlling.

### `.sensitivity`: Number

Adjusts the sensitivity of input handling. Higher values increase responsiveness. Defaults to `1.0`.

### `.bindings`: Object

Maps user inputs to specific actions or commands.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

## Methods

### `.initialize()`

Initializes the controller, setting up necessary event listeners and configurations.

### `.update(deltaTime)`

Updates the controller's state based on elapsed time and inputs. Should be called every frame.

### `.shutdown()`

Cleans up the controller by removing event listeners and freeing resources. 