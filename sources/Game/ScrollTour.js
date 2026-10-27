import * as THREE from 'three/webgpu'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const smoothstep = (edge0, edge1, value) =>
{
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}
const mix = (a, b, t) => a + (b - a) * t

/**
 * Scroll is the throttle for one continuous scooter ride.
 *
 * Crucially, the vehicle, camera, road, roadside scenery and lighting all use
 * the same road curve. This prevents the camera from touring an empty path
 * while the scooter stays parked back at the physics spawn point.
 */
export class ScrollTour
{
    constructor(game)
    {
        this.game = game
        this.active = true
        this.progress = 0
        this.targetProgress = 0
        this.lookTarget = new THREE.Vector3()
        this.ridePosition = new THREE.Vector3()
        this.routePoint = new THREE.Vector3()
        this.tangent = new THREE.Vector3()
        this.side = new THREE.Vector3()
        this.cameraTarget = new THREE.Vector3()
        this.cameraPosition = new THREE.Vector3()
        this.vehicleQuaternion = new THREE.Quaternion()
        this.rollQuaternion = new THREE.Quaternion()
        this.pointer = { x: 0, y: 0 }
        this.pointerTarget = { x: 0, y: 0 }
        this.up = new THREE.Vector3(0, 1, 0)
        this.rollAxis = new THREE.Vector3(0, 0, 1)
        this.lastFov = this.game.view.camera.fov

        this.roadCurve = this.game.world.scrollWorld.roadCurve
        this.roadLength = this.roadCurve.getLength()

        // The route is paced by real content chapters, not raw document height.
        // Larger project sections can take longer to read while the ride keeps
        // moving through the district naturally.
        this.chapterStops = {
            home: 0,
            about: 0.075,
            skills: 0.19,
            experience: 0.36,
            projects: 0.62,
            education: 0.78,
            certifications: 0.86,
            achievements: 0.93,
            contact: 1
        }

        this.sections = Array.from(document.querySelectorAll('[data-chapter]'))
        this.navLinks = Array.from(document.querySelectorAll('[data-nav-target]'))
        this.progressBar = document.querySelector('.js-progress-bar')
        this.progressLabel = document.querySelector('.js-progress-label')

        this.onScroll = () =>
        {
            if(this.sections.length < 2)
            {
                const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
                this.targetProgress = THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1)
                return
            }

            const scrollY = window.scrollY
            const tops = this.sections.map(section => section.getBoundingClientRect().top + scrollY)
            let index = 0

            while(index < tops.length - 1 && tops[index + 1] <= scrollY)
                index++

            if(index >= tops.length - 1)
            {
                this.targetProgress = 1
                return
            }

            const startSection = this.sections[index]
            const endSection = this.sections[index + 1]
            const startStop = this.chapterStops[startSection.dataset.chapter] ?? index / (this.sections.length - 1)
            const endStop = this.chapterStops[endSection.dataset.chapter] ?? (index + 1) / (this.sections.length - 1)
            const segmentLength = Math.max(1, tops[index + 1] - tops[index])
            const segmentProgress = THREE.MathUtils.clamp((scrollY - tops[index]) / segmentLength, 0, 1)

            this.targetProgress = mix(startStop, endStop, segmentProgress)
        }

        this.onPointerMove = (event) =>
        {
            if(event.pointerType === 'touch')
                return

            this.pointerTarget.x = THREE.MathUtils.clamp((event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1)
            this.pointerTarget.y = THREE.MathUtils.clamp((event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1)
            document.documentElement.style.setProperty('--cursor-x', event.clientX + 'px')
            document.documentElement.style.setProperty('--cursor-y', event.clientY + 'px')
        }

        this.onNavClick = (event) =>
        {
            const link = event.target.closest('[data-nav-target]')
            if(!link)
                return

            const section = document.getElementById(link.dataset.navTarget)
            if(!section)
                return

            event.preventDefault()
            section.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'start'
            })
        }

        this.observer = new IntersectionObserver((entries) =>
        {
            for(const entry of entries)
            {
                if(!entry.isIntersecting)
                    continue

                const chapter = entry.target.dataset.chapter
                entry.target.classList.add('is-in-view')
                document.documentElement.dataset.chapter = chapter
                for(const link of this.navLinks)
                {
                    const active = link.dataset.navTarget === chapter
                    link.classList.toggle('is-active', active)
                    if(active)
                        link.setAttribute('aria-current', 'location')
                    else
                        link.removeAttribute('aria-current')
                }

                const number = String(Math.max(1, this.sections.indexOf(entry.target) + 1)).padStart(2, '0')
                if(this.progressLabel)
                    this.progressLabel.textContent = number + ' / ' + String(this.sections.length).padStart(2, '0')
            }
        }, { threshold: 0.38 })

        this.sections.forEach(section => this.observer.observe(section))
        document.querySelector('.js-tour-nav')?.addEventListener('click', this.onNavClick)
        window.addEventListener('scroll', this.onScroll, { passive: true })
        window.addEventListener('resize', this.onScroll)
        window.addEventListener('pointermove', this.onPointerMove, { passive: true })
        this.onScroll()

