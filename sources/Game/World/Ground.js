import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * The ground: one large plane visually, one thick slab physically.
 *
 * The physical half is a deep cuboid rather than a plane so a car at speed can
 * never tunnel through it between two steps.
 */
export class Ground
{
    constructor(size = 460)
    {
        this.game = Game.getInstance()
        this.size = size

        const geometry = new THREE.PlaneGeometry(size, size)
        geometry.rotateX(-Math.PI * 0.5)

        this.mesh = new THREE.Mesh(geometry, this.game.materials.get('ground'))
        this.mesh.receiveShadow = true
        this.game.scene.add(this.mesh)

        this.game.objects.add(null, {
            type: 'fixed',
            friction: 0.9,
            restitution: 0,
            colliders: [
                { shape: 'cuboid', parameters: [ size * 0.5, 2, size * 0.5 ], position: { x: 0, y: -2, z: 0 }, category: 'floor' }
            ]
        })
    }
}
