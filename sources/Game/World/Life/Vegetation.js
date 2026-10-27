import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { scatterAlongRoute } from '../../utilities/placement.js'
import { seededRandom } from '../../utilities/maths.js'

const merge = (parts) => mergeGeometries(parts.map(part => part.index ? part.toNonIndexed() : part), false)
const at = (geometry, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
{
    const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
        new THREE.Vector3(sx, sy, sz)
    )
    geometry.applyMatrix4(matrix)
    return geometry
}
const cone = (r, h, y, seg = 7) => at(new THREE.ConeGeometry(r, h, seg), 0, y, 0)
const blob = (r, x, y, z, sx = 1, sy = 1, sz = 1, detail = 1) => at(new THREE.IcosahedronGeometry(r, detail), x, y, z, 0, 0, 0, sx, sy, sz)

/**
 * Multi-species, seeded vegetation. Every species is a handful of merged
 * geometries drawn with InstancedMesh, so hundreds of plants cost a few draw
 * calls. Foliage materials bend gently in the wind via a TSL position node;
 * trunks stay rigid.
 */
export class Vegetation
{
    constructor(ctx)
    {
        this.ctx = ctx
        this.world = ctx.world
        this.dummy = new THREE.Object3D()
        this.meshes = []
        this.counts = {}
        this.build()
    }

    material(hex, options = {}, wind = null)
    {
        const material = this.world.material(hex, { roughness: 1, ...options })
        if(wind)
            this.ctx.applyWind(material, wind)
        return material
    }

    /** Create an InstancedMesh for `records` (each `{ x, y, z, ry, sx, sy, sz }`). */
    instance(name, geometry, material, records, { castShadow = true } = {})
    {
        if(!records.length)
            return null

        const mesh = new THREE.InstancedMesh(geometry, material, records.length)
        mesh.name = name
        records.forEach((record, index) =>
        {
            this.dummy.position.set(record.x, record.y, record.z)
            this.dummy.rotation.set(record.rx ?? 0, record.ry ?? 0, record.rz ?? 0)
            this.dummy.scale.set(record.sx, record.sy ?? record.sx, record.sz ?? record.sx)
            this.dummy.updateMatrix()
            mesh.setMatrixAt(index, this.dummy.matrix)
        })
        mesh.instanceMatrix.needsUpdate = true
        mesh.castShadow = castShadow
        mesh.receiveShadow = true
        mesh.computeBoundingSphere()
        this.ctx.group.add(mesh)
        this.meshes.push(mesh)
        this.counts[name] = records.length
        return mesh
    }

    /** Resolve scatter records to world transforms, splitting by variant. */
    resolve(records, { yOffset = 0, avoidRiver = true, riverMargin = 1.5 } = {})
    {
        const out = []
        const position = new THREE.Vector3()
        for(const record of records)
        {
            this.ctx.point(record.t, record.offset, yOffset, position)
            if(avoidRiver && this.ctx.inRiver(position.x, position.z, riverMargin))
                continue
            out.push({ ...record, x: position.x, y: yOffset, z: position.z })
        }
        return out
    }

