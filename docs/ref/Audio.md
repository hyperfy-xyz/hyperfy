# Audio

Represents a single audio clip that can be played in the world.

## Properties

### `.src`: String

An absolute url to an audio file, or an asset url from an audio file embedded in the app.

Currently only `mp3` files are supported.

### `.volume`: Number

The audio volume. Defaults to `1`.

### `.loop`: Boolean

Whether the audio should loop. Defaults to `false`.

### `.group`: Enum('music', 'sfx')

The type of audio being played. Choose `music` for ambient sounds or live event music etc. Choose `sfx` for short sound effects that happen throughout the world.

Users are able to adjust the global audio volume for these groups independently.

Defaults to `music`.

### `.spatial`: Boolean

Whether music should be played spatially and heard by people nearby. Defaults to `true`.

### `.distanceModel`: Enum('linear', 'inverse', 'expontential')

When spatial is enabled, the distance model to use. Defaults to `inverse`.

### `.refDistance`: Number

When spatial is enabled, the reference distance to use. Defaults to `1`.

### `.maxDistance`: Number

When spatial is enabled, the max distance to use. Defaults to `40`.

### `.rolloffFactor`: Number

When spatial is enabled, the rolloff factor to use. Defaults to `3`.

### `.coneInnerAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `.coneOuterAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `.coneOuterGain`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `0`.

### `.currentTime`: Number

Gets and sets the current playback time, in seconds.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

## Methods

### `.play()`

Plays the audio. 

NOTE: If no click gesture has ever happened within the world, playback won't begin until it has.

### `.pause()`

Pauses the audio, retaining the current time.

### `.stop()`

Stops the audio and resets the time back to zero.
