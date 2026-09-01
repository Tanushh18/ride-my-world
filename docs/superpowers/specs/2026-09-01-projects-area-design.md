# Projects Area — Design

**Date:** 2026-09-01
**Owner:** Muhammad Mubazar Qureshi
**Status:** Approved (approach A, presentation, landmark form and card depth decided in brainstorming)
**Parent:** [3D Driving Portfolio](2026-08-28-3d-driving-portfolio-design.md) — Phase 3, first slice

## Purpose

Turn the world from scenery into a portfolio by building **one** area end to
end: the visitor drives north-east, finds a plaza of buildings, and each
building announces a project as the car approaches it.

This slice is deliberately one area, not all seven. Once the pattern works,
every remaining area is a variation on it, and adding a project is one object
in an array.

## Success criteria

1. From the spawn point the plaza is visible on the horizon, and no instruction
   is needed to go there.
2. Driving near a building shows that project's card; driving away hides it.
   Only ever one card at a time, and it never flickers on a boundary.
3. Adding a fifth project is one object in `data/projects.js` — no geometry
   code, no placement maths, no new class.
4. The plaza costs a handful of draw calls and does not move the frame rate.
5. The card is readable and its links are clickable, on desktop and on a phone.

## Decisions

| Area | Decision | Rationale |
|---|---|---|
| Presentation | 3D landmark plus a DOM card on approach | The world stays 3D; the text stays sharp and the links stay clickable. Canvas-texture body text would be unreadable at driving distance and impossible on a phone |
| Landmark form | One parametric `building()` builder driven by project data | A fifth project is a data change, not a code change — the parent spec's criterion #2 |
| Card depth | Title, role, year, 2-3 lines, tech tags, links | Enough for a recruiter without covering the screen or stopping the car |
| Abstraction | Concrete `ProjectsArea`, general `Zones` | `Zones`' interface is already known and already in the parent spec's frame contract at priority 8. An `Area` base class designed from one example would almost certainly be wrong for Career (a timeline), Contact (a form) and the race circuit (lap timing) |
| Discovery | Tall buildings visible through the fog | Fog is `near: 55`, `far: 190`; a 13-unit building at 87 units reads as a clear silhouette. A road network connects *all* areas and belongs with the full Phase 3 layout, not with one area |
| Placement source | `data/world.js` positions the area; `data/projects.js` holds content | Buildings are arranged from their index, so placement is derived rather than authored per project |
| Text on signs | Canvas texture through `colorNode` | `MeshStylizedMaterial` already takes a `colorNode`; the ground uses one. Lets a building be identified before its card appears |

## Architecture

Three new units, each with one purpose, plus two data files.

```
data/world.js            where the area sits and how wide it is
data/projects.js         the four projects: content plus building shape

Game/Builders/building.js    parameters -> geometry + collider footprint
Game/Builders/sign.js        a string -> a canvas-textured board
Game/utilities/arrangement.js  count + centre + arc -> positions and facings

Game/Zones.js                proximity registry; emits enter / leave
Game/World/Areas/ProjectsArea.js   reads data, places buildings, registers zones
Game/Interface/ProjectCard.js      listens to zones, fills the DOM card
```

### Frame ordering

Two new entries in the contract from the parent spec, both already reserved
there:

```
5    Vehicle post     writes physicsVehicle.position
8    Zones            reads that position, resolves the active zone
14   ProjectCard      reads the active zone, updates the DOM
```

`Zones` may only read state produced below 8; `ProjectCard` only reads what
`Zones` produced this frame. Neither writes anything the other reads back.

## Components

### `data/world.js`

```js
export default {
    projectsArea: {
        center: { x: 62, z: -62 },
        ringRadius: 26,
        entranceFacing: Math.PI * 0.75,  // the bearing back towards spawn
        spread: Math.PI * 1.1,           // arc the buildings occupy
        zoneRadius: 11,
        zoneHysteresis: 1.25,
        clearingRadius: 40
    }
}
```

`clearingRadius` is appended to `Scenery`'s reserved list so trees do not grow
inside the buildings. `Scenery` currently hardcodes its clearings; it gains one
entry read from here, and nothing else about it changes.

