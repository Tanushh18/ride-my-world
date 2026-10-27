import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Game } from '../Game.js'
import { buildWedge } from '../Builders/wedge.js'
import { seededRandom } from '../utilities/maths.js'

/**
 * The test course: ramps to jump, crates to scatter, barrels to knock over.
 *
 * It exercises the vehicle — suspension over a ramp, friction on a slope, mass
 * ratios against dynamic objects — and doubles as the thing that makes driving
 * around fun before the portfolio areas exist.
 */
export class Playground
{
    constructor()
    {
        this.game = Game.getInstance()
        this.random = seededRandom(7)
        this.group = new THREE.Group()
        this.group.name = 'DebugPlayground'
        this.game.scene.add(this.group)

        this.addRamp({ x: 18, z: 0 }, 0)
        this.addRamp({ x: -18, z: 12 }, Math.PI)
        this.addRamp({ x: 6, z: -22 }, Math.PI * 0.5)

        this.addCrateStack({ x: 26, z: 6 }, 3, 3)
        this.addCrateStack({ x: -14, z: -14 }, 2, 4)

        for(let i = 0; i < 14; i++)
            this.addBarrel()
    }

    /**
     * A launch ramp: a true wedge, simulated as a convex hull of the same six
     * corners, so what the car climbs is exactly what is drawn.
     */
    addRamp(position, yRotation)
    {
        const length = 11
        const height = 2.4
        const width = 7

        const wedge = buildWedge(length, height, width)
        const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yRotation)

        const group = new THREE.Group()
        group.position.set(position.x, 0, position.z)
        group.quaternion.copy(quaternion)
        this.group.add(group)

        const mesh = new THREE.Mesh(wedge.geometry, this.game.materials.get('wood'))
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)

        // A stripe along the lip, so the take-off point is readable at speed
        const lip = new THREE.Mesh(
            new RoundedBoxGeometry(0.5, 0.28, width * 1.02, 2, 0.08),
            this.game.materials.get('accent')
        )
        lip.castShadow = true
        lip.position.set(length * 0.5 - 0.18, height - 0.1, 0)
        group.add(lip)

        this.game.objects.add(null, {
            type: 'fixed',
            friction: 0.8,
            rotation: quaternion,
            position: { x: position.x, y: 0, z: position.z },
            colliders: [
                { shape: 'hull', parameters: [ wedge.points ], category: 'floor' }
            ]
        })
    }

    addCrateStack(position, columns, rows)
    {
        const size = 1.2
        const geometry = new RoundedBoxGeometry(size, size, size, 2, 0.08)

        for(let column = 0; column < columns; column++)
        {
            for(let row = 0; row < rows; row++)
            {
                const mesh = new THREE.Mesh(geometry, this.game.materials.get('wood'))
                mesh.castShadow = true
                mesh.receiveShadow = true
                this.group.add(mesh)

                this.game.objects.add(mesh, {
                    type: 'dynamic',
                    position: {
                        x: position.x + column * (size + 0.06),
                        y: size * 0.5 + row * (size + 0.06),
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

    addBarrel()
    {
        const radius = 0.42
        const height = 1.05

        // Sits outside the spawn clearing but within easy reach
        const angle = this.random() * Math.PI * 2
        const distance = 20 + this.random() * 55

        const group = new THREE.Group()

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, height, 12),
            this.game.materials.get('metal')
        )
        body.castShadow = true
        body.receiveShadow = true

        const band = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, height * 0.16, 12),
            this.game.materials.get('accentWarm')
        )
        band.castShadow = true

        group.add(body, band)
        this.group.add(group)

        this.game.objects.add(group, {
            type: 'dynamic',
            position: {
                x: Math.cos(angle) * distance,
                y: height * 0.5,
                z: Math.sin(angle) * distance
            },
            friction: 0.4,
            colliders: [
                { shape: 'cylinder', parameters: [ height * 0.5, radius ], mass: 0.3 }
            ]
        })
    }
}
