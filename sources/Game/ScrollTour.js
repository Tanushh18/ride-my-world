import * as THREE from 'three/webgpu'

/**
 * Maps ordinary document scrolling to one continuous cinematic camera route.
 * The route is reversible and uses the existing renderer-owned ticker.
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

        this.cameraPath = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-138, 34, 90),
            new THREE.Vector3(-108, 22, 38),
            new THREE.Vector3(-78, 13, 3),
            new THREE.Vector3(-42, 14, 30),
            new THREE.Vector3(-7, 12, -16),
            new THREE.Vector3(28, 18, -47),
            new THREE.Vector3(64, 24, -82),
            new THREE.Vector3(100, 30, -112)
        ], false, 'catmullrom', 0.28)

        this.targetPath = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-95, 0, 50),
            new THREE.Vector3(-87, 1, 10),
            new THREE.Vector3(-48, 2, 8),
            new THREE.Vector3(-12, 0, -19),
            new THREE.Vector3(18, 2, -41),
            new THREE.Vector3(53, 7, -58),
            new THREE.Vector3(82, 4, -90),
            new THREE.Vector3(115, 8, -105)
        ], false, 'catmullrom', 0.28)

        const camera = this.game.view.camera
        camera.position.copy(this.cameraPath.getPoint(0))
        this.lookTarget.copy(this.targetPath.getPoint(0))
        camera.lookAt(this.lookTarget)

        this.onScroll = () =>
        {
            const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
            this.targetProgress = THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1)
        }

        this.onScroll()
        window.addEventListener('scroll', this.onScroll, { passive: true })
        window.addEventListener('resize', this.onScroll)

        this.progressBar = document.querySelector('.js-progress-bar')
        this.progressLabel = document.querySelector('.js-progress-label')
        this.sections = Array.from(document.querySelectorAll('[data-chapter]'))
        this.navLinks = Array.from(document.querySelectorAll('[data-nav-target]'))

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

        document.querySelector('.js-tour-nav')?.addEventListener('click', this.onNavClick)

        this.observer = new IntersectionObserver((entries) =>
        {
            for(const entry of entries)
            {
                if(!entry.isIntersecting)
                    continue

                const chapter = entry.target.dataset.chapter
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
    }

    update(camera)
    {
        const delta = Math.min(this.game.ticker.delta || 1 / 60, 1 / 30)
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.1)

        this.progress += (this.targetProgress - this.progress) * damping

        const position = this.cameraPath.getPoint(this.progress)
        const target = this.targetPath.getPoint(this.progress)

        camera.position.lerp(position, reducedMotion ? 1 : 1 - Math.exp(-delta * 2.6))
        this.lookTarget.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-delta * 3.6))
        camera.lookAt(this.lookTarget)

        if(this.progressBar)
            this.progressBar.style.transform = 'scaleX(' + this.targetProgress + ')'
    }

    destroy()
    {
        window.removeEventListener('scroll', this.onScroll)
        window.removeEventListener('resize', this.onScroll)
        document.querySelector('.js-tour-nav')?.removeEventListener('click', this.onNavClick)
        this.observer?.disconnect()
    }
}