        const camera = this.game.view.camera
        camera.fov = 53
        camera.updateProjectionMatrix()
        this.update(camera, true)
    }

    updateVehicle()
    {
        const vehicle = this.game.world.visualVehicle
        if(!vehicle)
            return

        const physical = this.game.physicsVehicle
        const wheelSettings = physical.wheels.settings
        const suspension = wheelSettings.restLength
        const radius = wheelSettings.radius

        this.routePoint.copy(this.roadCurve.getPointAt(this.progress))
        this.tangent.copy(this.roadCurve.getTangentAt(this.progress)).setY(0).normalize()
        this.side.set(-this.tangent.z, 0, this.tangent.x).normalize()

        const yaw = Math.atan2(-this.tangent.z, this.tangent.x)
        const behind = this.roadCurve.getTangentAt(Math.max(0, this.progress - 0.018)).setY(0).normalize()
        const ahead = this.roadCurve.getTangentAt(Math.min(1, this.progress + 0.018)).setY(0).normalize()
        const yawBehind = Math.atan2(-behind.z, behind.x)
        const yawAhead = Math.atan2(-ahead.z, ahead.x)
        const yawDelta = Math.atan2(Math.sin(yawAhead - yawBehind), Math.cos(yawAhead - yawBehind))
        const lean = clamp(yawDelta * 1.55, -0.17, 0.17)

        this.ridePosition.set(
            this.routePoint.x,
            this.routePoint.y + suspension + radius,
            this.routePoint.z
        )

        vehicle.group.position.copy(this.ridePosition)
        this.vehicleQuaternion.setFromAxisAngle(this.up, yaw)
        this.rollQuaternion.setFromAxisAngle(this.rollAxis, lean)
        vehicle.group.quaternion.copy(this.vehicleQuaternion).multiply(this.rollQuaternion)
        vehicle.group.visible = true

        const wheelDistance = this.progress * this.roadLength
        for(const wheel of vehicle.wheels)
        {
            const { basePosition } = wheel.physical
            wheel.holder.position.set(
                basePosition.x,
                basePosition.y - suspension,
                0
            )
            wheel.holder.rotation.y = basePosition.x > 0 ? clamp(yawDelta * 3.5, -0.22, 0.22) : 0
            wheel.spinner.rotation.z = -wheelDistance / radius
        }
    }

    update(camera, immediate = false)
    {
        const delta = Math.min(this.game.ticker.delta || 1 / 60, 1 / 30)
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const immediateUpdate = immediate || reducedMotion
        const progressDamping = 1 - Math.exp(-delta * (reducedMotion ? 18 : 5.2))

        this.progress = immediateUpdate
            ? this.targetProgress
            : this.progress + (this.targetProgress - this.progress) * progressDamping
        this.progress = clamp(this.progress, 0, 1)

        this.updateVehicle()

        // A restrained mouse parallax adds depth without changing scroll as the
        // primary navigation or introducing camera shake.
        const pointerDamping = immediateUpdate ? 1 : 1 - Math.exp(-delta * 2.4)
        this.pointer.x += (this.pointerTarget.x - this.pointer.x) * pointerDamping
        this.pointer.y += (this.pointerTarget.y - this.pointer.y) * pointerDamping

        // Camera keyframes are offsets from the rider on the road, so the
        // scooter remains in frame through the jungle, waterfall, city and end.
        const establishing = smoothstep(0, 0.12, this.progress)
        const waterfall = smoothstep(0.54, 0.58, this.progress) * (1 - smoothstep(0.64, 0.70, this.progress))
        const cityReveal = smoothstep(0.68, 0.82, this.progress)
        const finale = smoothstep(0.92, 0.99, this.progress)

        const followDistance = mix(7.8, 4.35, establishing) + waterfall * 1.6 + cityReveal * 0.75 + finale * 4.8
        const cameraHeight = mix(4.85, 2.45, establishing) + waterfall * 1.45 + cityReveal * 1.2 + finale * 3.15
        const sideOffset = waterfall * 3.0 + cityReveal * 1.1 - finale * 2.0
        const lookAhead = mix(5.8, 4.4, establishing) + waterfall * 1.6 + finale * 4.4

        this.roadCurve.getPointAt(Math.min(1, this.progress + lookAhead / Math.max(this.roadLength, 1)), this.cameraTarget)
        this.cameraTarget.y = this.routePoint.y + mix(1.25, 1.65, finale)

        this.cameraPosition.copy(this.routePoint)
            .addScaledVector(this.tangent, -followDistance)
            .addScaledVector(this.side, sideOffset)
        this.cameraPosition.y = this.routePoint.y + cameraHeight
        this.cameraPosition.addScaledVector(this.side, this.pointer.x * 0.42)
        this.cameraPosition.y -= this.pointer.y * 0.16

        const cameraDamping = immediateUpdate ? 1 : 1 - Math.exp(-delta * 5.3)
        camera.position.lerp(this.cameraPosition, cameraDamping)
        this.lookTarget.lerp(this.cameraTarget, immediateUpdate ? 1 : 1 - Math.exp(-delta * 6.1))
        camera.lookAt(this.lookTarget)

        const nextFov = mix(53, 49, finale) + waterfall * 3.5 + cityReveal * 1.2
        if(Math.abs(nextFov - this.lastFov) > 0.25)
        {
            camera.fov = nextFov
            camera.updateProjectionMatrix()
            this.lastFov = nextFov
        }

        if(this.progressBar)
            this.progressBar.style.transform = 'scaleX(' + this.progress + ')'
        document.documentElement.style.setProperty('--ride-progress', this.progress.toFixed(4))
    }

    destroy()
    {
        window.removeEventListener('scroll', this.onScroll)
        window.removeEventListener('resize', this.onScroll)
        window.removeEventListener('pointermove', this.onPointerMove)
        document.querySelector('.js-tour-nav')?.removeEventListener('click', this.onNavClick)
        this.observer?.disconnect()
    }
}
