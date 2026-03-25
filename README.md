# AI Character — React Native + Godot

A React Native app that embeds the Godot Engine to render an animated 3D character (Sophia) with real-time audio-driven lip sync.

## Features

- Godot 4 engine embedded in React Native via `@borndotcom/react-native-godot`
- Sophia 3D character with skeletal animation
- Mouth open/close via texture swap (no mesh deformation)
- Auto-blinking eyes using UV texture atlas
- Talking animation — two modes:
  - **Timer-based**: random mouth toggle at 0.1–0.2s intervals
  - **Audio-driven**: mouth follows real-time audio peak volume via `AudioServer`
- React Native → Godot bridge to trigger animations and voice lines
- Supports Android and iOS

## Project Structure

```
├── App.tsx                          # React Native entry point
├── character-project/               # Godot 4 source project
│   ├── player/sophia_skin/
│   │   ├── sophia_skin.gd           # Character controller script
│   │   ├── sophia_skin.tscn         # Character scene
│   │   └── model/
│   │       ├── sophia.glb           # 3D model
│   │       ├── sophia_mouth_smile_diffuse.png
│   │       ├── sophia_mouth_open_diffuse.png
│   │       ├── materials/
│   │       │   ├── mouth_mat.tres
│   │       │   └── eye_mat_override.tres
│   │       └── textures/
│   │           └── eyes_diffuse_map.png   # Eye atlas (open/closed)
│   └── assets/
│       └── test-audio.wav
├── android/
└── ios/
```

## Setup

### Prerequisites

- Node.js + Yarn
- Godot 4.x (to edit/export the character project)
- Android Studio + SDK (for Android)
- Xcode + Apple Developer account (for iOS)

### Install

```bash
yarn install
```

### iOS

```bash
cd ios && pod install && cd ..
yarn ios
```

### Android

```bash
yarn android
```

## Godot Character API

The `SophiaSkin` node exposes these methods callable from React Native:

| Method | Description |
|---|---|
| `idle()` | Play idle animation |
| `move()` | Play move animation |
| `jump()` | Play jump animation |
| `fall()` | Play fall animation |
| `edge_grab()` | Play edge grab animation |
| `wall_slide()` | Play wall slide animation |
| `talk()` | Start mouth animation (timer-based) |
| `stop_talk()` | Stop mouth animation |
| `talk_audio(path)` | Play audio + mouth animation (audio-driven) |
| `set_mouth_open(bool)` | Manually open/close mouth |
| `chat(message)` | Stream audio from server SSE endpoint + lip sync |

## Calling from React Native

```tsx
import { RTNGodot, runOnGodotThread } from '@borndotcom/react-native-godot';

runOnGodotThread(() => {
  'worklet';
  const Godot = RTNGodot.API();
  const root = Godot.Engine.get_main_loop().get_root();
  const sophiaSkin = root.get_node('Main/SophiaSkin');

  // Play animation
  sophiaSkin.call('idle');

  // Talk with audio (must be a res:// Godot resource path)
  sophiaSkin.call('talk_audio', 'res://assets/test-audio.wav');
});
```

## Chat Streaming (SSE Audio)

`chat(message)` connects to `POST /chat/audio` on the configured server and streams audio in real-time:

1. Opens an `HTTPClient` connection to `server_host:server_port` (default `localhost:3000`)
2. Parses SSE events: `data: <base64_pcm>\n\n`
3. Decodes base64 → raw 16-bit mono PCM at 22050 Hz
4. Pushes samples into an `AudioStreamGenerator` playback buffer
5. Lip sync runs automatically via `AudioServer` peak volume metering
6. When `data: [DONE]` is received, waits for the generator buffer to drain then stops

Configure the server address via `@export` vars (settable in the Godot editor):
```gdscript
@export var server_host := "localhost"  # use "10.0.2.2" for Android emulator
@export var server_port := 3000
```

Expected server SSE format:
```
data: <base64-encoded raw PCM chunk>\n\n
...
data: [DONE]\n\n
```
Audio spec: 22050 Hz, 16-bit signed little-endian, mono.

## How Lip Sync Works

1. `talk_audio(path)` loads the audio stream and plays it through a dedicated `VoiceBus`
2. `AudioEffectCapture` is attached to `VoiceBus` to enable peak metering on all platforms including mobile
3. Every frame, `_process()` reads `AudioServer.get_bus_peak_volume_left_db()`
4. Mouth opens when volume > `-30 dB`, closes otherwise
5. When audio ends, the `finished` signal calls `stop_talk()` automatically

Tune sensitivity in `sophia_skin.gd`:
```gdscript
const _OPEN_THRESHOLD_DB := -30.0  # lower = more sensitive
```

## Exporting the Godot Project

After editing `character-project/`, re-export for each platform using **Project → Export** in the Godot editor. Presets are already configured in `export_presets.cfg`.

| Platform | Output path |
|---|---|
| Android | `android/app/src/main/assets/GodotExample/` |
| iOS | `ios/GodotExample.pck` |