### `data/projects.js`

An array. Each entry:

```js
{
    id: 'kebab-case-unique',
    title: 'Project name',
    role: 'Lead engineer',
    year: '2024',
    description: 'Two or three sentences.',
    tags: [ 'React', 'Node', 'Postgres' ],
    links: [ { label: 'Live', url: '…' } ],
    building: {
        floors: 4,          // 2-6, drives height
        width: 7,
        depth: 6,
        roof: 'flat',       // flat | pitched | stepped
        accent: 'accent'    // a palette key
    }
}
```

Content is authored; a malformed entry is a bug, not user input, so the area
validates on construction and throws with the offending id and field — the same
loud failure `Materials.get()` already uses. The app's existing failure page
catches it.

**The four entries ship as placeholders.** The owner replaces the text; the
shape and the pipeline are what this slice delivers.

### `Builders/building.js`

`buildBuilding(parameters)` returns geometry merged per material, following
`vegetation.js`: everything non-indexed with recomputed normals, so surfaces
are faceted and read as deliberate.

```js
{
    parts: { concrete, glass, accent },   // one BufferGeometry each
    height,                                // total, for placing the sign
    footprint: { width, depth },           // what the collider uses
}
```

Composition, all derived from `floors`, `width`, `depth`, `roof`, `accent`:

- **Body** — a rounded box, `floors × 3.2` tall
- **Window bands** — one thin inset box per floor per long face, in `carGlass`
- **Roof** — `flat` a slab, `pitched` a wedge reusing `buildWedge`, `stepped` a
  smaller box set back on top
- **Entrance** — a door recess and an awning in the accent colour, on the face
  that will point at the plaza centre

The builder knows nothing about projects, palettes or the scene. It takes
numbers and returns geometry.

### `Builders/sign.js`

`buildSign(text, width, height)` draws the text to a 2D canvas and returns
`{ geometry, texture }`. `ProjectsArea` wraps it in a `MeshStylizedMaterial`
with the texture as its `colorNode`. One sign per building, above the entrance,
facing the plaza. The sign carries only the project title — the description
lives in the DOM card, where it can actually be read.

### `utilities/arrangement.js`

```js
arrangeOnArc({ count, center, radius, facing, spread })
  -> [ { x, z, rotation } ]
```

Places `count` points evenly on the arc *opposite* `facing`, so the gap in the
ring is the entrance and the visitor drives in through it. Each point's
`rotation` faces the centre. Pure function, no THREE, no Game — the placement
rules are tested directly.

### `Zones.js`

A general proximity registry, not specific to projects.

```js
zones.register({ id, position, radius, data })
zones.events.on('enter', (zone) => …)
zones.events.on('leave', (zone) => …)
zones.active            // the current zone or null
```

Ticks at priority 8. The decision itself is a pure function so it can be tested
without a running game:

```js
resolveActiveZone(zones, position, currentId, hysteresis) -> id | null
```

Rules:

- **Nearest wins.** At most one zone is active, which is what makes "one card"
  true by construction rather than by the card's own bookkeeping.
- **Hysteresis.** A zone is entered at `radius` but only left past
  `radius × hysteresis`. Driving along a boundary would otherwise strobe the
  card on and off every few frames.
- Switching directly between two overlapping zones fires `leave` then `enter`
  in the same tick, so a listener never sees two active at once.

### `Interface/ProjectCard.js`

Static markup in `index.html`, matching how `.hint`, `.loader` and `.failure`
already work; the class fills it and toggles `is-visible`. Listens for zone
events at priority 14.

The card is `pointer-events: none` so it never steals a camera drag; only its
links re-enable pointer events. On desktop it slides in from the right; under
40rem it becomes a bottom sheet, above the (already hidden) hint bar.

## Data flow

```
data/world.js ─┐
               ├─> ProjectsArea ─> buildBuilding ─> scene + fixed colliders
data/projects.js ┘              └─> arrangeOnArc ─> positions
                                └─> zones.register(one per project)

physicsVehicle.position (p5) ─> Zones.resolveActiveZone (p8)
                                  └─> 'enter' / 'leave'
                                        └─> ProjectCard (p14) ─> DOM
```

