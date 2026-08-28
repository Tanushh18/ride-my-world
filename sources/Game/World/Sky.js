import * as THREE from 'three/webgpu'
import { color, mix, positionLocal, uniform } from 'three/tsl'
import { Game } from '../Game.js'
import palette from '../../data/palette.js'

/**
 * A gradient dome that rides along with the camera.
 *
 * An inverted sphere is used rather than `scene.backgroundNode` because its
 * shading is plain local-space maths — predictable, and easy to extend into a
 * day/night cycle later. The horizon colour matches the fog colour, so distant
 * geometry dissolves into the sky with no visible seam.
 */
export class Sky
{
    constructor()
    {
        this.game = Game.getInstance()

        this.radius = 320
        this.horizonColor = uniform(color(palette.skyHorizon))
        this.zenithColor = uniform(color(palette.skyZenith))
        this.horizonHeight = uniform(0.02)
        this.zenithHeight = uniform(0.55)

        const material = new THREE.MeshBasicNodeMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            fog: false
        })

        // -1 at the bottom of the dome, 1 at the top
        const heightRatio = positionLocal.y.div(this.radius)

        material.colorNode = mix(
            this.horizonColor,
            this.zenithColor,
            heightRatio.smoothstep(this.horizonHeight, this.zenithHeight)
        )

        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 32, 16), material)
        this.mesh.frustumCulled = false
        this.mesh.renderOrder = -1
        this.game.scene.add(this.mesh)

        this.game.ticker.events.on('tick', () => { this.update() }, 10)

        this.setDebug()
    }

    update()
    {
        // Keeping the dome centred on the camera makes it unreachable
        this.mesh.position.copy(this.game.view.camera.position)
    }

    setDebug()
    {
        const panel = this.game.debug.addFolder({ title: 'Sky' })

        if(!panel)
            return

        panel.addBinding(this.horizonHeight, 'value', { label: 'horizon', min: -0.5, max: 1, step: 0.01 })
        panel.addBinding(this.zenithHeight, 'value', { label: 'zenith', min: 0, max: 1, step: 0.01 })
    }
}
