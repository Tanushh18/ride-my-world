import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { lerp } from '../utilities/maths.js'

/**
 * The scooter's simulation half: a compact chassis and paired raycast wheels
 * driven by Rapier's DynamicRayCastVehicleController. The second wheel on each
 * axle is kept close to the centreline for stable contact with the ground.
 */
export class PhysicsVehicle
{
    constructor()
    {
        this.game = Game.getInstance()
        this.events = new Events()

        this.settings = {
            steeringAmplitude: 0.5,
            engineForce: 300,
            boostMultiplier: 2,
            topSpeed: 14,
            topSpeedBoost: 26,
            brakeAmplitude: 35,
            idleBrake: 0.06,
            reverseBrake: 0.4
        }

        // Measurements other systems read
        this.position = new THREE.Vector3(0, 3, 0)
        this.quaternion = new THREE.Quaternion()
        this.velocity = new THREE.Vector3()
        this.direction = new THREE.Vector3(1, 0, 0)
        this.forward = new THREE.Vector3(1, 0, 0)
        this.upward = new THREE.Vector3(0, 1, 0)
        this.speed = 0
        this.forwardSpeed = 0
        this.goingForward = true
        this.yRotation = 0
        this.airborne = false

        this.setChassis()
        this.controller = this.game.physics.world.createVehicleController(this.chassis.physical.body)
        this.setWheels()
        this.setDebug()

        this.game.ticker.events.on('tick', () => { this.updatePrePhysics() }, 2)
        this.game.ticker.events.on('tick', () => { this.updatePostPhysics() }, 5)
    }

    setChassis()
    {
        this.chassis = {}

        // A narrow deck and low centre of mass give the scooter a smaller
        // collision footprint without changing the shared object/physics API.
        const object = this.game.objects.add(null, {
            type: 'dynamic',
            position: this.position,
            friction: 0.4,
            canSleep: false,
            colliders: [
                { shape: 'cuboid', parameters: [ 0.98, 0.2, 0.24 ], mass: 2.5, position: { x: 0, y: -0.12, z: 0 }, centerOfMass: { x: 0, y: -0.42, z: 0 } },
                { shape: 'cuboid', parameters: [ 0.36, 0.16, 0.22 ], mass: 0, position: { x: -0.22, y: 0.2, z: 0 } },
                { shape: 'cuboid', parameters: [ 1.12, 0.26, 0.25 ], mass: 0, position: { x: 0.05, y: -0.18, z: 0 }, category: 'bumper' }
            ]
        })

        this.chassis.physical = object.physical
        this.chassis.mass = object.physical.body.mass()
    }

    setWheels()
    {
        this.wheels = {}
        this.wheels.inContactCount = 4
        this.wheels.items = []

        this.wheels.settings = {
            offset: { x: 0.88, y: 0, z: 0.17 },
            radius: 0.36,
            width: 0.19,
            restLength: 0.56,
            suspensionStiffness: 28,
            directionCs: { x: 0, y: -1, z: 0 },
            axleCs: { x: 0, y: 0, z: 1 },
            frictionSlip: 0.9,
            maxSuspensionForce: 150,
            maxSuspensionTravel: 1.5,
            sideFrictionStiffness: 3.5,
            suspensionCompression: 10,
            suspensionRelaxation: 2.7
        }

        const { offset, radius, restLength, directionCs, axleCs } = this.wheels.settings

        // Two close-together support wheels at each axle; the visual model
        // renders only one wheel at the centreline for a scooter silhouette.
        const positions = [
            new THREE.Vector3(  offset.x, offset.y,  offset.z),
            new THREE.Vector3(  offset.x, offset.y, -offset.z),
            new THREE.Vector3( -offset.x, offset.y,  offset.z),
            new THREE.Vector3( -offset.x, offset.y, -offset.z)
        ]

        for(const basePosition of positions)
        {
            this.controller.addWheel(basePosition, directionCs, axleCs, restLength, radius)

            this.wheels.items.push({
                basePosition,
                inContact: false,
                suspensionLength: restLength,
                rotation: 0,
                steering: 0
            })
        }

        this.applyWheelSettings()
    }

    applyWheelSettings()
    {
        const settings = this.wheels.settings

        for(let i = 0; i < this.wheels.items.length; i++)
        {
            this.controller.setWheelChassisConnectionPointCs(i, this.wheels.items[i].basePosition)
            this.controller.setWheelDirectionCs(i, settings.directionCs)
            this.controller.setWheelAxleCs(i, settings.axleCs)
            this.controller.setWheelRadius(i, settings.radius)
            this.controller.setWheelSuspensionRestLength(i, settings.restLength)
            this.controller.setWheelSuspensionStiffness(i, settings.suspensionStiffness)
            this.controller.setWheelFrictionSlip(i, settings.frictionSlip)
            this.controller.setWheelMaxSuspensionForce(i, settings.maxSuspensionForce)
            this.controller.setWheelMaxSuspensionTravel(i, settings.maxSuspensionTravel)
            this.controller.setWheelSideFrictionStiffness(i, settings.sideFrictionStiffness)
            this.controller.setWheelSuspensionCompression(i, settings.suspensionCompression)
            this.controller.setWheelSuspensionRelaxation(i, settings.suspensionRelaxation)
        }
    }

