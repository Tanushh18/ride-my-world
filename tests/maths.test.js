import { describe, expect, it } from 'vitest'
import { clamp, damp, lerp, remap, remapClamp, seededRandom, smallestAngle } from '../sources/Game/utilities/maths.js'

describe('clamp', () =>
{
    it('passes values inside the range through', () =>
    {
        expect(clamp(0.5, 0, 1)).toBe(0.5)
    })

    it('clamps both ends', () =>
    {
        expect(clamp(-3, 0, 1)).toBe(0)
        expect(clamp(9, 0, 1)).toBe(1)
    })
})

describe('lerp / remap', () =>
{
    it('interpolates', () =>
    {
        expect(lerp(0, 10, 0.25)).toBe(2.5)
    })

    it('remaps between ranges', () =>
    {
        expect(remap(5, 0, 10, 0, 100)).toBe(50)
    })

    it('clamps a remap to the output range', () =>
    {
        expect(remapClamp(50, 0, 10, 0, 100)).toBe(100)
        expect(remapClamp(-50, 0, 10, 0, 100)).toBe(0)
    })

    it('clamps a remap whose output range is inverted', () =>
    {
        // Used for things like "more speed means less camera damping"
        expect(remapClamp(50, 0, 10, 100, 0)).toBe(0)
        expect(remapClamp(-50, 0, 10, 100, 0)).toBe(100)
    })
})

describe('damp', () =>
{
    it('approaches the target without overshooting', () =>
    {
        let value = 0

        for(let i = 0; i < 200; i++)
            value = damp(value, 10, 0.01, 1 / 60)

        expect(value).toBeGreaterThan(9.9)
        expect(value).toBeLessThanOrEqual(10)
    })

    it('is frame-rate independent', () =>
    {
        // One second of damping must land in the same place whether it was
        // computed in 60 steps or 120. This is the whole reason damp() exists.
        let at60 = 0
        for(let i = 0; i < 60; i++)
            at60 = damp(at60, 1, 0.01, 1 / 60)

        let at120 = 0
        for(let i = 0; i < 120; i++)
            at120 = damp(at120, 1, 0.01, 1 / 120)

        expect(at60).toBeCloseTo(at120, 6)
    })
})

describe('smallestAngle', () =>
{
    it('returns the short way round', () =>
    {
        expect(smallestAngle(0, 0.5)).toBeCloseTo(0.5, 6)
        expect(smallestAngle(0, -0.5)).toBeCloseTo(-0.5, 6)
    })

    it('crosses the wrap point instead of going the long way', () =>
    {
        // From just below 2PI to just above 0 is a small positive step
        expect(smallestAngle(Math.PI * 2 - 0.1, 0.1)).toBeCloseTo(0.2, 6)
        expect(smallestAngle(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2, 6)
    })

    it('never returns more than half a turn', () =>
    {
        for(let i = 0; i < 100; i++)
        {
            const a = Math.random() * Math.PI * 4 - Math.PI * 2
            const b = Math.random() * Math.PI * 4 - Math.PI * 2
            expect(Math.abs(smallestAngle(a, b))).toBeLessThanOrEqual(Math.PI + 1e-9)
        }
    })
})

describe('seededRandom', () =>
{
    it('is deterministic for a given seed', () =>
    {
        const first = seededRandom(42)
        const second = seededRandom(42)

        for(let i = 0; i < 20; i++)
            expect(first()).toBe(second())
    })

    it('differs between seeds', () =>
    {
        expect(seededRandom(1)()).not.toBe(seededRandom(2)())
    })

    it('stays within 0..1', () =>
    {
        const random = seededRandom(1234)

        for(let i = 0; i < 500; i++)
        {
            const value = random()
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThan(1)
        }
    })
})
