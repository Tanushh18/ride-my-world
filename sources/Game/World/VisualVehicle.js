import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Game } from '../Game.js'

/**
 * The car's visual half, built entirely from rounded primitives.
 *
 * Rounded boxes rather than plain ones: the soft edge catches the light along
 * its curve, which is what stops the car reading as a crate. Its dimensions
 * mirror the chassis colliders, so what you see is what the physics simulates.
 *
 * The body group follows the chassis rigid body; the wheels are its children, so
 * suspension travel, steering and spin are plain local transforms.
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
        const materials = this.game.materials

        const parts = [
            // Main hull — matches the 1.28 x 0.34 x 0.75 chassis collider
            { size: [ 2.56, 0.6, 1.62 ], radius: 0.14, position: [ 0, -0.2, 0 ], material: 'carPaint' },
            // A thin glass band, not a full-height cabin
            { size: [ 1.4, 0.3, 1.42 ], radius: 0.1, position: [ -0.1, 0.22, 0 ], material: 'carGlass' },
            // Roof, slightly wider than the glass so it reads as an overhang
            { size: [ 1.5, 0.13, 1.46 ], radius: 0.06, position: [ -0.12, 0.42, 0 ], material: 'carPaint' },
            // Bumpers
            { size: [ 0.3, 0.3, 1.54 ], radius: 0.09, position: [ 1.3, -0.24, 0 ], material: 'carDark' },
            { size: [ 0.28, 0.3, 1.54 ], radius: 0.09, position: [ -1.32, -0.24, 0 ], material: 'carDark' },
            // Spoiler on two legs
            { size: [ 0.4, 0.09, 1.35 ], radius: 0.04, position: [ -1.26, 0.3, 0 ], material: 'carDark' },
            { size: [ 0.1, 0.24, 0.1 ], radius: 0.03, position: [ -1.22, 0.16, 0.55 ], material: 'carDark' },
            { size: [ 0.1, 0.24, 0.1 ], radius: 0.03, position: [ -1.22, 0.16, -0.55 ], material: 'carDark' },
            // Headlights
            { size: [ 0.1, 0.18, 0.26 ], radius: 0.05, position: [ 1.34, -0.06, 0.46 ], material: 'accent' },
            { size: [ 0.1, 0.18, 0.26 ], radius: 0.05, position: [ 1.34, -0.06, -0.46 ], material: 'accent' },
            // Tail lights
            { size: [ 0.09, 0.14, 0.24 ], radius: 0.045, position: [ -1.4, -0.06, 0.48 ], material: 'accentWarm' },
            { size: [ 0.09, 0.14, 0.24 ], radius: 0.045, position: [ -1.4, -0.06, -0.48 ], material: 'accentWarm' }
        ]

        for(const part of parts)
        {
            const geometry = new RoundedBoxGeometry(...part.size, 3, part.radius)
            const mesh = new THREE.Mesh(geometry, materials.get(part.material))

            mesh.position.set(...part.position)
            mesh.castShadow = true
            mesh.receiveShadow = true

            this.group.add(mesh)
        }
    }

    setWheels()
    {
        const settings = this.game.physicsVehicle.wheels.settings

        const tyreGeometry = new THREE.CylinderGeometry(settings.radius, settings.radius, settings.width, 16)
        tyreGeometry.rotateX(Math.PI * 0.5)

        // Slightly proud of the tyre, so the spin is readable at speed
        const rimGeometry = new THREE.CylinderGeometry(settings.radius * 0.52, settings.radius * 0.52, settings.width * 1.06, 6)
        rimGeometry.rotateX(Math.PI * 0.5)

        const spokeGeometry = new RoundedBoxGeometry(settings.radius * 1.5, settings.radius * 0.16, settings.width * 1.08, 2, 0.04)

        const tyreMaterial = this.game.materials.get('tyre')
        const rimMaterial = this.game.materials.get('rim')

        this.wheels = []

        for(const wheel of this.game.physicsVehicle.wheels.items)
        {
            // Holder takes the steering angle, spinner takes the rotation
            const holder = new THREE.Group()
            const spinner = new THREE.Group()

            const tyre = new THREE.Mesh(tyreGeometry, tyreMaterial)
            tyre.castShadow = true

            const rim = new THREE.Mesh(rimGeometry, rimMaterial)
            rim.castShadow = true

            const spoke = new THREE.Mesh(spokeGeometry, rimMaterial)

            spinner.add(tyre, rim, spoke)
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
