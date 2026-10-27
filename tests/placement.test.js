import { describe, expect, it } from 'vitest'
import {
    brakeAmount, flightPath, isReserved, laneFade, lanePosition, laneSpeed, pingPong, scatterAlongRoute
} from '../sources/Game/utilities/placement.js'

describe('scatterAlongRoute', () =>
{
    const options = { count: 80, tMin: 0.1, tMax: 0.5, minOffset: 6, maxOffset: 30, seed: 7, variants: 4 }

    it('is deterministic for a seed', () =>
    {
        expect(scatterAlongRoute(options)).toEqual(scatterAlongRoute(options))
    })

    it('differs between seeds', () =>
    {
        expect(scatterAlongRoute({ ...options, seed: 8 })).not.toEqual(scatterAlongRoute(options))
    })

    it('keeps placements inside the requested route and offset range', () =>
    {
        for(const item of scatterAlongRoute(options))
        {
            expect(item.t).toBeGreaterThanOrEqual(0.1)
            expect(item.t).toBeLessThanOrEqual(0.5)
            expect(Math.abs(item.offset)).toBeGreaterThanOrEqual(6)
            expect(Math.abs(item.offset)).toBeLessThanOrEqual(30)
            expect(item.variant).toBeLessThan(4)
        }
    })

    it('never places anything inside a reserved zone', () =>
    {
        const zones = [{ t: 0.3, halfT: 0.05, side: 1, minOffset: 0, maxOffset: 40 }]
        const items = scatterAlongRoute({ ...options, zones })
        expect(items.length).toBeGreaterThan(20)
        for(const item of items)
            expect(isReserved(item.t, item.offset, zones)).toBe(false)
    })

    it('honours the exclude predicate (for example a river)', () =>
    {
        const items = scatterAlongRoute({ ...options, exclude: (t, offset) => offset > 0 })
        for(const item of items)
            expect(item.offset).toBeLessThan(0)
    })

    it('groups placements into clusters when asked', () =>
    {
        const spread = (items) =>
        {
            const sorted = items.map(item => item.t).sort((a, b) => a - b)
            let big = 0
            for(let i = 1; i < sorted.length; i++)
                if(sorted[i] - sorted[i - 1] > 0.02)
                    big++
            return big
        }
        const uniform = scatterAlongRoute({ ...options, count: 120 })
        const grouped = scatterAlongRoute({ ...options, count: 120, clusters: 3 })
        expect(spread(grouped)).toBeGreaterThan(spread(uniform))
    })
})

describe('isReserved', () =>
{
    const zones = [{ t: 0.5, halfT: 0.01, side: -1, minOffset: 2, maxOffset: 10 }]

    it('matches only the right side, range and stretch', () =>
    {
        expect(isReserved(0.505, -5, zones)).toBe(true)
        expect(isReserved(0.505, 5, zones)).toBe(false)
        expect(isReserved(0.52, -5, zones)).toBe(false)
        expect(isReserved(0.505, -12, zones)).toBe(false)
    })
})

describe('traffic lanes', () =>
{
    const profile = { cruise: 9, slow: 3, period: 20 }

    it('keeps the lane speed between slow and cruise', () =>
    {
        for(let time = 0; time < 40; time += 0.5)
        {
            const speed = laneSpeed(time, profile)
            expect(speed).toBeGreaterThanOrEqual(3 - 1e-9)
            expect(speed).toBeLessThanOrEqual(9 + 1e-9)
        }
    })

    it('changes speed gradually (no jumps)', () =>
    {
        let previous = laneSpeed(0, profile)
        for(let time = 0.05; time < 40; time += 0.05)
        {
            const speed = laneSpeed(time, profile)
            expect(Math.abs(speed - previous)).toBeLessThan(0.2)
            previous = speed
        }
    })

    it('keeps vehicles in a lane evenly spaced so they cannot collide', () =>
    {
        const length = 100
        const count = 5
        const positions = Array.from({ length: count }, (_, i) => lanePosition(37.3, i, count, length)).sort((a, b) => a - b)
        for(let i = 1; i < count; i++)
            expect(positions[i] - positions[i - 1]).toBeCloseTo(length / count, 6)
    })

    it('wraps positions into the lane length, including negatives', () =>
    {
        expect(lanePosition(-5, 0, 4, 100)).toBeCloseTo(95)
        expect(lanePosition(250, 1, 4, 100)).toBeCloseTo(75)
    })

    it('fades vehicles at lane ends only', () =>
    {
        expect(laneFade(0, 100, 5)).toBe(0)
        expect(laneFade(50, 100, 5)).toBe(1)
        expect(laneFade(99, 100, 5)).toBeCloseTo(0.2)
    })

    it('reports braking only while decelerating', () =>
    {
        expect(brakeAmount(4, 6, 0.1)).toBe(1)
        expect(brakeAmount(6, 4, 0.1)).toBe(0)
        expect(brakeAmount(4, 6, 0)).toBe(0)
    })
})

describe('pingPong / flightPath', () =>
{
    it('bounces between 0 and 1', () =>
    {
        expect(pingPong(0.25)).toBeCloseTo(0.25)
        expect(pingPong(1.25)).toBeCloseTo(0.75)
        expect(pingPong(2.25)).toBeCloseTo(0.25)
        expect(pingPong(-0.25)).toBeCloseTo(0.25)
    })

    it('keeps a bird inside its loop and near its cruising height', () =>
    {
        for(let time = 0; time < 60; time += 0.7)
        {
            const point = flightPath(time, { radiusX: 20, radiusZ: 10, speed: 0.4, height: 14, bob: 0.5 })
            expect(Math.abs(point.x)).toBeLessThanOrEqual(20)
            expect(Math.abs(point.z)).toBeLessThanOrEqual(10)
            expect(Math.abs(point.y - 14)).toBeLessThanOrEqual(0.5 + 1e-9)
        }
    })
})
