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
 * Lives here rather than next to `Zones` so it can be tested: anything that
 * imports `Game` also imports Rapier's WASM package, which Vitest cannot load.
 *
 * @param {Array<{id: string, position: {x: number, z: number}, radius: number}>} zones
 * @param {{x: number, z: number}} position
 * @param {string|null} currentId  The zone active last frame, or null
 * @param {number} hysteresis      Multiplier on the radius before leaving
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
