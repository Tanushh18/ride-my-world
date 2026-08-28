import { color, mix, mx_fractal_noise_float, positionWorld, uniform } from 'three/tsl'
import { Game } from './Game.js'
import { MeshStylizedMaterial } from './Materials/MeshStylizedMaterial.js'
import palette from '../data/palette.js'

/**
 * Central material store.
 *
 * Materials are shared by name so the whole world batches well and a palette
 * change lands everywhere at once.
 */
export class Materials
{
    constructor()
    {
        this.game = Game.getInstance()
        this.list = new Map()

        this.setSolids()
        this.setGround()
    }

    /** One flat-shaded material per palette entry that needs one. */
    setSolids()
    {
        const names = [
            'grassLight', 'grassMid', 'grassDark', 'dirt', 'dirtDark',
            'trunk', 'foliageLight', 'foliageMid', 'foliageDeep', 'blossom',
            'rock', 'rockDark', 'concrete', 'wood', 'metal',
            'carPaint', 'carPaintDark', 'carDark', 'tyre', 'rim',
            'accent', 'accentWarm', 'accentCool'
        ]

        for(const name of names)
            this.list.set(name, new MeshStylizedMaterial({ color: palette[name] }))

        // Glass reads better without a cast shadow darkening its own surface
        this.list.set('carGlass', new MeshStylizedMaterial({
            color: palette.carGlass,
            hasBounce: false
        }))
    }

    /**
     * The ground is the one surface large enough that a single flat colour
     * would look like a bug. Two octaves of noise break it up into patches, and
     * a third, much larger octave suggests dry ground near the edges.
     */
    setGround()
    {
        this.groundNoiseScale = uniform(0.035)
        this.groundPatchScale = uniform(0.006)

        const patches = mx_fractal_noise_float(positionWorld.xz.mul(this.groundNoiseScale), 3)
            .mul(0.5)
            .add(0.5)

        const dryness = mx_fractal_noise_float(positionWorld.xz.mul(this.groundPatchScale), 2)
            .mul(0.5)
            .add(0.5)

        const green = mix(color(palette.grassDark), color(palette.grassLight), patches)
        const ground = mix(green, color(palette.dirt), dryness.smoothstep(0.62, 0.95))

        this.list.set('ground', new MeshStylizedMaterial({
            colorNode: ground,
            // A flat plane has one normal, so a core shadow would flip the whole
            // world's ground at once
            hasCoreShadow: false,
            hasBounce: false
        }))
    }

    get(name)
    {
        const material = this.list.get(name)

        if(!material)
            throw new Error(`Materials > unknown material "${name}"`)

        return material
    }
}
