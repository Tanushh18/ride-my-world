import * as THREE from 'three/webgpu'

/**
 * A ramp, as a triangular prism.
 *
 * Built as a real wedge rather than a rotated box so its side profile reads as
 * a ramp from any angle — a rotated box seen head-on is just a slab.
 *
 * Returns the geometry alongside the eight corner points, so the collider can
 * be the exact same shape via a convex hull instead of an approximation.
 */
export const buildWedge = (length, height, width) =>
{
    const halfLength = length * 0.5
    const halfWidth = width * 0.5

    // Profile rises from the back edge to the front edge
    const shape = new THREE.Shape()
    shape.moveTo(-halfLength, 0)
    shape.lineTo(halfLength, 0)
    shape.lineTo(halfLength, height)
    shape.closePath()

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
    geometry.translate(0, 0, -halfWidth)

    const flat = geometry.toNonIndexed()
    flat.computeVertexNormals()
    geometry.dispose()

    // Six corners of the prism, in the order Rapier's convex hull wants them:
    // a flat list of x, y, z triples.
    const points = new Float32Array([
        -halfLength, 0, -halfWidth,
        halfLength, 0, -halfWidth,
        halfLength, height, -halfWidth,
        -halfLength, 0, halfWidth,
        halfLength, 0, halfWidth,
        halfLength, height, halfWidth
    ])

    return { geometry: flat, points, angle: Math.atan2(height, length) }
}
