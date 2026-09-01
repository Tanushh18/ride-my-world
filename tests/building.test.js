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

        // Half of 8 wide and 6 deep, with a little slack for the parapet
        expect(box.max.x).toBeLessThanOrEqual(4.6)
        expect(box.max.z).toBeLessThanOrEqual(3.25)
        expect(box.min.y).toBeGreaterThanOrEqual(-0.01)
    })

    it('builds a gable whose ridge sits on the centre line, not a lean-to', () =>
    {
        const { parts, height } = buildBuilding({ ...base, roof: 'pitched' })
        const position = parts.concrete.attributes.position

        // The highest vertices must straddle z = 0 rather than sit at one edge
        let ridgeZ = []

        for(let i = 0; i < position.count; i++)
            if(Math.abs(position.getY(i) - height) < 1e-4)
                ridgeZ.push(position.getZ(i))

        expect(ridgeZ.length).toBeGreaterThan(0)

        for(const z of ridgeZ)
            expect(Math.abs(z)).toBeLessThan(1e-4)
    })
})
