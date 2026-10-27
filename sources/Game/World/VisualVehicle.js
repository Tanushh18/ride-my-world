import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Game } from '../Game.js'

/**
 * The visible scooter and rider. The underlying vehicle remains Rapier-driven;
 * this class is only the visual model that follows its chassis and wheel state.
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

        const addRoundedBox = (size, radius, position, materialName) =>
        {
            const geometry = new RoundedBoxGeometry(...size, 3, radius)
            const mesh = new THREE.Mesh(geometry, materials.get(materialName))
            mesh.position.set(...position)
            mesh.castShadow = true
            mesh.receiveShadow = true
            this.group.add(mesh)
            return mesh
        }

        const addSphere = (radius, position, materialName, scale = [ 1, 1, 1 ]) =>
        {
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 14, 10),
                materials.get(materialName)
            )
            mesh.position.set(...position)
            mesh.scale.set(...scale)
            mesh.castShadow = true
            mesh.receiveShadow = true
            this.group.add(mesh)
            return mesh
        }

        const addTubeBetween = (startValues, endValues, radius, materialName) =>
        {
            const start = new THREE.Vector3(...startValues)
            const end = new THREE.Vector3(...endValues)
            const direction = new THREE.Vector3().subVectors(end, start)
            const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, direction.length(), 10),
                materials.get(materialName)
            )

            mesh.position.copy(start).add(end).multiplyScalar(0.5)
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
            mesh.castShadow = true
            mesh.receiveShadow = true
            this.group.add(mesh)
            return mesh
        }

        // Scooter deck, lower shell, front apron, seat, and wheel guards.
        addRoundedBox([ 0.98, 0.12, 0.34 ], 0.055, [ 0.02, -0.13, 0 ], 'carDark')
        addRoundedBox([ 0.57, 0.39, 0.37 ], 0.12, [ -0.28, 0.12, 0 ], 'carPaint')
        addRoundedBox([ 0.34, 0.62, 0.36 ], 0.12, [ 0.48, 0.12, 0 ], 'carPaint')
        addRoundedBox([ 0.24, 0.13, 0.33 ], 0.055, [ 0.56, 0.43, 0 ], 'carPaintDark')
        addRoundedBox([ 0.62, 0.12, 0.29 ], 0.055, [ -0.27, 0.41, 0 ], 'carDark')
        addRoundedBox([ 0.46, 0.065, 0.29 ], 0.03, [ -0.72, -0.14, 0 ], 'carPaintDark')
        addRoundedBox([ 0.38, 0.065, 0.28 ], 0.03, [ 0.78, -0.16, 0 ], 'carPaintDark')

        // Steering stem and handlebars sit above the front apron.
        addTubeBetween([ 0.76, -0.2, 0 ], [ 0.42, 0.57, 0 ], 0.035, 'metal')

        const handlebar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.027, 0.027, 0.62, 10),
            materials.get('carDark')
        )
        handlebar.rotation.x = Math.PI * 0.5
        handlebar.position.set(0.42, 0.57, 0)
        handlebar.castShadow = true
        this.group.add(handlebar)

        for(const side of [ -1, 1 ])
        {
            // Mirrors and grips are mirrored across the scooter centreline.
            addRoundedBox([ 0.15, 0.055, 0.075 ], 0.025, [ 0.42, 0.57, side * 0.32 ], 'carDark')
            addTubeBetween([ 0.39, 0.59, side * 0.19 ], [ 0.28, 0.81, side * 0.25 ], 0.018, 'metal')
            addSphere(0.065, [ 0.28, 0.83, side * 0.25 ], 'metal', [ 0.9, 0.55, 1.15 ])

            // Simplified rider arms reach the handlebars.
            addTubeBetween([ 0.12, 0.76, side * 0.13 ], [ 0.39, 0.59, side * 0.23 ], 0.052, 'carDark')
            addSphere(0.058, [ 0.4, 0.59, side * 0.24 ], 'carPaintDark')

            // Legs fold forward onto the footboard rather than dangling beside the wheel.
            addTubeBetween([ -0.14, 0.45, side * 0.11 ], [ 0.2, -0.02, side * 0.095 ], 0.06, 'carDark')
        }

        // Stylised rider silhouette with a warm helmet and a cool visor.
        addRoundedBox([ 0.37, 0.47, 0.34 ], 0.14, [ -0.015, 0.65, 0 ], 'carDark')
        addSphere(0.215, [ 0.015, 1.005, 0 ], 'accent', [ 0.96, 1, 0.96 ])
        addRoundedBox([ 0.085, 0.105, 0.275 ], 0.035, [ 0.205, 1.015, 0 ], 'carGlass')

        // Headlamp, rear light, and a small front badge make the silhouette readable at distance.
        addSphere(0.105, [ 0.665, 0.27, 0 ], 'accent', [ 0.72, 0.8, 1 ])
        addRoundedBox([ 0.09, 0.12, 0.2 ], 0.035, [ -0.59, 0.21, 0 ], 'accentWarm')
        addRoundedBox([ 0.08, 0.08, 0.13 ], 0.025, [ 0.68, 0.02, 0 ], 'accentCool')

        // Small model details make the rider legible from a rear chase camera.
        // Backpack, jacket seams, helmet stripe, mirrors, rack, and exhaust
        // provide layered silhouettes instead of one flat humanoid primitive.
        addRoundedBox([ 0.24, 0.31, 0.3 ], 0.065, [ -0.285, 0.71, 0 ], 'carPaintDark')
        addRoundedBox([ 0.03, 0.21, 0.08 ], 0.015, [ -0.421, 0.72, 0 ], 'accentWarm')
        addRoundedBox([ 0.025, 0.24, 0.06 ], 0.012, [ -0.188, 1.01, 0 ], 'accentWarm')
        addRoundedBox([ 0.28, 0.035, 0.014 ], 0.008, [ -0.28, 0.18, 0.195 ], 'accent')
        addRoundedBox([ 0.28, 0.035, 0.014 ], 0.008, [ -0.28, 0.18, -0.195 ], 'accent')

        for(const side of [ -1, 1 ])
        {
            // A more defined shoulder and elbow break gives the rider a natural
            // riding pose when the scooter banks around a bend.
            addSphere(0.105, [ 0.095, 0.755, side * 0.145 ], 'carDark', [ 1.1, 0.93, 0.92 ])
            addSphere(0.064, [ 0.285, 0.645, side * 0.205 ], 'carDark')
            addTubeBetween([ -0.5, -0.11, side * 0.2 ], [ -0.11, -0.11, side * 0.2 ], 0.052, 'metal')
            addTubeBetween([ -0.67, 0.41, side * 0.12 ], [ -0.25, 0.41, side * 0.12 ], 0.022, 'metal')
        }

        // Rear wheel fender, illuminated tail lamp, and a registration plate.
        addRoundedBox([ 0.55, 0.11, 0.4 ], 0.055, [ -0.72, 0.05, 0 ], 'carPaint')
        addRoundedBox([ 0.05, 0.09, 0.24 ], 0.018, [ -0.866, 0.2, 0 ], 'accentWarm')
        addRoundedBox([ 0.045, 0.12, 0.23 ], 0.012, [ -0.835, -0.015, 0 ], 'metal')
        addRoundedBox([ 0.18, 0.045, 0.035 ], 0.01, [ -0.48, -0.12, 0.235 ], 'carDark')
        addRoundedBox([ 0.18, 0.045, 0.035 ], 0.01, [ -0.48, -0.12, -0.235 ], 'carDark')
    }

    setWheels()
    {
        const settings = this.game.physicsVehicle.wheels.settings

        const tyreGeometry = new THREE.CylinderGeometry(settings.radius, settings.radius, settings.width, 18)
        tyreGeometry.rotateX(Math.PI * 0.5)

        const rimGeometry = new THREE.CylinderGeometry(
            settings.radius * 0.53,
            settings.radius * 0.53,
            settings.width * 1.08,
            10
        )
        rimGeometry.rotateX(Math.PI * 0.5)

        const spokeGeometry = new RoundedBoxGeometry(
            settings.radius * 1.35,
            settings.radius * 0.1,
            settings.width * 1.1,
            2,
            0.025
        )

        const tyreMaterial = this.game.materials.get('tyre')
        const rimMaterial = this.game.materials.get('rim')

        this.wheels = []

        // The controller has paired raycast wheels for stability; only the two
        // centreline wheels are drawn, so the ride reads as a scooter.
        for(const index of [ 0, 2 ])
        {
            const physical = this.game.physicsVehicle.wheels.items[index]
            const holder = new THREE.Group()
            const spinner = new THREE.Group()

            const tyre = new THREE.Mesh(tyreGeometry, tyreMaterial)
            tyre.castShadow = true

            const rim = new THREE.Mesh(rimGeometry, rimMaterial)
            rim.castShadow = true

            const spokeA = new THREE.Mesh(spokeGeometry, rimMaterial)
            const spokeB = new THREE.Mesh(spokeGeometry, rimMaterial)
            spokeB.rotation.z = Math.PI * 0.5

            spinner.add(tyre, rim, spokeA, spokeB)
            holder.add(spinner)
            this.group.add(holder)

            this.wheels.push({ holder, spinner, physical })
        }
    }

    update()
    {
        // The portfolio ride is synchronized by ScrollTour along the road curve.
        // Do not overwrite its scooter pose with the parked physics chassis.
        if(this.game.view.scrollTour?.active)
            return

        const vehicle = this.game.physicsVehicle

        this.group.position.copy(vehicle.position)
        this.group.quaternion.copy(vehicle.quaternion)

        for(const wheel of this.wheels)
        {
            const { basePosition, suspensionLength, steering, rotation } = wheel.physical

            // Centre the visible wheels on the scooter, while following the
            // physical suspension and steering at the front.
            wheel.holder.position.set(
                basePosition.x,
                basePosition.y - suspensionLength,
                0
            )
            wheel.holder.rotation.y = steering
            wheel.spinner.rotation.z = -rotation
        }
    }
}
