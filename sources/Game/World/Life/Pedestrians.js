import * as THREE from 'three/webgpu'
import { pingPong } from '../../utilities/placement.js'
import { seededRandom } from '../../utilities/maths.js'
import { LAYOUT } from './layout.js'

const damp = (current, target, rate, delta) => current + (target - current) * (1 - Math.exp(-rate * delta))

/**
 * A small, varied cast of stylized people. Each person is a few shared
 * geometries with pivoted limbs, so walking, waiting, sitting and cycling are
 * plain rotations. Only people near the rider are updated or drawn.
 */
export class Pedestrians
{
    constructor(ctx, vehicles)
    {
        this.ctx = ctx
        this.world = ctx.world
        this.vehicles = vehicles
        this.random = seededRandom(5150)
        this.people = []
        this.walkers = []
        this.crossers = []
        this.waiters = []
        this.seated = []
        this.cyclists = []
        this.group = new THREE.Group()
        this.group.name = 'Pedestrians'
        ctx.group.add(this.group)

        const m = (hex) => this.world.material(hex, { roughness: 0.92 })
        this.shirts = ['#d98b73', '#5f9aa0', '#e3c070', '#8d86b8', '#7aa578', '#c9737f', '#f0e6d4', '#4e6f8a'].map(m)
        this.pants = ['#3b4655', '#6b5a50', '#54637a', '#2f3a3d', '#7b6d82'].map(m)
        this.skins = ['#f1c7a3', '#d79b73', '#a8714f', '#7b4e36', '#e6b38c'].map(m)
        this.hairs = ['#2b2420', '#4a3426', '#1c1c20', '#8a6a44', '#b7b0a4'].map(m)
        this.shoe = m('#26292d')
        this.bag = m('#b9654c')

        this.torsoGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.64, 8)
        this.headGeo = new THREE.SphereGeometry(0.17, 10, 8)
        this.hairGeo = new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62)
        this.armGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.56, 6)
        this.legGeo = new THREE.CylinderGeometry(0.085, 0.07, 0.8, 6)
        this.footGeo = new THREE.BoxGeometry(0.14, 0.07, 0.26)
        this.packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.14)

        this.buildWalkers()
        this.buildWaiters()
        this.buildCrossers()
        this.buildCafeGuests()
        this.buildCyclists()

        this.counts = {
            walkers: this.walkers.length,
            waiters: this.waiters.length,
            crossers: this.crossers.length,
            seated: this.seated.length,
            cyclists: this.cyclists.length
        }
    }

    pick(list)
    {
        return list[Math.floor(this.random() * list.length)]
    }

    /** Build one person. Origin at the feet, facing +z. */
    person(options = {})
    {
        const height = options.height ?? 0.92 + this.random() * 0.16
        const shirt = options.shirt ?? this.pick(this.shirts)
        const pants = options.pants ?? this.pick(this.pants)
        const skin = this.pick(this.skins)
        const hair = this.pick(this.hairs)
        const group = new THREE.Group()
        const body = new THREE.Group()
        group.add(body)

        const mesh = (geometry, material, parent, x, y, z) =>
        {
            const m = new THREE.Mesh(geometry, material)
            m.position.set(x, y, z)
            m.castShadow = true
            parent.add(m)
            return m
        }

        const hips = new THREE.Group()
        hips.position.y = 0.86
        body.add(hips)
        const torso = mesh(this.torsoGeo, shirt, hips, 0, 0.36, 0)
        void torso
        const head = mesh(this.headGeo, skin, hips, 0, 0.9, 0)
        mesh(this.hairGeo, hair, hips, 0, 0.93, -0.01)

        const limb = (geometry, material, x, y, parent, length) =>
        {
            const pivot = new THREE.Group()
            pivot.position.set(x, y, 0)
            const m = mesh(geometry, material, pivot, 0, -length / 2, 0)
            void m
            parent.add(pivot)
            return pivot
        }
        const armL = limb(this.armGeo, shirt, -0.3, 0.6, hips, 0.56)
        const armR = limb(this.armGeo, shirt, 0.3, 0.6, hips, 0.56)
        const legL = limb(this.legGeo, pants, -0.11, 0, hips, 0.8)
        const legR = limb(this.legGeo, pants, 0.11, 0, hips, 0.8)
        mesh(this.footGeo, this.shoe, legL, 0, -0.78, 0.06)
        mesh(this.footGeo, this.shoe, legR, 0, -0.78, 0.06)

        if(options.backpack ?? this.random() < 0.3)
            mesh(this.packGeo, this.bag, hips, 0, 0.42, -0.2)

        group.scale.setScalar(height)
        group.userData = { hips, armL, armR, legL, legR, head }
        return group
    }

    addPerson(person, extra)
    {
        person.visible = false
        this.group.add(person)
        const entry = { person, base: person.scale.x, ...extra }
        this.people.push(entry)
        return entry
    }

    setFacing(person, dx, dz)
    {
        person.rotation.y = Math.atan2(dx, dz)
    }

    pose(person, phase, amount, bob = 0.03)
    {
        const { hips, armL, armR, legL, legR } = person.userData
        const swing = Math.sin(phase) * amount
        legL.rotation.x = swing
        legR.rotation.x = -swing
        armL.rotation.x = -swing * 0.8
        armR.rotation.x = swing * 0.8
        hips.position.y = 0.86 + Math.abs(Math.cos(phase)) * bob * (amount > 0.01 ? 1 : 0)
    }

    // ---------- sidewalk walkers ----------

    buildWalkers()
    {
        const routes = [
            { t0: 0.70, t1: 0.80, side: 1 }, { t0: 0.79, t1: 0.9, side: -1 }, { t0: 0.88, t1: 0.97, side: 1 },
            { t0: 0.93, t1: 0.99, side: -1 }, { t0: 0.72, t1: 0.78, side: -1 }, { t0: 0.82, t1: 0.88, side: 1 }
        ]
        const count = this.ctx.low ? 4 : routes.length
        routes.slice(0, count).forEach((route, index) =>
        {
            const person = this.person()
            const lane = LAYOUT.sidewalkWalk.offset + (index % 2) * 0.55
            this.addPerson(person, { kind: 'walker', route, lane, speed: 1.1 + this.random() * 0.5, phase: this.random() * 6, yaw: 0 })
            this.walkers.push(person)
        })
    }

    updateWalker(entry, time, delta)
    {
        const { route, lane } = entry
        const length = (route.t1 - route.t0) * this.world.roadLength
        const u = pingPong((time * entry.speed + entry.phase * 3) / length)
        const t = route.t0 + u * (route.t1 - route.t0)
        const forward = Math.floor(((time * entry.speed + entry.phase * 3) / length) % 2) === 0 ? 1 : -1
        const p = this.ctx.point(t, route.side * lane, 0.14)
        const frame = this.ctx.frame(t)
        entry.person.position.copy(p)
        const targetYaw = Math.atan2(frame.tangent.x * forward, frame.tangent.z * forward)
        entry.yaw = this.turnToward(entry.yaw, targetYaw, delta)
        entry.person.rotation.y = entry.yaw
        this.pose(entry.person, time * entry.speed * 4.2 + entry.phase, 0.6)
    }

    turnToward(current, target, delta)
    {
        let difference = target - current
        while(difference > Math.PI) difference -= Math.PI * 2
        while(difference < -Math.PI) difference += Math.PI * 2
        return current + difference * (1 - Math.exp(-9 * delta))
    }

    // ---------- bus-stop waiters ----------

    buildWaiters()
    {
        const stop = LAYOUT.busStop
        const frame = this.ctx.frame(stop.t)
        ;[-1.2, 0.1, 1.3].forEach((along, index) =>
        {
            const person = this.person({ backpack: index === 1 })
            const position = this.ctx.point(stop.t + along / this.world.roadLength, stop.side * (stop.offset - 0.5), 0.12)
            person.position.copy(position)
            // Face the road (towards the centre line)
            this.setFacing(person, -frame.side.x * stop.side, -frame.side.z * stop.side)
            this.addPerson(person, { kind: 'waiter', t: stop.t, phase: index * 1.7, phone: index === 0 })
            this.waiters.push(person)
        })
    }

    updateWaiter(entry, time)
    {
        const { armR, armL, head } = entry.person.userData
        const breathe = Math.sin(time * 1.6 + entry.phase)
        entry.person.userData.hips.position.y = 0.86 + breathe * 0.008
        if(entry.phone)
        {
            armR.rotation.x = -1.25
            head.rotation.x = 0.25
            armL.rotation.x = 0.05
        }
        else
        {
            // Occasionally glance up the road for the bus
            head.rotation.y = Math.sin(time * 0.35 + entry.phase) * 0.7
            armL.rotation.x = 0.05
            armR.rotation.x = -0.05
        }
    }

    // ---------- crossing the marked crosswalk ----------

    buildCrossers()
    {
        const t = LAYOUT.crossing.t
        const count = this.ctx.low ? 2 : 3
        for(let index = 0; index < count; index++)
        {
            const person = this.person()
            this.addPerson(person, { kind: 'crosser', t, lane: (index - 1) * 1.1, phase: index * 5.5, dir: index % 2 ? 1 : -1, progress: 0, state: 'wait', timer: index * 2.5 })
            this.crossers.push(person)
        }
    }

    updateCrosser(entry, time, delta, progress)
    {
        const frame = this.ctx.frame(entry.t)
        const near = Math.abs(progress - entry.t) < 0.05
        const half = 5.6 // from kerb to kerb across the 9m road plus verge
        const speed = near ? 3.4 : 1.35

        if(entry.state === 'wait')
        {
            entry.timer -= delta
            if(entry.timer <= 0 && !near)
            {
                entry.state = 'cross'
                entry.progress = 0
            }
        }
        else
        {
            entry.progress += (speed * delta) / (half * 2)
            if(entry.progress >= 1)
            {
                entry.progress = 0
                entry.state = 'wait'
                entry.dir *= -1
                entry.timer = 5 + this.random() * 6
            }
        }

        const u = entry.state === 'cross' ? entry.progress : 0
        const offset = entry.dir * (-half + u * half * 2)
        const along = (entry.lane) / this.world.roadLength
        const p = this.ctx.point(entry.t + along, offset, 0.14)
        entry.person.position.copy(p)
        // Walk towards the far kerb; stand facing it while waiting
        const facing = entry.dir
        this.setFacing(entry.person, frame.side.x * facing, frame.side.z * facing)
        this.pose(entry.person, time * (speed * 3.4) + entry.phase, entry.state === 'cross' ? 0.6 : 0)
    }

    // ---------- people at the café ----------

    buildCafeGuests()
    {
        const cafe = LAYOUT.cafe
        const frame = this.ctx.frame(cafe.t)
        ;[[-2.1, 0.0], [1.2, -0.4]].forEach(([along, across], index) =>
        {
            const person = this.person()
            const position = this.ctx.point(cafe.t + along / this.world.roadLength, cafe.side * (cafe.offset - 2.2 + across), 0.12)
            person.position.copy(position)
            person.userData.hips.position.y = 0.52
            person.userData.legL.rotation.x = -1.45
            person.userData.legR.rotation.x = -1.45
            // Face the road (toward the centre line)
            this.setFacing(person, -frame.side.x * cafe.side, -frame.side.z * cafe.side)
            this.addPerson(person, { kind: 'seated', t: cafe.t, phase: index * 2 })
            this.seated.push(person)
        })
    }

    updateSeated(entry, time)
    {
        const { armR, armL, head } = entry.person.userData
        armR.rotation.x = -0.9 + Math.sin(time * 0.6 + entry.phase) * 0.15
        armL.rotation.x = -0.5
        head.rotation.y = Math.sin(time * 0.4 + entry.phase) * 0.35
    }

    // ---------- cyclist ----------

    buildCyclists()
    {
        const count = this.ctx.low ? 1 : 2
        for(let index = 0; index < count; index++)
        {
            const bike = this.vehicles.bicycle(index ? '#4f8a8f' : '#c87a5f')
            const rider = this.person({ backpack: index === 0 })
            rider.userData.hips.position.y = 0.82
            rider.userData.armL.rotation.x = -1.0
            rider.userData.armR.rotation.x = -1.0
            rider.position.set(0, 0.02, 0)
            // Bicycle forward is +x, person forward is +z
            rider.rotation.y = Math.PI / 2
            rider.scale.multiplyScalar(0.95)
            bike.add(rider)
            this.addPerson(bike, { kind: 'cyclist', index, phase: index * 40, speed: 3.6 + index * 0.6 })
            this.cyclists.push(bike)
        }
    }

    updateCyclist(entry, time, tour)
    {
        const { tMin, tMax, offset } = LAYOUT.cyclist
        const length = (tMax - tMin) * this.world.roadLength
        const distance = ((time * entry.speed + entry.phase) % length + length) % length
        const t = tMin + distance / this.world.roadLength
        const lane = offset - entry.index * 0.0
        const position = this.ctx.point(t, lane, 0.14)
        const frame = this.ctx.frame(t)
        entry.person.position.copy(position)
        entry.person.rotation.y = frame.yaw
        // Fade in/out at the ends rather than popping
        const fade = Math.min(1, distance / 5, (length - distance) / 5)
        const clear = this.ctx.clearance(t, -1, tour)
        entry.person.scale.setScalar(Math.max(0.001, fade * clear))
        // Pedalling and wheel spin
        const rider = entry.person.children.find(child => child.userData.legL)
        if(rider)
        {
            const phase = time * 7
            rider.userData.legL.rotation.x = Math.sin(phase) * 0.7 - 0.5
            rider.userData.legR.rotation.x = Math.sin(phase + Math.PI) * 0.7 - 0.5
        }
        for(const wheel of entry.person.userData.wheels)
            wheel.rotation.z = -(time * entry.speed) / 0.34
    }

    update(time, delta, progress, tour)
    {
        for(const entry of this.people)
        {
            const t = entry.t ?? entry.route?.t0 ?? LAYOUT.cyclist.tMin
            const reference = entry.kind === 'walker' ? (entry.route.t0 + entry.route.t1) / 2
                : entry.kind === 'cyclist' ? 0.85
                    : t
            const range = entry.kind === 'cyclist' ? 0.2 : entry.kind === 'walker' ? 0.14 : 0.1
            const visible = Math.abs(reference - progress) < range
            const side = entry.kind === 'walker' ? entry.route.side
                : entry.kind === 'waiter' ? LAYOUT.busStop.side
                    : entry.kind === 'seated' ? LAYOUT.cafe.side
                        : entry.kind === 'cyclist' ? -1 : 0
            const clear = entry.kind === 'cyclist' ? 1 : this.ctx.clearance(entry.kind === 'walker' ? reference : t, side, tour)
            entry.clear = clear
            const shown = visible && clear > 0.04
            if(entry.person.visible !== shown)
                entry.person.visible = shown
            if(!shown)
                continue
            if(entry.kind !== 'cyclist')
                entry.person.scale.setScalar(entry.base * clear)

            switch(entry.kind)
            {
                case 'walker': this.updateWalker(entry, time, delta); break
                case 'waiter': this.updateWaiter(entry, time); break
                case 'crosser': this.updateCrosser(entry, time, delta, progress); break
                case 'seated': this.updateSeated(entry, time); break
                case 'cyclist': this.updateCyclist(entry, time, tour); break
            }
        }
    }
}

void damp