    build()
    {
        const ctx = this.ctx
        const zones = ctx.zones
        // Reject the river and, in the city, the paved sidewalk strip.
        const noRiver = (t, offset) =>
        {
            if(t > 0.675 && Math.abs(offset) < 10.1)
                return true
            const p = ctx.point(t, offset, 0, ctx.tmpA)
            return ctx.inRiver(p.x, p.z, 2)
        }

        // ---- Species geometry (unit-ish height 1; instance scale sets size) ----
        const pineTrunk = merge([at(new THREE.CylinderGeometry(0.07, 0.12, 1, 6), 0, 0.5, 0)])
        const pineFoliage = merge([cone(0.62, 0.62, 0.62), cone(0.5, 0.55, 0.98), cone(0.36, 0.5, 1.3), cone(0.2, 0.4, 1.58)])

        const broadTrunk = merge([
            at(new THREE.CylinderGeometry(0.1, 0.16, 0.62, 7), 0, 0.31, 0),
            // exposed root flares
            at(new THREE.ConeGeometry(0.07, 0.3, 4), 0.15, 0.06, 0.05, 0, 0, -1.15),
            at(new THREE.ConeGeometry(0.07, 0.3, 4), -0.13, 0.06, -0.08, 0, 0, 1.15),
            at(new THREE.ConeGeometry(0.07, 0.28, 4), 0.04, 0.06, 0.15, 1.15, 0, 0),
            at(new THREE.ConeGeometry(0.06, 0.26, 4), -0.02, 0.06, -0.15, -1.15, 0, 0)
        ])
        const broadFoliage = merge([
            blob(0.5, 0, 0.92, 0, 1.1, 0.9, 1.05),
            blob(0.36, 0.3, 0.74, 0.12),
            blob(0.38, -0.27, 0.78, -0.14),
            blob(0.34, 0.06, 1.2, -0.06),
            blob(0.3, -0.1, 0.72, 0.3)
        ])

        const birchTrunk = merge([at(new THREE.CylinderGeometry(0.045, 0.07, 1, 6), 0, 0.5, 0)])
        const birchFoliage = merge([blob(0.3, 0, 1.0, 0, 0.9, 1.7, 0.9), blob(0.2, 0.1, 1.4, 0.05, 1, 1.3, 1)])

        const palmSegments = []
        for(let i = 0; i < 6; i++)
        {
            const u = i / 6
            palmSegments.push(at(new THREE.CylinderGeometry(0.075 - u * 0.02, 0.09 - u * 0.02, 0.19, 6), 0.2 * u * u * 1.2, 0.09 + i * 0.18, 0, 0, 0, -0.18 * u))
        }
        const palmTrunk = merge(palmSegments)
        const palmFronds = []
        for(let i = 0; i < 8; i++)
        {
            const angle = (i / 8) * Math.PI * 2
            const frond = at(new THREE.ConeGeometry(0.09, 0.78, 4), 0, 0.39, 0, 0, 0, 0, 1, 1, 0.22)
            frond.rotateZ(-Math.PI / 2 - 0.45)
            frond.rotateY(angle)
            frond.translate(0.24, 1.1, 0)
            palmFronds.push(frond)
        }
        const palmFoliage = merge(palmFronds)

        const bushGeometry = merge([blob(0.34, 0, 0.26, 0, 1.2, 0.8, 1.1, 1), blob(0.26, 0.28, 0.2, 0.08), blob(0.24, -0.26, 0.22, -0.06)])
        const tuftBlades = []
        for(let i = 0; i < 7; i++)
        {
            const angle = (i / 7) * Math.PI * 2
            const blade = at(new THREE.ConeGeometry(0.035, 0.55, 3), 0, 0.27, 0)
            blade.rotateZ(Math.sin(i * 3.1) * 0.28)
            blade.rotateY(angle)
            blade.translate(Math.cos(angle) * 0.07, 0, Math.sin(angle) * 0.07)
            tuftBlades.push(blade)
        }
        const tuftGeometry = merge(tuftBlades)

        const rockGeometry = new THREE.DodecahedronGeometry(0.5, 0)
        const mossGeometry = at(new THREE.SphereGeometry(0.46, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.35), 0, 0.12, 0)
        const logGeometry = merge([
            at(new THREE.CylinderGeometry(0.16, 0.2, 1, 7), 0, 0, 0, 0, 0, Math.PI / 2),
            at(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 5), 0.2, 0.18, 0, 0, 0, 0.8)
        ])
        const flowerGeometry = merge([
            at(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), 0, 0.15, 0),
            blob(0.07, 0, 0.32, 0, 1, 0.7, 1, 0)
        ])

        // ---- Materials ----
        const wind = { amplitude: 0.045, speed: 1.25, height: 1.5 }
        const gentle = { amplitude: 0.03, speed: 1.0, height: 1.2 }
        const bark = this.material('#6f5043')
        const darkBark = this.material('#4d3b36')
        const birchBark = this.material('#d8cfc0')
        const palmBark = this.material('#9b7a5e')
        const pineMats = [this.material('#2f6b55', {}, wind), this.material('#3b7a5a', {}, wind), this.material('#285c4d', {}, wind)]
        const leafMats = [this.material('#5a9467', {}, wind), this.material('#6fa56a', {}, wind), this.material('#487d5c', {}, wind), this.material('#8fa860', {}, wind)]
        const birchMats = [this.material('#a9b968', {}, wind), this.material('#c1c56e', {}, wind)]
        const palmMats = [this.material('#4f9a5f', {}, wind), this.material('#63a867', {}, wind)]
        const bushMats = [this.material('#4e8561', {}, gentle), this.material('#68985f', {}, gentle), this.material('#3f7557', {}, gentle)]
        const tuftMats = [this.material('#8cae5e', {}, { amplitude: 0.09, speed: 1.6, height: 0.55 }), this.material('#b7b56a', {}, { amplitude: 0.09, speed: 1.4, height: 0.55 }), this.material('#6d9a57', {}, { amplitude: 0.09, speed: 1.7, height: 0.55 })]
        const rockMats = [this.material('#8d8587'), this.material('#756c70'), this.material('#a09594')]
        const mossMat = this.material('#6e8f5b')
        const flowerMats = [this.material('#e8a0b4'), this.material('#f1d36f'), this.material('#fffaf0'), this.material('#b49be0')]

        const splitBy = (records, key) =>
        {
            const buckets = []
            for(const record of records)
            {
                const index = record[key]
                ;(buckets[index] ??= []).push(record)
            }
            return buckets
        }

        const place = (name, options, trunkGeom, trunkMat, foliageGeom, foliageMats, scaleFn) =>
        {
            const records = this.resolve(scatterAlongRoute({ ...options, zones, exclude: noRiver }))
            const trunks = []
            const buckets = splitBy(records, 'variant')
            for(const record of records)
            {
                const size = scaleFn(record)
                trunks.push({ x: record.x, y: 0, z: record.z, ry: record.rotation, sx: size.w, sy: size.h, sz: size.w })
            }
            this.instance(name + 'Trunk', trunkGeom, trunkMat, trunks)
            buckets.forEach((bucket, bucketIndex) =>
            {
                if(!bucket)
                    return
                const list = bucket.map(record =>
                {
                    const size = scaleFn(record)
                    return { x: record.x, y: 0, z: record.z, ry: record.rotation, sx: size.w, sy: size.h, sz: size.w }
                })
                this.instance(name + 'Foliage' + bucketIndex, foliageGeom, foliageMats[bucketIndex % foliageMats.length], list)
            })
        }

        // ---- Jungle & forest (route 0.02–0.58): layered, clustered ----
        place('Pine', { count: ctx.count(70), tMin: 0.02, tMax: 0.56, minOffset: 12, maxOffset: 60, seed: 101, variants: pineMats.length, clusters: 5, scaleRange: [0.8, 1.5] },
            pineTrunk, darkBark, pineFoliage, pineMats, r => ({ w: 1.15 * r.scale, h: 6.5 * r.scale }))

        place('Broadleaf', { count: ctx.count(95), tMin: 0.02, tMax: 0.57, minOffset: 11, maxOffset: 55, seed: 202, variants: leafMats.length, clusters: 6, scaleRange: [0.75, 1.5] },
            broadTrunk, bark, broadFoliage, leafMats, r => ({ w: 3.4 * r.scale, h: 4.2 * r.scale }))

        place('Birch', { count: ctx.count(34), tMin: 0.04, tMax: 0.5, minOffset: 9, maxOffset: 35, seed: 303, variants: birchMats.length, clusters: 4, scaleRange: [0.8, 1.3] },
            birchTrunk, birchBark, birchFoliage, birchMats, r => ({ w: 2.4 * r.scale, h: 6.0 * r.scale }))

        // Understory: saplings and bushes close to the road, mixed sizes
        place('Sapling', { count: ctx.count(46), tMin: 0.02, tMax: 0.58, minOffset: 6.4, maxOffset: 14, seed: 404, variants: leafMats.length, scaleRange: [0.5, 0.85] },
            broadTrunk, bark, broadFoliage, leafMats, r => ({ w: 1.6 * r.scale, h: 2.1 * r.scale }))

        const bushRecords = this.resolve(scatterAlongRoute({ count: ctx.count(150), tMin: 0.02, tMax: 0.97, minOffset: 5.7, maxOffset: 26, seed: 505, variants: bushMats.length, clusters: 10, scaleRange: [0.7, 1.7], zones, exclude: noRiver }))
        splitBy(bushRecords, 'variant').forEach((bucket, index) =>
        {
            if(bucket)
                this.instance('Bush' + index, bushGeometry, bushMats[index], bucket.map(r => ({ x: r.x, y: 0, z: r.z, ry: r.rotation, sx: 1.5 * r.scale, sy: 1.2 * r.scale, sz: 1.5 * r.scale })))
        })

        // Grass tufts & flowers: dense at the road edge, varied height/colour/orientation
        const tuftRecords = this.resolve(scatterAlongRoute({ count: ctx.count(420), tMin: 0.0, tMax: 1.0, minOffset: 5.0, maxOffset: 18, seed: 606, variants: tuftMats.length, clusters: 18, scaleRange: [0.6, 1.9], zones: zones.filter(z => z.maxOffset > 9), exclude: noRiver }), { riverMargin: 0.5 })
        splitBy(tuftRecords, 'variant').forEach((bucket, index) =>
        {
            if(bucket)
                this.instance('Tuft' + index, tuftGeometry, tuftMats[index], bucket.map(r => ({ x: r.x, y: 0, z: r.z, ry: r.rotation, rz: (r.random - 0.5) * 0.18, sx: 1.2 * r.scale, sy: 1.1 * r.scale, sz: 1.2 * r.scale })), { castShadow: false })
        })

        const flowerRecords = this.resolve(scatterAlongRoute({ count: ctx.count(170), tMin: 0.02, tMax: 0.97, minOffset: 5.3, maxOffset: 16, seed: 707, variants: flowerMats.length, clusters: 12, scaleRange: [0.8, 1.6], zones, exclude: noRiver }))
        splitBy(flowerRecords, 'variant').forEach((bucket, index) =>
        {
            if(bucket)
                this.instance('Flower' + index, flowerGeometry, flowerMats[index], bucket.map(r => ({ x: r.x, y: 0, z: r.z, ry: r.rotation, sx: r.scale, sy: r.scale, sz: r.scale })), { castShadow: false })
        })

        // Rocks with moss caps, fallen logs
        const rockRecords = this.resolve(scatterAlongRoute({ count: ctx.count(64), tMin: 0.02, tMax: 0.98, minOffset: 5.6, maxOffset: 30, seed: 808, variants: rockMats.length, clusters: 9, scaleRange: [0.5, 2.2], zones, exclude: noRiver }))
        const random = seededRandom(909)
        const rockList = rockRecords.map(r => ({ x: r.x, y: 0.1 * r.scale, z: r.z, rx: random() * 0.4, ry: r.rotation, rz: random() * 0.4, sx: r.scale * (0.9 + random() * 0.5), sy: r.scale * (0.55 + random() * 0.4), sz: r.scale * (0.9 + random() * 0.5), variant: r.variant, moss: random() < 0.55 }))
        splitBy(rockList, 'variant').forEach((bucket, index) =>
        {
            if(bucket)
                this.instance('Rock' + index, rockGeometry, rockMats[index], bucket)
        })
        this.instance('RockMoss', mossGeometry, mossMat, rockList.filter(r => r.moss).map(r => ({ ...r, y: r.y + 0.02 })), { castShadow: false })

        const logRecords = this.resolve(scatterAlongRoute({ count: ctx.count(14), tMin: 0.03, tMax: 0.52, minOffset: 8, maxOffset: 26, seed: 1010, scaleRange: [1.3, 2.6], zones, exclude: noRiver }))
        this.instance('FallenLog', logGeometry, bark, logRecords.map(r => ({ x: r.x, y: 0.17 * r.scale * 0.6, z: r.z, ry: r.rotation, sx: r.scale * 1.8, sy: r.scale * 0.8, sz: r.scale * 0.8 })))

        this.buildRiverbank({ bushGeometry, bushMats, tuftGeometry, tuftMats, rockGeometry, rockMats, mossGeometry, mossMat, flowerGeometry, flowerMats })
        this.buildCityPark({ broadTrunk, bark, broadFoliage, leafMats, palmTrunk, palmBark, palmFoliage, palmMats, bushGeometry, bushMats })
    }

    /** Reeds, shrubs and wet rocks hugging the river edge with a soft shore. */
    buildRiverbank({ bushGeometry, bushMats, tuftGeometry, tuftMats, rockGeometry, rockMats, mossGeometry, mossMat })
    {
        const ctx = this.ctx
        const random = seededRandom(1212)
        const position = new THREE.Vector3()
        const reeds = []
        const shrubs = []
        const rocks = []

        const count = ctx.count(120)
        for(let i = 0; i < count; i++)
        {
            const u = (random() * 2 - 1) * 23
            const edge = random() < 0.5 ? -1 : 1
            const v = edge * (7.4 + random() * 1.6)
            ctx.riverPoint(u, v, 0, position)
            const frame = ctx.frame(0.6)
            // Keep the road, bridge and waterfall corridor clear
            const toRoad = position.distanceTo(frame.position)
            if(toRoad < 11)
                continue
            if(ctx.inRiver(position.x, position.z, -0.4))
                continue
            const entry = { x: position.x, y: 0, z: position.z, ry: random() * Math.PI * 2, rz: (random() - 0.5) * 0.2, s: 0.8 + random() * 1.2 }
            const roll = random()
            if(roll < 0.55)
                reeds.push(entry)
            else if(roll < 0.8)
                shrubs.push(entry)
            else
                rocks.push(entry)
        }

        this.instance('ReedTuft', tuftGeometry, tuftMats[0], reeds.map(e => ({ ...e, sx: 1.4 * e.s, sy: 2.2 * e.s, sz: 1.4 * e.s })), { castShadow: false })
        this.instance('RiverShrub', bushGeometry, bushMats[2], shrubs.map(e => ({ ...e, sx: 1.5 * e.s, sy: 1.2 * e.s, sz: 1.5 * e.s })))
        this.instance('RiverRock', rockGeometry, rockMats[1], rocks.map(e => ({ ...e, y: 0.05, sx: 1.1 * e.s, sy: 0.7 * e.s, sz: 1.2 * e.s })))
        this.instance('RiverRockMoss', mossGeometry, mossMat, rocks.map(e => ({ ...e, y: 0.07, sx: 1.1 * e.s, sy: 0.7 * e.s, sz: 1.2 * e.s })), { castShadow: false })
    }

    /** Street trees, palms and planting beds that suit the boulevard and airport. */
    buildCityPark({ broadTrunk, bark, broadFoliage, leafMats, palmTrunk, palmBark, palmFoliage, palmMats, bushGeometry, bushMats })
    {
        const ctx = this.ctx
        const zones = ctx.zones
        const random = seededRandom(1313)
        const trees = []
        const palms = []

        for(let t = 0.72; t <= 0.992; t += 0.0125)
        {
            for(const side of [-1, 1])
            {
                if(random() < 0.28)
                    continue
                const offset = side * (10.4 + random() * 1.3)
                const jitterT = t + (random() - 0.5) * 0.004
                if(zones.some(zone => (zone.side === 0 || zone.side === side) && Math.abs(jitterT - zone.t) < zone.halfT && Math.abs(offset) >= zone.minOffset && Math.abs(offset) <= zone.maxOffset))
                    continue
                const position = ctx.point(jitterT, offset, 0)
                const entry = { x: position.x, z: position.z, ry: random() * Math.PI * 2, s: 0.8 + random() * 0.45, v: Math.floor(random() * leafMats.length) }
                ;(random() < 0.34 ? palms : trees).push(entry)
            }
        }

        this.instance('StreetTreeTrunk', broadTrunk, bark, trees.map(e => ({ x: e.x, y: 0.12, z: e.z, ry: e.ry, sx: 2.1 * e.s, sy: 3.1 * e.s, sz: 2.1 * e.s })))
        for(let v = 0; v < leafMats.length; v++)
            this.instance('StreetTreeFoliage' + v, broadFoliage, leafMats[v], trees.filter(e => e.v === v).map(e => ({ x: e.x, y: 0.12, z: e.z, ry: e.ry, sx: 2.1 * e.s, sy: 3.1 * e.s, sz: 2.1 * e.s })))

        // Palms lean slightly toward the road; trunk and fronds share a transform
        this.instance('PalmTrunk', palmTrunk, palmBark, palms.map(e => ({ x: e.x, y: 0.12, z: e.z, ry: e.ry, sx: 2.2 * e.s, sy: 4.6 * e.s, sz: 2.2 * e.s })))
        this.instance('PalmFronds0', palmFoliage, palmMats[0], palms.map(e => ({ x: e.x, y: 0.12, z: e.z, ry: e.ry, sx: 2.2 * e.s, sy: 4.6 * e.s, sz: 2.2 * e.s })))

        // Planting beds under street trees and around the terminal approach
        const beds = []
        for(let t = 0.73; t <= 0.99; t += 0.021)
        {
            const side = random() < 0.5 ? -1 : 1
            if(zones.some(zone => (zone.side === 0 || zone.side === side) && Math.abs(t - zone.t) < zone.halfT && 9.9 >= zone.minOffset && 9.9 <= zone.maxOffset))
                continue
            const p = ctx.point(t, side * 9.9, 0.12)
            beds.push({ x: p.x, y: 0.12, z: p.z, ry: random() * 6, sx: 1.0, sy: 0.8, sz: 1.0 })
        }
        this.instance('StreetShrub', bushGeometry, bushMats[1], beds)
    }
}
