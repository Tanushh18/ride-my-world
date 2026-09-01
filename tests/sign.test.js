import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { buildSign } from '../sources/Game/Builders/sign.js'

describe('buildSign', () =>
{
    it('returns a plane sized to the arguments', () =>
    {
        const { geometry } = buildSign({ text: 'Wholesale Marketplace', width: 6, height: 1.4 })
        geometry.computeBoundingBox()

        const size = geometry.boundingBox.getSize(new THREE.Vector3())

        expect(size.x).toBeCloseTo(6, 5)
        expect(size.y).toBeCloseTo(1.4, 5)
    })

    it('falls back to no texture where there is no canvas, rather than throwing', () =>
    {
        // Node has no `document`. A missing sign must never take the world down,
        // so the caller gets a plain accent board instead.
        const { texture } = buildSign({ text: 'Anything', width: 6, height: 1.4 })

        expect(texture).toBe(null)
    })
})