    updatePrePhysics()
    {
        const player = this.game.player
        const settings = this.settings

        // Engine force falls off past the top speed instead of hard-clamping,
        // which keeps acceleration smooth when boosting.
        const topSpeed = lerp(settings.topSpeed, settings.topSpeedBoost, player.boosting)
        const overflow = Math.max(0, this.speed - topSpeed)
        let engineForce = player.accelerating
            * (1 + player.boosting * settings.boostMultiplier)
            * settings.engineForce
            / (1 + overflow)

        // Braking: explicit brake, a light idle brake so the scooter settles,
        // and a stronger brake when the player asks for the opposite direction.
        let brake = player.braking

        if(!player.braking && Math.abs(player.accelerating) < 0.1)
            brake = settings.idleBrake

        if(this.speed > 0.5 &&
            ((player.accelerating > 0 && !this.goingForward) || (player.accelerating < 0 && this.goingForward)))
        {
            brake = settings.reverseBrake
            engineForce = 0
        }

        brake *= settings.brakeAmplitude
        const steer = player.steering * settings.steeringAmplitude

        this.controller.setWheelSteering(0, steer)
        this.controller.setWheelSteering(1, steer)

        for(let i = 0; i < 4; i++)
        {
            this.controller.setWheelBrake(i, brake)
            this.controller.setWheelEngineForce(i, engineForce)
        }

        // Averaged delta keeps the vehicle stable through frame-time spikes
        this.controller.updateVehicle(Math.min(1 / 60, this.game.ticker.deltaAverage))
    }

    updatePostPhysics()
    {
        const body = this.chassis.physical.body
        const newPosition = new THREE.Vector3().copy(body.translation())

        this.velocity.copy(newPosition).sub(this.position)
        this.position.copy(newPosition)
        this.quaternion.copy(body.rotation())

        this.forward.set(1, 0, 0).applyQuaternion(this.quaternion)
        this.upward.set(0, 1, 0).applyQuaternion(this.quaternion)

        const delta = Math.max(this.game.ticker.delta, 0.0001)
        this.speed = this.velocity.length() / delta

        if(this.velocity.lengthSq() > 0)
            this.direction.copy(this.velocity).normalize()

        const forwardRatio = this.direction.dot(this.forward)
        this.goingForward = forwardRatio > 0.5
        this.forwardSpeed = this.speed * forwardRatio
        this.yRotation = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ').y

        let inContactCount = 0

        for(let i = 0; i < 4; i++)
        {
            const wheel = this.wheels.items[i]

            wheel.inContact = this.controller.wheelIsInContact(i)
            wheel.suspensionLength = this.controller.wheelSuspensionLength(i) ?? this.wheels.settings.restLength
            wheel.rotation = this.controller.wheelRotation(i) ?? wheel.rotation
            wheel.steering = this.controller.wheelSteering(i) ?? 0

            if(wheel.inContact)
                inContactCount++
        }

        const wasAirborne = this.airborne
        this.wheels.inContactCount = inContactCount
        this.airborne = inContactCount === 0

        if(this.airborne !== wasAirborne)
            this.events.trigger(this.airborne ? 'takeOff' : 'land')
    }

    moveTo(position, yRotation = 0)
    {
        const body = this.chassis.physical.body

        body.setTranslation(position, true)
        body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yRotation), true)
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)

        this.position.copy(position)
        this.velocity.set(0, 0, 0)
    }

    setDebug()
    {
        const panel = this.game.debug.addFolder({ title: 'Scooter', expanded: true })

        if(!panel)
            return

        panel.addBinding(this.settings, 'engineForce', { min: 0, max: 800, step: 1 })
        panel.addBinding(this.settings, 'topSpeed', { min: 1, max: 40, step: 0.5 })
        panel.addBinding(this.settings, 'topSpeedBoost', { min: 1, max: 60, step: 0.5 })
        panel.addBinding(this.settings, 'steeringAmplitude', { min: 0.1, max: 1.2, step: 0.01 })
        panel.addBinding(this.settings, 'brakeAmplitude', { min: 0, max: 100, step: 1 })
        panel.addBinding(this.wheels.settings, 'restLength', { min: 0.3, max: 1.8, step: 0.01 })
            .on('change', () => { this.applyWheelSettings() })
        panel.addBinding(this.wheels.settings, 'suspensionStiffness', { min: 5, max: 80, step: 0.5 })
            .on('change', () => { this.applyWheelSettings() })
        panel.addBinding(this.wheels.settings, 'frictionSlip', { min: 0.1, max: 3, step: 0.01 })
            .on('change', () => { this.applyWheelSettings() })
        panel.addBinding(this, 'speed', { readonly: true, format: value => value.toFixed(2) })
    }
}
