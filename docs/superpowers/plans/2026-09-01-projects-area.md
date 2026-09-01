# Projects Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one portfolio area end to end — a plaza of parametric buildings north-east of spawn, each revealing a project card as the car approaches.

**Architecture:** Two pure utilities (arc placement, zone resolution) and two geometry builders (building, sign) are composed by one concrete `ProjectsArea` class. A general `Zones` registry ticks at priority 8 and emits enter/leave; a `ProjectCard` DOM class listens at priority 14. Content and placement live in `data/projects.js` and `data/world.js`, so a fifth project is one object in an array.

**Tech Stack:** Three.js `three/webgpu` + TSL, Rapier 3D via the existing `Objects`/`Physics` registry, Vitest for pure logic, Playwright for the smoke test. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-projects-area-design.md`

> **Executed 2026-09-01.** Three tasks differed from what is written below —
> the pure zone resolver moved to `Game/utilities/zones.js`, the pitched roof
> became two mirrored wedges, and the sign's `colorNode` had to be `.rgb`. The
> spec's "Implementation notes" section records why. Read the code, not this
> plan, for what was actually built.

## Global Constraints

- **Do not run `git commit` or `git add`, and never `git push`.** The owner handles version control. Every task ends with a verification step instead of a commit.
- No new npm dependencies.
- Every colour comes from `sources/data/palette.js`. Nothing else hardcodes one.
- Every `tick` listener registers an explicit numeric priority. `Zones` is 8, `ProjectCard` is 14. A system may only read state produced by a lower number in the same frame.
- Geometry builders return faceted geometry: `toNonIndexed()` then `computeVertexNormals()`, matching `sources/Game/Builders/vegetation.js`.
- Builders take numbers and return geometry. They must not import `Game`, `palette`, or touch the scene.
- Code style follows the existing files: 4-space indent, Allman braces, no semicolons, `/** */` block comments that explain *why*.
- Unit tests run under `environment: 'node'`. `three/webgpu` imports fine there; `document` and `HTMLCanvasElement` do not exist.

---

### Task 1: Arc placement utility

**Files:**
- Create: `sources/Game/utilities/arrangement.js`
- Test: `tests/arrangement.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `arrangeOnArc({ count, center, radius, facing, spread }) -> [ { x, z, angle, rotation } ]`

Geometry convention for the whole feature: **a building is built with its entrance facing +X.** A Y-rotation of `r` maps +X to `(cos r, 0, -sin r)`, so to point a building at the arc's centre from a point at bearing `angle`, `rotation = Math.PI - angle`. Task 6 relies on this.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'
import { arrangeOnArc } from '../sources/Game/utilities/arrangement.js'

const center = { x: 62, z: -62 }
const base = { count: 4, center, radius: 26, facing: Math.PI * 0.75, spread: Math.PI * 1.1 }

