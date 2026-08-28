# 3D Driving Portfolio — Design

**Date:** 2026-08-28
**Owner:** Muhammad Mubazar Qureshi
**Status:** Approved (approaches + scope + language decided in brainstorming)

## Purpose

An interactive 3D portfolio in the browser: the visitor drives a car around a
stylized procedural world and discovers the owner's work by driving into areas.
Inspired by bruno-simon.com, but built from scratch — no code, models, textures,
or sounds are copied from it. Bruno's MIT-licensed repository is used only as a
technique reference.

## Success criteria

1. A visitor lands on the page and is driving within a few seconds, with no
   instructions needed.
2. Every area's content comes from a data file, so adding a project is one
   object in an array.
3. Runs at 60fps on a mid-range desktop and stays usable on a phone.
4. Repository is light — the world is generated in code, not shipped as models.

## Decisions

| Area | Decision | Rationale |
|---|---|---|
| Renderer | Three.js `WebGPURenderer` via `three/webgpu` | Automatic WebGL fallback; one shader source for both backends; compute available for grass/particles |
| Shading | TSL (Three.js Shading Language) node materials | Same API as the reference implementation, so technique transfers directly |
| Physics | Rapier 3D (`@dimforge/rapier3d`, WASM) | Ships `DynamicRayCastVehicleController` — suspension, wheel friction and contacts for free |
| Build | Vite 7 + `vite-plugin-wasm` + `vite-plugin-top-level-await` | Required for Rapier's WASM module |
| Language | JavaScript (JSDoc where useful) | TSL's node API is loosely typed; TS would add casts without safety |
| Art | 100% procedural — parametric builders in code | No Blender dependency; every dimension is a tweakable number; tiny repo |
| Debug | Tweakpane panel behind `#debug` hash | Tune materials/physics/cycles live instead of editing constants |
| Audio | Howler.js (Phase 5) | Manual distance attenuation, same approach as reference |
| Deploy | Vercel static build (Phase 6) | Matches owner's existing stack |
| Multiplayer | Out of scope for v1 | Needs a backend, moderation and hosting cost; design leaves room for it |

## Architecture

A single `Game` singleton owns every subsystem. Subsystems reach each other via
`Game.getInstance()`. One `requestAnimationFrame` loop (driven by
`renderer.setAnimationLoop`) feeds a `Ticker` that dispatches a `tick` event to
priority-ordered listeners. Priorities are the contract that removes
frame-ordering bugs:

```
0    Time, Inputs
1    Player           input -> intent (accelerate / steer / brake / boost)
2    Vehicle pre      intent -> wheel steering, engine force, brake
3    PHYSICS STEP     Rapier world.step()
4    Objects          rigid body transforms -> Object3D transforms
5    Vehicle post     speed, wheel contacts, airborne, flip detection
7    View             follow camera
8    DayCycles, Weather, Zones
10   World systems    floor, grass, areas, particles
14   Audio, Notifications
998  Rendering
```

Rule: a system may only read state produced by a lower priority number in the
same frame.

## Components

### Core
- `Game` — singleton, owns and orders construction of everything
- `Ticker` — the single loop; `tick` events with numeric priority; exposes
  `elapsed`, `delta`, and matching TSL uniforms for shaders
- `Events` — tiny priority-aware emitter used by every subsystem
- `Viewport` — size and pixel ratio, throttled resize events
- `Debug` — Tweakpane panel, active only with `#debug` in the URL

### Input
- `Inputs` — aggregates sources, exposes named actions, not raw keys
- `Keyboard`, `Pointer`, `Touch` (Phase 6), `Gamepad` (Phase 6)

### Simulation
- `Physics` — Rapier world, collider/body factory, collision events
- `PhysicsVehicle` — chassis + 4 raycast wheels, suspension presets, boost,
  brake, reverse brake, stuck and flip detection
- `Objects` — registry syncing rigid bodies to visual objects
- `Player` — turns input actions into vehicle intent; owns respawn and stats

### Presentation
- `Rendering` — renderer setup, backend reporting, post-processing (Phase 2)
- `View` — follow camera with damping, drag-to-orbit, speed-based zoom
- `Materials/MeshStylizedMaterial` — the look: palette colour, flat core
  shadow, recoloured drop shadow, ground light bounce, fog, water line
- `Lighting`, `Fog`, `Terrain` (colour/data field sampled by materials)
- `World/*` — floor, grass, visual vehicle, particles
- `World/Areas/*` — one class per area, built from its data file

### Content
- `data/projects.js` — 4 flagship projects
- `data/lab.js` — 11 smaller client projects
- `data/career.js` — SeeBiz progression, teaching role, education, certificates
- `data/skills.js` — 9 skill categories
- `data/social.js` — email, LinkedIn, GitHub (no phone number)
- `data/world.js` — area placement and procedural parameters
- `data/achievements.js` — Phase 5

