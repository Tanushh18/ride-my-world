import * as THREE from 'three/webgpu'

/**
 * Airport grounds: runway edge lights, a forecourt with drop-off vehicles,
 * apron service vehicles, a perimeter fence, a windsock and approach signs.
 * Everything is placed in the end-of-route frame (tangent / lateral) so it
 * follows the terminal and runway that ScrollWorld builds from the same frame.
 */
export class AirportLife
{
    constructor(ctx, vehicles)
    {
        this.ctx = ctx
        this.world = ctx.world
        this.vehicles = vehicles
        this.end = ctx.frame(1)
        this.group = new THREE.Group()
        this.group.name = 'AirportLife'
        ctx.group.add(this.group)
        this.counts = {}
        this.lightPhase = []

        this.buildRunwayLights()
        this.buildForecourt()
        this.buildServiceVehicles()
        this.buildFence()
        this.buildWindsock()
        this.buildSigns()
    }

    /** World position from airport-frame coordinates. */
    at(along, lateral, y = 0, target = new THREE.Vector3())
    {
        target.copy(this.end.position)
            .addScaledVector(this.end.tangent, along)
            .addScaledVector(this.end.side, lateral)
        target.y = y
        return target
    }

    place(object, along, lateral, y = 0, yawOffset = 0)
    {
        this.at(along, lateral, y, object.position)
        object.rotation.y = this.end.yaw + yawOffset
        this.group.add(object)
    }

    buildRunwayLights()
    {
        const records = []
        for(let along = 6; along <= 62; along += 4)
            for(const lateral of [-6.45, 6.45])
            {
                const p = this.at(along, lateral, 0.07)
                records.push({ x: p.x, y: 0.07, z: p.z, sx: 1, sy: 1, sz: 1 })
            }
        const material = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb860', emissiveIntensity: 1.4, roughness: 0.4 })
        this.runwayLights = this.ctx.instance('RunwayEdgeLights', new THREE.CylinderGeometry(0.1, 0.12, 0.12, 8), material, records, { castShadow: false })
        this.runwayLightMaterial = material
        this.counts.runwayLights = records.length
    }

