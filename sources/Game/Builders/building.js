import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildWedge } from './wedge.js'

/**
 * Parametric buildings.
 *
 * A landmark is described by four numbers rather than authored, so a new
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

/**
 * `mergeGeometries` refuses to mix indexed and non-indexed inputs, and
 * `buildWedge` already returns non-indexed. Everything is therefore converted
 * on the way in rather than on the way out.
 */
const unindexed = (geometry) =>
{
    if(!geometry.index)
        return geometry

    const flat = geometry.toNonIndexed()
    geometry.dispose()
    return flat
}

const box = (width, height, depth, position) =>
{
    const geometry = new RoundedBoxGeometry(width, height, depth, 1, 0.06)
    geometry.translate(...position)
    return unindexed(geometry)
}

/**
 * A gable, as two mirrored ramps meeting on the centre line.
 *
 * `buildWedge` rises along +X, so each half is turned a quarter turn to slope
 * along Z instead and shifted so its high edge lands on z = 0. Using it twice
 * rather than once is the difference between a roof and a lean-to.
 */
const gable = (width, depth, ridge, baseHeight) =>
{
    const quarter = depth * 0.25

    const low = buildWedge(depth * 0.5, ridge, width).geometry
    low.rotateY(-Math.PI * 0.5)
    low.translate(0, baseHeight, -quarter)

    const high = buildWedge(depth * 0.5, ridge, width).geometry
    high.rotateY(Math.PI * 0.5)
    high.translate(0, baseHeight, quarter)

    return [ low, high ]
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

    // Entrance on +X: a door standing proud of the wall, with an awning over it
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
        concrete.push(...gable(width, depth, ridge, bodyHeight))
        height = bodyHeight + ridge
    }
    else
    {
        const setback = FLOOR_HEIGHT * 1.1
        concrete.push(box(width * 0.66, setback, depth * 0.66, [ 0, bodyHeight + setback * 0.5, 0 ]))
        height = bodyHeight + setback
    }

    const faceted = (geometries) =>
    {
        const merged = mergeGeometries(geometries)
        merged.computeVertexNormals()
        return merged
    }

    return {
        parts: {
            concrete: faceted(concrete),
            glass: faceted(glass),
            accent: faceted(accent)
        },
        height,
        footprint: { width, depth }
    }
}
