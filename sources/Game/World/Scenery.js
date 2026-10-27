import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { buildBush, buildRock, buildTree } from '../Builders/vegetation.js'
import { seededRandom } from '../utilities/maths.js'
import world from '../../data/world.js'

/**
 * Fills the world with trees, rocks and bushes.
 *
 * Placement is seeded, so the world is identical on every load and can be
 * reasoned about. Everything is instanced: three tree variants times three
 * foliage tints, plus rocks and bushes, covers several hundred objects in a
 * handful of draw calls.
 *
 * Tree trunks and rocks get fixed colliders, because driving through a tree
 * should not be possible. Bushes deliberately have none — brushing through them
 * is more fun than bouncing off them.
 */
export class Scenery
{
    constructor()
    {
        this.game = Game.getInstance()
        this.random = seededRandom(90210)

        // Keep the spawn clearing and the test course readable
        this.reserved = [
            { x: 0, z: 0, radius: 16 },
            { x: 18, z: 0, radius: 12 },
            { x: -18, z: 12, radius: 12 },
            { x: 6, z: -22, radius: 12 },
            { x: 26, z: 6, radius: 8 },
            { x: -14, z: -14, radius: 8 },

            // Keep a clear corridor around the scripted scenic road. The
            // larger circles are sparse clearings for the river and city skyline.
            { x: -130, z: 55, radius: 14 },
            { x: -106, z: 24, radius: 13 },
            { x: -84, z: -12, radius: 13 },
            { x: -48, z: 8, radius: 12 },
            { x: -10, z: -3, radius: 13 },
            { x: 15, z: -34, radius: 17 },
            { x: 43, z: -56, radius: 14 },
            { x: 76, z: -79, radius: 15 },
            { x: 108, z: -98, radius: 19 },
            { x: 126, z: -108, radius: 23 },

            // Keep the project plaza and terminal approach readable.
            {
                x: world.projectsArea.center.x,
                z: world.projectsArea.center.z,
                radius: world.projectsArea.clearingRadius
            }
        ]

        this.extent = 150
        this.scale = this.game.quality.sceneryScale

        this.setTrees()
        this.setRocks()
        this.setBushes()
    }

    /** A position at least `radius` away from anything reserved. */
    findPosition(radius, attempts = 30)
    {
        for(let attempt = 0; attempt < attempts; attempt++)
        {
            const x = (this.random() - 0.5) * this.extent * 2
            const z = (this.random() - 0.5) * this.extent * 2

            const blocked = this.reserved.some((area) =>
                Math.hypot(x - area.x, z - area.z) < area.radius + radius)

            if(!blocked)
                return { x, z }
        }

        return null
    }

    /**
     * Builds instanced meshes for one variant and returns the placements, so
     * callers can add physics for the same transforms.
     */
    placeInstances({ geometries, materials, count, scaleRange, radius, collider })
    {
        const placements = []

        for(let i = 0; i < count; i++)
        {
            const position = this.findPosition(radius)

            if(!position)
                continue

            const scale = scaleRange[0] + this.random() * (scaleRange[1] - scaleRange[0])

            const matrix = new THREE.Matrix4().compose(
                new THREE.Vector3(position.x, 0, position.z),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.random() * Math.PI * 2),
                new THREE.Vector3(scale, scale, scale)
            )

            placements.push({ position, scale, matrix })
        }

        if(placements.length === 0)
            return placements

        for(let i = 0; i < geometries.length; i++)
        {
            const mesh = new THREE.InstancedMesh(geometries[i], materials[i], placements.length)
            mesh.castShadow = true
            mesh.receiveShadow = true

            for(let index = 0; index < placements.length; index++)
                mesh.setMatrixAt(index, placements[index].matrix)

            mesh.instanceMatrix.needsUpdate = true
            mesh.computeBoundingSphere()
            this.game.scene.add(mesh)
        }

        if(collider)
            for(const placement of placements)
                collider(placement)

        return placements
    }

    setTrees()
    {
        const foliageNames = [ 'foliageLight', 'foliageMid', 'foliageDeep' ]
        const counts = [ 132, 72, 90 ]

        for(let variant = 0; variant < 3; variant++)
        {
            const tree = buildTree(variant)

            for(const foliageName of foliageNames)
            {
                this.placeInstances({
                    geometries: [ tree.trunk, tree.foliage ],
                    materials: [ this.game.materials.get('trunk'), this.game.materials.get(foliageName) ],
                    count: Math.round(counts[variant] / foliageNames.length * this.scale),
                    scaleRange: [ 0.8, 1.35 ],
                    radius: 1.5,
                    collider: ({ position, scale }) =>
                    {
                        this.game.objects.add(null, {
                            type: 'fixed',
                            friction: 0.4,
                            position: { x: position.x, y: tree.height * scale * 0.5, z: position.z },
                            colliders: [
                                { shape: 'cylinder', parameters: [ tree.height * scale * 0.5, tree.radius * scale ] }
                            ]
                        })
                    }
                })
            }
        }
    }

    setRocks()
    {
        for(let variant = 0; variant < 3; variant++)
        {
            this.placeInstances({
                geometries: [ buildRock(variant) ],
                materials: [ this.game.materials.get(variant === 2 ? 'rockDark' : 'rock') ],
                count: Math.round(32 * this.scale),
                scaleRange: [ 0.7, 1.6 ],
                radius: 1.5,
                collider: ({ position, scale }) =>
                {
                    this.game.objects.add(null, {
                        type: 'fixed',
                        friction: 0.6,
                        position: { x: position.x, y: 0.28 * scale, z: position.z },
                        colliders: [
                            { shape: 'ball', parameters: [ 0.72 * scale ] }
                        ]
                    })
                }
            })
        }
    }

    setBushes()
    {
        const tints = [ 'foliageMid', 'foliageDeep' ]

        for(let variant = 0; variant < 2; variant++)
        {
            this.placeInstances({
                geometries: [ buildBush(variant) ],
                materials: [ this.game.materials.get(tints[variant]) ],
                count: Math.round(110 * this.scale),
                scaleRange: [ 0.7, 1.6 ],
                radius: 0.8
            })
        }

        // A scattering of pink for accent
        this.placeInstances({
            geometries: [ buildBush(1) ],
            materials: [ this.game.materials.get('blossom') ],
            count: Math.round(36 * this.scale),
            scaleRange: [ 0.6, 1.1 ],
            radius: 0.8
        })
    }
}
