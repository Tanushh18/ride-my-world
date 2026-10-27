import * as THREE from 'three/webgpu'
import { flightPath, isReserved } from '../../utilities/placement.js'
import { seededRandom } from '../../utilities/maths.js'

const TAU = Math.PI * 2

/**
 * Wildlife is a delightful discovery, not clutter: a few flocks overhead,
 * perched birds that take off as the rider approaches, deer grazing in distant
 * clearings, small animals in the park, insects near flowers and water, and fish
 * silhouettes in the river. Everything is procedural and only animated while
 * the rider is within range of it, so distant wildlife costs no CPU.
 */
export class Wildlife
{
    constructor(ctx)
    {
        this.ctx = ctx
        this.world = ctx.world
        this.group = new THREE.Group()
        this.group.name = 'Wildlife'
        ctx.group.add(this.group)
        this.random = seededRandom(4242)

        this.matrix = new THREE.Matrix4()
        this.wingMatrix = new THREE.Matrix4()
        this.local = new THREE.Matrix4()
        this.dummy = new THREE.Object3D()
        this.tmp = new THREE.Vector3()

        this.flocks = []
        this.perched = []
        this.deer = []
        this.rabbits = []
        this.squirrels = []
        this.swarms = []
        this.fish = null

        this.buildBirdGeometry()
        this.buildFlocks()
        this.buildPerchedBirds()
        this.buildDeer()
        this.buildSmallAnimals()
        this.buildInsects()
        this.buildFish()

        this.counts = {
            flyingBirds: this.flocks.reduce((total, flock) => total + flock.count, 0),
            perchedBirds: this.perched.length,
            deer: this.deer.length,
            rabbits: this.rabbits.length,
            squirrels: this.squirrels.length,
            butterflies: this.swarms.filter(s => s.kind === 'butterfly').reduce((total, s) => total + s.count, 0),
            dragonflies: this.swarms.filter(s => s.kind === 'dragonfly').reduce((total, s) => total + s.count, 0),
            fish: this.fish?.count ?? 0
        }
    }

    // ---------- shared geometry ----------

