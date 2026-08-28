import * as THREE from 'three/webgpu'
import { Fn, If, color, float, frontFacing, max, mix, normalWorld, positionWorld, vec3, vec4 } from 'three/tsl'
import { Game } from '../Game.js'

/**
 * The look of the whole world, in one material.
 *
 * It extends MeshLambertNodeMaterial only to inherit the shadow plumbing; the
 * output is replaced entirely, so none of Lambert's diffuse shading survives.
 * Five things happen, in this order:
 *
 *   1. light bounce   — undersides pick up the colour of the ground below
 *   2. sun            — a flat multiply, no falloff
 *   3. core shadow    — a hard terminator from normal against sun direction
 *   4. drop shadow    — the real shadow map, recoloured instead of darkened
 *   5. fog            — distance blend towards the sky colour
 *
 * Steps 3 and 4 share one tinted colour, which is why lit and shadowed surfaces
 * read as the same material rather than two.
 */
export class MeshStylizedMaterial extends THREE.MeshLambertNodeMaterial
{
    constructor(parameters = {})
    {
        super()

        this.game = Game.getInstance()

        this.transparent = parameters.transparent ?? false
        this.side = parameters.side ?? THREE.FrontSide
        this.depthWrite = parameters.depthWrite ?? true
        this.alphaTest = parameters.alphaTest ?? 0.1

        this.hasCoreShadow = parameters.hasCoreShadow ?? true
        this.hasDropShadow = parameters.hasDropShadow ?? true
        this.hasBounce = parameters.hasBounce ?? true
        this.hasFog = parameters.hasFog ?? true

        this._colorNode = parameters.colorNode ?? color(parameters.color ?? 0xffffff)
        this._normalNode = parameters.normalNode ?? normalWorld
        this._alphaNode = parameters.alphaNode ?? float(1)
        this._extraShadowNode = parameters.shadowNode ?? float(0)

        // Note: `normalNode` is deliberately left alone. Assigning normalWorld
        // to it would make normalLocal depend on its own derived value; callers
        // that need a custom normal (the grass) set it themselves.

        const lighting = this.game.lighting
        const fog = this.game.fog

        /**
         * Capture the shadow map result as a plain number and return 1, so the
         * inherited lighting sees no shadow at all. We then apply it ourselves
         * as a colour shift. Without this the shadow would arrive as a
         * multiply, which is exactly the grey look we are avoiding.
         */
        const catchedShadow = float(1).toVar()

        if(this.hasDropShadow)
        {
            this.receivedShadowNode = Fn(([ shadow ]) =>
            {
                catchedShadow.mulAssign(vec3(shadow).r)
                return float(1)
            })
        }

        const needsNormal = this.hasBounce || this.hasCoreShadow

        this.outputNode = Fn(() =>
        {
            const baseColor = this._colorNode.toVar()
            const outputColor = baseColor.toVar()

            // Only touched when something actually shades with it. Declaring it
            // unconditionally would pull the normal attribute into shaders that
            // have no normals to give — the grass, for one.
            const normal = needsNormal ? this._normalNode.toVar() : null

            // Back faces need their normal flipped or their shading inverts
            if(needsNormal && (this.side === THREE.DoubleSide || this.side === THREE.BackSide))
                If(frontFacing.not(), () => { normal.mulAssign(-1) })

            if(this.hasBounce)
            {
                const facingDown = normal.dot(vec3(0, -1, 0)).smoothstep(-0.1, 1)

                // 1 at ground level, 0 at bounceHeight and above
                const nearGround = positionWorld.y
                    .div(lighting.bounceHeight)
                    .clamp(0, 1)
                    .oneMinus()

                outputColor.assign(mix(
                    outputColor,
                    lighting.bounceColorUniform,
                    facingDown.mul(nearGround).mul(lighting.bounceStrength)
                ))
            }

            outputColor.mulAssign(lighting.colorUniform.mul(lighting.intensityUniform))

            let coreShadowMix = float(0)

            if(this.hasCoreShadow)
                coreShadowMix = normal
                    .dot(lighting.directionUniform)
                    .smoothstep(lighting.coreShadowEdgeHigh, lighting.coreShadowEdgeLow)

            let dropShadowMix = float(0)

            if(this.hasDropShadow)
                dropShadowMix = catchedShadow.oneMinus()

            if(this.hasCoreShadow || this.hasDropShadow)
            {
                const shadowMix = max(max(coreShadowMix, dropShadowMix), this._extraShadowNode)
                    .clamp(0, 1)
                    .mul(lighting.shadowStrength)

                // Multiply, not blend: the surface keeps its own hue and simply
                // gets darker and cooler, so lit and shadowed read as one material
                const shadowColor = baseColor.mul(lighting.shadowColorUniform)

                outputColor.assign(mix(outputColor, shadowColor, shadowMix))
            }

            if(this.hasFog)
                outputColor.assign(mix(outputColor, fog.colorUniform, fog.strengthNode))

            if(this.transparent === false && parameters.alphaNode)
                this._alphaNode.lessThan(this.alphaTest).discard()

            return vec4(outputColor, this._alphaNode)
        })()
    }
}
