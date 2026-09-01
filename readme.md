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

## URL switches

| Hash | Effect |
|---|---|
| `#debug` | Tweakpane panel, and `window.game` in the console. Tweakpane is dynamically imported, so it never ships to a visitor. |
| `#quality=low` / `#quality=high` | Overrides the automatic preset. Low thins the grass, halves the shadow map and reduces scenery — it is what mobile and the headless tests use. |
| `#bloom` | Enables bloom. Off by default: measured at 8fps for an effect that is barely visible against a flat palette. |

Combine them with `&`, e.g. `#debug&quality=low`.

## The look

The whole visual identity lives in one material,
`Game/Materials/MeshStylizedMaterial.js`. It extends `MeshLambertNodeMaterial`
only to inherit the shadow plumbing, then replaces the output entirely:

1. **Light bounce** — undersides pick up the colour of the ground below them
2. **Sun** — a flat multiply, no distance falloff
3. **Core shadow** — a hard terminator from the surface normal against the sun
4. **Drop shadow** — the real shadow map, captured through `receivedShadowNode`
   and applied as a colour shift rather than a darkening multiply
5. **Fog** — a distance blend towards the sky colour

Steps 3 and 4 share one shadow colour, which is why lit and shadowed faces read
as the same material. That colour is a pale lavender used as a **multiplier**,
not a colour to blend towards: blending green towards saturated purple lands on
grey, which is the muddy look the material exists to avoid.

Every colour in the world comes from `data/palette.js`. Nothing else hardcodes
one.

## Areas

A portfolio area is a ring of landmarks with one side left open, so the visitor
drives in through the gap instead of around the outside. `Projects` is the first
one: `data/world.js` says where the plaza is, `data/projects.js` says what is in
it, and `arrangeOnArc` derives every building's position and facing from its
index. **Adding a project is one object in `data/projects.js`** — the ring
re-spaces itself and a zone is registered for the new entry.

The buildings themselves are parametric. `Builders/building.js` takes `floors`,
`width`, `depth` and a roof style and returns one merged geometry per material,
so the whole plaza costs three draw calls. Nothing about a project's shape is
authored by hand.

`Zones.js` decides which card is on screen. Two rules, both there because of how
the card behaves rather than how the geometry does:

- **Nearest wins**, so "one card at a time" is true by construction rather than
  bookkeeping the card has to do.
- **Hysteresis** — a zone is entered at its radius but only left past
  `radius x 1.25`. Driving along a boundary otherwise flips the card on and off
  every few frames.

The card is DOM, not a texture. Body text baked into a canvas is unreadable at
driving distance and impossible to tap on a phone, and a link has to be a real
link. The world stays 3D; only the words are HTML.

Discovery needs no signposting: the plaza sits 87 units from spawn and its
buildings are 10 to 23 units tall, so with fog at `near 55 / far 190` they read
as a silhouette on the horizon from the spawn point. Moving the plaza means
re-checking that against `Game/Fog.js`.

## Testing

```bash
npm test                # unit tests (maths, damping, seeded randomness)
npm run smoke           # headed Chrome, real GPU, WebGL backend — the practical default
npm run smoke:webgpu    # headed Chrome, real GPU, WebGPU backend
npm run smoke:headless  # software rendering; forces #quality=low and is still slow
```

The smoke test boots the app in real Chrome, waits for the car to settle on its
suspension, drives it, and asserts on measured state: console cleanliness, draw
calls, wheel contact, suspension compression, distance travelled, top speed,
peak steering angle, accumulated heading change and wheel spin. It then puts the
car in a project's zone and asserts the card appears, is filled in, and clears
again on leaving.

Two things it does deliberately:

- **Counts progress in frames, not milliseconds.** Software rendering runs at
  roughly 2fps, so a time-based test would only ever prove that nothing had
  happened yet.
- **Samples every frame rather than reading the final one.** The car routinely
  ends a run against a tree, which hides its top speed, or having turned a full
  circle, which hides that it steered at all.

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
  index.js              entry
  index.html
  style/                plain CSS
  data/
    palette.js          every colour in the world
    world.js            where the areas sit and how big they are
    projects.js         the projects, content and building shape
    validateProjects.js fails loudly on malformed project data
  Game/
    Game.js             singleton owning every subsystem
    Ticker.js           the single render loop, priority-ordered tick events
    Quality.js          how much work the renderer may do
    Lighting.js         sun uniforms, plus a real light for the shadow map
    Fog.js              distance fog, applied by the materials
    Materials.js        shared material registry
    Zones.js            proximity registry; emits enter and leave
    Materials/
      MeshStylizedMaterial.js   the look, in one file
    Builders/           parametric geometry (vegetation, wedge, building, sign)
    Physics/            Rapier world and the raycast vehicle
    World/              everything visible: sky, ground, grass, scenery, car
    World/Areas/        one class per portfolio area
    Interface/          the DOM that reacts to the world
    Inputs/             devices mapped to named actions
    utilities/
docs/superpowers/specs/   design documents
tests/
```

The world is generated, not authored: `Builders/` returns geometry from
parameters and `World/Scenery.js` places it with seeded randomness, so the world
is identical on every load and a change of layout is a change of numbers.

Frame ordering is a contract: every subsystem registers its `tick` listener with
an explicit priority, and may only read state produced by a lower number in the
same frame. `readme` of the design doc lists the full order.