### Procedural art
`Builders/` holds pure functions returning `THREE.Group`s from parameters:
`building()`, `tree()`, `ramp()`, `road()`, `prop()`. Seeded randomness so the
world is identical on every load.

## World layout

```
        [ About / Skills ]        [ Projects ]
                     \              /
                      \            /
     [ Career ] ---- ( LANDING: spawn ) ---- [ Lab ]
                      /            \
                     /              \
        [ Stunt park ]            [ Contact ]
                      \            /
                     [ Race circuit ]
```

Areas are wide and open, connected by roads; nothing is gated. Driving into an
area reveals its content on billboards and via interactive points.

## Data flow

Input devices -> `Inputs` named actions -> `Player` intent -> `PhysicsVehicle`
wheel parameters -> Rapier step -> `Objects` sync -> `VisualVehicle` and `View`
-> `Rendering`. Content flows separately: `data/*.js` -> `Areas` at
construction time -> geometry and DOM overlays.

## Error handling

- WebGPU unavailable: `WebGPURenderer` falls back to WebGL automatically; the
  active backend is logged and exposed for the quality system.
- Rapier WASM fails to load: show a static fallback page with the same content
  as plain HTML, so the portfolio is never unreachable.
- Car stuck or upside down: automatic detection plus a manual respawn action.
- Low frame rate: quality system drops post-processing and density.

## Testing

This is a real-time graphical system, so the strategy is layered:
- Unit tests (Vitest) for pure logic: maths utilities, seeded randomness,
  builders' returned structure, data file shape, achievement progress rules.
- Manual verification per phase, driven by the debug panel and an on-screen
  stats readout (draw calls, triangles, frame time).
- A headless smoke test that boots the app and asserts no console errors and a
  non-zero draw-call count.

## Phases

| Phase | Deliverable |
|---|---|
| 1 | Scaffold, `Game` + ticker, Rapier vehicle, follow camera — a drivable car on a flat plane |
| 2 | `MeshStylizedMaterial`, palette, shadows, fog, post-processing — the look |
| 3 | Procedural builders, world layout, areas, interactive points, menu UI, real content |
| 4 | Day/night cycle and weather |
| 5 | Sound and achievements |
| 6 | Touch and gamepad input, quality levels, deploy |

## Out of scope for v1

Multiplayer whispers, online leaderboard, WebGPU compute grass (Phase 2 uses
vertex-shader grass), localisation, blog.

## Implementation notes

Added during Phase 1, where reality differed from the plan:

- `vite-plugin-top-level-await` is incompatible with current `@swc/core`
  ("missing field `type`" during `generateBundle`). Dropped in favour of
  `build.target: 'esnext'`, which lets the browser handle Rapier's top-level
  await natively. One less dependency.
- Chrome on Linux does not enable WebGPU by default, so local runs take the
  WebGL2 fallback unless started with `--enable-unsafe-webgpu
  --enable-features=Vulkan`. Both backends were measured at ~60fps on this
  machine, and the smoke test can target either.
- The smoke test measures progress in frames, not milliseconds. Headless
  software rendering runs at about 2fps, so a time-based test asserts only that
  nothing has happened yet.

Added during Phase 2:

- **Shadow colour is a multiplier, not a blend target.** Blending towards a
  saturated purple lands on grey for every green surface, which produced exactly
  the muddy look the stylised material exists to avoid. A pale lavender
  (`#9a95d8`) used as a multiply keeps each surface's hue and simply darkens and
  cools it.
- **Bloom is opt-in** (`#bloom`). Measured at 8fps on this machine for an effect
  that is barely visible against a flat, low-contrast palette. It should become
  a quality-system decision rather than always-on.
- **Grass wrapping uses a `fract`-based positive modulo**, not `mod()`. TSL's
  `mod` maps to backend operators whose behaviour for negative operands differs
  between WGSL and GLSL, and the wrap window straddles zero.
- **Blade height has to stay well under the wheel radius.** At 0.62 against a
  0.4 radius wheel the car looked like it was wading rather than driving. Now
  0.33.
- **Assertions must not sample only the final frame.** The car routinely ends a
  run against a tree (hiding its top speed) or having turned a full circle
  (hiding that it steered). The smoke test now samples every frame and asserts
  on top speed, peak steering angle and accumulated heading change.
- `receivedShadowNode` receives a value whose type varies, so it is read as
  `vec3(shadow).r` to work whether it arrives as a scalar or a colour.

### Known gaps after Phase 2

- Frame rate is 50-56fps on this machine, not a locked 60. The cost is spread
  across the shadow pass, 90,000 grass blades and ~420 objects; no single
  dominant cost was found beyond bloom, which is now off. The quality system in
  Phase 6 is where this gets addressed properly.
- The world is scenery only. Portfolio areas, content and UI are Phase 3.
