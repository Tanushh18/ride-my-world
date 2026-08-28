import * as THREE from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { Game } from './Game.js'

/**
 * Renderer setup, post-processing and the render call.
 *
 * WebGPURenderer falls back to WebGL2 on its own when WebGPU is unavailable, so
 * one code path serves every browser. The active backend is reported because the
 * quality system will need to know which one it got.
 */
export class Rendering
{
    constructor()
    {
        this.game = Game.getInstance()
        this.backend = 'unknown'
        this.postProcessing = null
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

        // Transparency and draw order are controlled explicitly rather than by
        // distance, so the sky dome and overlays stay predictable
        this.renderer.sortObjects = false
        this.renderer.setOpaqueSort((a, b) => a.renderOrder - b.renderOrder)
        this.renderer.setTransparentSort((a, b) => a.renderOrder - b.renderOrder)

        await this.renderer.init()

        this.backend = this.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL'
        console.log(`Rendering > backend: ${this.backend}`)

        return this.renderer
    }

    /**
     * A restrained bloom: threshold above 1 means only genuinely bright things
     * glow, which keeps the flat palette flat instead of washing it out.
     *
     * Wrapped in a try/catch because a post-processing graph that fails to
     * compile should cost the glow, not the whole page.
     */
    setPostProcessing()
    {
        // Measured at 8fps for an effect that is barely visible against a flat
        // palette, so it is opt-in until the quality system can decide.
        if(!window.location.hash.match(/bloom/i))
            return

        try
        {
            const postProcessing = new THREE.PostProcessing(this.renderer)

            const scenePass = pass(this.game.scene, this.game.view.camera)
            const scenePassColor = scenePass.getTextureNode('output')

            this.bloomPass = bloom(scenePassColor, 0.32, 0.5, 0.9)

            postProcessing.outputNode = scenePassColor.add(this.bloomPass)

            this.postProcessing = postProcessing

            this.setDebug()
        }
        catch(error)
        {
            console.warn('Rendering > post-processing unavailable, rendering directly', error)
            this.postProcessing = null
        }
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
        if(this.postProcessing)
            this.postProcessing.render()
        else
            this.renderer.render(this.game.scene, this.game.view.camera)
    }

    setDebug()
    {
        const panel = this.game.debug.addFolder({ title: 'Rendering' })

        if(!panel || !this.bloomPass)
            return

        panel.addBinding(this.bloomPass.strength, 'value', { label: 'bloomStrength', min: 0, max: 2, step: 0.01 })
        panel.addBinding(this.bloomPass.threshold, 'value', { label: 'bloomThreshold', min: 0, max: 2, step: 0.01 })
        panel.addBinding(this.bloomPass.radius, 'value', { label: 'bloomRadius', min: 0, max: 1, step: 0.01 })
    }
}
