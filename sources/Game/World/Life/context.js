import * as THREE from 'three/webgpu'
import { positionLocal, instanceIndex, float, vec3, sin, cos } from 'three/tsl'

/**
 * Shared helpers for the "world life" systems (vegetation, wildlife, traffic,
 * pedestrians, road props and effects).
 *
 * Everything is expressed in route coordinates so that props follow the road if
 * the curve is edited: `t` is progress along the route, `offset` is the signed
 * lateral distance from the centre line (positive = the route's +side).
 */
export class LifeContext
{
    constructor(scrollWorld)
    {
        this.world = scrollWorld
        this.game = scrollWorld.game
        this.group = new THREE.Group()
        this.group.name = 'WorldLife'
        scrollWorld.group.add(this.group)

        this.quality = this.game.quality
        this.scale = this.quality.sceneryScale ?? 1
        this.low = this.quality.level === 'low'

        this.tmpA = new THREE.Vector3()
        this.tmpFrame = { position: new THREE.Vector3(), tangent: new THREE.Vector3(), side: new THREE.Vector3(), yaw: 0 }

        // River plane: same transform as the mesh in ScrollWorld.addRiverAndWaterfall
        this.riverObject = new THREE.Object3D()
        this.riverObject.position.set(15, 0.018, -34)
        this.riverObject.rotation.set(-Math.PI / 2, -0.86, 0)
        this.riverObject.updateMatrix()
        this.riverInverse = this.riverObject.matrix.clone().invert()
        this.riverHalf = { x: 24, y: 8 }

        this.zones = this.buildZones()
    }

    /** Count adjusted for the quality preset (never below 1). */
    count(value)
    {
        return Math.max(1, Math.round(value * this.scale))
    }

    frame(t)
    {
        return this.world.routeFrame(t)
    }

    point(t, offset, y = 0, target = new THREE.Vector3())
    {
        const frame = this.world.routeFrame(t)
        target.copy(frame.position).addScaledVector(frame.side, offset)
        target.y = y
        return target
    }

    /**
     * 1 normally; fades to 0 for anything standing between the camera and the
     * board currently being read (same side, within a few metres along the road),
     * so people and vehicles never cover the text.
     */
    clearance(t, side, tour)
    {
        const weight = tour?.storyFocusWeight ?? 0
        const stop = tour?.storyFocusStop
        if(stop == null || weight <= 0.001)
            return 1
        const board = (this.world.storyBoardData ?? []).find(item => item.t === stop)
        if(!board || (side !== 0 && board.side !== side) || Math.abs(t - stop) > 0.026)
            return 1
        return 1 - Math.min(1, weight * 1.6)
    }

    /** True when a world position lies on (or very near) the river surface. */
    inRiver(x, z, margin = 0)
    {
        const local = this.tmpA.set(x, 0, z).applyMatrix4(this.riverInverse)
        return Math.abs(local.x) < this.riverHalf.x + margin && Math.abs(local.y) < this.riverHalf.y + margin
    }

    /** World position on the river plane from river-local (u along, v across). */
    riverPoint(u, v, y = 0.02, target = new THREE.Vector3())
    {
        target.set(u, v, 0).applyMatrix4(this.riverObject.matrix)
        target.y = y
        return target
    }

    /**
     * No-go zones for scattered props: every story board (plus the camera
     * corridor in front of it), the waterfall, bridge and the existing city
     * street furniture, so nothing grows through a sign or into the lane.
     */
    buildZones()
    {
        const zones = []

        for(const board of this.world.storyBoardData ?? [])
            zones.push({ t: board.t, halfT: 0.02, side: board.side, minOffset: 0, maxOffset: 16 })

        // Waterfall cliff and bridge
        zones.push({ t: 0.6, halfT: 0.05, side: 1, minOffset: 0, maxOffset: 22 })
        zones.push({ t: 0.6, halfT: 0.05, side: -1, minOffset: 0, maxOffset: 9 })

        // Existing boulevard furniture (parked cars, benches, planters, bus stop)
        const furniture = [
            [0.765, -1], [0.805, -1], [0.845, 1], [0.885, -1], [0.925, 1], [0.97, -1],
            [0.775, 1], [0.905, -1], [0.745, -1], [0.79, 1], [0.86, -1], [0.945, -1], [0.98, 1],
            [0.86, 1], [0.75, 1], [0.875, -1], [0.945, 1]
        ]
        for(const [t, side] of furniture)
            zones.push({ t, halfT: 0.011, side, minOffset: 5, maxOffset: 13.5 })

        // Learning hub and city gates
        zones.push({ t: 0.845, halfT: 0.03, side: -1, minOffset: 12, maxOffset: 45 })
        for(const gate of [[0.565, -1], [0.775, 1], [0.99, -1]])
            zones.push({ t: gate[0], halfT: 0.02, side: gate[1], minOffset: 0, maxOffset: 14 })

        // Junction side street, café terrace, vendor and bus-stop forecourt
        zones.push({ t: 0.745, halfT: 0.016, side: 1, minOffset: 0, maxOffset: 45 })
        zones.push({ t: 0.718, halfT: 0.016, side: -1, minOffset: 8, maxOffset: 20 })
        zones.push({ t: 0.895, halfT: 0.012, side: 1, minOffset: 8, maxOffset: 14 })
        zones.push({ t: 0.86, halfT: 0.02, side: 1, minOffset: 3, maxOffset: 15 })

        return zones
    }

    /** Create an InstancedMesh from `{ x, y, z, rx, ry, rz, sx, sy, sz }` records. */
    instance(name, geometry, material, records, { castShadow = true, receiveShadow = true } = {})
    {
        if(!records.length)
            return null
        const dummy = this.dummy ??= new THREE.Object3D()
        const mesh = new THREE.InstancedMesh(geometry, material, records.length)
        mesh.name = name
        records.forEach((record, index) =>
        {
            dummy.position.set(record.x, record.y ?? 0, record.z)
            dummy.rotation.set(record.rx ?? 0, record.ry ?? 0, record.rz ?? 0)
            dummy.scale.set(record.sx ?? 1, record.sy ?? record.sx ?? 1, record.sz ?? record.sx ?? 1)
            dummy.updateMatrix()
            mesh.setMatrixAt(index, dummy.matrix)
        })
        mesh.instanceMatrix.needsUpdate = true
        mesh.castShadow = castShadow
        mesh.receiveShadow = receiveShadow
        mesh.computeBoundingSphere()
        this.group.add(mesh)
        return mesh
    }

    /** Light wind: a TSL position node bending geometry by height. */
    applyWind(material, { amplitude = 0.05, speed = 1.2, height = 1 } = {})
    {
        const phase = float(instanceIndex).mul(1.713)
        const t = this.game.ticker.elapsedUniform.mul(speed).add(phase)
        const bend = positionLocal.y.div(height).max(0)
        const gust = sin(t).mul(0.65).add(sin(t.mul(2.31).add(1.7)).mul(0.35))
        material.positionNode = positionLocal.add(vec3(
            gust.mul(amplitude).mul(bend),
            0,
            cos(t.mul(0.83)).mul(amplitude * 0.6).mul(bend)
        ))
        return material
    }
}
