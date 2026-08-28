import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

/**
 * Renderer setup and the render call itself.
 *
 * WebGPURenderer falls back to WebGL on its own when WebGPU is unavailable, so
 * one code path serves every browser. The active backend is reported because
 * the quality system needs to know which one it got.
 */
export class Rendering
{
    constructor()
    {
        this.game = Game.getInstance()
        this.backend = 'unknown'
    }

    async setRenderer()
    {
        this.renderer = new THREE.WebGPURenderer({
            canvas: this.game.canvasElement,
            powerPreference: 'high-performance',
            forceWebGL: false,
            antialias: this.game.viewport.pixelRatio < 2
        })

        this.renderer.setSize(this.game.viewport.width, this.game.viewport.height)
        this.renderer.setPixelRatio(this.game.viewport.pixelRatio)
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

        await this.renderer.init()

        this.backend = this.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL'
        console.log(`Rendering > backend: ${this.backend}`)

        return this.renderer
    }

    start()
    {
        // The renderer owns the loop, and the loop drives the ticker. This is
        // the only requestAnimationFrame in the project.
        this.renderer.setAnimationLoop((elapsed) => { this.game.ticker.update(elapsed) })

        this.game.ticker.events.on('tick', () => { this.render() }, 998)
        this.game.viewport.events.on('change', () => { this.resize() })
    }

    resize()
    {
        this.renderer.setSize(this.game.viewport.width, this.game.viewport.height)
        this.renderer.setPixelRatio(this.game.viewport.pixelRatio)
    }

    render()
    {
        this.renderer.render(this.game.scene, this.game.view.camera)
    }
}