    buildBirdGeometry()
    {
        // Body points toward +z; wings extend along +x from their root.
        const body = new THREE.IcosahedronGeometry(0.16, 1)
        body.scale(0.8, 0.75, 1.9)
        const head = new THREE.IcosahedronGeometry(0.09, 1)
        head.translate(0, 0.04, 0.3)
        const tail = new THREE.ConeGeometry(0.06, 0.28, 4)
        tail.rotateX(-Math.PI / 2)
        tail.scale(1.6, 0.4, 1)
        tail.translate(0, 0, -0.34)
        this.birdBody = mergeSimple([body, head, tail])

        const wing = new THREE.BufferGeometry()
        wing.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, 0.17, 0, 0, -0.14, 0.62, 0.02, -0.05,
            0, 0, 0.17, 0.62, 0.02, -0.05, 0.5, 0.02, 0.1
        ], 3))
        wing.computeVertexNormals()
        this.birdWing = withUv(wing)
        this.birdWingLeft = withUv(wing.clone().scale(-1, 1, 1))
    }

    birdMaterial(hex)
    {
        return this.world.material(hex, { roughness: 0.85, side: THREE.DoubleSide })
    }

    // ---------- flocks of flying birds ----------

    buildFlocks()
    {
        const plans = [
            { t: 0.09, count: 6, side: 1, color: '#3d4a56' },
            { t: 0.30, count: 5, side: -1, color: '#4a5560' },
            { t: 0.58, count: 7, side: 1, color: '#f0e6d8' }, // river gulls
            { t: 0.80, count: 6, side: -1, color: '#5a5360' },
            { t: 0.97, count: 5, side: 1, color: '#e8dccd' }
        ]
        const bodyMat = this.birdMaterial('#6a6470')

        for(const plan of plans)
        {
            const count = Math.max(3, Math.round(plan.count * (this.ctx.low ? 0.6 : 1)))
            const material = this.birdMaterial(plan.color)
            const body = new THREE.InstancedMesh(this.birdBody, material, count)
            const wingsR = new THREE.InstancedMesh(this.birdWing, material, count)
            const wingsL = new THREE.InstancedMesh(this.birdWingLeft, material, count)
            for(const mesh of [body, wingsR, wingsL])
            {
                mesh.frustumCulled = false
                mesh.castShadow = false
                this.group.add(mesh)
            }
            void bodyMat

            const frame = this.ctx.frame(plan.t)
            const centre = frame.position.clone().addScaledVector(frame.side, plan.side * 22)
            const birds = Array.from({ length: count }, (_, i) => ({
                phase: i * 0.55 + this.random() * 0.4,
                radiusX: 16 + this.random() * 8,
                radiusZ: 9 + this.random() * 6,
                height: 11 + this.random() * 6,
                speed: 0.2 + this.random() * 0.05,
                flap: 7 + this.random() * 3,
                scale: 1.5 + this.random() * 0.5
            }))
            this.flocks.push({ ...plan, count, body, wingsR, wingsL, centre, birds, yaw: frame.yaw, visible: true })
        }
    }

    updateFlocks(time, progress)
    {
        for(const flock of this.flocks)
        {
            const near = Math.abs(flock.t - progress) < 0.2
            if(!near)
            {
                if(flock.visible)
                {
                    flock.body.visible = flock.wingsR.visible = flock.wingsL.visible = false
                    flock.visible = false
                }
                continue
            }
            if(!flock.visible)
            {
                flock.body.visible = flock.wingsR.visible = flock.wingsL.visible = true
                flock.visible = true
            }

            flock.birds.forEach((bird, index) =>
            {
                const path = flightPath(time, { radiusX: bird.radiusX, radiusZ: bird.radiusZ, speed: bird.speed, phase: bird.phase, height: bird.height, bob: 0.6 })
                this.dummy.position.set(flock.centre.x + path.x, path.y, flock.centre.z + path.z)
                this.dummy.rotation.set(0, path.heading, 0)
                this.dummy.scale.setScalar(bird.scale)
                this.dummy.updateMatrix()
                flock.body.setMatrixAt(index, this.dummy.matrix)

                const flap = Math.sin(time * bird.flap + bird.phase * 6) * 0.75
                this.setWing(flock.wingsR, index, this.dummy.matrix, 0.08, flap)
                this.setWing(flock.wingsL, index, this.dummy.matrix, -0.08, -flap, true)
            })
            flock.body.instanceMatrix.needsUpdate = true
            flock.wingsR.instanceMatrix.needsUpdate = true
            flock.wingsL.instanceMatrix.needsUpdate = true
        }
    }

    setWing(mesh, index, birdMatrix, rootX, flap)
    {
        this.local.makeRotationZ(flap)
        this.local.setPosition(rootX, 0.04, 0)
        this.wingMatrix.multiplyMatrices(birdMatrix, this.local)
        mesh.setMatrixAt(index, this.wingMatrix)
    }

    // ---------- perched birds that take off ----------

    makeBirdMesh(color)
    {
        const material = this.birdMaterial(color)
        const group = new THREE.Group()
        const body = new THREE.Mesh(this.birdBody, material)
        const right = new THREE.Mesh(this.birdWing, material)
        const left = new THREE.Mesh(this.birdWingLeft, material)
        right.position.set(0.08, 0.04, 0)
        left.position.set(-0.08, 0.04, 0)
        group.add(body, right, left)
        group.userData = { right, left, body }
        return group
    }

    buildPerchedBirds()
    {
        // [t, offset, y, colour] — bridge rails, lamp arms and boulevard railings
        const spots = [
            [0.585, 4.25, 0.92, '#6d5b52'], [0.598, -4.25, 0.92, '#5d6670'], [0.612, 4.25, 0.92, '#b8a99a'],
            [0.795, 5.9, 3.38, '#5d5560'], [0.836, -5.9, 3.38, '#6d5b52'], [0.925, 5.9, 3.38, '#4f5964'],
            [0.30, 9.2, 2.05, '#7a5c4e'], [0.19, -9.5, 2.1, '#5d6670']
        ]
        spots.forEach(([t, offset, y, color], index) =>
        {
            const mesh = this.makeBirdMesh(color)
            const position = this.ctx.point(t, offset, y)
            const frame = this.ctx.frame(t)
            mesh.position.copy(position)
            mesh.scale.setScalar(1.25)
            mesh.rotation.y = frame.yaw + (index % 2 ? 0.6 : -0.9)
            this.group.add(mesh)
            this.perched.push({ mesh, home: position.clone(), yaw: mesh.rotation.y, t, side: Math.sign(offset), state: 'perched', timer: 0, phase: index * 1.3 })
        })
    }

    updatePerched(time, delta, progress)
    {
        for(const bird of this.perched)
        {
            const { right, left } = bird.mesh.userData
            const distance = Math.abs(bird.t - progress)

            if(bird.state === 'perched')
            {
                bird.mesh.visible = distance < 0.2
                if(!bird.mesh.visible)
                    continue
                right.rotation.z = left.rotation.z = 0.9 // wings folded
                bird.mesh.rotation.y = bird.yaw + Math.sin(time * 0.7 + bird.phase) * 0.12
                bird.mesh.position.y = bird.home.y + Math.max(0, Math.sin(time * 2.4 + bird.phase)) * 0.02
                if(distance < 0.028)
                {
                    bird.state = 'flying'
                    bird.timer = 0
                }
            }
            else if(bird.state === 'flying')
            {
                bird.timer += delta
                const u = Math.min(1, bird.timer / 5)
                const away = bird.side
                const frame = this.ctx.frame(bird.t)
                // Arc up and away from the road, then keep climbing out of view
                this.tmp.copy(bird.home)
                    .addScaledVector(frame.side, away * u * 26)
                    .addScaledVector(frame.tangent, u * 14)
                this.tmp.y = bird.home.y + u * 9 + Math.sin(u * Math.PI) * 2
                const heading = Math.atan2(frame.side.x * away * 26 + frame.tangent.x * 14, frame.side.z * away * 26 + frame.tangent.z * 14)
                bird.mesh.position.copy(this.tmp)
                bird.mesh.rotation.y = heading
                const flap = Math.sin(time * 18) * 0.8
                right.rotation.z = flap
                left.rotation.z = -flap
                if(u >= 1)
                {
                    bird.state = 'away'
                    bird.mesh.visible = false
                }
            }
            else if(distance > 0.12)
            {
                // The rider has moved on; the bird quietly returns to its perch
                bird.state = 'perched'
                bird.mesh.position.copy(bird.home)
                bird.mesh.visible = false
            }
        }
    }

    // ---------- deer ----------

    makeDeer(antlers)
    {
        const hide = this.world.material('#a37a56', { roughness: 0.95 })
        const belly = this.world.material('#d9c2a0', { roughness: 0.95 })
        const dark = this.world.material('#3d3029', { roughness: 0.9 })
        const group = new THREE.Group()
        const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            mesh.rotation.set(rx, ry, rz)
            mesh.castShadow = true
            group.add(mesh)
            return mesh
        }

        const body = new THREE.IcosahedronGeometry(0.5, 1)
        body.scale(0.7, 0.62, 1.35)
        add(body, hide, 0, 1.02, 0)
        add(new THREE.IcosahedronGeometry(0.3, 1), belly, 0, 0.84, 0.1).scale.set(0.9, 0.6, 1.6)
        add(new THREE.SphereGeometry(0.1, 6, 4), belly, 0, 1.08, -0.7).scale.set(1, 1.3, 0.7) // tail

        const legGeometry = new THREE.CylinderGeometry(0.05, 0.035, 0.85, 5)
        const legs = []
        for(const [x, z] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]])
        {
            const leg = add(legGeometry, dark, x, 0.43, z)
            legs.push(leg)
        }

        const neck = new THREE.Group()
        neck.position.set(0, 1.18, 0.55)
        group.add(neck)
        const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.62, 6), hide)
        neckMesh.position.set(0, 0.28, 0.12)
        neckMesh.rotation.x = 0.45
        neckMesh.castShadow = true
        neck.add(neckMesh)
        const head = new THREE.Group()
        head.position.set(0, 0.6, 0.3)
        neck.add(head)
        const skull = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 6), hide)
        skull.rotation.x = Math.PI / 2
        skull.position.z = 0.08
        head.add(skull)
        for(const x of [-0.09, 0.09])
        {
            const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 4), hide)
            ear.position.set(x, 0.1, -0.06)
            ear.rotation.z = x > 0 ? -0.7 : 0.7
            head.add(ear)
        }
        if(antlers)
        {
            for(const x of [-0.06, 0.06])
            {
                const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.4, 4), dark)
                antler.position.set(x * 1.8, 0.28, -0.04)
                antler.rotation.z = x > 0 ? -0.5 : 0.5
                head.add(antler)
            }
        }
        return { group, neck, head, legs }
    }

    buildDeer()
    {
        const clearings = [[0.08, 1, 34], [0.175, -1, 38], [0.325, 1, 31], [0.455, -1, 36]]
        clearings.forEach(([t, side, offset], index) =>
        {
            if(isReserved(t, side * offset, this.ctx.zones))
                return
            const position = this.ctx.point(t, side * offset, 0)
            if(this.ctx.inRiver(position.x, position.z, 3))
                return
            const deer = this.makeDeer(index % 2 === 0)
            deer.group.position.copy(position)
            deer.group.scale.setScalar(1.15)
            deer.group.rotation.y = this.ctx.frame(t).yaw + (side > 0 ? 2.4 : 0.7)
            this.group.add(deer.group)
            this.deer.push({ ...deer, t, phase: index * 2.1, baseYaw: deer.group.rotation.y })
        })
    }

    updateDeer(time, progress)
    {
        for(const deer of this.deer)
        {
            const near = Math.abs(deer.t - progress) < 0.14
            deer.group.visible = near
            if(!near)
                continue
            // Grazing cycle: head lowers, lifts to look around, flicks an ear
            const cycle = (time * 0.18 + deer.phase) % 1
            const graze = cycle < 0.6 ? Math.sin(cycle / 0.6 * Math.PI) : 0
            deer.neck.rotation.x = 0.1 + graze * 0.85
            deer.head.rotation.y = cycle > 0.62 ? Math.sin((cycle - 0.62) * 14) * 0.3 : 0
            deer.group.rotation.y = deer.baseYaw + Math.sin(time * 0.11 + deer.phase) * 0.12
        }
    }

    // ---------- rabbits and squirrels (city park / forest edge) ----------

    makeSmallAnimal(furHex, tailHex, ears)
    {
        const fur = this.world.material(furHex, { roughness: 1 })
        const tailMat = this.world.material(tailHex, { roughness: 1 })
        const group = new THREE.Group()
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), fur)
        body.scale.set(0.85, 0.8, 1.35)
        body.position.y = 0.2
        body.castShadow = true
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), fur)
        head.position.set(0, 0.3, 0.22)
        const tail = new THREE.Mesh(new THREE.IcosahedronGeometry(ears ? 0.06 : 0.12, 1), tailMat)
        tail.position.set(0, ears ? 0.22 : 0.34, -0.26)
        if(!ears)
            tail.scale.set(0.7, 1.7, 0.8)
        group.add(body, head, tail)
        if(ears)
        {
            for(const x of [-0.04, 0.04])
            {
                const ear = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.2, 4), fur)
                ear.position.set(x, 0.44, 0.2)
                ear.rotation.z = x > 0 ? -0.15 : 0.15
                group.add(ear)
            }
        }
        group.scale.setScalar(1.5)
        return group
    }

    buildSmallAnimals()
    {
        // Rabbits graze and hop in the park verges; squirrels circle a street tree
        ;[[0.735, -1, 12.6], [0.935, 1, 12.9], [0.37, 1, 14], [0.11, -1, 13]].forEach(([t, side, offset], index) =>
        {
            if(isReserved(t, side * offset, this.ctx.zones))
                return
            const mesh = this.makeSmallAnimal('#b9a692', '#f2eadd', true)
            const position = this.ctx.point(t, side * offset, 0.12)
            mesh.position.copy(position)
            this.group.add(mesh)
            this.rabbits.push({ mesh, home: position.clone(), t, phase: index * 1.9, yaw: index * 2.2 })
        })

        ;[[0.83, -1, 11.4], [0.955, -1, 11.2]].forEach(([t, side, offset], index) =>
        {
            if(isReserved(t, side * offset, this.ctx.zones))
                return
            const mesh = this.makeSmallAnimal('#a56b44', '#c88a58', false)
            const position = this.ctx.point(t, side * offset, 0.12)
            mesh.position.copy(position)
            this.group.add(mesh)
            this.squirrels.push({ mesh, home: position.clone(), t, phase: index * 2.4 })
        })
    }

    updateSmallAnimals(time, progress)
    {
        for(const rabbit of this.rabbits)
        {
            const near = Math.abs(rabbit.t - progress) < 0.1
            rabbit.mesh.visible = near
            if(!near)
                continue
            // Short hops separated by still pauses, always moving away from the road
            const cycle = (time * 0.35 + rabbit.phase) % 3
            const hopping = cycle < 1
            const hop = hopping ? Math.sin(cycle * Math.PI) : 0
            rabbit.mesh.position.y = rabbit.home.y + hop * 0.28
            const drift = Math.floor((time * 0.35 + rabbit.phase) / 3) * 0.6 + (hopping ? cycle * 0.6 : 0.6)
            rabbit.mesh.position.x = rabbit.home.x + Math.cos(rabbit.yaw) * (drift % 3.6)
            rabbit.mesh.position.z = rabbit.home.z + Math.sin(rabbit.yaw) * (drift % 3.6)
            rabbit.mesh.rotation.y = -rabbit.yaw + Math.PI / 2
        }

        for(const squirrel of this.squirrels)
        {
            const near = Math.abs(squirrel.t - progress) < 0.1
            squirrel.mesh.visible = near
            if(!near)
                continue
            const angle = time * 0.8 + squirrel.phase
            squirrel.mesh.position.set(
                squirrel.home.x + Math.cos(angle) * 0.9,
                squirrel.home.y + Math.abs(Math.sin(angle * 4)) * 0.12,
                squirrel.home.z + Math.sin(angle) * 0.9
            )
            squirrel.mesh.rotation.y = -angle + Math.PI
        }
    }

    // ---------- butterflies and dragonflies ----------

    buildInsects()
    {
        const butterflyWing = new THREE.BufferGeometry()
        butterflyWing.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, 0, 0.16, 0, 0.1, 0.14, 0, -0.1,
            0.16, 0, 0.1, 0.24, 0, 0, 0.14, 0, -0.1
        ], 3))
        butterflyWing.computeVertexNormals()
        withUv(butterflyWing)
        const dragonWing = new THREE.BufferGeometry()
        dragonWing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.04, 0.34, 0, 0.02, 0, 0, -0.04], 3))
        dragonWing.computeVertexNormals()
        withUv(dragonWing)

        const makeSwarm = (kind, anchors, perAnchor, colors, wingGeometry, flapRate, radius, height) =>
        {
            const count = Math.max(2, Math.round(anchors.length * perAnchor * (this.ctx.low ? 0.6 : 1)))
            const wingMaterial = this.world.material(colors[0], { roughness: 0.8, side: THREE.DoubleSide, emissive: colors[0], emissiveIntensity: 0.12 })
            const bodyMaterial = this.world.material('#3a3038', { roughness: 0.9 })
            const rightWings = new THREE.InstancedMesh(wingGeometry, wingMaterial, count)
            const leftWings = new THREE.InstancedMesh(withUv(wingGeometry.clone().scale(-1, 1, 1)), wingMaterial, count)
            const bodyGeometry = kind === 'dragonfly' ? new THREE.CylinderGeometry(0.012, 0.008, 0.36, 4).rotateX(Math.PI / 2) : new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4).rotateX(Math.PI / 2)
            const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, count)
            for(const mesh of [rightWings, leftWings, bodies])
            {
                mesh.frustumCulled = false
                this.group.add(mesh)
            }
            const items = Array.from({ length: count }, (_, i) =>
            {
                const anchor = anchors[i % anchors.length]
                return { anchor, phase: this.random() * TAU, speed: 0.5 + this.random() * 0.4, radius: radius * (0.6 + this.random() * 0.8), height: height + this.random() * 0.8 }
            })
            this.swarms.push({ kind, count, rightWings, leftWings, bodies, items, flapRate, scale: kind === 'dragonfly' ? 1.4 : 1.7 })
        }

        // Butterflies: flower-rich verges in the forest and the city park
        const butterflyAnchors = [0.06, 0.15, 0.27, 0.41, 0.52, 0.74, 0.93].map((t, i) =>
        {
            const side = i % 2 ? 1 : -1
            return { t, position: this.ctx.point(t, side * 8.5, 0.6) }
        })
        makeSwarm('butterfly', butterflyAnchors, 3, ['#f0a35e'], butterflyWing, 11, 2.4, 1.1)

        // Dragonflies skim the river between the banks
        const dragonAnchors = [-16, -6, 4, 14].map(u => ({ t: 0.56, position: this.ctx.riverPoint(u, 0, 0.9) }))
        makeSwarm('dragonfly', dragonAnchors, 2, ['#9fd8e6'], dragonWing, 28, 3.2, 0.9)
    }

    updateInsects(time, progress)
    {
        for(const swarm of this.swarms)
        {
            let any = false
            swarm.items.forEach((item, index) =>
            {
                const near = Math.abs(item.anchor.t - progress) < 0.16
                if(!near)
                {
                    this.dummy.scale.setScalar(0.0001)
                    this.dummy.updateMatrix()
                    swarm.bodies.setMatrixAt(index, this.dummy.matrix)
                    swarm.rightWings.setMatrixAt(index, this.dummy.matrix)
                    swarm.leftWings.setMatrixAt(index, this.dummy.matrix)
                    return
                }
                any = true
                const a = time * item.speed + item.phase
                const x = item.anchor.position.x + Math.cos(a) * item.radius + Math.sin(a * 2.3) * item.radius * 0.3
                const z = item.anchor.position.z + Math.sin(a * 1.2) * item.radius
                const y = item.anchor.position.y + item.height * 0.3 + Math.sin(a * 1.9) * 0.4
                const dx = -Math.sin(a) * item.radius
                const dz = Math.cos(a * 1.2) * item.radius * 1.2
                this.dummy.position.set(x, y, z)
                this.dummy.rotation.set(0, Math.atan2(dx, dz), 0)
                this.dummy.scale.setScalar(swarm.scale)
                this.dummy.updateMatrix()
                swarm.bodies.setMatrixAt(index, this.dummy.matrix)
                const flap = Math.sin(time * swarm.flapRate + item.phase * 5) * 0.9
                this.setWing(swarm.rightWings, index, this.dummy.matrix, 0.01, flap)
                this.setWing(swarm.leftWings, index, this.dummy.matrix, -0.01, -flap)
            })
            swarm.bodies.instanceMatrix.needsUpdate = true
            swarm.rightWings.instanceMatrix.needsUpdate = true
            swarm.leftWings.instanceMatrix.needsUpdate = true
            swarm.bodies.visible = swarm.rightWings.visible = swarm.leftWings.visible = any
        }
    }

    // ---------- fish silhouettes ----------

    buildFish()
    {
        const body = new THREE.CircleGeometry(0.5, 10)
        body.scale(1, 0.32, 1)
        body.rotateX(-Math.PI / 2)
        const tail = new THREE.CircleGeometry(0.22, 3)
        tail.rotateZ(Math.PI)
        tail.scale(1, 1.4, 1)
        tail.rotateX(-Math.PI / 2)
        tail.translate(-0.62, 0, 0)
        const geometry = mergeSimple([body, tail])

        const count = this.ctx.low ? 8 : 16
        const material = new THREE.MeshBasicMaterial({ color: '#134a58', transparent: true, opacity: 0.38, depthWrite: false })
        const mesh = new THREE.InstancedMesh(geometry, material, count)
        mesh.frustumCulled = false
        mesh.renderOrder = 1
        this.group.add(mesh)
        const items = Array.from({ length: count }, (_, i) => ({
            lane: (this.random() * 2 - 1) * 5.6,
            speed: (0.8 + this.random() * 1.2) * (i % 2 ? 1 : -1),
            offset: this.random() * 48,
            size: 0.7 + this.random() * 0.8,
            phase: this.random() * TAU
        }))
        this.fish = { mesh, items, count }
    }

    updateFish(time, progress)
    {
        if(!this.fish)
            return
        const near = Math.abs(progress - 0.58) < 0.18
        this.fish.mesh.visible = near
        if(!near)
            return
        const point = new THREE.Vector3()
        this.fish.items.forEach((fish, index) =>
        {
            // Swim along the river's long axis, wrapping so fish stay inside the banks
            const u = ((fish.offset + time * fish.speed) % 44 + 44) % 44 - 22
            const v = fish.lane + Math.sin(time * 0.9 + fish.phase) * 0.7
            this.ctx.riverPoint(u, v, 0.035, point)
            this.dummy.position.copy(point)
            // River plane long axis in world space is local +x
            const heading = this.riverHeading ??= (() =>
            {
                const axis = new THREE.Vector3(1, 0, 0).transformDirection(this.ctx.riverObject.matrix)
                return Math.atan2(-axis.z, axis.x)
            })()
            this.dummy.rotation.set(0, (fish.speed > 0 ? heading : heading + Math.PI) + Math.sin(time * 6 + fish.phase) * 0.16, 0)
            this.dummy.scale.setScalar(fish.size)
            this.dummy.updateMatrix()
            this.fish.mesh.setMatrixAt(index, this.dummy.matrix)
        })
        this.fish.mesh.instanceMatrix.needsUpdate = true
    }

    update(time, delta, progress)
    {
        this.updateFlocks(time, progress)
        this.updatePerched(time, delta, progress)
        this.updateDeer(time, progress)
        this.updateSmallAnimals(time, progress)
        this.updateInsects(time, progress)
        this.updateFish(time, progress)
    }
}

const withUv = (geometry) =>
{
    if(!geometry.attributes.uv)
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2))
    return geometry
}

/** Merge non-indexed geometries with matching attributes (position/normal only). */
function mergeSimple(geometries)
{
    const prepared = geometries.map(geometry =>
    {
        const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone()
        flat.deleteAttribute('uv')
        if(!flat.attributes.normal)
            flat.computeVertexNormals()
        return flat
    })
    let total = 0
    for(const geometry of prepared)
        total += geometry.attributes.position.count
    const positions = new Float32Array(total * 3)
    const normals = new Float32Array(total * 3)
    let offset = 0
    for(const geometry of prepared)
    {
        positions.set(geometry.attributes.position.array, offset * 3)
        normals.set(geometry.attributes.normal.array, offset * 3)
        offset += geometry.attributes.position.count
    }
    const merged = new THREE.BufferGeometry()
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    return withUv(merged)
}
