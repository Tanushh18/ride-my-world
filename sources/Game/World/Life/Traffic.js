import * as THREE from 'three/webgpu'
import { brakeAmount, laneFade, lanePosition, laneSpeed } from '../../utilities/placement.js'
import { LAYOUT } from './layout.js'

/**
 * Moving traffic plus the parked fleet.
 *
 * Moving vehicles live on a single one-way lane. They all share one speed that
 * eases between a cruise and a slow roll, and are evenly spaced along the lane,
 * so they never close the gap or overlap. They stay in their lane (never on the
 * sidewalk or through buildings) and scale in/out at the lane ends rather than
 * teleporting. Tail lamps brighten while the lane is slowing down.
 */
export class Traffic
{
    constructor(ctx, vehicles)
    {
        this.ctx = ctx
        this.world = ctx.world
        this.vehicles = vehicles
        this.group = new THREE.Group()
        this.group.name = 'Traffic'
        ctx.group.add(this.group)

        this.laneTail = new THREE.MeshBasicMaterial({ color: '#7a2f2d' })
        this.brakeColor = new THREE.Color('#ff3b32')
        this.idleColor = new THREE.Color('#7a2f2d')
        this.moving = []
        this.parked = []
        this.bus = null
        this.speedNow = 0
        this.speedBefore = 0
        this.distance = 0
        this.profile = { cruise: 8.5, slow: 2.4, period: 26, phase: 0 }
        this.fadeLength = 6

        this.buildMoving()
        this.buildBus()
        this.buildParked()

        this.counts = {
            moving: this.moving.length,
            parked: this.parked.length,
            bus: this.bus ? 1 : 0
        }
    }

    get laneLength()
    {
        return (LAYOUT.laneA.tMax - LAYOUT.laneA.tMin) * this.world.roadLength
    }

    buildMoving()
    {
        const fleet = [
            ['hatch', 0], ['van', 6], ['sedan', 3], ['suv', 1], ['hatch', 4], ['scooter', 2]
        ]
        const count = this.ctx.low ? 4 : fleet.length
        for(let index = 0; index < count; index++)
        {
            const [kind, paint] = fleet[index]
            const vehicle = kind === 'scooter' ? this.vehicles.scooter(paint) : this.vehicles.car(kind, paint, this.laneTail)
            vehicle.visible = false
            this.group.add(vehicle)
            this.moving.push({ vehicle, index, count, radius: kind === 'scooter' ? 0.34 : 0.34 })
        }
    }