    buildForecourt()
    {
        // Kerbside drop-off in front of the terminal canopy
        const fleet = [['sedan', 2, 4.5], ['suv', 5, 9.5], ['hatch', 0, 14.2], ['van', 6, 19.5]]
        fleet.forEach(([kind, paint, along]) =>
        {
            const car = this.vehicles.car(kind, paint)
            this.place(car, along, 14.6, 0.04)
            this.counts.forecourt = (this.counts.forecourt ?? 0) + 1
        })

        // Painted bays
        const lines = []
        for(let along = 2.5; along <= 22; along += 4.9)
        {
            const p = this.at(along, 14.6, 0.05)
            lines.push({ x: p.x, y: 0.05, z: p.z, ry: this.end.yaw + Math.PI / 2, sx: 0.1, sy: 0.01, sz: 3.2 })
        }
        const paint = new THREE.MeshBasicMaterial({ color: '#f4e5cc' })
        this.ctx.instance('ForecourtBays', new THREE.BoxGeometry(1, 1, 1), paint, lines, { castShadow: false })
        const kerb = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 0.3), this.world.material('#c9bab2', { roughness: 0.9 }))
        this.place(kerb, 12, 17.4, 0.06)
    }

    buildServiceVehicles()
    {
        // Fuel truck
        const fuel = new THREE.Group()
        const body = this.world.material('#e9e2d4', { roughness: 0.5 })
        const cab = this.world.material('#c5624f', { roughness: 0.5 })
        const dark = this.world.material('#2a3338', { roughness: 0.9 })
        const mesh = (geometry, material, x, y, z, parent = fuel) =>
        {
            const m = new THREE.Mesh(geometry, material)
            m.position.set(x, y, z)
            m.castShadow = true
            parent.add(m)
            return m
        }
        const tank = mesh(new THREE.CylinderGeometry(0.85, 0.85, 4.4, 12), body, -0.5, 1.45, 0)
        tank.rotation.z = Math.PI / 2
        mesh(new THREE.BoxGeometry(1.5, 1.5, 1.9), cab, 2.3, 1.2, 0)
        mesh(new THREE.BoxGeometry(0.1, 0.7, 1.7), this.vehicles.glass, 3.07, 1.5, 0)
        mesh(new THREE.BoxGeometry(5.8, 0.3, 1.7), dark, 0.2, 0.5, 0)
        for(const x of [-1.8, 0.2, 2.2])
            for(const z of [-0.95, 0.95])
            {
                const wheel = new THREE.Mesh(this.vehicles.wheelGeo, this.vehicles.rubber)
                wheel.position.set(x, 0.34, z)
                fuel.add(wheel)
            }
        this.place(fuel, 24, 11.0, 0.04, Math.PI)

        // Baggage tractor pulling two carts
        const tug = this.vehicles.car('hatch', 4)
        tug.scale.set(0.8, 0.9, 0.8)
        this.place(tug, 36, 9.8, 0.04)
        for(let i = 1; i <= 2; i++)
        {
            const cart = new THREE.Group()
            mesh(new THREE.BoxGeometry(2.0, 0.12, 1.4), dark, 0, 0.45, 0, cart)
            mesh(new THREE.BoxGeometry(1.6, 0.55, 1.1), this.world.material(i % 2 ? '#8d6e57' : '#5f7979', { roughness: 0.9 }), 0, 0.8, 0, cart)
            for(const x of [-0.7, 0.7])
                for(const z of [-0.7, 0.7])
                {
                    const wheel = new THREE.Mesh(this.vehicles.wheelGeo, this.vehicles.rubber)
                    wheel.scale.setScalar(0.6)
                    wheel.position.set(x, 0.2, z)
                    cart.add(wheel)
                }
            this.place(cart, 36 - i * 2.4, 9.8, 0.04)
        }

        // Boarding stairs beside the parked aircraft
        const stairs = new THREE.Group()
        for(let i = 0; i < 6; i++)
            mesh(new THREE.BoxGeometry(0.5, 0.12, 1.0), this.vehicles.chrome, i * 0.45, 0.3 + i * 0.28, 0, stairs)
        mesh(new THREE.BoxGeometry(1.2, 0.12, 1.2), this.vehicles.chrome, 3.0, 2.0, 0, stairs)
        for(const z of [-0.5, 0.5])
            mesh(new THREE.BoxGeometry(3.4, 0.05, 0.05), this.vehicles.chrome, 1.4, 1.3, z, stairs).rotation.z = 0.5
        this.place(stairs, 30.5, 5.6, 0.04, Math.PI / 2)
        this.counts.service = 4
    }

    buildFence()
    {
        const posts = []
        for(let along = 2; along <= 66; along += 3)
        {
            const p = this.at(along, -11.5, 0)
            posts.push({ x: p.x, y: 0.8, z: p.z, sx: 0.08, sy: 1.6, sz: 0.08 })
        }
        const box = new THREE.BoxGeometry(1, 1, 1)
        const steel = this.world.material('#6a787b', { roughness: 0.6, metalness: 0.4 })
        this.ctx.instance('PerimeterFencePosts', box, steel, posts)
        const wire = new THREE.Mesh(new THREE.PlaneGeometry(64, 1.2), new THREE.MeshBasicMaterial({ color: '#9aa5a8', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }))
        wire.rotation.x = 0
        this.place(wire, 34, -11.5, 1.0, Math.PI / 2)
        // Perimeter lamps on the fence line
        const lamps = []
        for(let along = 8; along <= 62; along += 18)
        {
            const p = this.at(along, -11.5, 4.2)
            lamps.push({ x: p.x, y: 4.2, z: p.z, sx: 0.4, sy: 0.14, sz: 0.4 })
        }
        this.ctx.instance('PerimeterLamps', box, new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), lamps, { castShadow: false })
        this.counts.fencePosts = posts.length
    }

    buildWindsock()
    {
        const group = new THREE.Group()
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.2, 6), this.vehicles.chrome)
        pole.position.y = 2.1
        group.add(pole)
        const sock = new THREE.Group()
        sock.position.set(0, 4.0, 0)
        for(let i = 0; i < 4; i++)
        {
            const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.28 - i * 0.05, 0.33 - i * 0.05, 0.38, 8, 1, true), this.world.material(i % 2 ? '#f3ece0' : '#e06a3d', { roughness: 0.8, side: THREE.DoubleSide }))
            segment.rotation.z = Math.PI / 2
            segment.position.x = 0.2 + i * 0.38
            sock.add(segment)
        }
        group.add(sock)
        this.place(group, 60, 9.2, 0.04)
        this.windsock = sock
    }

    makeSign(label, sub)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 160
        const c = canvas.getContext('2d')
        c.fillStyle = '#1a4f7a'
        c.fillRect(0, 0, 512, 160)
        c.strokeStyle = '#ffffff'
        c.lineWidth = 6
        c.strokeRect(8, 8, 496, 144)
        c.fillStyle = '#ffffff'
        c.font = '800 60px Arial'
        c.textAlign = 'left'
        c.fillText(label, 28, 78)
        c.font = '600 34px Arial'
        c.fillStyle = '#ffd36b'
        c.fillText(sub, 28, 128)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        return texture
    }

    buildSigns()
    {
        // Approach signage south of the terminal, facing arriving traffic
        ;[[-9, -8.2, 'TERMINAL ▶', 'Departures · Arrivals'], [3, 11.8, 'DROP-OFF', 'Forecourt']].forEach(([along, lateral, label, sub]) =>
        {
            const group = new THREE.Group()
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 6), this.vehicles.chrome)
            post.position.y = 1.5
            group.add(post)
            const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ map: this.makeSign(label, sub), toneMapped: false, side: THREE.DoubleSide }))
            face.position.set(0, 2.7, 0.06)
            group.add(face)
            this.place(group, along, lateral, 0.04, -Math.PI / 2)
        })
        this.counts.signs = 2
    }

    update(time, wind = 0)
    {
        if(this.runwayLightMaterial)
            this.runwayLightMaterial.emissiveIntensity = 1.1 + Math.sin(time * 1.6) * 0.3
        if(this.windsock)
            this.windsock.rotation.y = Math.sin(time * 0.6) * 0.25 + wind
    }
}
