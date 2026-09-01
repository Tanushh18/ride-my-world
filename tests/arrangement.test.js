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