    buildBus()
    {
        const stop = LAYOUT.busStop
        const bus = this.vehicles.bus()
        const position = this.ctx.point(stop.t, LAYOUT.busLane.offset, 0.12)
        const frame = this.ctx.frame(stop.t)
        bus.position.copy(position)
        bus.rotation.y = frame.yaw
        this.group.add(bus)
        this.bus = { vehicle: bus, t: stop.t, hazard: bus.userData.detail }
        // Hazard indicators blink while the bus is stopped at the shelter
        const lamp = (x, z) =>
        {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.22), this.vehicles.indicatorMat)
            mesh.position.set(x, 0.95, z)
            bus.add(mesh)
            return mesh
        }
        this.bus.lamps = [lamp(5.22, 1.12), lamp(5.22, -1.12), lamp(-5.22, 1.12), lamp(-5.22, -1.12)]
    }

    buildParked()
    {
        // [t, side, offset, kind, paint]; zones guard against existing furniture
        const spots = [
            [0.715, 1, 12.4, 'suv', 5], [0.735, 1, 12.4, 'hatch', 0],
            [0.775, -1, 12.3, 'sedan', 2], [0.825, 1, 12.3, 'van', 6],
            [0.9, 1, 12.3, 'hatch', 3], [0.95, -1, 12.3, 'suv', 1]
        ]
        for(const [t, side, offset, kind, paint] of spots)
        {
            if(this.isBlocked(t, side, offset))
                continue
            const car = this.vehicles.car(kind, paint)
            this.placeAtKerb(car, t, side, offset, 0.12)
            this.parked.push({ vehicle: car, t, side })
        }

        // Two-wheelers near shopfronts
        const scooters = [[0.73, -1, 10.2], [0.8, -1, 10.1], [0.84, -1, 10.4], [0.87, 1, 10.1], [0.91, 1, 10.0], [0.965, 1, 10.3], [0.985, -1, 10.2]]
        scooters.forEach(([t, side, offset], index) =>
        {
            if(this.isBlocked(t, side, offset))
                return
            const scooter = this.vehicles.scooter(index + 1)
            this.placeAtKerb(scooter, t, side, offset, 0.14, Math.PI / 2 * (index % 2 ? 1 : -1))
            this.parked.push({ vehicle: scooter, t, side })
        })
    }

    isBlocked(t, side, offset)
    {
        return this.ctx.zones.some(zone =>
            (zone.side === 0 || zone.side === side)
            && Math.abs(t - zone.t) < zone.halfT
            && offset >= zone.minOffset && offset <= zone.maxOffset)
    }

    placeAtKerb(vehicle, t, side, offset, y, yawOffset = 0)
    {
        const position = this.ctx.point(t, side * offset, y)
        const frame = this.ctx.frame(t)
        vehicle.position.copy(position)
        // Park parallel to the kerb, nose along the direction of travel for that side
        vehicle.rotation.y = frame.yaw + (side > 0 ? Math.PI : 0) + yawOffset
        this.group.add(vehicle)
    }

    update(time, delta, progress, cameraPosition, tour)
    {
        // Lane-wide speed with smooth braking; advance the conveyor
        this.speedBefore = this.speedNow
        this.speedNow = laneSpeed(time, this.profile)
        this.distance += this.speedNow * delta
        const brake = brakeAmount(this.speedNow, this.speedBefore, delta, 0.35)
        this.laneTail.color.copy(this.idleColor).lerp(this.brakeColor, brake)

        const length = this.laneLength
        const laneNear = Math.abs(progress - (LAYOUT.laneA.tMin + LAYOUT.laneA.tMax) / 2) < 0.25
        for(const item of this.moving)
        {
            const { vehicle, index, count } = item
            vehicle.visible = laneNear
            if(!laneNear)
                continue
            const s = lanePosition(this.distance, index, count, length)
            const t = LAYOUT.laneA.tMin + s / this.world.roadLength
            const position = this.ctx.point(t, LAYOUT.laneA.offset, 0.12)
            const frame = this.ctx.frame(t)
            vehicle.position.copy(position)
            vehicle.rotation.y = frame.yaw
            const fade = Math.max(0.001, laneFade(s, length, this.fadeLength) * this.ctx.clearance(t, -1, tour))
            vehicle.scale.setScalar(fade)

            // Wheel spin, and detail only when close enough to read it
            const spin = -(this.speedNow * delta) / 0.34
            for(const wheel of vehicle.userData.wheels)
                wheel.rotation.z += spin
            const distance = cameraPosition ? vehicle.position.distanceToSquared(cameraPosition) : 0
            vehicle.userData.detail.visible = distance < 55 * 55
        }

        if(this.bus)
        {
            const near = Math.abs(this.bus.t - progress) < 0.2
            this.bus.vehicle.visible = near
            if(near)
            {
                const blink = Math.sin(time * 6) > 0
                for(const lamp of this.bus.lamps)
                    lamp.visible = blink
                this.bus.vehicle.userData.detail.visible = !cameraPosition || this.bus.vehicle.position.distanceToSquared(cameraPosition) < 70 * 70
            }
        }

        for(const parked of this.parked)
        {
            const near = Math.abs(parked.t - progress) < 0.16 && this.ctx.clearance(parked.t, parked.side, tour) > 0.05
            if(parked.vehicle.visible !== near)
                parked.vehicle.visible = near
        }
    }
}
