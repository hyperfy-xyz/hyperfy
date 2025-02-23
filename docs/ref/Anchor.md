# Anchor

For the most part, an anchor acts just like a group node.
But more importantly they can be used to attach players to them, eg for seating or vehicles.

When creating an anchor, be sure to give it a unique ID within your app to ensure that every client has the same ID for the player to be anchored to:

```jsx
const seat = app.create('anchor', { id: 'seat' })
car.add(seat)

// later...
control.setEffect({ anchor: seat })
```

## Properties

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

