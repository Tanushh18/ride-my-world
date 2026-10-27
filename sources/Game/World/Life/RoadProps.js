import * as THREE from 'three/webgpu'
import { LAYOUT } from './layout.js'
import { seededRandom } from '../../utilities/maths.js'

const canvasTexture = (width, height, draw) =>
{
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if(!ctx)
        return null
    draw(ctx, width, height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

/**
 * Roads, kerbs and street furniture, all in route coordinates so nothing is
 * hard-coded in world space: lane paint and studs, a T-junction, speed breakers,
 * crossings with tactile paving, drains and manholes, guardrails, delineators,
 * kilometre posts, direction signs, utility poles with cables, lamp posts,
 * bollards, bins, bicycle stands, a café, a fruit vendor and a small works zone.
 */
export class RoadProps
{
    constructor(ctx, vehicles)
    {
        this.ctx = ctx
        this.world = ctx.world
        this.vehicles = vehicles
        this.random = seededRandom(7777)
        this.textures = []
        this.counts = {}
        this.box = new THREE.BoxGeometry(1, 1, 1)
        const m = (hex, options) => this.world.material(hex, options)
        this.mats = {
            paint: new THREE.MeshBasicMaterial({ color: '#f6e7cf' }),
            yellow: new THREE.MeshBasicMaterial({ color: '#f0c25b' }),
            stud: new THREE.MeshStandardMaterial({ color: '#f5c46a', emissive: '#f5c46a', emissiveIntensity: 0.65, roughness: 0.3 }),
            studWhite: new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#fff4e0', emissiveIntensity: 0.5, roughness: 0.3 }),
            steel: m('#6a787b', { roughness: 0.55, metalness: 0.4 }),
            darkSteel: m('#3f4a4e', { roughness: 0.6, metalness: 0.35 }),
            concrete: m('#b9aaa4', { roughness: 0.95 }),
            asphalt: m('#574750', { roughness: 0.96 }),
            iron: m('#2c3236', { roughness: 0.8, metalness: 0.3 }),
            white: m('#f3ece0', { roughness: 0.7 }),
            red: m('#c8503f', { roughness: 0.6 }),
            orange: m('#e98b3c', { roughness: 0.6 }),
            wood: m('#a97757', { roughness: 0.9 }),
            cream: m('#efe2cf', { roughness: 0.7 }),
            teal: m('#31565a', { roughness: 0.6 }),
            bin: m('#3f6b5e', { roughness: 0.7 }),
            lampHead: new THREE.MeshBasicMaterial({ color: '#ffd9a0' }),
            glassCell: m('#f4e0b5', { roughness: 0.3 })
        }

        this.paintLane()
        this.buildJunction()
        this.buildSpeedBreakers()
        this.buildCrossingDetails()
        this.buildDrainsAndManholes()
        this.buildGuardrails()
        this.buildDelineatorsAndMarkers()
        this.buildSigns()
        this.buildUtilityPoles()
        this.buildLampPosts()
        this.buildSidewalkFurniture()
        this.buildCafe()
        this.buildVendor()
        this.buildWorksZone()
    }

    /** True when (t, side, offset) is clear of banners, gates, cars, benches… */
    free(t, side, offset, pad = 0)
    {
        return !this.ctx.zones.some(zone =>
            (zone.side === 0 || zone.side === side)
            && Math.abs(t - zone.t) < zone.halfT + pad
            && offset >= zone.minOffset && offset <= zone.maxOffset)
    }

    /** Nudge `t` along the route until the slot is free; null if none found. */
    slot(t, side, offset, extent = 0.03)
    {
        for(let step = 0; step <= extent; step += 0.004)
        {
            for(const direction of [1, -1])
            {
                const candidate = t + step * direction
                if(this.free(candidate, side, offset))
                    return candidate
            }
        }
        return null
    }

    mesh(geometry, material, parent, x, y, z, sx = 1, sy = 1, sz = 1)
    {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        mesh.scale.set(sx, sy, sz)
        mesh.castShadow = true
        mesh.receiveShadow = true
        parent.add(mesh)
        return mesh
    }

    /** Group placed on the route at (t, offset) facing along the road. */
    anchor(t, offset, y = 0)
    {
        const frame = this.ctx.frame(t)
        const group = new THREE.Group()
        group.position.copy(frame.position).addScaledVector(frame.side, offset)
        group.position.y = y
        group.rotation.y = frame.yaw
        this.ctx.group.add(group)
        return group
    }

    // ---------- lane paint, studs ----------

    paintLane()
    {
        const ctx = this.ctx
        const length = this.world.roadLength
        const dashes = []
        const studs = []
        const edgeStuds = []
        const dashStep = 7.5
        for(let s = 3; s < length - 3; s += dashStep)
        {
            const t = s / length
            const frame = ctx.frame(t)
            dashes.push({ x: frame.position.x, y: 0.19, z: frame.position.z, ry: frame.yaw, sx: 2.6, sy: 0.02, sz: 0.2 })
        }
        for(let s = 2; s < length - 2; s += 5)
        {
            const t = s / length
            const frame = ctx.frame(t)
            studs.push({ x: frame.position.x, y: 0.19, z: frame.position.z, sx: 1, sy: 1, sz: 1 })
            if(Math.round(s / 5) % 2 === 0)
                for(const side of [-1, 1])
                {
                    const p = ctx.point(t, side * 4.12, 0.19)
                    edgeStuds.push({ x: p.x, y: 0.19, z: p.z, sx: 1, sy: 1, sz: 1 })
                }
        }
        const stud = new THREE.CylinderGeometry(0.075, 0.09, 0.04, 8)
        ctx.instance('LaneDashes', this.box, this.mats.paint, dashes, { castShadow: false })
        ctx.instance('CentreStuds', stud, this.mats.stud, studs, { castShadow: false })
        ctx.instance('EdgeStuds', stud, this.mats.studWhite, edgeStuds, { castShadow: false })
        this.counts.dashes = dashes.length
        this.counts.studs = studs.length + edgeStuds.length
    }

    // ---------- T-junction with a zebra across the side street ----------

    buildJunction()
    {
        const { t, side } = LAYOUT.junction
        const anchor = this.anchor(t, 0, 0)
        const width = 7.2
        // Side road laid slightly above the sidewalk so it reads as a dropped kerb
        const road = this.mesh(this.box, this.mats.asphalt, anchor, 0, 0.152, side * 17.2, width, 0.02, 25.6)
        road.castShadow = false
        for(let offset = 9.2; offset <= 11.6; offset += 0.55)
            this.mesh(this.box, this.mats.paint, anchor, 0, 0.17, side * offset, 5.9, 0.012, 0.28, false)
        this.mesh(this.box, this.mats.paint, anchor, 0, 0.17, side * 12.6, 6.2, 0.012, 0.18)
        this.mesh(this.box, this.mats.paint, anchor, 0, 0.17, side * 15, 0.16, 0.012, 14, false)
        for(const x of [-width / 2 - 0.12, width / 2 + 0.12])
            this.mesh(this.box, this.mats.concrete, anchor, x, 0.19, side * 17.2, 0.22, 0.12, 25.6)

        // Triangular island with bollards at the mouth of the junction
        const island = this.mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.14, 3), this.mats.concrete, anchor, 0, 0.2, side * 5.0)
        island.rotation.y = Math.PI / 2
        for(const dz of [-0.45, 0.45])
            this.bollard(anchor, dz, side * 5.0)

        // Give-way sign
        const sign = this.signPost(this.giveWayTexture(), 1.0)
        sign.position.set(width / 2 + 1.0, 0, side * 24)
        anchor.add(sign)
        sign.rotation.y = side > 0 ? 0 : Math.PI

        this.junctionAnchor = anchor
    }

    bollard(parent, x, z)
    {
        const post = this.mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 8), this.mats.white, parent, x, 0.54, z)
        this.mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 8), this.mats.red, parent, x, 0.7, z)
        return post
    }

    signPost(texture, size = 0.9, height = 2.4)
    {
        const group = new THREE.Group()
        this.mesh(new THREE.CylinderGeometry(0.035, 0.04, height, 6), this.mats.steel, group, 0, height / 2 + 0.14, 0)
        const face = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }))
        face.position.set(0, height + 0.14 - size / 2 + 0.1, 0.04)
        group.add(face)
        return group
    }

    giveWayTexture()
    {
        const texture = canvasTexture(256, 256, (c, w, h) =>
        {
            c.fillStyle = '#ffffff'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#d8453b'
            c.beginPath()
            c.moveTo(18, 40); c.lineTo(w - 18, 40); c.lineTo(w / 2, h - 30); c.closePath(); c.fill()
            c.fillStyle = '#ffffff'
            c.beginPath()
            c.moveTo(70, 70); c.lineTo(w - 70, 70); c.lineTo(w / 2, h - 90); c.closePath(); c.fill()
        })
        this.textures.push(texture)
        return texture
    }

    // ---------- speed breakers ----------

    buildSpeedBreakers()
    {
        const texture = canvasTexture(256, 64, (c, w, h) =>
        {
            for(let i = 0; i < 8; i++)
            {
                c.fillStyle = i % 2 ? '#2d2b30' : '#f2c14e'
                c.fillRect((i * w) / 8, 0, w / 8, h)
            }
        })
        this.textures.push(texture)
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        const material = new THREE.MeshBasicMaterial({ map: texture })
        const geometry = new THREE.BoxGeometry(2.0, 0.08, 8.6)
        for(const t of [0.722, 0.952])
        {
            const anchor = this.anchor(t, 0, 0.14)
            const bump = new THREE.Mesh(geometry, material)
            bump.position.y = 0.04
            bump.receiveShadow = true
            anchor.add(bump)
        }
        this.counts.speedBreakers = 2
    }

    // ---------- crossing details ----------

    buildCrossingDetails()
    {
        const tactile = []
        const ramps = []
        const bollards = []
        const warning = this.pedestrianSignTexture()
        for(const t of [0.755, 0.835, 0.915, 0.975])
        {
            const frame = this.ctx.frame(t)
            for(const side of [-1, 1])
            {
                for(let i = -2; i <= 2; i++)
                {
                    const p = this.ctx.point(t + (i * 0.52) / this.world.roadLength, side * 5.05, 0.155)
                    tactile.push({ x: p.x, y: 0.155, z: p.z, ry: frame.yaw, sx: 0.46, sy: 0.02, sz: 0.62 })
                }
                const rampPosition = this.ctx.point(t, side * 4.72, 0.14)
                ramps.push({ x: rampPosition.x, y: 0.14, z: rampPosition.z, ry: frame.yaw, sx: 4.6, sy: 0.02, sz: 0.6 })
                // Bollards guard the corners; a pedestrian sign marks each crossing
                for(const dz of [-3.2, 3.2])
                {
                    const bp = this.ctx.point(t + dz / this.world.roadLength, side * 6.2, 0.14)
                    bollards.push({ x: bp.x, y: 0.55, z: bp.z, sx: 1, sy: 1, sz: 1 })
                }
            }
        }
        this.ctx.instance('TactilePaving', this.box, this.mats.yellow, tactile, { castShadow: false })
        this.ctx.instance('CurbRamps', this.box, this.mats.concrete, ramps, { castShadow: false })
        this.ctx.instance('CrossingBollards', new THREE.CylinderGeometry(0.07, 0.08, 0.8, 8), this.mats.white, bollards)
        for(const t of [0.755, 0.835, 0.915, 0.975])
        {
            for(const side of [-1, 1])
            {
                const post = this.signPost(warning, 0.8, 2.3)
                const frame = this.ctx.frame(t - 3.8 / this.world.roadLength)
                post.position.copy(frame.position).addScaledVector(frame.side, side * 5.6)
                post.position.y = 0.14
                post.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z)
                if(side > 0 && !this.free(t, side, 5.6) && t !== 0.755)
                    continue
                this.ctx.group.add(post)
            }
        }
        this.counts.crossings = 4
    }

    pedestrianSignTexture()
    {
        const texture = canvasTexture(256, 256, (c, w, h) =>
        {
            c.fillStyle = '#2f6fb4'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#ffffff'
            c.fillRect(14, 14, w - 28, h - 28)
            c.fillStyle = '#2f6fb4'
            c.fillRect(24, 24, w - 48, h - 48)
            c.fillStyle = '#ffffff'
            c.beginPath(); c.arc(w / 2, 78, 22, 0, Math.PI * 2); c.fill()
            c.fillRect(w / 2 - 14, 104, 28, 64)
            c.save(); c.translate(w / 2, 170); c.rotate(0.35); c.fillRect(-26, 0, 16, 62); c.restore()
            c.save(); c.translate(w / 2, 170); c.rotate(-0.25); c.fillRect(10, 0, 16, 62); c.restore()
        })
        this.textures.push(texture)
        return texture
    }

    // ---------- manholes and drains ----------

    buildDrainsAndManholes()
    {
        const holes = []
        const drains = []
        const covers = [[0.12, -2.65], [0.33, 1.4], [0.52, -1.8], [0.71, 2.2], [0.83, -2.65], [0.9, 2.1], [0.965, -1.2]]
        for(const [t, offset] of covers)
        {
            const p = this.ctx.point(t, offset, 0.186)
            holes.push({ x: p.x, y: 0.186, z: p.z, sx: 1, sy: 1, sz: 1 })
        }
        for(let t = 0.7; t < 0.99; t += 0.024)
        {
            const frame = this.ctx.frame(t)
            for(const side of [-1, 1])
            {
                const p = this.ctx.point(t, side * 4.3, 0.18)
                drains.push({ x: p.x, y: 0.18, z: p.z, ry: frame.yaw, sx: 0.9, sy: 0.02, sz: 0.28 })
            }
        }
        this.ctx.instance('Manholes', new THREE.CylinderGeometry(0.42, 0.42, 0.025, 14), this.mats.iron, holes, { castShadow: false })
        this.ctx.instance('DrainGrates', this.box, this.mats.iron, drains, { castShadow: false })
        this.counts.manholes = holes.length
        this.counts.drains = drains.length
    }

    // ---------- guardrails ----------

    buildGuardrails()
    {
        const posts = []
        const beams = []
        for(const [t0, t1] of [[0.497, 0.568], [0.632, 0.676]])
        {
            for(let t = t0; t < t1; t += 3 / this.world.roadLength)
            {
                const frame = this.ctx.frame(t)
                for(const side of [-1, 1])
                {
                    const p = this.ctx.point(t, side * 5.05, 0)
                    posts.push({ x: p.x, y: 0.4, z: p.z, ry: frame.yaw, sx: 0.1, sy: 0.8, sz: 0.1 })
                    const pm = this.ctx.point(t + 1.5 / this.world.roadLength, side * 5.0, 0.62)
                    beams.push({ x: pm.x, y: 0.62, z: pm.z, ry: frame.yaw, sx: 3.0, sy: 0.26, sz: 0.045 })
                }
            }
        }
        this.ctx.instance('GuardrailPosts', this.box, this.mats.steel, posts)
        this.ctx.instance('GuardrailBeams', this.box, this.mats.steel, beams)
        this.counts.guardrailSegments = beams.length
    }

    // ---------- delineators and kilometre markers ----------

    buildDelineatorsAndMarkers()
    {
        const posts = []
        const caps = []
        for(let s = 12; s < this.world.roadLength * 0.68; s += 18)
        {
            const t = s / this.world.roadLength
            const side = Math.round(s / 18) % 2 ? 1 : -1
            if(!this.free(t, side, 4.95))
                continue
            const p = this.ctx.point(t, side * 4.95, 0)
            posts.push({ x: p.x, y: 0.45, z: p.z, sx: 0.07, sy: 0.9, sz: 0.07 })
            caps.push({ x: p.x, y: 0.82, z: p.z, sx: 0.09, sy: 0.16, sz: 0.09 })
        }
        this.ctx.instance('Delineators', this.box, this.mats.white, posts)
        this.ctx.instance('DelineatorReflectors', this.box, this.mats.orange, caps, { castShadow: false })

        // Kilometre posts every tenth of the route, numbered on a small face
        const stones = []
        for(let n = 1; n <= 9; n++)
        {
            const side = n % 2 ? 1 : -1
            const t = this.slot(n / 10 - 0.012, side, 5.4)
            if(t === null)
                continue
            const frame = this.ctx.frame(t)
            const group = this.anchor(t, side * 5.4, 0)
            this.mesh(this.box, this.mats.white, group, 0, 0.34, 0, 0.3, 0.68, 0.22)
            this.mesh(this.box, this.mats.red, group, 0, 0.7, 0, 0.31, 0.14, 0.23)
            const face = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), new THREE.MeshBasicMaterial({ map: this.kmTexture(n), toneMapped: false }))
            face.position.set(0, 0.36, 0.115)
            // Face the oncoming rider
            face.rotation.y = 0
            group.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z) - Math.PI / 2 + Math.PI / 2
            group.add(face)
            stones.push(group)
        }
        this.counts.kmMarkers = stones.length
    }

    kmTexture(n)
    {
        const texture = canvasTexture(96, 128, (c, w, h) =>
        {
            c.fillStyle = '#f3ece0'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#c8503f'
            c.font = '700 26px Arial'
            c.textAlign = 'center'
            c.fillText('KM', w / 2, 34)
            c.fillStyle = '#31565a'
            c.font = '800 70px Arial'
            c.fillText(String(n), w / 2, 104)
        })
        this.textures.push(texture)
        return texture
    }

    // ---------- direction & information signs ----------

    directionTexture(label, arrow = '▶')
    {
        const texture = canvasTexture(512, 192, (c, w, h) =>
        {
            c.fillStyle = '#1f5a4a'
            c.fillRect(0, 0, w, h)
            c.strokeStyle = '#f3ece0'
            c.lineWidth = 8
            c.strokeRect(10, 10, w - 20, h - 20)
            c.fillStyle = '#f3ece0'
            c.textAlign = 'left'
            c.font = '800 54px Arial'
            c.fillText(label, 34, 96, w - 150)
            c.font = '800 84px Arial'
            c.textAlign = 'right'
            c.fillText(arrow, w - 30, 150)
        })
        this.textures.push(texture)
        return texture
    }

    buildSigns()
    {
        const signs = [
            [0.19, 1, 'RIVER CROSSING', '▶'], [0.655, -1, 'CITY CENTRE', '▲'], [0.738, -1, 'LEARNING ROUTE', '◀'],
            [0.935, -1, 'AIRPORT', '▲']
        ]
        for(const [target, side, label, arrow] of signs)
        {
            const t = this.slot(target, side, 5.9)
            if(t === null)
                continue
            const frame = this.ctx.frame(t)
            const group = new THREE.Group()
            group.position.copy(frame.position).addScaledVector(frame.side, side * 5.9)
            group.position.y = 0.14
            group.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z)
            this.mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.8, 6), this.mats.steel, group, -0.6, 1.4, 0)
            this.mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.8, 6), this.mats.steel, group, 0.6, 1.4, 0)
            const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.72), new THREE.MeshBasicMaterial({ map: this.directionTexture(label, arrow), side: THREE.DoubleSide, toneMapped: false }))
            face.position.set(0, 2.5, 0.05)
            group.add(face)
            this.ctx.group.add(group)
        }

        // Speed-limit roundels
        for(const [target, side] of [[0.3, -1], [0.715, -1], [0.8, 1]])
        {
            const t = this.slot(target, side, 5.5)
            if(t === null)
                continue
            const texture = canvasTexture(256, 256, (c, w, h) =>
            {
                c.fillStyle = '#ffffff'
                c.beginPath(); c.arc(w / 2, h / 2, 120, 0, Math.PI * 2); c.fill()
                c.strokeStyle = '#d8453b'
                c.lineWidth = 26
                c.beginPath(); c.arc(w / 2, h / 2, 106, 0, Math.PI * 2); c.stroke()
                c.fillStyle = '#222'
                c.font = '800 110px Arial'
                c.textAlign = 'center'
                c.fillText(target > 0.7 ? '30' : '50', w / 2, h / 2 + 38)
            })
            this.textures.push(texture)
            const post = this.signPost(texture, 0.85, 2.3)
            const frame = this.ctx.frame(t)
            post.position.copy(frame.position).addScaledVector(frame.side, side * 5.5)
            post.position.y = 0.14
            post.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z)
            this.ctx.group.add(post)
        }
    }

    // ---------- utility poles and cables ----------

    buildUtilityPoles()
    {
        const poles = []
        const arms = []
        const cabinets = []
        const tops = []
        const tValues = []
        for(let t = 0.04; t < 0.7; t += 0.062)
            tValues.push(t)
        tValues.forEach((target, index) =>
        {
            const t = this.slot(target, -1, 12.6, 0.02)
            if(t === null)
                return
            const frame = this.ctx.frame(t)
            const p = this.ctx.point(t, -12.6, 0)
            if(this.ctx.inRiver(p.x, p.z, 2))
                return
            poles.push({ x: p.x, y: 3.7, z: p.z, sx: 0.2, sy: 7.4, sz: 0.2 })
            arms.push({ x: p.x, y: 6.9, z: p.z, ry: frame.yaw, sx: 0.12, sy: 0.12, sz: 2.2 })
            tops.push({ p, frame })
            if(index % 3 === 0)
            {
                const c = this.ctx.point(t, -11.6, 0)
                cabinets.push({ x: c.x, y: 0.55, z: c.z, ry: frame.yaw, sx: 0.9, sy: 1.1, sz: 0.5 })
            }
        })
        this.ctx.instance('UtilityPoles', new THREE.CylinderGeometry(0.5, 0.6, 1, 7), this.mats.wood, poles)
        this.ctx.instance('UtilityArms', this.box, this.mats.wood, arms)
        this.ctx.instance('ElectricalCabinets', this.box, this.mats.steel, cabinets)

        // Sagging cables between consecutive poles (three conductors)
        const segments = []
        for(let i = 0; i < tops.length - 1; i++)
        {
            const a = tops[i]
            const b = tops[i + 1]
            if(a.p.distanceTo(b.p) > 40)
                continue
            for(const lateral of [-1, 0, 1])
            {
                let previous = null
                for(let k = 0; k <= 8; k++)
                {
                    const u = k / 8
                    const point = new THREE.Vector3().lerpVectors(a.p, b.p, u)
                    point.addScaledVector(a.frame.tangent.clone().cross(new THREE.Vector3(0, 1, 0)), lateral * 1.0)
                    point.y = 6.9 - Math.sin(u * Math.PI) * 0.7
                    if(previous)
                        segments.push(previous, point)
                    previous = point
                }
            }
        }
        if(segments.length)
        {
            const cable = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segments), new THREE.LineBasicMaterial({ color: '#2f3438' }))
            cable.frustumCulled = false
            this.ctx.group.add(cable)
        }
        this.counts.utilityPoles = poles.length
    }

    // ---------- highway lamp posts (jungle & outskirts) ----------

    buildLampPosts()
    {
        const poles = []
        const heads = []
        for(let target = 0.07; target < 0.68; target += 0.07)
        {
            const side = Math.round(target / 0.07) % 2 ? 1 : -1
            const t = this.slot(target, side, 5.6)
            if(t === null)
                continue
            const p = this.ctx.point(t, side * 5.6, 0)
            if(this.ctx.inRiver(p.x, p.z, 1))
                continue
            const frame = this.ctx.frame(t)
            poles.push({ x: p.x, y: 2.6, z: p.z, sx: 0.12, sy: 5.2, sz: 0.12 })
            const head = this.ctx.point(t, side * 4.1, 5.15)
            heads.push({ x: head.x, y: 5.15, z: head.z, ry: frame.yaw, sx: 0.8, sy: 0.12, sz: 0.34 })
            poles.push({ x: (p.x + head.x) / 2, y: 5.2, z: (p.z + head.z) / 2, ry: frame.yaw + Math.PI / 2, sx: 0.07, sy: 0.07, sz: 1.5 })
        }
        const poleMesh = this.ctx.instance('HighwayLampPoles', this.box, this.mats.darkSteel, poles.map(pole => ({ ...pole, sx: pole.sx, sy: pole.sy, sz: pole.sz })))
        void poleMesh
        this.ctx.instance('HighwayLampHeads', this.box, this.mats.lampHead, heads, { castShadow: false })
        this.counts.lampPosts = heads.length
    }

    // ---------- bins, stands, bus pole, benches ----------

    buildSidewalkFurniture()
    {
        const bins = []
        for(const [target, side] of [[0.7425, -1], [0.8, -1], [0.87, 1], [0.935, 1], [0.985, -1]])
        {
            const t = this.slot(target, side, 9.5)
            if(t === null)
                continue
            const p = this.ctx.point(t, side * 9.5, 0.14)
            bins.push({ x: p.x, y: 0.5, z: p.z, sx: 1, sy: 1, sz: 1 })
        }
        this.ctx.instance('Dustbins', new THREE.CylinderGeometry(0.26, 0.22, 0.9, 10), this.mats.bin, bins)

        // Bicycle stands (inverted U racks) with a parked bike
        const stands = []
        for(const [target, side] of [[0.7, -1], [0.915, 1]])
        {
            const t = this.slot(target + 0.03, side, 10.2)
            if(t === null)
                continue
            const frame = this.ctx.frame(t)
            const group = this.anchor(t, side * 10.2, 0.14)
            for(let i = -1; i <= 1; i++)
            {
                const arch = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 12, Math.PI), this.mats.steel)
                arch.position.set(i * 0.75, 0.05, 0)
                arch.rotation.y = Math.PI / 2
                arch.castShadow = true
                group.add(arch)
            }
            const bike = this.vehicles.bicycle(side > 0 ? '#4f8a8f' : '#c87a5f')
            bike.position.set(0.37, 0, 0)
            bike.rotation.y = Math.PI / 2
            group.add(bike)
            stands.push(frame)
        }
        this.counts.bikeStands = stands.length

        // Bus-stop pole sign beside the existing shelter
        const stop = LAYOUT.busStop
        const texture = canvasTexture(256, 256, (c, w, h) =>
        {
            c.fillStyle = '#1f5a8f'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#ffffff'
            c.font = '800 120px Arial'
            c.textAlign = 'center'
            c.fillText('BUS', w / 2, 150)
            c.font = '700 40px Arial'
            c.fillText('STOP', w / 2, 210)
        })
        this.textures.push(texture)
        const post = this.signPost(texture, 0.8, 2.6)
        const frame = this.ctx.frame(stop.t + 6 / this.world.roadLength)
        post.position.copy(frame.position).addScaledVector(frame.side, stop.side * 5.4)
        post.position.y = 0.14
        post.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z)
        this.ctx.group.add(post)
    }

    // ---------- café with terrace ----------

    buildCafe()
    {
        const cafe = LAYOUT.cafe
        const group = this.anchor(cafe.t, cafe.side * 14.6, 0.12)
        // Local +z points away from the road for side +1; rotate so the shop front faces the road
        group.rotation.y += cafe.side > 0 ? Math.PI : 0
        const front = cafe.side > 0 ? 1 : -1
        void front
        this.mesh(this.box, this.mats.cream, group, 0, 1.25, 0, 3.4, 2.5, 2.4)
        this.mesh(this.box, this.mats.teal, group, 0, 2.6, 0, 3.9, 0.25, 2.9)
        const awning = this.mesh(this.box, this.mats.red, group, 0, 2.25, -1.55, 3.6, 0.1, 1.2)
        awning.rotation.x = -0.25
        this.mesh(this.box, this.mats.wood, group, 0, 0.55, -1.25, 3.0, 1.1, 0.5) // counter
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), new THREE.MeshBasicMaterial({
            map: canvasTexture(512, 140, (c, w, h) =>
            {
                c.fillStyle = '#31565a'
                c.fillRect(0, 0, w, h)
                c.fillStyle = '#f6e7cf'
                c.font = '800 80px Arial'
                c.textAlign = 'center'
                c.fillText('CAFÉ', w / 2, 100)
            }),
            toneMapped: false
        }))
        sign.position.set(0, 2.95, -1.47)
        sign.rotation.y = Math.PI
        group.add(sign)

        // Terrace: tables, stools and umbrellas on the road side of the kiosk
        const tableTop = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12)
        const stem = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 6)
        const stool = new THREE.CylinderGeometry(0.17, 0.15, 0.45, 8)
        const umbrella = new THREE.ConeGeometry(1.15, 0.45, 8)
        ;[-2.1, 0, 2.1].forEach((x, index) =>
        {
            const tz = -3.4
            this.mesh(tableTop, this.mats.white, group, x, 0.75, tz)
            this.mesh(stem, this.mats.steel, group, x, 0.37, tz)
            this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 5), this.mats.steel, group, x, 1.4, tz)
            this.mesh(umbrella, index % 2 ? this.mats.orange : this.mats.red, group, x, 2.35, tz)
            for(const dx of [-0.65, 0.65])
                this.mesh(stool, this.mats.wood, group, x + dx, 0.23, tz)
        })
        this.cafeGroup = group
    }

    // ---------- fruit vendor ----------

    buildVendor()
    {
        const vendor = LAYOUT.vendor
        const t = this.slot(vendor.t, vendor.side, vendor.offset, 0.02)
        if(t === null)
            return
        const group = this.anchor(t, vendor.side * vendor.offset, 0.14)
        this.mesh(this.box, this.mats.wood, group, 0, 0.7, 0, 2.0, 0.12, 1.1)
        for(const [x, z] of [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]])
            this.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 5), this.mats.steel, group, x, 0.35, z)
        for(const x of [-0.95, 0.95])
            this.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), this.mats.iron, group, x, 0.3, 0.7).rotation.x = Math.PI / 2
        const crates = []
        const colours = ['#e9a23b', '#c8503f', '#8fb04c', '#f0d36b']
        colours.forEach((hex, i) =>
        {
            const material = this.world.material(hex, { roughness: 0.8 })
            for(let k = 0; k < 4; k++)
                crates.push(this.mesh(new THREE.SphereGeometry(0.13, 8, 6), material, group, -0.75 + i * 0.5, 0.88 + (k % 2) * 0.05, -0.25 + (k % 2) * 0.3 + (k > 1 ? 0.12 : 0)))
        })
        this.mesh(new THREE.ConeGeometry(1.5, 0.5, 8), this.mats.red, group, 0, 2.5, 0)
        this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), this.mats.steel, group, 0, 1.6, 0)
        this.counts.vendor = 1
    }

    // ---------- small works zone ----------

    buildWorksZone()
    {
        const t = this.slot(0.656, -1, 5.2, 0.015)
        if(t === null)
            return
        const cones = []
        for(let i = 0; i < 6; i++)
        {
            const p = this.ctx.point(t + (i * 1.6 - 4) / this.world.roadLength, -4.1 - (i < 3 ? i * 0.15 : 0), 0.14)
            cones.push({ x: p.x, y: 0.28, z: p.z, sx: 1, sy: 1, sz: 1 })
        }
        this.ctx.instance('TrafficCones', new THREE.ConeGeometry(0.17, 0.56, 8), this.mats.orange, cones)
        this.ctx.instance('ConeBases', this.box, this.mats.iron, cones.map(c => ({ ...c, y: 0.02, sx: 0.38, sy: 0.04, sz: 0.38 })), { castShadow: false })

        const stripes = canvasTexture(128, 32, (c, w, h) =>
        {
            for(let i = 0; i < 8; i++)
            {
                c.fillStyle = i % 2 ? '#f3ece0' : '#d8453b'
                c.fillRect((i * w) / 8, 0, w / 8, h)
            }
        })
        this.textures.push(stripes)
        const barrierMaterial = new THREE.MeshBasicMaterial({ map: stripes })
        const frame = this.ctx.frame(t)
        for(const along of [-1.6, 1.6])
        {
            const barrier = new THREE.Group()
            const board = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.28, 0.06), barrierMaterial)
            board.position.y = 0.95
            barrier.add(board)
            for(const x of [-0.85, 0.85])
                this.mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), this.mats.white, barrier, x, 0.5, 0)
            barrier.position.copy(this.ctx.point(t + along / this.world.roadLength, -5.0, 0.0))
            barrier.rotation.y = frame.yaw + Math.PI / 2
            this.ctx.group.add(barrier)
        }
        this.counts.cones = cones.length
    }
}
