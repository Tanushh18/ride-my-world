import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * The car's visual half, built entirely from primitives.
 *
 * The body group is synced to the chassis rigid body; the wheels are its
 * children, so their suspension travel, steering and spin are plain local
 * transforms. Wheel geometry is baked pointing along Z (the axle) so spinning
 * is a single rotation.
 */
export class VisualVehicle
{
    constructor()
    {
        this.game = Game.getInstance()

        this.group = new THREE.Group()
        this.game.scene.add(this.group)

        this.setBody()
        this.setWheels()

        this.game.ticker.events.on('tick', () => { this.update() }, 8)
    }

    setBody()
    {
        const paint = new THREE.MeshLambertNodeMaterial({ color: '#ff5a3c' })
        const dark = new THREE.MeshLambertNodeMaterial({ color: '#2b2f44' })
        const glass = new THREE.MeshLambertNodeMaterial({ color: '#8ad8ff' })

        // Half-extents mirror the chassis colliders so the visual matches the
        // simulation instead of merely resembling it.
        const parts = [
            { size: [ 2.6, 0.8, 1.7 ], position: [ 0, -0.1, 0 ], material: paint },
            { size: [ 1.0, 0.3, 1.3 ], position: [ 0, 0.4, 0 ], material: glass },
            { size: [ 0.5, 0.25, 1.75 ], position: [ 1.15, -0.05, 0 ], material: dark },
            { size: [ 0.35, 0.5, 1.5 ], position: [ -1.3, 0.15, 0 ], material: dark }
        ]

        for(const part of parts)
        {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...part.size), part.material)
            mesh.position.set(...part.position)
            mesh.castShadow = true
            mesh.receiveShadow = true
            this.group.add(mesh)
        }
    }

    setWheels()
    {
        const settings = this.game.physicsVehicle.wheels.settings

        const tyreGeometry = new THREE.CylinderGeometry(settings.radius, settings.radius, settings.width, 18)
        tyreGeometry.rotateX(Math.PI * 0.5)

        // A hub bar makes the spin readable; a plain cylinder looks static.
        const hubGeometry = new THREE.BoxGeometry(settings.radius * 1.5, settings.radius * 0.28, settings.width * 1.05)

        const tyreMaterial = new THREE.MeshLambertNodeMaterial({ color: '#22242f' })
        const hubMaterial = new THREE.MeshLambertNodeMaterial({ color: '#f2f2f2' })

        this.wheels = []

        for(const wheel of this.game.physicsVehicle.wheels.items)
        {
            // Holder takes the steering angle, spinner takes the rotation
            const holder = new THREE.Group()
            const spinner = new THREE.Group()

            const tyre = new THREE.Mesh(tyreGeometry, tyreMaterial)
            tyre.castShadow = true

            const hub = new THREE.Mesh(hubGeometry, hubMaterial)
            hub.castShadow = true

            spinner.add(tyre, hub)
            holder.add(spinner)
            this.group.add(holder)

            this.wheels.push({ holder, spinner, physical: wheel })
        }
    }

    update()
    {
        const vehicle = this.game.physicsVehicle

        this.group.position.copy(vehicle.position)
        this.group.quaternion.copy(vehicle.quaternion)

        for(const wheel of this.wheels)
        {
            const { basePosition, suspensionLength, steering, rotation } = wheel.physical

            // Wheel centre = connection point + suspension direction * length
            wheel.holder.position.set(
                basePosition.x,
                basePosition.y - suspensionLength,
                basePosition.z
            )
            wheel.holder.rotation.y = steering
            wheel.spinner.rotation.z = -rotation
        }
    }
}
