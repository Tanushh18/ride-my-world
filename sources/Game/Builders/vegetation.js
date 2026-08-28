import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Geometry builders for the plant life.
 *
 * Each returns a single merged geometry per material, so a whole forest costs
 * one instanced draw call per part. Everything is converted to non-indexed with
 * recomputed normals to force flat shading — faceted surfaces are what make
 * low-poly shapes read as deliberate rather than low-detail.
 */
const faceted = (geometry) =>
{
    const flat = geometry.toNonIndexed()
    flat.computeVertexNormals()
    geometry.dispose()
    return flat
}

const blob = (radius, position, scale = [ 1, 1, 1 ]) =>
{
    const geometry = new THREE.IcosahedronGeometry(radius, 0)
    geometry.scale(...scale)
    geometry.translate(...position)
    return geometry
}

/**
 * @param {number} variant 0 rounded, 1 tall and narrow, 2 wide and layered
 */
export const buildTree = (variant = 0) =>
{
    const trunkHeight = [ 1.9, 2.9, 1.5 ][variant]
    const trunk = new THREE.CylinderGeometry(0.15, 0.24, trunkHeight, 7)
    trunk.translate(0, trunkHeight * 0.5, 0)

    const crowns = [
        [
            blob(1.15, [ 0, trunkHeight + 0.75, 0 ]),
            blob(0.8, [ 0.55, trunkHeight + 0.35, 0.35 ]),
            blob(0.7, [ -0.5, trunkHeight + 0.5, -0.4 ])
        ],
        [
            blob(0.85, [ 0, trunkHeight + 0.6, 0 ], [ 1, 1.5, 1 ]),
            blob(0.6, [ 0.25, trunkHeight + 1.5, -0.2 ])
        ],
        [
            blob(1.35, [ 0, trunkHeight + 0.5, 0 ], [ 1, 0.62, 1 ]),
            blob(0.95, [ 0.15, trunkHeight + 1.2, 0.1 ], [ 1, 0.62, 1 ])
        ]
    ][variant]

    return {
        trunk: faceted(trunk),
        foliage: faceted(mergeGeometries(crowns)),
        height: trunkHeight,
        radius: 0.3
    }
}

export const buildRock = (variant = 0) =>
{
    const parts = [
        [ blob(1, [ 0, 0.35, 0 ], [ 1, 0.65, 1.1 ]) ],
        [ blob(0.8, [ 0, 0.3, 0 ], [ 1.3, 0.7, 0.9 ]), blob(0.45, [ 0.7, 0.2, 0.3 ]) ],
        [ blob(0.55, [ 0, 0.25, 0 ], [ 1, 0.9, 1 ]), blob(0.35, [ -0.5, 0.15, 0.25 ]) ]
    ][variant]

    return faceted(mergeGeometries(parts))
}

export const buildBush = (variant = 0) =>
{
    const parts = [
        [ blob(0.5, [ 0, 0.3, 0 ], [ 1.2, 0.85, 1.1 ]) ],
        [ blob(0.42, [ 0, 0.28, 0 ]), blob(0.3, [ 0.4, 0.18, 0.15 ]), blob(0.26, [ -0.32, 0.2, -0.2 ]) ]
    ][variant]

    return faceted(mergeGeometries(parts))
}
