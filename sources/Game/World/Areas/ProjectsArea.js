import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import { Game } from '../../Game.js'
import { FLOOR_HEIGHT, buildBuilding } from '../../Builders/building.js'
import { buildSign } from '../../Builders/sign.js'
import { MeshStylizedMaterial } from '../../Materials/MeshStylizedMaterial.js'
import { arrangeOnArc } from '../../utilities/arrangement.js'
import projects from '../../../data/projects.js'
import world from '../../../data/world.js'

/**
 * The first portfolio area: a ring of buildings, one per project.
 *
 * Concrete on purpose. There are six more areas to come and they are not
 * variations on this one — a timeline, a contact form and a lap-timed circuit
 * have little in common with a plaza — so the shared abstraction is being left
 * until there are three examples to draw it from. What *is* shared already
 * lives outside this class: `Zones` for proximity, `arrangeOnArc` for layout.
 *
 * Nothing here chooses a position. Buildings are placed from their index, which
 * is what makes a fifth project one object in `data/projects.js`.
 */
export class ProjectsArea
{
    constructor()
    {
        this.game = Game.getInstance()
        this.settings = world.projectsArea

        this.group = new THREE.Group()
        this.game.scene.add(this.group)

        this.game.zones.hysteresis = this.settings.zoneHysteresis

        this.placements = arrangeOnArc({
            count: projects.length,
            center: this.settings.center,
            radius: this.settings.ringRadius,
            facing: this.settings.entranceFacing,
            spread: this.settings.spread
        })

        projects.forEach((project, index) =>
        {
            this.addBuilding(project, this.placements[index])
            this.addZone(project, this.placements[index])
        })
    }

    addBuilding(project, placement)
    {
        const built = buildBuilding(project.building)
        const quaternion = new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation)

        const group = new THREE.Group()
        group.position.set(placement.x, 0, placement.z)
        group.quaternion.copy(quaternion)
        this.group.add(group)

        const materials = {
            concrete: this.game.materials.get('concrete'),
            glass: this.game.materials.get('carGlass'),
            accent: this.game.materials.get(project.building.accent)
        }

        for(const [ name, geometry ] of Object.entries(built.parts))
        {
            const mesh = new THREE.Mesh(geometry, materials[name])
            mesh.castShadow = true
            mesh.receiveShadow = true
            group.add(mesh)
        }

        this.addSign(project, group, built)

        // One cuboid matching the body. The roof and awning are detail; a
        // collider that chased them would cost more than it would ever be felt.
        const bodyHeight = project.building.floors * FLOOR_HEIGHT

        this.game.objects.add(null, {
            type: 'fixed',
            friction: 0.7,
            rotation: quaternion,
            position: { x: placement.x, y: bodyHeight * 0.5, z: placement.z },
            colliders: [ {
                shape: 'cuboid',
                parameters: [
                    built.footprint.width * 0.5,
                    bodyHeight * 0.5,
                    built.footprint.depth * 0.5
                ],
                category: 'floor'
            } ]
        })
    }

    /** A named board above the entrance, so a building is identifiable before its card appears. */
    addSign(project, group, built)
    {
        const width = built.footprint.width * 0.8
        const height = 1.3
        const sign = buildSign({ text: project.title, width, height })

        const board = new THREE.Mesh(
            new THREE.BoxGeometry(width + 0.3, height + 0.3, 0.2),
            this.game.materials.get(project.building.accent)
        )
        board.castShadow = true
        board.position.set(built.footprint.width * 0.5 + 0.1, FLOOR_HEIGHT * 1.35, 0)
        board.rotation.y = Math.PI * 0.5
        group.add(board)

        // No canvas, no lettering — the accent board alone still reads as signage
        if(!sign.texture)
            return

        const map = texture(sign.texture)

        const label = new THREE.Mesh(sign.geometry, new MeshStylizedMaterial({
            // rgb, not the whole texture: the material composes vec4(colour, alpha)
            // at the end, and a vec4 colour would make that five components
            colorNode: map.rgb,
            alphaNode: map.a,
            transparent: true,
            hasCoreShadow: false,
            hasBounce: false
        }))
        label.position.set(board.position.x + 0.12, board.position.y, 0)
        label.rotation.y = Math.PI * 0.5
        group.add(label)
    }

    /**
     * The zone sits in front of the entrance rather than on the building, so the
     * card appears when the visitor is looking at the face with the sign on it.
     */
    addZone(project, placement)
    {
        const toCenterX = this.settings.center.x - placement.x
        const toCenterZ = this.settings.center.z - placement.z
        const length = Math.hypot(toCenterX, toCenterZ)
        const offset = this.settings.zoneRadius * 0.45

        this.game.zones.register({
            id: project.id,
            position: {
                x: placement.x + (toCenterX / length) * offset,
                z: placement.z + (toCenterZ / length) * offset
            },
            radius: this.settings.zoneRadius,
            data: project
        })
    }
}
