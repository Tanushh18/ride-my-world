import * as THREE from 'three/webgpu'
import { color, uniform, vec3 } from 'three/tsl'
import { Game } from './Game.js'
import palette from '../data/palette.js'

/**
 * The sun, in two halves.
 *
 * A real DirectionalLight exists only to produce a shadow map — the stylised
 * material throws away its diffuse contribution and instead reads the uniforms
 * below. That split is what allows flat, tinted shading while still getting
 * real cast shadows.
 *
 * The shadow camera travels with the car, because a shadow map stretched over
 * the whole world would be far too coarse to show the car's own shadow.
 */
export class Lighting
{
    constructor()
    {
        this.game = Game.getInstance()

        this.direction = new THREE.Vector3(0.55, 0.72, 0.42).normalize()
        this.distance = 30

        // Read by every stylised material
        this.directionUniform = uniform(vec3(this.direction.x, this.direction.y, this.direction.z))
        this.colorUniform = uniform(color(palette.sun))
        this.intensityUniform = uniform(1.06)
        this.shadowColorUniform = uniform(color(palette.shadow))
        this.shadowStrength = uniform(0.92)

        // Where the flat terminator sits. The two edges being close together is
        // what makes the shading read as cel shading rather than a gradient.
        this.coreShadowEdgeLow = uniform(0.02)
        this.coreShadowEdgeHigh = uniform(0.28)

        // Light bouncing up off the ground, so undersides pick up grass colour
        this.bounceColorUniform = uniform(color(palette.grassMid))
        this.bounceStrength = uniform(0.35)
        this.bounceHeight = uniform(7)

        this.setLight()
        this.setDebug()

        this.game.ticker.events.on('tick', () => { this.update() }, 9)
    }

    setLight()
    {
        this.light = new THREE.DirectionalLight('#ffffff', 1)
        this.light.castShadow = true
        const mapSize = this.game.quality.shadowMapSize
        this.light.shadow.mapSize.set(mapSize, mapSize)
        this.light.shadow.camera.near = 0.5
        this.light.shadow.camera.far = 80
        this.light.shadow.camera.top = 22
        this.light.shadow.camera.bottom = -22
        this.light.shadow.camera.left = -22
        this.light.shadow.camera.right = 22
        this.light.shadow.bias = -0.0015
        this.light.shadow.normalBias = 0.02

        this.game.scene.add(this.light)
        this.game.scene.add(this.light.target)
    }

    update()
    {
        const focus = this.game.view.focusPoint

        this.light.position.copy(focus).addScaledVector(this.direction, this.distance)
        this.light.target.position.copy(focus)
    }

    setDebug()
    {
        const panel = this.game.debug.addFolder({ title: 'Lighting' })

        if(!panel)
            return

        panel.addBinding(this.intensityUniform, 'value', { label: 'sunIntensity', min: 0, max: 3, step: 0.01 })
        panel.addBinding(this.coreShadowEdgeLow, 'value', { label: 'coreEdgeLow', min: -1, max: 1, step: 0.01 })
        panel.addBinding(this.coreShadowEdgeHigh, 'value', { label: 'coreEdgeHigh', min: -1, max: 1, step: 0.01 })
        panel.addBinding(this.shadowStrength, 'value', { label: 'shadowStrength', min: 0, max: 1, step: 0.01 })
        panel.addBinding(this.bounceStrength, 'value', { label: 'bounce', min: 0, max: 1, step: 0.01 })
        panel.addBinding(this.bounceHeight, 'value', { label: 'bounceHeight', min: 1, max: 20, step: 0.1 })
    }
}
