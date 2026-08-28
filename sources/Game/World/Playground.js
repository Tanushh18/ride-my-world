import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { seededRandom } from '../utilities/maths.js'

/**
 * Phase 1 test course: ramps to jump, crates to scatter, pillars to bump into.
 *
 * Its real job is to exercise the vehicle — suspension over a ramp, friction on
 * a slope, mass ratios against dynamic objects — before any art exists.
 */
export class Playground
{
    constructor()
    {
        this.game = Game.getInstance()
        this.random = seededRandom(7)

        this.materials = {
            ramp: new THREE.MeshLambertNodeMaterial({ color: '#f2b23e' }),
            crate: new THREE.MeshLambertNodeMaterial({ color: '#c97b4a' }),
            pillar: new THREE.MeshLambertNodeMaterial({ color: '#7f8aa3' })
        }

        this.addRamp({ x: 18, z: 0 }, 0)
        this.addRamp({ x: -18, z: 12 }, Math.PI)
        this.addRamp({ x: 6, z: -22 }, Math.PI * 0.5)

        this.addCrateStack({ x: 26, z: 6 }, 3, 2)
        this.addCrateStack({ x: -14, z: -14 }, 2, 3)

        for(let i = 0; i < 10; i++)
            this.addPillar({
                x: (this.random() - 0.5) * 90,
                z: (this.random() - 0.5) * 90
            })
    }

    /** A wedge, built as a rotated box sunk into the ground. */
    addRamp(position, yRotation)
    {
        const length = 10
        const height = 0.6
        const width = 7
        const angle = Math.atan2(2.2, length)

        const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yRotation, angle, 'YZX'))

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), this.materials.ramp)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.position.set(position.x, 0, position.z)
        mesh.quaternion.copy(quaternion)
        this.game.scene.add(mesh)

        this.game.objects.add(null, {
            type: 'fixed',
            friction: 0.8,
            rotation: quaternion,
            position: { x: position.x, y: 0, z: position.z },
            colliders: [
                { shape: 'cuboid', parameters: [ length * 0.5, height * 0.5, width * 0.5 ], category: 'floor' }
            ]
        })
    }

    addCrateStack(position, columns, rows)
    {
        const size = 1.2

        for(let column = 0; column < columns; column++)
        {
            for(let row = 0; row < rows; row++)
            {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this.materials.crate)
                mesh.castShadow = true
                mesh.receiveShadow = true
                this.game.scene.add(mesh)

                this.game.objects.add(mesh, {
                    type: 'dynamic',
                    position: {
                        x: position.x + column * (size + 0.05),
                        y: size * 0.5 + row * (size + 0.05),
                        z: position.z
                    },
                    friction: 0.6,
                    colliders: [
                        { shape: 'cuboid', parameters: [ size * 0.5, size * 0.5, size * 0.5 ], mass: 0.4 }
                    ]
                })
            }
        }
    }

    addPillar(position)
    {
        const radius = 0.5 + this.random() * 0.5
        const height = 1.5 + this.random() * 2.5

        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), this.materials.pillar)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.game.scene.add(mesh)

        this.game.objects.add(mesh, {
            type: 'dynamic',
            position: { x: position.x, y: height * 0.5, z: position.z },
            friction: 0.5,
            colliders: [
                { shape: 'cylinder', parameters: [ height * 0.5, radius ], mass: 1.5 }
            ]
        })
    }
}
