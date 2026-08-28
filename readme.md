# Interactive 3D Portfolio

An interactive 3D portfolio: the visitor drives a car around a procedurally
generated world and discovers the work by exploring it.

Built from scratch — the world is generated in code, so there are no 3D model
files to author or ship.

## Stack

| Layer | Choice |
|---|---|
| Rendering | Three.js `WebGPURenderer` (`three/webgpu`), shaders written in TSL, automatic WebGL2 fallback |
| Physics | Rapier 3D (WASM), using its raycast vehicle controller |
| Build | Vite 7 with `vite-plugin-wasm`, `esnext` target for top-level await |
| Debug | Tweakpane, loaded only when the URL contains `#debug` |
| Tests | Vitest for pure logic, Playwright for a headless smoke test |

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
```

## Debug panel

Append `#debug` to the URL to load the Tweakpane panel and expose `window.game`
in the console. Tweakpane is dynamically imported, so it never ships to a
visitor.

## Testing

```bash
npm test            # unit tests (maths, seeded randomness)
npm run smoke       # headless Chrome, software rendering (~2fps, frame-based)
npm run smoke:gpu   # headed Chrome, real GPU, WebGL backend
npm run smoke:webgpu# headed Chrome, real GPU, WebGPU backend
```

The smoke test boots the app in real Chrome, waits for the car to settle on its
suspension, drives it, and asserts on measured state: draw calls, wheel contact,
suspension compression, distance travelled, steering and wheel spin. It counts
progress in frames rather than milliseconds, because software rendering runs at
roughly 2fps and a time-based test would only ever prove nothing had happened
yet.

## WebGPU on Linux

Chrome on Linux does not enable WebGPU by default. Without the flags the app
takes its WebGL2 fallback path, which is fully supported. To exercise the
WebGPU path locally:

```bash
google-chrome --enable-unsafe-webgpu --enable-features=Vulkan
```

Verified on this machine: WebGL backend 60fps, WebGPU backend 59.7fps.

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Drive |
| `Shift` | Boost |
| `Ctrl` / `B` | Brake |
| `R` | Respawn |
| `P` | Reset objects |
| Drag | Move camera |
| Wheel | Zoom |

## Structure

```
sources/
  index.js            entry
  index.html
  style/              plain CSS
  data/               portfolio content (projects, career, skills, social)
  Game/
    Game.js           singleton owning every subsystem
    Ticker.js         the single render loop, priority-ordered tick events
    Physics/          Rapier world and the vehicle
    World/            everything visible
    utilities/
docs/superpowers/specs/  design documents
tests/
```

Frame ordering is a contract: every subsystem registers its `tick` listener with
an explicit priority, and may only read state produced by a lower number in the
same frame. `readme` of the design doc lists the full order.
