import { cameraPosition, color, positionWorld, uniform } from 'three/tsl'
import { Game } from './Game.js'
import palette from '../data/palette.js'

/**
 * Distance fog, computed by the materials rather than by `scene.fog`.
 *
 * Doing it here means the fog colour can be driven by the same values as the
 * sky, so the horizon dissolves instead of showing a seam. `scene.fog` is left
 * unset on purpose — node materials would apply it a second time.
 */
export class Fog
{
    constructor()
    {
        this.game = Game.getInstance()

        this.colorUniform = uniform(color(palette.fog))
        this.nearUniform = uniform(55)
        this.farUniform = uniform(190)

        // 0 up close, 1 in the far distance
        this.strengthNode = positionWorld
            .sub(cameraPosition)
            .length()
            .smoothstep(this.nearUniform, this.farUniform)

        this.setDebug()
    }

    setDebug()
    {
        const panel = this.game.debug.addFolder({ title: 'Fog' })

        if(!panel)
            return

        panel.addBinding(this.nearUniform, 'value', { label: 'near', min: 0, max: 200, step: 1 })
        panel.addBinding(this.farUniform, 'value', { label: 'far', min: 10, max: 400, step: 1 })
    }
}
