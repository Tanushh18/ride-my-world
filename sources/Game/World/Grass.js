import * as THREE from 'three/webgpu'
import { Fn, attribute, color, cos, mix, sin, step, uniform, varying, vec2, vec3, vertexIndex } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshStylizedMaterial } from '../Materials/MeshStylizedMaterial.js'
import palette from '../../data/palette.js'
import { seededRandom } from '../utilities/maths.js'

/**
 * Ninety thousand blades of grass in a single draw call.
 *
 * Each blade is one triangle: vertex 0 is the tip, vertices 1 and 2 are the
 * base corners. Which is which comes from `vertexIndex % 3`, so no extra
 * attribute is needed for it.
 *
 * The patch is a fixed grid that stays centred on the car by wrapping each
 * blade's position into the window around the focus point. Because the wrap is
 * modular, every blade lands on the same world-space lattice however far the car
 * travels — the grass appears rooted in the ground rather than sliding along
 * with the camera.
 */
export class Grass
{
    constructor()
    {
        this.game = Game.getInstance()

        this.size = this.game.quality.grassSize
        this.subdivisions = this.game.quality.grassSubdivisions
        this.count = this.subdivisions * this.subdivisions

        this.setGeometry()
        this.setMaterial()

        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.frustumCulled = false
        this.mesh.receiveShadow = true
        this.game.scene.add(this.mesh)

        this.game.ticker.events.on('tick', () => { this.update() }, 10)
    }

    setGeometry()
    {
        const random = seededRandom(1312)
        const fragmentSize = this.size / this.subdivisions
        const half = this.size * 0.5

        const positions = new Float32Array(this.count * 3 * 3)
        const normals = new Float32Array(this.count * 3 * 3)
        const seeds = new Float32Array(this.count * 3)

        for(let iX = 0; iX < this.subdivisions; iX++)
        {
            for(let iZ = 0; iZ < this.subdivisions; iZ++)
            {
                const index = iX * this.subdivisions + iZ

                // Jitter inside the cell, otherwise the grid pattern is visible
                const x = -half + (iX + random()) * fragmentSize
                const z = -half + (iZ + random()) * fragmentSize
                const seed = random()

                for(let vertex = 0; vertex < 3; vertex++)
                {
                    const offset = (index * 3 + vertex) * 3

                    positions[offset] = x
                    positions[offset + 1] = 0
                    positions[offset + 2] = z

                    // Every blade faces straight up. Real per-vertex normals
                    // would fight the flat lighting; a uniform up normal is
                    // what keeps the field one even colour.
                    normals[offset] = 0
                    normals[offset + 1] = 1
                    normals[offset + 2] = 0

                    seeds[index * 3 + vertex] = seed
                }
            }
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        this.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
        this.geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))

        // Culling is off, so the bounding sphere only needs to be non-null
        this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), this.size)
    }

    setMaterial()
    {
        this.center = uniform(new THREE.Vector2())
        this.sizeUniform = uniform(this.size)
        this.bladeWidth = uniform(0.055)
        this.bladeHeight = uniform(0.33)
        this.windStrength = uniform(0.32)
        this.windSpeed = uniform(1.5)

        const seed = attribute('aSeed', 'float')

        // 1 on the tip vertex, 0 on the two base vertices
        const tipness = varying(step(vertexIndex.toFloat().mod(3), 0.5), 'vTipness')
        const seedVarying = varying(seed, 'vSeed')

        this.material = new MeshStylizedMaterial({
            // Every blade shares one upward normal, so a core shadow would flip
            // the entire field at once. Drop shadows still apply.
            hasCoreShadow: false,
            hasBounce: false,
            colorNode: mix(
                color(palette.grassDark),
                color(palette.grassMid),
                tipness.mul(0.55).add(seedVarying.mul(0.28))
            )
        })

        this.material.normalNode = vec3(0, 1, 0)

        this.material.positionNode = Fn(() =>
        {
            const base = attribute('position', 'vec3').xz
            const half = this.sizeUniform.mul(0.5)

            // Positive modulo. TSL's mod() maps to different semantics for
            // negative operands across backends, so it is spelled out here.
            const shifted = base.sub(this.center).add(half)
            const wrapped = shifted.div(this.sizeUniform).fract().mul(this.sizeUniform)
                .sub(half)
                .add(this.center)

            const loopIndex = vertexIndex.toFloat().mod(3)
            const localTipness = step(loopIndex, 0.5)

            // -1 for vertex 1, +1 for vertex 2; the tip's value is cancelled out
            const side = loopIndex.sub(1.5).mul(2).mul(localTipness.oneMinus())

            // Random facing per blade, so the field has no grain
            const angle = seed.mul(Math.PI * 2)
            const facing = vec2(cos(angle), sin(angle))

            const height = this.bladeHeight.mul(seed.mul(0.6).add(0.6)).mul(localTipness)

            const phase = wrapped.x.mul(0.16)
                .add(wrapped.y.mul(0.11))
                .add(this.game.ticker.elapsedUniform.mul(this.windSpeed))
            const wind = sin(phase).mul(0.6).add(sin(phase.mul(1.7)).mul(0.4))
            const sway = facing.mul(wind).mul(this.windStrength).mul(localTipness)

            const offset = facing.mul(side).mul(this.bladeWidth)

            return vec3(
                wrapped.x.add(offset.x).add(sway.x),
                height,
                wrapped.y.add(offset.y).add(sway.y)
            )
        })()

        this.setDebug()
    }

    update()
    {
        const focus = this.game.view.focusPoint

        this.center.value.set(focus.x, focus.z)
    }

    setDebug()
    {
        const panel = this.game.debug.addFolder({ title: 'Grass' })

        if(!panel)
            return

        panel.addBinding(this.bladeWidth, 'value', { label: 'width', min: 0.01, max: 0.2, step: 0.005 })
        panel.addBinding(this.bladeHeight, 'value', { label: 'height', min: 0.1, max: 2, step: 0.05 })
        panel.addBinding(this.windStrength, 'value', { label: 'wind', min: 0, max: 1, step: 0.01 })
        panel.addBinding(this.windSpeed, 'value', { label: 'windSpeed', min: 0, max: 5, step: 0.05 })
    }
}