Content flows once, at construction. Only the zone decision runs per frame, and
it is four distance comparisons.

## Error handling

- **Malformed project data** — throws at construction naming the id and field.
  Authored data; failing loud beats a silently missing building.
- **Unknown palette key in `building.accent`** — `Materials.get()` already
  throws for this; validation catches it earlier with a better message.
- **Canvas unavailable for a sign** — falls back to a plain accent-coloured
  board. A missing sign must not take the world down.
- **No project in range** — the normal state, not an error: `active` is `null`
  and the card is hidden.

## Testing

Pure logic gets unit tests; the assembled result gets the existing smoke test.
`three/webgpu` imports cleanly under Vitest in node, verified, so builders are
testable directly.

| File | Asserts |
|---|---|
| `tests/arrangement.test.js` | n points evenly spaced, all on the ring, each facing the centre, the gap lands on `facing` |
| `tests/zones.test.js` | enters at `radius`, holds until `radius × hysteresis`, nearest wins when two overlap, leaves to `null` cleanly |
| `tests/projects.test.js` | every entry has the required fields, ids unique, `roof` in range, `floors` in 2-6, `accent` a real palette key |
| `tests/building.test.js` | returns the three parts, height scales with `floors`, footprint matches the arguments, all geometry non-indexed |

The smoke test gains one scenario: drive from spawn toward the plaza, assert the
card becomes visible, that it contains the expected project title, and that the
console stays clean.

## Out of scope for this slice

- Roads. They connect all seven areas and belong with the full Phase 3 layout.
- A paved plaza floor. The grass field wraps around the car and would poke
  through a slab at ground level; masking it is a Grass change, not an area
  change.
- The other six areas, and an `Area` base class — deliberately, until there are
  three examples to generalise from.
- Screenshots in the card. The card is DOM, so images are a later addition that
  costs nothing structurally.
- Interiors. The buildings are landmarks, not places to enter.

## Implementation notes

Added during the build, where reality differed from the plan:

- **The pure zone resolver had to move out of `Zones.js`.** Anything importing
  `Game` also imports Rapier's WASM package, which Vitest cannot resolve, so the
  test could not load the file at all. `resolveActiveZone` now lives in
  `Game/utilities/zones.js` alongside the other pure logic, and `Zones` is
  reduced to plumbing. This is the better shape anyway.
- **A pitched roof needs two wedges, not one.** `buildWedge` is a ramp — it
  rises from one edge to the other — so using it once gives a lean-to. Each half
  of the gable is a wedge turned a quarter turn and shifted so its high edge
  lands on the centre line.
- **`mergeGeometries` refuses to mix indexed and non-indexed inputs**, and
  `buildWedge` already returns non-indexed while `RoundedBoxGeometry` does not.
  The building builder converts on the way in rather than on the way out.
- **A sign's `colorNode` must be a vec3.** Passing the whole texture made the
  material compose `vec4(vec4, alpha)`, which TSL reports as "length of
  parameters exceeds maximum length of function 'vec4()'" — a console error, not
  a crash, so it would have passed unnoticed without the smoke test's console
  check. It reads `.rgb` and takes alpha separately.
- **`wedge.js` and `vegetation.js` both called `toNonIndexed()` on geometry that
  was already non-indexed**, which clones the buffers and logs a warning for
  nothing — nine per load. Pre-existing, but the pitched roofs would have added
  more, so both got the same one-line guard.
- **Verified numerically as well as by eye.** From the spawn point with the car
  facing the plaza, all four buildings project inside the frustum, spanning
  x 357-916 of 1280 and standing 104-252 pixels tall. Criterion #1 holds.

### Known gaps

- **The follow camera has no collision.** Standing at a building with the car
  facing away puts the camera inside the wall. This was always true of `View`;
  buildings are simply the first geometry big enough to make it obvious. Fixing
  it is a `View` change — a raycast from the focus point to the camera — and
  belongs with the camera, not with this area.
- The plaza interior is bare grass. A paved floor needs the grass field to be
  masked, which is a `Grass` change.
- Project copy is placeholder text.
