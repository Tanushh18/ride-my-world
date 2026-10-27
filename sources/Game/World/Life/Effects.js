import * as THREE from 'three/webgpu'
import { seededRandom } from '../../utilities/maths.js'

const radialTexture = (size, stops) =>
{
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const c = canvas.getContext('2d')
    const gradient = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    for(const [offset, color] of stops)
        gradient.addColorStop(offset, color)
    c.fillStyle = gradient
    c.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

/**
 * Restrained atmosphere and feedback effects. Each one is a pooled Points /
 * Sprite / small-mesh system with a fixed particle budget (halved on the low
 * quality preset) and is only updated while the rider is close enough to see it.
 *
 *   - waterfall spray, foam and river sparkle
 *   - drifting cloud sprites and faint sun shafts
 *   - dust and leaves kicked up behind the scooter (only while it is moving)
 *   - soft speed lines (never during a banner reading pause)
 *   - banner glow when a board is focused or hovered, and a light pulse when
 *     a new chapter is reached
 */
export class Effects
{
    constructor(ctx)
    {
        this.ctx = ctx
        this.world = ctx.world
        this.game = ctx.game
        this.random = seededRandom(9001)
        this.group = new THREE.Group()
        this.group.name = 'Effects'
        ctx.group.add(this.group)
        this.counts = {}
        this.lastProgress = 0
        this.speed = 0
        this.chapter = document.documentElement.dataset.chapter ?? ''
        this.pulse = 0
        this.hovered = null
        this.raycaster = new THREE.Raycaster()
        this.pointerNdc = new THREE.Vector2(2, 2)
        this.enabled = { spray: true, sparkle: true, dust: true, streaks: true, clouds: true }

        this.buildSpray()
        this.buildSparkle()
        this.buildClouds()
        this.buildShafts()
        this.buildDust()
        this.buildStreaks()
        this.buildChapterPulse()
        this.buildBannerGlow()

        this.onPointerMove = (event) =>
        {
            if(event.pointerType === 'touch')
                return
            this.pointerNdc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1)
        }
        window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    }

    points(count, { size, color, opacity = 0.7, additive = true, map = null })
    {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3))
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage)
        geometry.attributes.color.setUsage(THREE.DynamicDrawUsage)
        const material = new THREE.PointsMaterial({
            size,
            color,
            map,
            sizeAttenuation: true,
            transparent: true,
            opacity,
            vertexColors: true,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            depthWrite: false
        })
        const points = new THREE.Points(geometry, material)
        points.frustumCulled = false
        points.renderOrder = 4
        this.group.add(points)
        return points
    }

    // ---------- waterfall spray & foam ----------

    buildSpray()
    {
        const count = this.ctx.low ? 40 : 90
        const frame = this.ctx.frame(0.6)
        // Base of the falls: ScrollWorld places the cliff 12.2m to the +side, face towards the road
        this.sprayOrigin = frame.position.clone().addScaledVector(frame.side, 12.2 - 1.9)
        this.sprayFrame = frame
        this.spray = this.points(count, { size: 0.22, color: '#e8fffb', opacity: 0.55, map: radialTexture(32, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) })
        this.sprayState = Array.from({ length: count }, (_, i) => ({ life: this.random(), speed: 0.3 + this.random() * 0.5, x: (this.random() - 0.5) * 10, z: (this.random() - 0.5) * 1.4 }))

        // Foam discs where the water lands
        const foamTexture = radialTexture(64, [[0, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(235,255,250,0.45)'], [1, 'rgba(255,255,255,0)']])
        const foamMaterial = new THREE.MeshBasicMaterial({ map: foamTexture, transparent: true, depthWrite: false, opacity: 0.7 })
        this.foam = []
        for(let i = 0; i < 7; i++)
        {
            const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 16), foamMaterial.clone())
            disc.rotation.x = -Math.PI / 2
            const along = -4.8 + i * 1.6
            disc.position.copy(this.sprayOrigin).addScaledVector(frame.tangent, along)
            disc.position.y = 0.05
            disc.scale.set(1.3, 0.8, 1)
            disc.renderOrder = 3
            this.group.add(disc)
            this.foam.push({ disc, phase: i * 1.1 })
        }
        this.counts.spray = count
    }

    updateSpray(time, near)
    {
        this.spray.visible = near
        for(const foam of this.foam)
            foam.disc.visible = near
        if(!near)
            return
        const positions = this.spray.geometry.attributes.position
        const colors = this.spray.geometry.attributes.color
        const { tangent, side } = this.sprayFrame
        this.sprayState.forEach((p, i) =>
        {
            const life = (time * p.speed * 0.4 + i * 0.137) % 1
            const x = this.sprayOrigin.x + tangent.x * p.x + side.x * (p.z + life * 0.5)
            const z = this.sprayOrigin.z + tangent.z * p.x + side.z * (p.z + life * 0.5)
            positions.setXYZ(i, x + Math.sin(time + i) * 0.1, 0.2 + life * 3.2, z + Math.cos(time * 0.8 + i) * 0.1)
            const fade = Math.sin(life * Math.PI)
            colors.setXYZ(i, fade, fade, fade)
        })
        positions.needsUpdate = true
        colors.needsUpdate = true
        for(const foam of this.foam)
        {
            const pulse = 0.5 + 0.5 * Math.sin(time * 1.7 + foam.phase)
            foam.disc.material.opacity = 0.35 + pulse * 0.4
            foam.disc.scale.set(1.3 + pulse * 0.25, 0.8 + pulse * 0.15, 1)
        }
    }

    // ---------- river sparkle ----------

    buildSparkle()
    {
        const count = this.ctx.low ? 40 : 90
        this.sparkle = this.points(count, { size: 0.16, color: '#ffffff', opacity: 0.9, map: radialTexture(32, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) })
        this.sparkleState = []
        const point = new THREE.Vector3()
        const positions = this.sparkle.geometry.attributes.position
        for(let i = 0; i < count; i++)
        {
            this.ctx.riverPoint((this.random() * 2 - 1) * 23, (this.random() * 2 - 1) * 7.6, 0.07, point)
            positions.setXYZ(i, point.x, 0.07, point.z)
            this.sparkleState.push({ phase: this.random() * 6.28, rate: 1.2 + this.random() * 2.4 })
        }
        positions.needsUpdate = true
        this.counts.sparkle = count
    }

    updateSparkle(time, near)
    {
        this.sparkle.visible = near
        if(!near)
            return
        const colors = this.sparkle.geometry.attributes.color
        this.sparkleState.forEach((s, i) =>
        {
            const twinkle = Math.max(0, Math.sin(time * s.rate + s.phase))
            const v = twinkle * twinkle * twinkle
            colors.setXYZ(i, v, v, v * 0.95)
        })
        colors.needsUpdate = true
    }

    // ---------- clouds and sun shafts ----------

    buildClouds()
    {
        const map = radialTexture(128, [[0, 'rgba(255,238,230,0.95)'], [0.55, 'rgba(255,214,206,0.5)'], [1, 'rgba(255,214,206,0)']])
        this.clouds = []
        const count = this.ctx.low ? 8 : 16
        for(let i = 0; i < count; i++)
        {
            const material = new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.4 + this.random() * 0.25, depthWrite: false, fog: false })
            const sprite = new THREE.Sprite(material)
            const t = this.random()
            const frame = this.ctx.frame(t)
            sprite.position.copy(frame.position).addScaledVector(frame.side, (this.random() * 2 - 1) * 110)
            sprite.position.y = 48 + this.random() * 28
            const scale = 38 + this.random() * 40
            sprite.scale.set(scale * 1.7, scale * 0.55, 1)
            sprite.renderOrder = 2
            this.group.add(sprite)
            this.clouds.push({ sprite, speed: 0.6 + this.random() * 0.8, baseX: sprite.position.x })
        }
        this.counts.clouds = count
    }

    buildShafts()
    {
        const map = radialTexture(64, [[0, 'rgba(255,236,190,0.9)'], [1, 'rgba(255,236,190,0)']])
        this.shafts = []
        ;[0.1, 0.22, 0.34, 0.47].forEach((t, index) =>
        {
            const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
            const shaft = new THREE.Mesh(new THREE.PlaneGeometry(5, 34), material)
            const frame = this.ctx.frame(t)
            shaft.position.copy(frame.position).addScaledVector(frame.side, (index % 2 ? 1 : -1) * 19)
            shaft.position.y = 15
            shaft.rotation.set(0, frame.yaw + 0.8 * (index % 2 ? 1 : -1), 0.28)
            shaft.renderOrder = 3
            this.group.add(shaft)
            this.shafts.push({ shaft, t, phase: index * 1.4 })
        })
    }

    updateAtmosphere(time, progress)
    {
        for(const cloud of this.clouds)
            cloud.sprite.position.x = cloud.baseX + Math.sin(time * 0.01 * cloud.speed) * 40
        for(const shaft of this.shafts)
        {
            const near = Math.abs(shaft.t - progress) < 0.2
            shaft.shaft.visible = near
            if(near)
                shaft.shaft.material.opacity = 0.035 + (0.5 + 0.5 * Math.sin(time * 0.4 + shaft.phase)) * 0.035
        }
    }

    // ---------- dust and leaves behind the scooter ----------

    buildDust()
    {
        const count = this.ctx.low ? 24 : 48
        this.dust = this.points(count, { size: 0.16, color: '#ffffff', opacity: 0.85, additive: false, map: radialTexture(32, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) })
        this.dustState = Array.from({ length: count }, () => ({ life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hue: 0 }))
        this.dustCursor = 0
        this.dustCarry = 0
        this.counts.dust = count
    }

    emitDust(position, tangent, side, intensity)
    {
        const particle = this.dustState[this.dustCursor]
        this.dustCursor = (this.dustCursor + 1) % this.dustState.length
        particle.life = 0
        particle.x = position.x - tangent.x * 0.9 + (this.random() - 0.5) * 0.3
        particle.y = 0.22
        particle.z = position.z - tangent.z * 0.9 + (this.random() - 0.5) * 0.3
        const spread = (this.random() - 0.5) * 1.2
        particle.vx = -tangent.x * (0.6 + intensity * 0.6) + side.x * spread
        particle.vz = -tangent.z * (0.6 + intensity * 0.6) + side.z * spread
        particle.vy = 0.5 + this.random() * 0.8
        particle.hue = this.random()
    }

    updateDust(delta, tour, progress)
    {
        const positions = this.dust.geometry.attributes.position
        const colors = this.dust.geometry.attributes.color
        const city = progress > 0.68
        const leafy = !city && this.random() < 0.35
        void leafy
        const moving = this.speed > 1.2 && tour && tour.bannerPauseAt === null
        if(moving && this.enabled.dust)
        {
            this.dustCarry += delta * Math.min(14, this.speed * 1.4)
            while(this.dustCarry >= 1)
            {
                this.dustCarry -= 1
                this.emitDust(tour.ridePosition, tour.tangent, tour.side, Math.min(1, this.speed / 10))
            }
        }
        this.dustState.forEach((p, i) =>
        {
            p.life += delta * 1.1
            if(p.life >= 1)
            {
                positions.setXYZ(i, 0, -50, 0)
                return
            }
            p.x += p.vx * delta
            p.z += p.vz * delta
            p.y += p.vy * delta
            p.vy -= 1.1 * delta
            positions.setXYZ(i, p.x, Math.max(0.1, p.y), p.z)
            const fade = Math.sin(Math.min(1, p.life) * Math.PI) * 0.8
            // Dust in town, mixed leaves in the forest
            const leaf = !city && p.hue > 0.6
            colors.setXYZ(i, (leaf ? 0.55 : 0.83) * fade, (leaf ? 0.65 : 0.76) * fade, (leaf ? 0.32 : 0.68) * fade)
        })
        positions.needsUpdate = true
        colors.needsUpdate = true
    }

    // ---------- soft speed lines ----------

    buildStreaks()
    {
        const count = this.ctx.low ? 10 : 22
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3))
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage)
        this.streakMaterial = new THREE.LineBasicMaterial({ color: '#fff4e0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
        this.streaks = new THREE.LineSegments(geometry, this.streakMaterial)
        this.streaks.frustumCulled = false
        this.streaks.renderOrder = 6
        this.group.add(this.streaks)
        this.streakState = Array.from({ length: count }, () => ({ along: this.random() * 24 - 6, lateral: (this.random() * 2 - 1) * 4.5, height: 0.3 + this.random() * 2.6, speed: 0.6 + this.random() * 0.8 }))
        this.counts.streaks = count
    }

    updateStreaks(delta, tour)
    {
        const reading = !tour || tour.bannerPauseAt !== null || (tour.storyFocusWeight ?? 0) > 0.05
        const target = reading || !this.enabled.streaks ? 0 : Math.min(0.32, Math.max(0, (this.speed - 5) / 14))
        this.streakMaterial.opacity += (target - this.streakMaterial.opacity) * Math.min(1, delta * 4)
        this.streaks.visible = this.streakMaterial.opacity > 0.01
        if(!this.streaks.visible || !tour)
            return
        const positions = this.streaks.geometry.attributes.position
        const length = 0.8 + this.speed * 0.12
        this.streakState.forEach((s, i) =>
        {
            s.along -= (this.speed * s.speed + 3) * delta
            if(s.along < -8)
            {
                s.along += 30
                s.lateral = (this.random() * 2 - 1) * 4.5
                s.height = 0.3 + this.random() * 2.6
            }
            const baseX = tour.ridePosition.x + tour.tangent.x * s.along + tour.side.x * s.lateral
            const baseZ = tour.ridePosition.z + tour.tangent.z * s.along + tour.side.z * s.lateral
            positions.setXYZ(i * 2, baseX, s.height, baseZ)
            positions.setXYZ(i * 2 + 1, baseX + tour.tangent.x * length, s.height, baseZ + tour.tangent.z * length)
        })
        positions.needsUpdate = true
    }

    // ---------- chapter pulse ----------

    buildChapterPulse()
    {
        const material = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        this.pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), material)
        this.pulseRing.rotation.x = -Math.PI / 2
        this.pulseRing.renderOrder = 6
        this.pulseRing.visible = false
        this.group.add(this.pulseRing)
    }

    updatePulse(delta, tour)
    {
        const chapter = document.documentElement.dataset.chapter ?? ''
        if(chapter && chapter !== this.chapter)
        {
            if(this.chapter)
                this.pulse = 1
            this.chapter = chapter
        }
        if(this.pulse > 0 && tour)
        {
            this.pulse = Math.max(0, this.pulse - delta * 0.8)
            const u = 1 - this.pulse
            this.pulseRing.visible = true
            this.pulseRing.position.copy(tour.ridePosition)
            this.pulseRing.position.y = 0.22
            this.pulseRing.scale.setScalar(0.6 + u * 7)
            this.pulseRing.material.opacity = this.pulse * 0.55
        }
        else
            this.pulseRing.visible = false
    }

    // ---------- banner glow + hover feedback ----------

    buildBannerGlow()
    {
        const map = radialTexture(128, [[0, 'rgba(255,225,170,0.9)'], [0.6, 'rgba(255,205,150,0.35)'], [1, 'rgba(255,205,150,0)']])
        this.glows = []
        const size = this.world.storyBoardSize ?? { width: 8.2, height: 4.7 }
        for(const board of this.world.storyBoards)
        {
            const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
            const glow = new THREE.Mesh(new THREE.PlaneGeometry(size.width * 1.35, size.height * 1.45), material)
            glow.position.z = -0.2
            glow.renderOrder = 4
            board.group.add(glow)
            // The face mesh is the pickable surface for hover
            const face = board.group.children.find(child => child.isMesh && child.geometry?.type === 'PlaneGeometry' && child !== glow)
            this.glows.push({ board, glow, face, amount: 0 })
        }
    }

    updateGlow(delta, tour, camera)
    {
        const focusStop = tour?.storyFocusStop ?? null
        const focusWeight = tour?.storyFocusWeight ?? 0

        // Hover: ray from the pointer against the board faces
        let hovered = null
        if(this.pointerNdc.x <= 1)
        {
            this.raycaster.setFromCamera(this.pointerNdc, camera)
            const faces = this.glows.map(item => item.face).filter(Boolean)
            const hit = this.raycaster.intersectObjects(faces, false)[0]
            hovered = hit ? this.glows.find(item => item.face === hit.object) : null
        }
        if(hovered !== this.hovered)
        {
            this.hovered = hovered
            document.documentElement.classList.toggle('is-hovering-board', Boolean(hovered))
        }

        for(const item of this.glows)
        {
            const focused = focusStop !== null && Math.abs(item.board.item.t - focusStop) < 1e-6 ? focusWeight : 0
            const target = Math.max(focused * 0.38, item === this.hovered ? 0.22 : 0)
            item.amount += (target - item.amount) * Math.min(1, delta * 5)
            item.glow.material.opacity = item.amount
            item.glow.visible = item.amount > 0.005
            if(item.amount > 0.005)
                item.board.edge.material.opacity = Math.min(1, item.board.edge.material.opacity + item.amount * 1.2)
        }
    }

    update(time, delta, progress, tour, camera)
    {
        this.speed = Math.abs(progress - this.lastProgress) / Math.max(delta, 1e-4) * this.world.roadLength
        this.speed = Math.min(30, this.speed)
        this.lastProgress = progress

        this.updateSpray(time, Math.abs(progress - 0.6) < 0.18)
        this.updateSparkle(time, Math.abs(progress - 0.57) < 0.2)
        this.updateAtmosphere(time, progress)
        this.updateDust(delta, tour, progress)
        this.updateStreaks(delta, tour)
        this.updatePulse(delta, tour)
        this.updateGlow(delta, tour, camera)
    }

    setDetail(level)
    {
        // Level 1 trims optional particles; level 2 also drops the soft streaks
        this.enabled.dust = level < 2
        this.enabled.streaks = level < 1
        this.sparkle.visible = this.sparkle.visible && level < 2
    }

    destroy()
    {
        window.removeEventListener('pointermove', this.onPointerMove)
    }
}
