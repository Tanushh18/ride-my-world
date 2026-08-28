import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * A large ground plane, visual and physical.
 *
 * The physical half is a thick cuboid rather than a plane so a fast car can
 * never tunnel through it between two steps.
 */
export class Floor
{
    constructor(size = 400)
    {
        this.game = Game.getInstance()
        this.size = size

        const geometry = new THREE.PlaneGeometry(size, size)
        geometry.rotateX(-Math.PI * 0.5)

        this.mesh = new THREE.Mesh(geometry, new THREE.MeshLambertNodeMaterial({ color: '#96c34f' }))
        this.mesh.receiveShadow = true
        this.game.scene.add(this.mesh)

        this.game.objects.add(null, {
            type: 'fixed',
            friction: 0.9,
            restitution: 0,
            colliders: [
                { shape: 'cuboid', parameters: [ size * 0.5, 1, size * 0.5 ], position: { x: 0, y: -1, z: 0 }, category: 'floor' }
            ]
        })
    }
}
