import { seededRandom } from './maths.js'

/**
 * Pure, three-free placement and traffic helpers.
 *
 * Everything that belongs to the road is described in route coordinates:
 * `t` is progress along the route (0–1) and `offset` is the signed lateral
 * distance from the road centre line. Keeping this maths free of three.js lets
 * it be unit-tested and reused when the route geometry changes.
 */

/**
 * Rectangular no-go zones in route space. A zone covers `t ± halfT` and
 * lateral offsets between `minOffset` and `maxOffset` on `side` (0 = both).
 */
export const isReserved = (t, offset, zones) =>
{
    const side = Math.sign(offset)
    const distance = Math.abs(offset)

    for(const zone of zones)
    {
        if(zone.side !== 0 && zone.side !== side)
            continue
        if(Math.abs(t - zone.t) > zone.halfT)
            continue
        if(distance < zone.minOffset || distance > zone.maxOffset)
            continue
        return true
    }
    return false
}

/**
 * Scatter `count` seeded placements along a stretch of the route.
 * Returns `{ t, offset, rotation, scale, variant }` records. Candidates that
 * land inside a reserved zone or the `exclude` predicate are re-rolled, so the
 * result never contains an object standing in a road, river or banner.
 */
export const scatterAlongRoute = ({
    count,
    tMin,
    tMax,
    minOffset,
    maxOffset,
    seed = 1,
    variants = 1,
    scaleRange = [0.8, 1.2],
    zones = [],
    exclude = null,
    clusters = 0,
    maxAttempts = 12
}) =>
{
    const random = seededRandom(seed)
    const results = []

    // Cluster centres give natural groves and clearings instead of an even
    // sprinkle. With no clusters the distribution is uniform.
    const centres = []
    for(let i = 0; i < clusters; i++)
        centres.push({ t: tMin + random() * (tMax - tMin), spread: 0.012 + random() * 0.02 })

    for(let index = 0; index < count; index++)
    {
        for(let attempt = 0; attempt < maxAttempts; attempt++)
        {
            let t
            if(centres.length)
            {
                const centre = centres[Math.floor(random() * centres.length)]
                t = centre.t + (random() + random() - 1) * centre.spread * 2
            }
            else
                t = tMin + random() * (tMax - tMin)

            if(t < tMin || t > tMax)
                continue

            const sideSign = random() < 0.5 ? -1 : 1
            const offset = sideSign * (minOffset + random() * (maxOffset - minOffset))

            if(isReserved(t, offset, zones))
                continue
            if(exclude && exclude(t, offset))
                continue

            results.push({
                t,
                offset,
                rotation: random() * Math.PI * 2,
                scale: scaleRange[0] + random() * (scaleRange[1] - scaleRange[0]),
                variant: Math.floor(random() * variants),
                random: random()
            })
            break
        }
    }

    return results
}

/**
 * One traffic lane is a closed set of vehicles sharing a single speed, so the
 * spacing between them never changes and they can never overlap. The speed
 * itself eases between cruising and a slow roll, which gives smooth
 * acceleration and braking for the whole lane at once.
 */
export const laneSpeed = (time, { cruise, slow, period, phase = 0 }) =>
{
    const wave = 0.5 + 0.5 * Math.sin((time / period) * Math.PI * 2 + phase)
    return slow + (cruise - slow) * wave * wave * (3 - 2 * wave)
}

/** Brake intensity (0–1) from the lane's acceleration, for brake lights. */
export const brakeAmount = (speedNow, speedBefore, delta, strength = 0.9) =>
{
    if(delta <= 0)
        return 0
    const deceleration = (speedBefore - speedNow) / delta
    return Math.min(1, Math.max(0, deceleration * strength))
}

/**
 * Distance of a vehicle along a lane that is `length` long. Vehicles are
 * evenly spaced and wrap around, so each lane is a conveyor of cars.
 */
export const lanePosition = (distance, index, count, length) =>
    ((distance + (index / count) * length) % length + length) % length

/** Fade in/out near the ends of a lane so wrapping never visibly pops. */
export const laneFade = (position, length, fadeLength) =>
    Math.min(1, position / fadeLength, (length - position) / fadeLength)

/** Smooth triangle wave 0→1→0, used for back-and-forth walking. */
export const pingPong = (value) =>
{
    const wrapped = ((value % 2) + 2) % 2
    return wrapped <= 1 ? wrapped : 2 - wrapped
}

/**
 * Closed flight loop (a lissajous-style ellipse) around a centre, returned as
 * position and heading so birds turn naturally instead of orbiting rigidly.
 */
export const flightPath = (time, { radiusX, radiusZ, speed, phase = 0, height, bob = 0.4 }) =>
{
    const angle = time * speed + phase
    const x = Math.cos(angle) * radiusX
    const z = Math.sin(angle * 1.07) * radiusZ
    const dx = -Math.sin(angle) * radiusX
    const dz = Math.cos(angle * 1.07) * radiusZ * 1.07
    return {
        x,
        z,
        y: height + Math.sin(angle * 2.3) * bob,
        heading: Math.atan2(dx, dz)
    }
}
