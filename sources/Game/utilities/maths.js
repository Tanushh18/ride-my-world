export const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const lerp = (a, b, t) => a + (b - a) * t

export const remap = (value, inMin, inMax, outMin, outMax) =>
    outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)

export const remapClamp = (value, inMin, inMax, outMin, outMax) =>
{
    const remapped = remap(value, inMin, inMax, outMin, outMax)
    return outMin < outMax ? clamp(remapped, outMin, outMax) : clamp(remapped, outMax, outMin)
}

/**
 * Frame-rate independent approach towards a target.
 *
 * `smoothing` is the fraction of the remaining distance left after one second.
 * A plain `lerp(current, target, 0.1)` per frame moves twice as fast at 120fps,
 * which is why the camera needs this instead.
 */
export const damp = (current, target, smoothing, delta) =>
    lerp(target, current, Math.pow(smoothing, delta))

/** Shortest signed angle from a to b, in radians. */
export const smallestAngle = (a, b) =>
{
    const difference = (b - a) % (Math.PI * 2)
    return ((difference * 2) % (Math.PI * 2)) - difference
}

/** Deterministic pseudo-random generator, so the world is identical each load. */
export const seededRandom = (seed) =>
{
    let state = seed >>> 0

    return () =>
    {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
