import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

/**
 * Phase 1 lighting: one directional light with a shadow camera that follows the
 * car, plus ambient fill.
 *
 * The shadow camera has to travel with the focus point — a world-sized shadow
 * map would be too coarse to see the car's own shadow.
 */
export class Lighting
{
    constructor()
    {
        this.game = Game.getInstance()

        this.directionalLight = new THREE.DirectionalLight('#ffe9d6', 2.2)
        this.directionalLight.position.set(6, 12, 4)
        this.directionalLight.castShadow = true
        this.directionalLight.shadow.mapSize.set(2048, 2048)
        this.directionalLight.shadow.camera.near = 0.5
        this.directionalLight.shadow.camera.far = 60
        this.directionalLight.shadow.camera.top = 20
        this.directionalLight.shadow.camera.bottom = -20
        this.directionalLight.shadow.camera.left = -20
        this.directionalLight.shadow.camera.right = 20
        this.directionalLight.shadow.bias = -0.002
        this.game.scene.add(this.directionalLight)
        this.game.scene.add(this.directionalLight.target)

        this.ambientLight = new THREE.AmbientLight('#8fb7ff', 1.1)
        this.game.scene.add(this.ambientLight)

        this.offset = this.directionalLight.position.clone()

        this.game.ticker.events.on('tick', () => { this.update() }, 9)
    }

    update()
    {
        const focus = this.game.view.focusPoint

        this.directionalLight.position.copy(focus).add(this.offset)
        this.directionalLight.target.position.copy(focus)
    }
}
