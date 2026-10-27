import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { clamp, damp, remapClamp, smallestAngle } from './utilities/maths.js'

/**
 * The follow camera.
 *
 * Two damped values do the work: a focus point that trails the car, and a
 * spherical orbit that swings behind it. Dragging takes manual control and
 * releases it a moment after the pointer goes up, so the camera never fights
 * the player.
 */
export class View
{
    constructor()
    {
        this.game = Game.getInstance()

        this.camera = new THREE.PerspectiveCamera(45, this.game.viewport.ratio, 0.1, 400)
        this.camera.position.set(-12, 8, 0)

        this.focusPoint = new THREE.Vector3()
        this.focusHeight = 1.05
        this.focusSmoothing = 0.0000001
        this.thetaSmoothing = 0.02
        this.radiusSmoothing = 0.05

        this.spherical = { radius: 9.5, phi: Math.PI * 0.37, theta: Math.PI }
        this.baseRadius = 9.5
        this.speedRadius = 4

        this.manual = { active: false, releaseAt: 0, holdDuration: 2.5 }

        this.setDrag()
        this.setDebug()

        this.game.ticker.events.on('tick', () => { this.update() }, 7)
        this.game.viewport.events.on('change', () => { this.resize() })
    }

    setDrag()
    {
        const element = this.game.canvasElement
        let pointerId = null
        let previous = { x: 0, y: 0 }

        element.addEventListener('pointerdown', (event) =>
        {
            pointerId = event.pointerId
            previous = { x: event.clientX, y: event.clientY }
            this.manual.active = true
            element.setPointerCapture(pointerId)
        })

        element.addEventListener('pointermove', (event) =>
        {
            if(event.pointerId !== pointerId)
                return

            const deltaX = event.clientX - previous.x
            const deltaY = event.clientY - previous.y
            previous = { x: event.clientX, y: event.clientY }

            this.spherical.theta -= deltaX * 0.005
            this.spherical.phi = clamp(this.spherical.phi - deltaY * 0.005, 0.15, Math.PI * 0.48)
        })

        const release = (event) =>
        {
            if(event.pointerId !== pointerId)
                return

            pointerId = null
            this.manual.active = false
            this.manual.releaseAt = this.game.ticker.elapsed
        }

        element.addEventListener('pointerup', release)
        element.addEventListener('pointercancel', release)

        element.addEventListener('wheel', (event) =>
        {
            event.preventDefault()
            this.baseRadius = clamp(this.baseRadius + Math.sign(event.deltaY) * 1.2, 6, 40)
        }, { passive: false })
    }

    update()
    {
        // When the page is in portfolio-tour mode, scroll owns the camera.
        // Return early so the vehicle-follow camera never fights the tour path.
        if(this.scrollTour?.active)
        {
            this.scrollTour.update(this.camera)
            return
        }

        const vehicle = this.game.physicsVehicle
        const delta = this.game.ticker.delta

        // Focus slightly ahead of the car so fast driving does not hug the edge
        const lead = remapClamp(vehicle.forwardSpeed, 0, 25, 0, 3)
        const target = vehicle.position.clone()
            .addScaledVector(vehicle.forward, lead)
        target.y += this.focusHeight

        this.focusPoint.x = damp(this.focusPoint.x, target.x, this.focusSmoothing, delta)
        this.focusPoint.y = damp(this.focusPoint.y, target.y, this.focusSmoothing, delta)
        this.focusPoint.z = damp(this.focusPoint.z, target.z, this.focusSmoothing, delta)

        // Swing behind the car unless the player is holding the camera
        const holding = this.manual.active
            || this.game.ticker.elapsed - this.manual.releaseAt < this.manual.holdDuration

        if(!holding)
        {
            const targetTheta = Math.PI - vehicle.yRotation
            const difference = smallestAngle(this.spherical.theta, targetTheta)
            this.spherical.theta += difference * (1 - Math.pow(this.thetaSmoothing, delta))
        }

        // Pull back with speed for a sense of acceleration
        const targetRadius = this.baseRadius + remapClamp(Math.abs(vehicle.forwardSpeed), 0, 30, 0, this.speedRadius)
        this.spherical.radius = damp(this.spherical.radius, targetRadius, this.radiusSmoothing, delta)

        const { radius, phi, theta } = this.spherical
        this.camera.position.set(
            this.focusPoint.x + radius * Math.sin(phi) * Math.cos(theta),
            this.focusPoint.y + radius * Math.cos(phi),
            this.focusPoint.z + radius * Math.sin(phi) * Math.sin(theta)
        )
        this.camera.lookAt(this.focusPoint)
    }

    resize()
    {
        this.camera.aspect = this.game.viewport.ratio
        this.camera.updateProjectionMatrix()
    }

    setDebug()
    {
        const panel = this.game.debug.addFolder({ title: 'View' })

        if(!panel)
            return

        panel.addBinding(this, 'baseRadius', { min: 5, max: 40, step: 0.5 })
        panel.addBinding(this, 'focusHeight', { min: 0, max: 5, step: 0.1 })
        panel.addBinding(this.spherical, 'phi', { min: 0.1, max: Math.PI * 0.49, step: 0.01 })
        panel.addBinding(this, 'thetaSmoothing', { min: 0.0001, max: 0.5, step: 0.0001 })
    }
}
