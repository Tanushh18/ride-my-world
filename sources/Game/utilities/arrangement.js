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
