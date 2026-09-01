import { describe, expect, it } from 'vitest'
import { resolveActiveZone } from '../sources/Game/utilities/zones.js'

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
