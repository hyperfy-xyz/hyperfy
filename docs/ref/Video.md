# Video

Renders a video into the world, either on a simple plane or onto geometry.

## Properties

### `.src`: String

A url to a video file, or an asset url from a video prop.

Currently only `mp4` and `m3u8` (HLS streams) are supported.

### `.linked`: Number|String

By default, videos are not linked and each node spawns a new video player with its own state and control.

If you plan to show a video multiple times throughout the world and require the state and controls to be synchronized, you can set this property to `true` or use a string ID to link video nodes together. This is allows you to have potentially hundreds of instances of a single video playing within the world all with individual audio emitters with very little overhead.

### `.loop`: Boolean

Whether the video should loop. Defaults to `false`.

### `.visible`: Boolean

Whether the video should be displayed. Defaults to `true`.

This can be used if you just want to play audio headlessly with more control over the audio position.

### `.color`: String

The color of the mesh before the video is playing. Defaults to `black`.

### `.lit`: Boolean

Whether the mesh material is lit (reacts to lighting) or not. Defaults to `false`.

### `.doubleside`: Boolean

Whether the video should play on both sides of the plane. Does not apply to custom geometry. Defaults to `true`.

### `.castShadow`: Boolean

Whether the mesh should cast a shadow. Defaults to `false`.

### `.receiveShadow`: Boolean

Whether the video should receive shadows. Defaults to `false`.

### `.aspect`: Number

The aspect ratio. 

When using a video plane (eg not using the `.geometry` property) before the video loads this aspect ratio will be used to calculate any `width` or `height` values that are set to null in order to maintain the correct pre-video aspect ratio of the plane. Once the video is playing the video's actual aspect ratio will take over and re-calculate any missing `width` or `height` values set to null and resize itself to maintain the videos aspect ratio.

When using custom geometry, you should set this to the physical/visual aspect ratio of the geometry you are projecting onto. If your geometry is a curved 16:9 aspect ratio screen, you would set this value to `16 / 9` or `1.777`. If you are making a 360 sphere your aspect ratio should be `2 / 1` as most 360 videos use an aspect ratio of 2:1

This may be slightly confusing but when set up correctly it allows you to swap and play any video with any dimensions and it will display correctly without stretching or distortion.

NOTE: UV's for custom geometry should generally stretch to take up the entire 0,0 -> 1,1 UV texture area, we then use your provided `aspect` value to scale and offset the video.

### `.fit`: Enum("none", "contain", "cover")

The resize strategy for fitting the video onto its surface. `contain` will shrink the video until it is entirely visible. `cover` will expand the video until it covers the entire surface. `none` will apply no logic and preserve existing UVs.

Defaults to `contain`.

### `.width`: Number|null

The fixed width of the plane when not using a custom geometry. Can be set to `null` to be automatic. When automatic, the width will match the `.ratio` value until the video begins playback and will then resize to match the video dimensions. Defaults to `null`.

### `.height`: Number|null

The fixed height of the plane when not using a custom geometry. Can be set to `null` to be automatic. When automatic, the height will match the `.ratio` value until the video begins playback and will then resize to match the video dimensions. Defaults to `null`.

### `.geometry`: Geometry

The custom geometry to use instead of a plane. Geometry can be extracted from a `Mesh` node's `.geometry` property.

### `.volume`: Number

The volume of the videos audio. Defaults to `1`.

### `.group`: String

The audio group this music belongs to. Players can adjust the volume of these groups individually. Must be `music` or `sfx` (`voice` not allowed). Defaults to `music`.

### `.spatial`: Boolean

Whether music should be played spatially and heard by players nearby. Defaults to `true`.

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

### `.isPlaying`: Boolean

Whether the video is currently playing. Read-only.

### `.currentTime`: Number

The current time of the video. Can be used to read and update the current time of the video.

### `.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

## Methods

### `.play()`

Plays the audio. 

### `.pause()`

Pauses the audio, retaining the current time.

### `.stop()`

Stops the audio and resets the time back to zero.