describe('arrangeOnArc', () =>
{
    it('puts every point on the ring', () =>
    {
        for(const point of arrangeOnArc(base))
        {
            const distance = Math.hypot(point.x - center.x, point.z - center.z)
            expect(distance).toBeCloseTo(26, 6)
        }
    })

    it('spaces points evenly across the spread', () =>
    {
        const points = arrangeOnArc(base)
        const steps = points.slice(1).map((point, index) => point.angle - points[index].angle)

        for(const step of steps)
            expect(step).toBeCloseTo(base.spread / (base.count - 1), 6)
    })

    it('leaves the gap on the facing bearing, so the entrance points at spawn', () =>
    {
        const points = arrangeOnArc(base)

        // Every point sits on the arc opposite `facing`; none is near it
        for(const point of points)
        {
            const delta = Math.abs(Math.atan2(
                Math.sin(point.angle - base.facing),
                Math.cos(point.angle - base.facing)
            ))
            expect(delta).toBeGreaterThan(Math.PI - base.spread * 0.5 - 1e-6)
        }
    })

    it('rotates each point to face the centre', () =>
    {
        for(const point of arrangeOnArc(base))
        {
            // +X rotated by `rotation` must point from the building to the centre
            const forwardX = Math.cos(point.rotation)
            const forwardZ = -Math.sin(point.rotation)
            const toCenterX = (center.x - point.x) / 26
            const toCenterZ = (center.z - point.z) / 26

            expect(forwardX).toBeCloseTo(toCenterX, 6)
            expect(forwardZ).toBeCloseTo(toCenterZ, 6)
        }
    })

    it('places a single point opposite the facing bearing', () =>
    {
        const [ only ] = arrangeOnArc({ ...base, count: 1 })
        expect(only.angle).toBeCloseTo(base.facing + Math.PI, 6)
    })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/arrangement.test.js`
Expected: FAIL — cannot resolve `../sources/Game/utilities/arrangement.js`

- [ ] **Step 3: Write the implementation**

```js
/**
 * Places points evenly on the arc *opposite* a bearing.
 *
 * Areas are rings of landmarks with one side left open, so the visitor drives
 * in through the gap rather than around the outside. `facing` is that gap — the
 * bearing back towards where the visitor is coming from — and everything is
 * arranged on the far side of it.
 *
 * Placement is derived from the item count, which is what makes adding a
 * project a data change: the ring re-spaces itself.
 *
 * @param {object}   options
 * @param {number}   options.count   How many points to place
 * @param {{x: number, z: number}} options.center
 * @param {number}   options.radius  Ring radius
 * @param {number}   options.facing  Bearing of the gap, radians
 * @param {number}   options.spread  Arc the points occupy, radians
 * @returns {Array<{x: number, z: number, angle: number, rotation: number}>}
 */
export const arrangeOnArc = ({ count, center, radius, facing, spread }) =>
{
    const points = []

    // A lone point belongs in the middle of the arc, not at its start
    const start = count > 1 ? facing + Math.PI - spread * 0.5 : facing + Math.PI
    const step = count > 1 ? spread / (count - 1) : 0

    for(let index = 0; index < count; index++)
    {
        const angle = start + step * index

        points.push({
            x: center.x + Math.cos(angle) * radius,
            z: center.z + Math.sin(angle) * radius,
            angle,
            // A Y-rotation r maps +X to (cos r, -sin r) in the xz plane. Solving
            // that against the direction back to the centre gives PI - angle.
            rotation: Math.PI - angle
        })
    }

    return points
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/arrangement.test.js`
Expected: PASS, 5 tests

---

### Task 2: Zone proximity registry

**Files:**
- Create: `sources/Game/Zones.js`
- Test: `tests/zones.test.js`

**Interfaces:**
- Consumes: `Game.getInstance()`, `game.ticker.events`, `game.physicsVehicle.position`, `Events` from `sources/Game/Events.js`
- Produces:
  - `resolveActiveZone(zones, position, currentId, hysteresis) -> string | null` (exported from `Zones.js`, pure, no Game)
  - `class Zones` with `register({ id, position, radius, data })`, `zones.events` (`'enter'` / `'leave'`, each called with the zone object), and `zones.active`

The pure resolver is what carries the rules; the class is thin plumbing around it. Only the resolver is unit tested — the class is covered by the smoke test in Task 8.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'
import { resolveActiveZone } from '../sources/Game/Zones.js'

const zones = [
    { id: 'near', position: { x: 0, z: 0 }, radius: 10 },
    { id: 'far', position: { x: 30, z: 0 }, radius: 10 }
]

const at = (x, z = 0) => ({ x, z })

describe('resolveActiveZone', () =>
{
    it('activates nothing when the car is outside every zone', () =>
    {
        expect(resolveActiveZone(zones, at(60), null, 1.25)).toBe(null)
    })

    it('activates a zone once the car is inside its radius', () =>
    {
        expect(resolveActiveZone(zones, at(9.9), null, 1.25)).toBe('near')
    })

    it('does not activate a zone the car is only just outside', () =>
    {
        expect(resolveActiveZone(zones, at(10.1), null, 1.25)).toBe(null)
    })

    it('holds the active zone past its radius, up to the hysteresis distance', () =>
    {
        // Would not have been entered here, but is not yet left either. This is
        // what stops the card strobing when driving along a boundary.
        expect(resolveActiveZone(zones, at(12), 'near', 1.25)).toBe('near')
    })

    it('leaves once past the hysteresis distance', () =>
    {
        expect(resolveActiveZone(zones, at(12.6), 'near', 1.25)).toBe(null)
    })

    it('gives the nearest zone when two overlap', () =>
    {
        const overlapping = [
            { id: 'a', position: { x: 0, z: 0 }, radius: 20 },
            { id: 'b', position: { x: 10, z: 0 }, radius: 20 }
        ]

        expect(resolveActiveZone(overlapping, at(9), null, 1.25)).toBe('b')
        expect(resolveActiveZone(overlapping, at(1), null, 1.25)).toBe('a')
    })

    it('switches away from a held zone when another is genuinely entered', () =>
    {
        const overlapping = [
            { id: 'a', position: { x: 0, z: 0 }, radius: 10 },
            { id: 'b', position: { x: 14, z: 0 }, radius: 10 }
        ]

        // 11.5 is inside a's hysteresis band, but properly inside b
        expect(resolveActiveZone(overlapping, at(11.5), 'a', 1.25)).toBe('b')
    })

    it('ignores a stale current id that is no longer registered', () =>
    {
        expect(resolveActiveZone(zones, at(60), 'deleted', 1.25)).toBe(null)
    })

    it('is unaffected by height — only the ground plane matters', () =>
    {
        expect(resolveActiveZone(zones, { x: 5, y: 40, z: 0 }, null, 1.25)).toBe('near')
    })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/zones.test.js`
Expected: FAIL — `resolveActiveZone` is not exported

- [ ] **Step 3: Write the implementation**

```js
import { Game } from './Game.js'
import { Events } from './Events.js'

/**
 * Decides which zone the car is in.
 *
 * Two rules, and both exist because of how the card behaves rather than how the
 * geometry does:
 *
 *   Nearest wins — at most one zone is ever active, so "one card on screen" is
 *   true by construction instead of being bookkeeping the card has to do.
 *
 *   Hysteresis — a zone is entered at its radius but only left past
 *   `radius * hysteresis`. Driving along a boundary otherwise flips the card on
 *   and off every few frames.
 *
 * Distance is measured on the ground plane; a jump should not dismiss a card.
 *
 * Pure on purpose: the rules are the interesting part, and this way they are
 * tested without a running game.
 *
 * @returns {string|null} the id of the zone that should be active
 */
export const resolveActiveZone = (zones, position, currentId, hysteresis) =>
{
    let bestId = null
    let bestDistance = Infinity

    for(const zone of zones)
    {
        const distance = Math.hypot(position.x - zone.position.x, position.z - zone.position.z)

        // A zone already active keeps a wider radius than one being entered
        const limit = zone.id === currentId ? zone.radius * hysteresis : zone.radius

        if(distance > limit)
            continue

        // Compare on true distance, not on the widened limit, so a held zone
        // does not out-rank one the car has actually driven into
        if(distance < bestDistance)
        {
            bestDistance = distance
            bestId = zone.id
        }
    }

    return bestId
}

/**
 * Registry of places worth reacting to.
 *
 * Deliberately general and deliberately not part of any area: every area will
 * want this, and its interface is already settled even though the areas' are
 * not. Ticks at priority 8, so it reads the vehicle position written at 5.
 */
export class Zones
{
    constructor()
    {
        this.game = Game.getInstance()
        this.events = new Events()
        this.items = []
        this.active = null
        this.hysteresis = 1.25

        this.game.ticker.events.on('tick', () => { this.update() }, 8)
    }

    /**
     * @param {object} zone
     * @param {string} zone.id
     * @param {{x: number, z: number}} zone.position
     * @param {number} zone.radius
     * @param {*} [zone.data]  Handed back to listeners untouched
     */
    register(zone)
    {
        if(this.items.some(item => item.id === zone.id))
            throw new Error(`Zones > duplicate zone id "${zone.id}"`)

        this.items.push(zone)

        return zone
    }

    update()
    {
        const currentId = this.active ? this.active.id : null
        const nextId = resolveActiveZone(
            this.items,
            this.game.physicsVehicle.position,
            currentId,
            this.hysteresis
        )

        if(nextId === currentId)
            return

        // Leave before enter, so a listener never sees two zones active at once
        if(this.active)
        {
            const left = this.active
            this.active = null
            this.events.trigger('leave', [ left ])
        }

        if(nextId)
        {
            this.active = this.items.find(item => item.id === nextId)
            this.events.trigger('enter', [ this.active ])
        }
    }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/zones.test.js`
Expected: PASS, 9 tests

---

### Task 3: Project and world data, with validation

**Files:**
- Create: `sources/data/world.js`
- Create: `sources/data/projects.js`
- Create: `sources/data/validateProjects.js`
- Test: `tests/projects.test.js`

**Interfaces:**
- Consumes: `palette` from `sources/data/palette.js`
- Produces:
  - `world.projectsArea` — `{ center, ringRadius, entranceFacing, spread, zoneRadius, zoneHysteresis, clearingRadius }`
  - `projects` — the array described below
  - `validateProjects(projects) -> projects` (throws on a malformed entry)

`center: { x: 62, z: -62 }` is 87.7 units from spawn. Fog is `near: 55`, `far: 190`, so a 13-unit building there reads as a clear silhouette from the spawn point — that is the whole discovery mechanism, so do not move it closer without re-checking against `sources/Game/Fog.js`.

`entranceFacing: Math.PI * 0.75` is `atan2(62, -62)`, the bearing from the plaza centre back to spawn.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'
import palette from '../sources/data/palette.js'
import projects from '../sources/data/projects.js'
import world from '../sources/data/world.js'
import { validateProjects } from '../sources/data/validateProjects.js'

describe('world data', () =>
{
    it('puts the plaza where it is visible through the fog but not on top of spawn', () =>
    {
        const { center } = world.projectsArea
        const distance = Math.hypot(center.x, center.z)

        expect(distance).toBeGreaterThan(60)
        expect(distance).toBeLessThan(140)
    })

    it('faces the entrance back towards spawn', () =>
    {
        const { center, entranceFacing } = world.projectsArea
        const bearingToSpawn = Math.atan2(-center.z, -center.x)

        expect(Math.cos(entranceFacing - bearingToSpawn)).toBeCloseTo(1, 3)
    })

    it('reserves a clearing wide enough for the whole ring', () =>
    {
        const { ringRadius, clearingRadius } = world.projectsArea
        expect(clearingRadius).toBeGreaterThan(ringRadius)
    })
})

describe('projects data', () =>
{
    it('ships four projects', () =>
    {
        expect(projects).toHaveLength(4)
    })

    it('gives every project a unique id', () =>
    {
        const ids = projects.map(project => project.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('passes its own validator', () =>
    {
        expect(() => validateProjects(projects)).not.toThrow()
    })

    it('only uses accent colours that exist in the palette', () =>
    {
        for(const project of projects)
            expect(palette[project.building.accent]).toBeDefined()
    })
})

describe('validateProjects', () =>
{
    const valid = () => ([ {
        id: 'a',
        title: 'A',
        role: 'Engineer',
        year: '2024',
        description: 'Does a thing.',
        tags: [ 'JS' ],
        links: [ { label: 'Live', url: 'https://example.com' } ],
        building: { floors: 3, width: 7, depth: 6, roof: 'flat', accent: 'accent' }
    } ])

    it('names the id and the field when something is missing', () =>
    {
        const broken = valid()
        delete broken[0].title

        expect(() => validateProjects(broken)).toThrow(/"a".*title/)
    })

    it('rejects a roof it cannot build', () =>
    {
        const broken = valid()
        broken[0].building.roof = 'dome'

        expect(() => validateProjects(broken)).toThrow(/roof/)
    })

    it('rejects a floor count outside the range the builder handles', () =>
    {
        const broken = valid()
        broken[0].building.floors = 12

        expect(() => validateProjects(broken)).toThrow(/floors/)
    })

    it('rejects an accent that is not a palette key', () =>
    {
        const broken = valid()
        broken[0].building.accent = 'chartreuse'

        expect(() => validateProjects(broken)).toThrow(/accent/)
    })

    it('rejects duplicate ids', () =>
    {
        const broken = [ ...valid(), ...valid() ]

        expect(() => validateProjects(broken)).toThrow(/duplicate/)
    })

    it('returns the array it was given so it can be used inline', () =>
    {
        const list = valid()
        expect(validateProjects(list)).toBe(list)
    })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/projects.test.js`
Expected: FAIL — cannot resolve `../sources/data/world.js`

- [ ] **Step 3: Write `sources/data/world.js`**

```js
/**
 * Where the areas sit and how big they are.
 *
 * Separate from the content files on purpose: a project describes itself, the
 * world describes where projects are put. Adding a project therefore never
 * involves choosing coordinates — the ring re-spaces itself.
 */
export default {
    projectsArea: {
        // 87.7 units from spawn. Fog is near 55 / far 190, so the buildings read
        // as a silhouette on the horizon from the spawn point, which is the only
        // thing telling a visitor there is somewhere to go. Moving this closer or
        // further needs a look at Game/Fog.js.
        center: { x: 62, z: -62 },

        ringRadius: 26,

        // atan2(-z, -x) of the centre: the bearing back towards spawn. The ring
        // leaves its gap here, so the visitor arrives through the entrance.
        entranceFacing: Math.PI * 0.75,

        // Buildings occupy the far 198 degrees, leaving a wide way in
        spread: Math.PI * 1.1,

        zoneRadius: 11,
        zoneHysteresis: 1.25,

        // Scenery keeps trees out of this circle
        clearingRadius: 40
    }
}
```

- [ ] **Step 4: Write `sources/data/validateProjects.js`**

```js
import palette from './palette.js'

const REQUIRED = [ 'id', 'title', 'role', 'year', 'description', 'tags', 'links', 'building' ]
const REQUIRED_BUILDING = [ 'floors', 'width', 'depth', 'roof', 'accent' ]
const ROOFS = [ 'flat', 'pitched', 'stepped' ]

/**
 * Fails loudly on malformed project data.
 *
 * This is authored content, not user input, so a missing field is a bug and the
 * right response is to stop rather than to render three buildings and leave the
 * fourth silently absent. The app's failure page catches the throw.
 *
 * @returns the same array, so it can be used inline at the point of import
 */
export const validateProjects = (projects) =>
{
    const seen = new Set()

    for(const project of projects)
    {
        const id = project.id ?? '(no id)'

        for(const field of REQUIRED)
            if(project[field] === undefined)
                throw new Error(`projects > "${id}" is missing "${field}"`)

        if(seen.has(project.id))
            throw new Error(`projects > duplicate id "${id}"`)

        seen.add(project.id)

        if(!Array.isArray(project.tags))
            throw new Error(`projects > "${id}" field "tags" must be an array`)

        if(!Array.isArray(project.links))
            throw new Error(`projects > "${id}" field "links" must be an array`)

        for(const link of project.links)
            if(!link.label || !link.url)
                throw new Error(`projects > "${id}" has a link missing "label" or "url"`)

        for(const field of REQUIRED_BUILDING)
            if(project.building[field] === undefined)
                throw new Error(`projects > "${id}" is missing "building.${field}"`)

        if(!ROOFS.includes(project.building.roof))
            throw new Error(`projects > "${id}" has roof "${project.building.roof}", expected one of ${ROOFS.join(', ')}`)

        // The builder's window banding and proportions are only sensible in this
        // range; outside it the result reads as a mistake rather than a choice
        if(project.building.floors < 2 || project.building.floors > 6)
            throw new Error(`projects > "${id}" has floors ${project.building.floors}, expected 2 to 6`)

        if(palette[project.building.accent] === undefined)
            throw new Error(`projects > "${id}" has accent "${project.building.accent}", which is not a palette key`)
    }

    return projects
}
```

- [ ] **Step 5: Write `sources/data/projects.js`**

```js
import { validateProjects } from './validateProjects.js'

/**
 * The flagship projects, in the order they appear around the plaza.
 *
 * PLACEHOLDER CONTENT — the text below is scaffolding so the pipeline can be
 * built and seen. Replace `title`, `role`, `year`, `description`, `tags` and
 * `links` with the real thing; the `building` block is what gives each one its
 * shape, and is worth keeping varied.
 *
 * Adding a fifth project is one more object in this array. Nothing else needs
 * to change: the ring re-spaces itself and a zone is registered per entry.
 */
export default validateProjects([
    {
        id: 'wholesale-marketplace',
        title: 'Wholesale Marketplace',
        role: 'Senior Full Stack Engineer',
        year: '2024',
        description: 'A B2B marketplace connecting wholesale suppliers with retail buyers. Rebuilt the catalogue and search layer, cutting median result time from seconds to milliseconds across millions of listings.',
        tags: [ 'React', 'Node.js', 'PostgreSQL', 'Elasticsearch' ],
        links: [ { label: 'Live', url: 'https://example.com' } ],
        building: { floors: 6, width: 9, depth: 7, roof: 'stepped', accent: 'accent' }
    },
    {
        id: 'inventory-sync',
        title: 'Inventory Sync Engine',
        role: 'Lead Engineer',
        year: '2023',
        description: 'A synchronisation service keeping stock levels consistent across half a dozen sales channels. Event-driven, idempotent, and designed so a channel going offline never corrupts the others.',
        tags: [ 'TypeScript', 'Redis', 'Queues', 'Docker' ],
        links: [ { label: 'Case study', url: 'https://example.com' } ],
        building: { floors: 4, width: 8, depth: 8, roof: 'flat', accent: 'accentCool' }
    },
    {
        id: 'analytics-dashboard',
        title: 'Seller Analytics',
        role: 'Full Stack Engineer',
        year: '2023',
        description: 'A dashboard giving sellers their traffic, conversion and revenue in one place. The hard part was making a year of per-hour data feel instant on a laptop.',
        tags: [ 'Vue', 'ClickHouse', 'D3' ],
        links: [ { label: 'Live', url: 'https://example.com' } ],
        building: { floors: 3, width: 10, depth: 6, roof: 'pitched', accent: 'accentWarm' }
    },
    {
        id: 'design-system',
        title: 'Component Library',
        role: 'Maintainer',
        year: '2022',
        description: 'The shared component library behind four internal products. Accessible by default, themed from one token file, and documented well enough that teams stopped rebuilding buttons.',
        tags: [ 'React', 'Storybook', 'a11y' ],
        links: [ { label: 'Docs', url: 'https://example.com' }, { label: 'GitHub', url: 'https://example.com' } ],
        building: { floors: 2, width: 11, depth: 7, roof: 'pitched', accent: 'blossom' }
    }
])
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run tests/projects.test.js`
Expected: PASS, 13 tests

---

### Task 4: Parametric building builder

**Files:**
- Create: `sources/Game/Builders/building.js`
- Test: `tests/building.test.js`

**Interfaces:**
- Consumes: `three/webgpu`, `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`, `buildWedge` from `sources/Game/Builders/wedge.js`
- Produces: `buildBuilding({ floors, width, depth, roof }) -> { parts: { concrete, glass, accent }, height, footprint: { width, depth } }`

`FLOOR_HEIGHT` is exported so `ProjectsArea` can place the sign without re-deriving it.

Read `sources/Game/Builders/wedge.js` before starting — `buildWedge(length, height, width)` returns `{ geometry, points }` and its geometry is already faceted.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'
import { FLOOR_HEIGHT, buildBuilding } from '../sources/Game/Builders/building.js'

const base = { floors: 4, width: 8, depth: 6, roof: 'flat' }
const vertexCount = geometry => geometry.attributes.position.count

describe('buildBuilding', () =>
{
    it('returns one geometry per material', () =>
    {
        const { parts } = buildBuilding(base)

        expect(vertexCount(parts.concrete)).toBeGreaterThan(0)
        expect(vertexCount(parts.glass)).toBeGreaterThan(0)
        expect(vertexCount(parts.accent)).toBeGreaterThan(0)
    })

    it('scales height with the floor count', () =>
    {
        const short = buildBuilding({ ...base, floors: 2 })
        const tall = buildBuilding({ ...base, floors: 6 })

        expect(tall.height).toBeGreaterThan(short.height)
        expect(tall.height - short.height).toBeCloseTo(FLOOR_HEIGHT * 4, 6)
    })

    it('reports a footprint matching the arguments, so the collider fits the body', () =>
    {
        const { footprint } = buildBuilding(base)

        expect(footprint.width).toBe(8)
        expect(footprint.depth).toBe(6)
    })

    it('gives more floors more window bands', () =>
    {
        const short = buildBuilding({ ...base, floors: 2 })
        const tall = buildBuilding({ ...base, floors: 6 })

        expect(vertexCount(tall.parts.glass)).toBeGreaterThan(vertexCount(short.parts.glass))
    })

    it('builds every roof style and gives each a different silhouette', () =>
    {
        const heights = [ 'flat', 'pitched', 'stepped' ].map(roof => buildBuilding({ ...base, roof }).height)

        expect(new Set(heights).size).toBe(3)
    })

    it('rejects a roof style it cannot build', () =>
    {
        expect(() => buildBuilding({ ...base, roof: 'dome' })).toThrow(/dome/)
    })

    it('returns faceted geometry, so surfaces read as deliberate', () =>
    {
        const { parts } = buildBuilding(base)

        for(const geometry of Object.values(parts))
        {
            expect(geometry.index).toBe(null)
            expect(geometry.attributes.normal).toBeDefined()
        }
    })

    it('keeps the body inside its own footprint', () =>
    {
        const { parts } = buildBuilding(base)
        parts.concrete.computeBoundingBox()
        const box = parts.concrete.boundingBox

        // Half of 8 wide and 6 deep, with a little slack for the entrance awning
        expect(box.max.x).toBeLessThanOrEqual(4.6)
        expect(box.max.z).toBeLessThanOrEqual(3.25)
        expect(box.min.y).toBeGreaterThanOrEqual(-0.01)
    })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/building.test.js`
Expected: FAIL — cannot resolve `../sources/Game/Builders/building.js`

- [ ] **Step 3: Write the implementation**

```js
import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildWedge } from './wedge.js'

/**
 * Parametric buildings.
 *
 * A landmark is described by five numbers rather than authored, so a new
 * project gets a distinct silhouette without anyone writing geometry. Like the
 * vegetation builder this returns one merged geometry per material — a whole
 * plaza then costs three draw calls — and everything is faceted, because flat
 * facets are what make low-poly read as a choice rather than as low detail.
 *
 * The entrance faces +X. Every consumer relies on that: `arrangeOnArc` returns
 * a rotation computed against it.
 *
 * Nothing here knows about projects, the palette or the scene. It takes numbers
 * and gives back geometry.
 */

/** Exported so callers can place a sign without re-deriving the height. */
export const FLOOR_HEIGHT = 3.2

const ROOFS = [ 'flat', 'pitched', 'stepped' ]

const faceted = (geometry) =>
{
    const flat = geometry.toNonIndexed()
    flat.computeVertexNormals()
    geometry.dispose()
    return flat
}

const box = (width, height, depth, position) =>
{
    const geometry = new RoundedBoxGeometry(width, height, depth, 1, 0.06)
    geometry.translate(...position)
    return geometry
}

/**
 * @param {object} parameters
 * @param {number} parameters.floors  2-6
 * @param {number} parameters.width   Along X, the face the entrance is on
 * @param {number} parameters.depth   Along Z
 * @param {string} parameters.roof    flat | pitched | stepped
 */
export const buildBuilding = ({ floors, width, depth, roof }) =>
{
    if(!ROOFS.includes(roof))
        throw new Error(`buildBuilding > unknown roof "${roof}", expected one of ${ROOFS.join(', ')}`)

    const bodyHeight = floors * FLOOR_HEIGHT

    const concrete = [ box(width, bodyHeight, depth, [ 0, bodyHeight * 0.5, 0 ]) ]
    const glass = []
    const accent = []

    // One band per floor, wrapping the two long faces. Insetting them rather
    // than cutting holes keeps the body a single convex shape, which is what
    // lets one cuboid collider match what is drawn.
    for(let floor = 0; floor < floors; floor++)
    {
        const y = floor * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.62
        const bandHeight = FLOOR_HEIGHT * 0.34

        glass.push(box(width * 0.78, bandHeight, depth + 0.12, [ 0, y, 0 ]))
        glass.push(box(width + 0.12, bandHeight, depth * 0.72, [ 0, y, 0 ]))
    }

    // Entrance on +X: a recessed door with an awning over it
    accent.push(box(0.5, FLOOR_HEIGHT * 0.72, width * 0.3, [ width * 0.5, FLOOR_HEIGHT * 0.36, 0 ]))
    accent.push(box(1.4, 0.24, width * 0.44, [ width * 0.5 + 0.4, FLOOR_HEIGHT * 0.8, 0 ]))

    let height = bodyHeight

    if(roof === 'flat')
    {
        // A thin parapet, so the top edge catches the sun as a line
        concrete.push(box(width + 0.4, 0.5, depth + 0.4, [ 0, bodyHeight + 0.25, 0 ]))
        height = bodyHeight + 0.5
    }
    else if(roof === 'pitched')
    {
        const ridge = Math.min(width, depth) * 0.45
        const wedge = buildWedge(depth, ridge, width)

        // buildWedge rises along +X; a roof ridge should run across the depth
        wedge.geometry.rotateY(Math.PI * 0.5)
        wedge.geometry.translate(0, bodyHeight, 0)
        concrete.push(wedge.geometry)
        height = bodyHeight + ridge
    }
    else
    {
        const setback = FLOOR_HEIGHT * 1.1
        concrete.push(box(width * 0.66, setback, depth * 0.66, [ 0, bodyHeight + setback * 0.5, 0 ]))
        height = bodyHeight + setback
    }

    return {
        parts: {
            concrete: faceted(mergeGeometries(concrete)),
            glass: faceted(mergeGeometries(glass)),
            accent: faceted(mergeGeometries(accent))
        },
        height,
        footprint: { width, depth }
    }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/building.test.js`
Expected: PASS, 8 tests

If `buildWedge`'s geometry turns out not to be centred the way the pitched roof assumes, fix it here by translating the wedge rather than by changing `wedge.js` — the ramps in `Playground.js` depend on its current origin.

---

### Task 5: Sign builder

**Files:**
- Create: `sources/Game/Builders/sign.js`
- Test: `tests/sign.test.js`

**Interfaces:**
- Consumes: `three/webgpu`
- Produces: `buildSign({ text, width, height }) -> { geometry, texture }`, where `texture` is a `THREE.CanvasTexture` in the browser and `null` where no canvas exists

`texture: null` is the contract that keeps the world alive when a canvas cannot be made, and it is also what makes this testable under node.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest'
import { buildSign } from '../sources/Game/Builders/sign.js'

describe('buildSign', () =>
{
    it('returns a plane sized to the arguments', () =>
    {
        const { geometry } = buildSign({ text: 'Wholesale Marketplace', width: 6, height: 1.4 })
        geometry.computeBoundingBox()

        const size = geometry.boundingBox.getSize({ x: 0, y: 0, z: 0 })

        expect(size.x).toBeCloseTo(6, 5)
        expect(size.y).toBeCloseTo(1.4, 5)
    })

    it('falls back to no texture where there is no canvas, rather than throwing', () =>
    {
        // Node has no `document`. A missing sign must never take the world down,
        // so the caller gets a plain accent board instead.
        const { texture } = buildSign({ text: 'Anything', width: 6, height: 1.4 })

        expect(texture).toBe(null)
    })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/sign.test.js`
Expected: FAIL — cannot resolve `../sources/Game/Builders/sign.js`

- [ ] **Step 3: Write the implementation**

```js
import * as THREE from 'three/webgpu'

/**
 * A board with a name on it.
 *
 * The card carries the detail; this only has to answer "which one is that?"
 * from across the plaza, before the car is close enough for a card to appear.
 *
 * Text is drawn to a 2D canvas rather than built as geometry: an extruded font
 * would need a font file, which the parent spec's "no shipped assets" rule
 * rules out, and would cost more triangles than the rest of the building.
 *
 * Where no canvas exists — a headless environment, or a browser refusing a 2D
 * context — this returns `texture: null` and the caller falls back to a plain
 * accent board. A sign is not worth failing a world over.
 */
export const buildSign = ({ text, width, height }) =>
{
    const geometry = new THREE.PlaneGeometry(width, height)

    return { geometry, texture: makeTexture(text, width, height) }
}

const makeTexture = (text, width, height) =>
{
    if(typeof document === 'undefined')
        return null

    const pixelsPerUnit = 128
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelsPerUnit)
    canvas.height = Math.round(height * pixelsPerUnit)

    const context = canvas.getContext('2d')

    if(!context)
        return null

    // Transparent ground: the board behind it supplies the colour, so the sign
    // picks up the same shading and fog as everything else
    context.clearRect(0, 0, canvas.width, canvas.height)

    context.fillStyle = '#1d2233'
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    // Shrink to fit rather than wrap: a long project name on two lines at this
    // size is less readable than the same name slightly smaller on one
    let fontSize = canvas.height * 0.5
    const maxWidth = canvas.width * 0.88

    do
    {
        context.font = `700 ${fontSize}px system-ui, sans-serif`
        fontSize -= 2
    }
    while(context.measureText(text).width > maxWidth && fontSize > 8)

    context.fillText(text, canvas.width * 0.5, canvas.height * 0.54)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4

    return texture
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/sign.test.js`
Expected: PASS, 2 tests

---

### Task 6: The Projects area

**Files:**
- Create: `sources/Game/World/Areas/ProjectsArea.js`
- Modify: `sources/Game/Game.js` — construct `Zones` before `World`
- Modify: `sources/Game/World/World.js` — construct `ProjectsArea`
- Modify: `sources/Game/World/Scenery.js` — reserve the plaza clearing

**Interfaces:**
- Consumes: `arrangeOnArc`, `buildBuilding`, `FLOOR_HEIGHT`, `buildSign`, `game.zones.register`, `game.objects.add`, `game.materials.get`
- Produces: `game.world.projectsArea`, and one registered zone per project whose `data` is the project object

This task has no unit test — it is wiring, and Task 8's smoke test is what proves it. Verify it by eye.

- [ ] **Step 1: Write `sources/Game/World/Areas/ProjectsArea.js`**

```js
import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import { Game } from '../../Game.js'
import { FLOOR_HEIGHT, buildBuilding } from '../../Builders/building.js'
import { buildSign } from '../../Builders/sign.js'
import { MeshStylizedMaterial } from '../../Materials/MeshStylizedMaterial.js'
import { arrangeOnArc } from '../../utilities/arrangement.js'
import projects from '../../../data/projects.js'
import world from '../../../data/world.js'

/**
 * The first portfolio area: a ring of buildings, one per project.
 *
 * Concrete on purpose. There are six more areas to come and they are not
 * variations on this one — a timeline, a contact form and a lap-timed circuit
 * have little in common with a plaza — so the shared abstraction is being left
 * until there are three examples to draw it from. What *is* shared already
 * lives outside this class: `Zones` for proximity, `arrangeOnArc` for layout.
 *
 * Nothing here chooses a position. Buildings are placed from their index, which
 * is what makes a fifth project one object in `data/projects.js`.
 */
export class ProjectsArea
{
    constructor()
    {
        this.game = Game.getInstance()
        this.settings = world.projectsArea

        this.group = new THREE.Group()
        this.game.scene.add(this.group)

        this.placements = arrangeOnArc({
            count: projects.length,
            center: this.settings.center,
            radius: this.settings.ringRadius,
            facing: this.settings.entranceFacing,
            spread: this.settings.spread
        })

        projects.forEach((project, index) =>
        {
            this.addBuilding(project, this.placements[index])
            this.addZone(project, this.placements[index])
        })
    }

    addBuilding(project, placement)
    {
        const built = buildBuilding(project.building)
        const quaternion = new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation)

        const group = new THREE.Group()
        group.position.set(placement.x, 0, placement.z)
        group.quaternion.copy(quaternion)
        this.group.add(group)

        const materials = {
            concrete: this.game.materials.get('concrete'),
            glass: this.game.materials.get('carGlass'),
            accent: this.game.materials.get(project.building.accent)
        }

        for(const [ name, geometry ] of Object.entries(built.parts))
        {
            const mesh = new THREE.Mesh(geometry, materials[name])
            mesh.castShadow = true
            mesh.receiveShadow = true
            group.add(mesh)
        }

        this.addSign(project, group, built)

        // One cuboid matching the body. The roof and awning are detail; a
        // collider that chased them would cost more than it would ever be felt.
        this.game.objects.add(null, {
            type: 'fixed',
            friction: 0.7,
            rotation: quaternion,
            position: {
                x: placement.x,
                y: project.building.floors * FLOOR_HEIGHT * 0.5,
                z: placement.z
            },
            colliders: [ {
                shape: 'cuboid',
                parameters: [
                    built.footprint.width * 0.5,
                    project.building.floors * FLOOR_HEIGHT * 0.5,
                    built.footprint.depth * 0.5
                ],
                category: 'floor'
            } ]
        })
    }

    /** A named board above the entrance, so a building is identifiable before its card appears. */
    addSign(project, group, built)
    {
        const width = built.footprint.width * 0.8
        const height = 1.3
        const sign = buildSign({ text: project.title, width, height })

        const board = new THREE.Mesh(
            new THREE.BoxGeometry(width + 0.3, height + 0.3, 0.2),
            this.game.materials.get(project.building.accent)
        )
        board.castShadow = true
        board.position.set(built.footprint.width * 0.5 + 0.1, FLOOR_HEIGHT * 1.35, 0)
        board.rotation.y = Math.PI * 0.5
        group.add(board)

        // No canvas, no lettering — the accent board alone still reads as signage
        if(!sign.texture)
            return

        const label = new THREE.Mesh(sign.geometry, new MeshStylizedMaterial({
            colorNode: texture(sign.texture),
            alphaNode: texture(sign.texture).a,
            transparent: true,
            hasCoreShadow: false,
            hasBounce: false
        }))
        label.position.set(board.position.x + 0.12, board.position.y, 0)
        label.rotation.y = Math.PI * 0.5
        group.add(label)
    }

    /**
     * The zone sits in front of the entrance rather than on the building, so the
     * card appears when the visitor is looking at the face with the sign on it.
     */
    addZone(project, placement)
    {
        const toCenterX = this.settings.center.x - placement.x
        const toCenterZ = this.settings.center.z - placement.z
        const length = Math.hypot(toCenterX, toCenterZ)
        const offset = this.settings.zoneRadius * 0.45

        this.game.zones.register({
            id: project.id,
            position: {
                x: placement.x + (toCenterX / length) * offset,
                z: placement.z + (toCenterZ / length) * offset
            },
            radius: this.settings.zoneRadius,
            data: project
        })
    }
}
```

- [ ] **Step 2: Construct `Zones` in `sources/Game/Game.js`**

In the `// Simulation` block, after `this.player = new Player()`, add:

```js
        this.zones = new Zones()
```

and the import alongside the others:

```js
import { Zones } from './Zones.js'
```

`Zones` reads `physicsVehicle.position` on tick, so it must exist before `World` registers anything into it — and `World` is constructed later in the same method, which satisfies that.

- [ ] **Step 3: Construct the area in `sources/Game/World/World.js`**

Add the import and one line after `this.playground = new Playground()`:

```js
import { ProjectsArea } from './Areas/ProjectsArea.js'
```

```js
        this.projectsArea = new ProjectsArea()
```

- [ ] **Step 4: Reserve the plaza in `sources/Game/World/Scenery.js`**

Add the import:

```js
import world from '../../data/world.js'
```

and append one entry to the `this.reserved` array literal, after the existing six:

```js
            {
                x: world.projectsArea.center.x,
                z: world.projectsArea.center.z,
                radius: world.projectsArea.clearingRadius
            }
```

- [ ] **Step 5: Check the unit suite still passes**

Run: `npm test`
Expected: PASS — the earlier tasks' tests, unchanged

- [ ] **Step 6: Look at it**

Run: `npm run dev`, open `http://localhost:5173/#debug`, and drive north-east.

Check, in this order:

1. The plaza is visible from spawn as a hazy silhouette. If it is not, the buildings are too short or `center` is too far — see `Game/Fog.js`.
2. Four buildings, all facing inward, evenly spaced, with a gap on the side you arrived from.
3. Signs are readable and the right way round.
4. The car cannot drive through a wall, and does not catch on an invisible edge outside one.
5. No trees inside the ring.
6. The console is clean.

---

### Task 7: The project card

**Files:**
- Create: `sources/Game/Interface/ProjectCard.js`
- Modify: `sources/index.html` — the card's markup
- Modify: `sources/style/index.css` — the card's styles
- Modify: `sources/Game/Game.js` — construct the card

**Interfaces:**
- Consumes: `game.zones.events` (`'enter'` / `'leave'`, each passed the zone whose `data` is the project)
- Produces: `game.projectCard`

Markup lives in `index.html` because `.hint`, `.loader` and `.failure` already do; the class fills it and toggles a class. No unit test — Task 8 covers it.

- [ ] **Step 1: Add the markup to `sources/index.html`**

Immediately after the `.hint` block, before the `<script>`:

```html
    <aside class="card js-card" aria-live="polite">
        <div class="card-head">
            <span class="card-year js-card-year"></span>
            <span class="card-role js-card-role"></span>
        </div>
        <h2 class="card-title js-card-title"></h2>
        <p class="card-description js-card-description"></p>
        <ul class="card-tags js-card-tags"></ul>
        <div class="card-links js-card-links"></div>
    </aside>
```

- [ ] **Step 2: Add the styles to `sources/style/index.css`**

Append, after the `.hint` rules and before the final media query:

```css
/* The card never takes the pointer — dragging the camera across it must still
   work — so only its links opt back in. */
.card
{
    position: fixed;
    top: 50%;
    right: 1.5rem;
    width: min(22rem, calc(100vw - 3rem));
    padding: 1.25rem 1.4rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.86);
    backdrop-filter: blur(10px);
    box-shadow: 0 1rem 2.5rem rgba(29, 34, 51, 0.18);
    pointer-events: none;
    opacity: 0;
    transform: translate(1.5rem, -50%);
    transition: opacity 0.28s ease, transform 0.28s ease;
}

.card.is-visible
{
    opacity: 1;
    transform: translate(0, -50%);
}

.card-head
{
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.6;
}

.card-title
{
    margin: 0.35rem 0 0.5rem;
    font-size: 1.35rem;
    line-height: 1.15;
}

.card-description
{
    font-size: 0.85rem;
    line-height: 1.5;
    opacity: 0.8;
}

.card-tags
{
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0.85rem 0 0;
    padding: 0;
    list-style: none;
}

.card-tags li
{
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: rgba(29, 34, 51, 0.08);
    font-size: 0.7rem;
    font-weight: 600;
}

.card-links
{
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
}

.card-links a
{
    padding: 0.4rem 0.8rem;
    border-radius: 0.5rem;
    background: #1d2233;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
    text-decoration: none;
    pointer-events: auto;
}

.card-links a:hover
{
    background: #343b58;
}

@media (max-width: 40rem)
{
    /* A side panel would cover the car on a narrow screen; a bottom sheet
       leaves the road visible. The hint bar is already hidden at this width. */
    .card
    {
        top: auto;
        right: 0.75rem;
        bottom: 0.75rem;
        left: 0.75rem;
        width: auto;
        transform: translate(0, 1.5rem);
    }

    .card.is-visible
    {
        transform: translate(0, 0);
    }
}
```

- [ ] **Step 3: Write `sources/Game/Interface/ProjectCard.js`**

```js
import { Game } from '../Game.js'

/**
 * The panel that names the project the car is next to.
 *
 * The world stays 3D and the words stay in the DOM. Body text baked into a
 * texture is unreadable at driving distance and impossible to tap on a phone,
 * and a link has to be a real link.
 *
 * Ticks at priority 14 by way of the zone events it listens to, so it only ever
 * reads a decision `Zones` already made this frame — it holds no proximity
 * logic of its own, and cannot disagree with the world about where the car is.
 */
export class ProjectCard
{
    constructor()
    {
        this.game = Game.getInstance()

        this.element = document.querySelector('.js-card')
        this.yearElement = this.element.querySelector('.js-card-year')
        this.roleElement = this.element.querySelector('.js-card-role')
        this.titleElement = this.element.querySelector('.js-card-title')
        this.descriptionElement = this.element.querySelector('.js-card-description')
        this.tagsElement = this.element.querySelector('.js-card-tags')
        this.linksElement = this.element.querySelector('.js-card-links')

        this.game.zones.events.on('enter', (zone) => { this.show(zone.data) }, 14)
        this.game.zones.events.on('leave', () => { this.hide() }, 14)
    }

    show(project)
    {
        this.yearElement.textContent = project.year
        this.roleElement.textContent = project.role
        this.titleElement.textContent = project.title
        this.descriptionElement.textContent = project.description

        this.tagsElement.replaceChildren(...project.tags.map((tag) =>
        {
            const item = document.createElement('li')
            item.textContent = tag
            return item
        }))

        this.linksElement.replaceChildren(...project.links.map((link) =>
        {
            const anchor = document.createElement('a')
            anchor.textContent = link.label
            anchor.href = link.url
            anchor.target = '_blank'
            anchor.rel = 'noopener noreferrer'
            return anchor
        }))

        this.element.classList.add('is-visible')
    }

    hide()
    {
        // Content is left in place: it fades out, and clearing it mid-transition
        // would empty the card before the visitor's eye had left it
        this.element.classList.remove('is-visible')
    }
}
```

- [ ] **Step 4: Construct it in `sources/Game/Game.js`**

Add the import:

```js
import { ProjectCard } from './Interface/ProjectCard.js'
```

and, after `this.world = new World()`, add:

```js
        this.projectCard = new ProjectCard()
```

It is constructed after `World` because the zones it reacts to are registered there.

- [ ] **Step 5: Drive it**

Run: `npm run dev` and drive into the plaza.

Check:

1. The card slides in when the car reaches a building, and out when it leaves.
2. Never two cards, and never a flicker when driving straight along the edge of a zone — if it flickers, `zoneHysteresis` in `data/world.js` is too low.
3. Dragging the camera works with the pointer over the card.
4. Links open in a new tab.
5. At a narrow window width the card becomes a bottom sheet and the car is still visible.

---

### Task 8: Smoke coverage and documentation

**Files:**
- Modify: `tests/smoke.mjs`
- Modify: `readme.md`

**Interfaces:**
- Consumes: everything above
- Produces: nothing new

Read `tests/smoke.mjs` in full first. It counts progress in frames rather than milliseconds and samples every frame, and the new scenario must do the same — software rendering runs at roughly 2fps, so anything time-based asserts only that nothing has happened yet.

- [ ] **Step 1: Add the plaza scenario to `tests/smoke.mjs`**

After the existing driving assertions, teleport the car to the plaza rather than driving 87 units to it — the existing run already proves the car drives, and this scenario is about the card:

```js
    // Drop the car at the entrance of the first building's zone and let the
    // frame ordering do the rest: Zones resolves at priority 8, the card
    // reacts at 14, so one full frame is enough.
    const cardState = await page.evaluate(async () =>
    {
        const game = window.game
        const zone = game.zones.items[0]

        game.physicsVehicle.moveTo({ x: zone.position.x, y: 2, z: zone.position.z })

        // Two frames: one to settle the transform, one for the zone to resolve
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

        const card = document.querySelector('.js-card')

        return {
            activeId: game.zones.active ? game.zones.active.id : null,
            isVisible: card.classList.contains('is-visible'),
            title: card.querySelector('.js-card-title').textContent
        }
    })

    assert.equal(cardState.activeId, 'wholesale-marketplace', 'the first zone should be active')
    assert.ok(cardState.isVisible, 'the card should be visible inside a zone')
    assert.ok(cardState.title.length > 0, 'the card should be filled in')
```

Then drive out and assert it hides:

```js
    const clearedState = await page.evaluate(async () =>
    {
        window.game.physicsVehicle.moveTo({ x: 0, y: 2, z: 0 })
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

        return {
            activeId: window.game.zones.active,
            isVisible: document.querySelector('.js-card').classList.contains('is-visible')
        }
    })

    assert.equal(clearedState.activeId, null, 'no zone should be active at spawn')
    assert.ok(!clearedState.isVisible, 'the card should hide on leaving a zone')
```

`window.game` is only exposed under `#debug`; check how the existing test opens the page and match it. If it does not use `#debug`, add it to that scenario's URL.

- [ ] **Step 2: Run the unit suite**

Run: `npm test`
Expected: PASS — arrangement, zones, projects, building, sign, plus the existing maths tests

- [ ] **Step 3: Run the smoke test**

Run: `npm run smoke`
Expected: PASS, console clean, both new assertions satisfied

- [ ] **Step 4: Update `readme.md`**

Three edits:

1. In the **Structure** tree, add `Interface/`, `World/Areas/`, `Zones.js`, and the two new data files, each with the one-line description used elsewhere in that tree.
2. Add a short **Areas** section after **The look**, saying that a project is one object in `data/projects.js`, that placement is derived from the index by `arrangeOnArc`, and that `Zones` decides which card shows — nearest wins, with hysteresis so a boundary does not strobe.
3. Note in **Testing** that the smoke test now also asserts the card appears and clears.

- [ ] **Step 5: Final check**

Run: `npm test && npm run build`
Expected: both pass. Do not commit — leave the working tree for the owner to review.

---

## Notes for the executor

- The four projects in `data/projects.js` are **placeholder text**. Do not invent detail beyond what is written there, and do not treat the placeholder copy as a requirement to preserve — the owner replaces it.
- If the pitched roof or the sign placement looks wrong in the browser, the numbers in `building.js` and `ProjectsArea.addSign` are meant to be adjusted by eye. That is tuning, not a redesign.
- `npm run smoke` is headed and needs a real GPU. `npm run smoke:headless` works everywhere but is slow and forces `#quality=low`.
