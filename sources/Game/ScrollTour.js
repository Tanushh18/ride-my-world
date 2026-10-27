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
        this.bannerCameraPosition = new THREE.Vector3()
        this.vehicleQuaternion = new THREE.Quaternion()
        this.bannerPauseAt = null
        this.bannerPauseUntil = 0
        this.bannerPauseCount = 0
        this.rollQuaternion = new THREE.Quaternion()
        this.pointer = { x: 0, y: 0 }
        this.pointerTarget = { x: 0, y: 0 }
        this.up = new THREE.Vector3(0, 1, 0)
        this.rollAxis = new THREE.Vector3(0, 0, 1)
        this.lastFov = this.game.view.camera.fov

        this.roadCurve = this.game.world.scrollWorld.roadCurve
        this.roadLength = this.roadCurve.getLength()

        // Camera beats are tied to the real in-world boards. As each board
        // arrives beside the rider, the view eases toward it instead of letting
        // useful writing remain tiny scenery at the edge of the screen.
        const storyStops = [
            { t: 0.025, side: 1 },
            { t: 0.13, side: -1 },
            { t: 0.275, side: 1 },
            { t: 0.405, side: -1 },
            { t: 0.465, side: 1 },
            { t: 0.535, side: -1 },
            { t: 0.70, side: 1 },
            { t: 0.82, side: 1 },
            { t: 0.89, side: -1 },
            { t: 0.955, side: 1 },
            { t: 0.99, side: 1 }
        ]
        const compact = window.innerWidth < 760
        const boardOffset = this.game.world.scrollWorld.storyBoardOffset ?? (compact ? 6.35 : 8.25)
        this.storyFocusStops = storyStops.map(stop =>
        {
            const position = this.roadCurve.getPointAt(stop.t)
            const tangent = this.roadCurve.getTangentAt(stop.t).setY(0).normalize()
            const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
            const normal = side.clone().multiplyScalar(-stop.side)
            const target = position.addScaledVector(side, stop.side * boardOffset)
            target.y = compact ? 2.68 : 3.28
            return { ...stop, target, normal }
        })

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

        this.measureScroll = () =>
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

        // Coalesce scroll events to one target measurement per animation frame.
        // Camera motion stays in the renderer's frame loop and follows this target.
        this.scrollFrame = 0
        this.onScroll = () =>
        {
            if(this.scrollFrame)
                return
            this.scrollFrame = window.requestAnimationFrame(() =>
            {
                this.scrollFrame = 0
                this.measureScroll()
            })
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
        const progressDamping = 1 - Math.exp(-delta * (reducedMotion ? 18 : 6.4))
        const proposedProgress = clamp(
            immediateUpdate
                ? this.targetProgress
                : this.progress + (this.targetProgress - this.progress) * progressDamping,
            0,
            1
        )
        const now = performance.now()

        // Pause the route itself briefly at each physical information board.
        // The page keeps its scroll target, so the ride resumes naturally after
        // the reader has had a moment to read the banner.
        if(!immediateUpdate && !reducedMotion && this.bannerPauseAt !== null && now < this.bannerPauseUntil)
        {
            this.progress = this.bannerPauseAt
        }
        else
        {
            this.bannerPauseAt = null
            this.bannerPauseUntil = 0
            const direction = proposedProgress - this.progress
            const crossedBanner = !immediateUpdate && !reducedMotion
                ? this.storyFocusStops.find(stop =>
                    direction > 0
                        ? this.progress < stop.t && proposedProgress >= stop.t
                        : direction < 0
                            ? this.progress > stop.t && proposedProgress <= stop.t
                            : false)
                : null

            if(crossedBanner)
            {
                this.progress = crossedBanner.t
                this.bannerPauseAt = crossedBanner.t
                this.bannerPauseUntil = now + 1150
                this.bannerPauseCount++
            }
            else
                this.progress = proposedProgress
        }

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

        // Pull back for a few cinematic establishing beats so the jungle,
        // waterfall/bridge, full city blocks and terminal read as places — not
        // merely as scenery beside a first-person road.
        const jungleWide = smoothstep(0.335, 0.37, this.progress) * (1 - smoothstep(0.445, 0.49, this.progress))
        const riverWide = smoothstep(0.545, 0.575, this.progress) * (1 - smoothstep(0.635, 0.675, this.progress))
        const cityWide = smoothstep(0.735, 0.765, this.progress) * (1 - smoothstep(0.805, 0.855, this.progress))
        const terminalWide = smoothstep(0.955, 0.97, this.progress) * (1 - smoothstep(0.985, 0.999, this.progress))
        const scenicReveal = Math.max(jungleWide, riverWide, cityWide, terminalWide)

        const baseFollowDistance = mix(7.8, 4.35, establishing)
            + waterfall * 1.6 + cityReveal * 0.75 + finale * 4.8 + scenicReveal * 2.35
        const baseCameraHeight = mix(4.85, 2.45, establishing)
            + waterfall * 1.45 + cityReveal * 1.2 + finale * 3.15 + scenicReveal * 1.25
        const baseSideOffset = waterfall * 3.0 + cityReveal * 1.1 - finale * 2.0
            + scenicReveal * (this.progress > 0.52 ? -1.7 : 1.7)
        const lookAhead = mix(5.8, 4.4, establishing)
            + waterfall * 1.6 + finale * 4.4 + scenicReveal * 3.0

        let focusWeight = 0
        let focusStop = null
        for(const stop of this.storyFocusStops)
        {
            const enter = smoothstep(stop.t - 0.04, stop.t - 0.012, this.progress)
            const leave = 1 - smoothstep(stop.t + 0.012, stop.t + 0.04, this.progress)
            const weight = enter * leave
            if(weight > focusWeight)
            {
                focusWeight = weight
                focusStop = stop
            }
        }

        this.storyFocusWeight = focusWeight
        this.storyFocusStop = focusStop?.t ?? null

        // Hold the wider scene for context, then settle on the nearby sign at
        // near eye level. Both the pan and the zoom follow the scroll easing.
        const focusBlend = focusWeight * 0.94
        const followDistance = mix(baseFollowDistance, baseFollowDistance + 0.9, focusWeight)
        const cameraHeight = mix(baseCameraHeight, 3.05 + scenicReveal * 0.3, focusWeight)
        const sideOffset = baseSideOffset * (1 - focusWeight * 0.72)

        this.roadCurve.getPointAt(Math.min(1, this.progress + lookAhead / Math.max(this.roadLength, 1)), this.cameraTarget)
        this.cameraTarget.y = this.routePoint.y + mix(1.25, 1.65, finale) + scenicReveal * 0.9 * (1 - focusWeight)
        if(scenicReveal > 0)
            this.cameraTarget.addScaledVector(this.side, (this.progress > 0.52 ? -2.4 : 2.4) * scenicReveal * (1 - focusWeight))
        if(focusStop)
            this.cameraTarget.lerp(focusStop.target, focusBlend)

        this.cameraPosition.copy(this.routePoint)
            .addScaledVector(this.tangent, -followDistance)
            .addScaledVector(this.side, sideOffset)
        this.cameraPosition.y = this.routePoint.y + cameraHeight
        this.cameraPosition.addScaledVector(this.side, this.pointer.x * 0.42)
        this.cameraPosition.y -= this.pointer.y * 0.16

        // A banner is read from directly in front of its face: the camera
        // turns 90 degrees off the road tangent and holds a clean, near-level
        // composition for the dwell. This removes the old tiny edge-of-screen
        // sign view and makes the printed copy legible.
        if(focusStop && focusWeight > 0.001)
        {
            const distance = window.innerWidth < 760 ? 5.25 : 5.35
            this.bannerCameraPosition.copy(focusStop.target)
                .addScaledVector(focusStop.normal, distance)
            this.bannerCameraPosition.y = focusStop.target.y + (window.innerWidth < 760 ? 0.04 : 0.08)
            this.cameraPosition.lerp(this.bannerCameraPosition, focusWeight)
        }

        const cameraDamping = immediateUpdate ? 1 : 1 - Math.exp(-delta * 6.4)
        camera.position.lerp(this.cameraPosition, cameraDamping)
        this.lookTarget.lerp(this.cameraTarget, immediateUpdate ? 1 : 1 - Math.exp(-delta * 7.3))
        camera.lookAt(this.lookTarget)

        const sceneFov = mix(53, 49, finale) + waterfall * 3.5 + cityReveal * 1.2 + scenicReveal * 3.4
        const nextFov = mix(sceneFov, 54, focusWeight)
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
        if(this.scrollFrame)
            window.cancelAnimationFrame(this.scrollFrame)
        this.observer?.disconnect()
    }
}
