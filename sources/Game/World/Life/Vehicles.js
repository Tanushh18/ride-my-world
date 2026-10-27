import * as THREE from 'three/webgpu'

/**
 * Vehicle and rider models. Forward is local +x and the road-side is local +z,
 * matching the existing parked cars, so `rotation.y = route yaw` aligns them
 * with the road. Wheels sit exactly on y = 0 so every vehicle touches the
 * ground; `userData` exposes tail lamps, wheels and a `detail` group that is
 * hidden at distance for a cheaper silhouette.
 */
export class VehicleFactory
{
    constructor(ctx)
    {
        this.ctx = ctx
        this.world = ctx.world
        const m = (hex, options) => this.world.material(hex, options)

        this.paints = [
            m('#e8d9c3', { roughness: 0.42, metalness: 0.15 }),
            m('#b6c4bf', { roughness: 0.4, metalness: 0.16 }),
            m('#b56f61', { roughness: 0.45, metalness: 0.12 }),
            m('#5f7979', { roughness: 0.42, metalness: 0.16 }),
            m('#d4b16f', { roughness: 0.46, metalness: 0.1 }),
            m('#6f7fa3', { roughness: 0.4, metalness: 0.16 }),
            m('#f2f0ea', { roughness: 0.36, metalness: 0.12 })
        ]
        this.glass = m('#8fb5bd', { roughness: 0.12, metalness: 0.25 })
        this.dark = m('#2a3338', { roughness: 0.95 })
        this.chrome = m('#9aa5a8', { roughness: 0.3, metalness: 0.7 })
        this.rubber = m('#242b2f', { roughness: 0.98 })
        this.cream = m('#efe2cf', { roughness: 0.6 })
        this.headMat = new THREE.MeshBasicMaterial({ color: '#ffeab8' })
        this.indicatorMat = new THREE.MeshBasicMaterial({ color: '#ff9a2e' })

        this.box = new THREE.BoxGeometry(1, 1, 1)
        this.wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12).rotateX(Math.PI / 2)
        this.hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.235, 8).rotateX(Math.PI / 2)
        this.mirrorGeo = new THREE.BoxGeometry(0.12, 0.1, 0.18)
    }

    part(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, shadow = true)
    {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        mesh.scale.set(sx, sy, sz)
        mesh.castShadow = shadow
        mesh.receiveShadow = true
        parent.add(mesh)
        return mesh
    }

    /** A lamp material per vehicle group is avoided: lanes share one tail material. */
    car(kind = 'hatch', paintIndex = 0, tailMaterial = null)
    {
        const specs = {
            hatch: { L: 3.75, W: 1.62, base: 0.62, cabinH: 0.52, cabinL: 2.0, cabinX: -0.12 },
            sedan: { L: 4.45, W: 1.72, base: 0.62, cabinH: 0.5, cabinL: 2.1, cabinX: -0.18 },
            suv: { L: 4.35, W: 1.85, base: 0.78, cabinH: 0.62, cabinL: 2.7, cabinX: -0.25 },
            van: { L: 5.2, W: 1.9, base: 0.7, cabinH: 1.3, cabinL: 3.3, cabinX: -0.55 }
        }
        const spec = specs[kind] ?? specs.hatch
        const paint = this.paints[paintIndex % this.paints.length]
        const tail = tailMaterial ?? new THREE.MeshBasicMaterial({ color: '#a8403d' })
        const group = new THREE.Group()
        group.name = 'Vehicle_' + kind
        const detail = new THREE.Group()
        group.add(detail)

        const baseY = 0.3 + spec.base / 2
        this.part(group, this.box, paint, 0, baseY, 0, spec.L, spec.base, spec.W)
        const cabinY = 0.3 + spec.base + spec.cabinH / 2 - 0.02
        if(kind === 'van')
        {
            // Cab at the front, tall cargo box behind
            this.part(group, this.box, paint, -spec.L * 0.18, cabinY + 0.1, 0, spec.L * 0.62, spec.cabinH, spec.W * 0.98)
            this.part(group, this.box, this.glass, spec.L * 0.34, cabinY - 0.12, 0, 0.12 + spec.L * 0.2, spec.cabinH * 0.7, spec.W * 0.9, true).scale.x = spec.L * 0.2
            this.part(detail, this.box, this.cream, -spec.L * 0.18, cabinY + 0.1, 0, spec.L * 0.62 + 0.02, 0.1, spec.W * 0.99, false).position.y += 0.15
        }
        else
        {
            this.part(group, this.box, paint, spec.cabinX, cabinY, 0, spec.cabinL, spec.cabinH, spec.W * 0.86)
            const windowBand = this.part(detail, this.box, this.glass, spec.cabinX, cabinY + 0.02, 0, spec.cabinL * 0.96, spec.cabinH * 0.62, spec.W * 0.88, false)
            windowBand.scale.z = spec.W * 0.88 + 0.02
            if(kind === 'hatch')
                this.part(group, this.box, paint, -spec.L * 0.4, cabinY - 0.1, 0, 0.9, spec.cabinH * 0.8, spec.W * 0.84)
        }

        // Bumpers, lamps, mirrors and plate
        for(const side of [-1, 1])
        {
            this.part(detail, this.box, this.headMat, spec.L / 2 + 0.01, baseY + 0.08, side * spec.W * 0.3, 0.06, 0.12, 0.34, false)
            this.part(detail, this.box, tail, -spec.L / 2 - 0.01, baseY + 0.1, side * spec.W * 0.32, 0.06, 0.12, 0.34, false)
            this.part(detail, this.mirrorGeo, paint, spec.cabinX + spec.cabinL * 0.38, cabinY - 0.05, side * (spec.W / 2 + 0.07), 1, 1, 1, false)
        }
        this.part(detail, this.box, this.dark, spec.L / 2 + 0.02, 0.43, 0, 0.1, 0.18, spec.W * 0.92, false)
        this.part(detail, this.box, this.dark, -spec.L / 2 - 0.02, 0.43, 0, 0.1, 0.18, spec.W * 0.92, false)
        this.part(detail, this.box, this.cream, -spec.L / 2 - 0.035, 0.62, 0, 0.02, 0.14, 0.42, false)

        const wheels = []
        for(const x of [-spec.L * 0.31, spec.L * 0.31])
        {
            for(const z of [-1, 1])
            {
                const wheel = new THREE.Group()
                wheel.position.set(x, 0.34, z * (spec.W / 2 - 0.06))
                const tyre = new THREE.Mesh(this.wheelGeo, this.rubber)
                tyre.castShadow = true
                wheel.add(tyre)
                const hub = new THREE.Mesh(this.hubGeo, this.chrome)
                hub.position.z = z * 0.01
                wheel.add(hub)
                group.add(wheel)
                wheels.push(tyre, hub)
            }
        }

        group.userData = { detail, wheels, tail, length: spec.L, width: spec.W, kind }
        return group
    }

    bus(tailMaterial = null)
    {
        const group = new THREE.Group()
        group.name = 'Vehicle_bus'
        const detail = new THREE.Group()
        group.add(detail)
        const tail = tailMaterial ?? new THREE.MeshBasicMaterial({ color: '#a8403d' })
        const L = 10.4
        const W = 2.5
        const body = this.world.material('#c5624f', { roughness: 0.5, metalness: 0.1 })
        const stripe = this.world.material('#f0e2c8', { roughness: 0.55 })

        this.part(group, this.box, body, 0, 0.35 + 1.45, 0, L, 2.9, W)
        this.part(group, this.box, stripe, 0, 0.35 + 1.0, 0, L + 0.02, 0.3, W + 0.02, false)
        this.part(group, this.box, this.dark, 0, 0.5, 0, L - 0.4, 0.4, W - 0.1, false)
        const windows = this.part(detail, this.box, this.glass, 0, 0.35 + 2.05, 0, L - 0.6, 0.95, W + 0.02, false)
        windows.scale.z = W + 0.02
        this.part(detail, this.box, this.glass, L / 2 + 0.01, 0.35 + 2.0, 0, 0.04, 1.05, W - 0.35, false)
        this.part(detail, this.box, this.cream, L / 2 + 0.03, 0.35 + 2.75, 0, 0.04, 0.26, W - 0.7, false) // destination sign
        for(const side of [-1, 1])
        {
            this.part(detail, this.box, this.headMat, L / 2 + 0.02, 0.8, side * 0.9, 0.05, 0.18, 0.4, false)
            this.part(detail, this.box, tail, -L / 2 - 0.02, 0.85, side * 0.95, 0.05, 0.2, 0.4, false)
            this.part(detail, this.mirrorGeo, this.chrome, L / 2 - 0.3, 2.55, side * (W / 2 + 0.16), 1.5, 1.8, 1, false)
        }
        this.part(detail, this.box, this.dark, 3.3, 1.3, W / 2 + 0.01, 1.2, 1.9, 0.03, false) // door

        const wheels = []
        for(const x of [-3.4, 3.2])
        {
            for(const z of [-1, 1])
            {
                const wheel = new THREE.Group()
                wheel.position.set(x, 0.5, z * (W / 2 - 0.12))
                wheel.scale.setScalar(1.35)
                const tyre = new THREE.Mesh(this.wheelGeo, this.rubber)
                tyre.castShadow = true
                wheel.add(tyre)
                wheel.add(new THREE.Mesh(this.hubGeo, this.chrome))
                group.add(wheel)
                wheels.push(tyre)
            }
        }
        group.userData = { detail, wheels, tail, length: L, width: W, kind: 'bus' }
        return group
    }

    /** Parked or moving two-wheeler. */
    scooter(paintIndex = 0)
    {
        const group = new THREE.Group()
        group.name = 'Vehicle_scooter'
        const paint = this.paints[paintIndex % this.paints.length]
        this.part(group, this.box, paint, 0, 0.5, 0, 1.1, 0.28, 0.3) // body
        this.part(group, this.box, paint, 0.62, 0.78, 0, 0.18, 0.7, 0.28).rotation.z = -0.35 // front column
        this.part(group, this.box, this.dark, -0.15, 0.78, 0, 0.7, 0.14, 0.32) // seat
        this.part(group, this.box, this.dark, 0.75, 1.15, 0, 0.1, 0.08, 0.75) // handlebar
        this.part(group, this.box, this.headMat, 0.84, 0.98, 0, 0.06, 0.14, 0.2, false)
        for(const x of [-0.55, 0.62])
        {
            const wheel = this.part(group, this.wheelGeo, this.rubber, x, 0.27, 0, 0.8, 0.8, 0.45)
            wheel.userData.spin = true
        }
        group.userData = { detail: new THREE.Group(), wheels: [], length: 1.8, width: 0.6, kind: 'scooter' }
        return group
    }

    bicycle(frameColor = '#c87a5f')
    {
        const group = new THREE.Group()
        group.name = 'Vehicle_bicycle'
        const frameMat = this.world.material(frameColor, { roughness: 0.5, metalness: 0.3 })
        const wheelGeo = new THREE.TorusGeometry(0.34, 0.025, 6, 16)
        const wheels = []
        for(const x of [-0.5, 0.5])
        {
            const wheel = new THREE.Mesh(wheelGeo, this.rubber)
            wheel.position.set(x, 0.37, 0)
            group.add(wheel)
            wheels.push(wheel)
        }
        const bar = (x1, y1, x2, y2) =>
        {
            const length = Math.hypot(x2 - x1, y2 - y1)
            const mesh = this.part(group, this.box, frameMat, (x1 + x2) / 2, (y1 + y2) / 2, 0, length, 0.04, 0.04, false)
            mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1)
        }
        bar(-0.5, 0.37, -0.05, 0.4)
        bar(-0.05, 0.4, 0.38, 0.72)
        bar(-0.5, 0.37, 0.0, 0.72)
        bar(0.0, 0.72, 0.38, 0.72)
        bar(0.5, 0.37, 0.38, 0.72)
        bar(-0.05, 0.4, 0.5, 0.37)
        this.part(group, this.box, this.dark, 0.0, 0.78, 0, 0.26, 0.05, 0.14, false) // saddle
        this.part(group, this.box, this.dark, 0.4, 0.84, 0, 0.05, 0.05, 0.5, false) // handlebar
        group.userData = { detail: new THREE.Group(), wheels, length: 1.6, width: 0.5, kind: 'bicycle' }
        return group
    }
}
