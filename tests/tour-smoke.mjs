import { chromium } from 'playwright'

const url = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/#debug&quality=low'
const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
const consoleErrors = []

page.on('pageerror', error => pageErrors.push(String(error)))
page.on('console', message =>
{
    if(message.type() === 'error')
        consoleErrors.push(message.text())
})

try
{
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForFunction(() =>
        document.documentElement.classList.contains('is-ready')
        || document.documentElement.classList.contains('is-failed'),
        null,
        { timeout: 60000 }
    )

    if(await page.evaluate(() => document.documentElement.classList.contains('is-failed')))
        throw new Error('3D initialization failed: ' + await page.locator('.js-error-message').textContent())

    await page.waitForFunction(() => Boolean(window.game?.view?.scrollTour), null, { timeout: 30000 })
    await page.waitForFunction(() => window.game.ticker.frame > 8, null, { timeout: 30000 })

    const initial = await page.evaluate(() =>
    {
        const game = window.game
        return {
            backend: game.rendering.backend,
            frames: game.ticker.frame,
            chapters: document.querySelectorAll('section[data-chapter]').length,
            skills: document.querySelectorAll('.js-skill-grid .skill-tile').length,
            experience: document.querySelectorAll('.js-experience-list .experience-entry').length,
            projects: document.querySelectorAll('.js-project-grid .project-card').length,
            projectZones: game.zones.items.length,
            certifications: document.querySelectorAll('.js-certification-list .certification-entry').length,
            achievements: document.querySelectorAll('.js-achievement-grid .achievement-card').length,
            name: document.querySelector('.brand-copy strong')?.textContent,
            rider: game.world.visualVehicle.group.position.toArray(),
            camera: game.view.camera.position.toArray(),
            wheel: game.world.visualVehicle.wheels[0].spinner.rotation.z,
            triangles: game.rendering.renderer.info.render.triangles,
            loaderStage: document.querySelector('#portfolio-loader')?.dataset.stage,
            loaderHeadline: document.querySelector('.loader-headline')?.textContent,
            energyNodes: game.world.scrollWorld.energyInstances?.count ?? 0,
            ambientMotes: game.world.scrollWorld.moteGeometry?.attributes.position.count ?? 0,
            storyBoards: game.world.scrollWorld.storyBoards?.length ?? 0,
            riftGates: game.world.scrollWorld.riftGates?.length ?? 0,
            maxBannerLines: Math.max(0, ...(game.world.scrollWorld.storyBoardData ?? []).map(board => board.lines.length)),
            facadeLabels: game.world.scrollWorld.facadeLabels?.length ?? 0,
            foregroundPanelsHidden: getComputedStyle(document.querySelector('#projects .story-inner')).display === 'none',
            projectPopupHidden: getComputedStyle(document.querySelector('.legacy-project-card')).display === 'none',
            flyingNote: Boolean(game.world.scrollWorld.paperNote?.group),
            aircraft: Boolean(game.world.scrollWorld.aircraft),
            airportPamphlet: Boolean(game.world.scrollWorld.airportPamphlet?.group),
            loaderProgress: getComputedStyle(document.querySelector('#portfolio-loader')).getPropertyValue('--loader-progress').trim()
        }
    })

    if(initial.chapters !== 9)
        throw new Error('Expected 9 real HTML story chapters; got ' + initial.chapters)
    if(initial.skills !== 6)
        throw new Error('Resume skill groups did not render; got ' + initial.skills)
    if(initial.experience !== 3)
        throw new Error('Resume experience entries did not render; got ' + initial.experience)
    if(initial.projects !== 6)
        throw new Error('Expected 6 project showcases; got ' + initial.projects)
    if(initial.projectZones !== 6)
        throw new Error('Expected 6 3D project landmarks/zones; got ' + initial.projectZones)
    if(initial.certifications !== 4)
        throw new Error('Resume certifications did not render; got ' + initial.certifications)
    if(initial.achievements !== 5)
        throw new Error('Resume achievements did not render; got ' + initial.achievements)
    if(!initial.name?.includes('TANUSH'))
        throw new Error('Expected Tanush branding; got ' + initial.name)
    if(initial.triangles <= 0)
        throw new Error('Renderer did not draw the 3D scene')
    if(initial.loaderStage !== 'ready')
        throw new Error('Cinematic loader did not reach the real ready stage; got ' + initial.loaderStage)
    if(initial.energyNodes !== 32)
        throw new Error('Scroll-reactive light trails missing; got ' + initial.energyNodes)
    if(initial.ambientMotes !== 300)
        throw new Error('WebGL atmosphere particles missing; got ' + initial.ambientMotes)
    if(initial.storyBoards !== 11)
        throw new Error('Expected 11 readable in-world story boards; got ' + initial.storyBoards)
    if(initial.riftGates !== 3)
        throw new Error('Expected 3 animated WebGL energy gates; got ' + initial.riftGates)
    if(initial.maxBannerLines < 4)
        throw new Error('Roadside banners are missing expanded details; max lines=' + initial.maxBannerLines)
    if(!initial.foregroundPanelsHidden || !initial.projectPopupHidden)
        throw new Error('Foreground information panels must stay hidden in banner-first ride mode')
    if(initial.flyingNote || initial.airportPamphlet)
        throw new Error('Floating information cards should be replaced by fixed roadside/banner information')
    if(initial.facadeLabels !== 6)
        throw new Error('Expected 6 project labels on city façades; got ' + initial.facadeLabels)
    if(!initial.aircraft)
        throw new Error('Airport aircraft is missing from the 3D world')
    if(initial.loaderProgress !== '100%')
        throw new Error('Loader did not reach 100% after boot; got ' + initial.loaderProgress)

    await page.evaluate(() =>
    {
        document.documentElement.style.scrollBehavior = 'auto'
        const projects = document.getElementById('projects')
        const education = document.getElementById('education')
        const start = projects.getBoundingClientRect().top + window.scrollY
        const end = education.getBoundingClientRect().top + window.scrollY
        // Aim just beyond the midpoint between Projects and Education.
        // That crosses the 0.70 in-world sign target, allowing the reading
        // dwell to trigger instead of asymptotically approaching it.
        window.scrollTo(0, start + (end - start) * 0.55)
    })

    await page.waitForFunction(() =>
        Math.abs(window.game.view.scrollTour.progress - 0.70) < 0.001
        && window.game.view.scrollTour.bannerPauseAt === 0.70
        && window.game.view.scrollTour.storyFocusWeight > 0.99,
        null,
        { timeout: 30000 }
    )
    // Let the damped camera finish its final face-on rotation while the
    // intentional banner dwell is still active.
    await page.waitForTimeout(300)

    const midRide = await page.evaluate(() =>
    {
        const game = window.game
        return {
            progress: game.view.scrollTour.progress,
            rider: game.world.visualVehicle.group.position.toArray(),
            camera: game.view.camera.position.toArray(),
            wheel: game.world.visualVehicle.wheels[0].spinner.rotation.z,
            storyFocusWeight: game.view.scrollTour.storyFocusWeight,
            storyFocusStop: game.view.scrollTour.storyFocusStop,
            focusStops: game.view.scrollTour.storyFocusStops.length,
            bannerPauseAt: game.view.scrollTour.bannerPauseAt,
            bannerPauseCount: game.view.scrollTour.bannerPauseCount,
            bannerFacingDot: (() => {
                const stop = game.view.scrollTour.storyFocusStops.find(item => item.t === 0.70)
                const viewDirection = game.view.camera.getWorldDirection(game.view.scrollTour.cameraTarget.clone())
                return viewDirection.dot(stop.normal.clone().negate())
            })()
        }
    })

    const positionChange = Math.hypot(
        midRide.rider[0] - initial.rider[0],
        midRide.rider[2] - initial.rider[2]
    )
    const cameraChange = Math.hypot(
        midRide.camera[0] - initial.camera[0],
        midRide.camera[1] - initial.camera[1],
        midRide.camera[2] - initial.camera[2]
    )

    if(positionChange < 20)
        throw new Error('Scooter did not ride along the road when scrolling; moved ' + positionChange.toFixed(2))
    if(cameraChange < 10)
        throw new Error('Chase camera did not follow the scroll journey; moved ' + cameraChange.toFixed(2))
    if(Math.abs(midRide.wheel - initial.wheel) < 10)
        throw new Error('Scooter wheel animation is not connected to scroll progress')
    if(midRide.focusStops !== 11)
        throw new Error('Camera story focus keyframes missing; got ' + midRide.focusStops)
    if(midRide.storyFocusWeight < 0.99)
        throw new Error('Camera did not settle on the physical roadside banner; focus=' + midRide.storyFocusWeight)
    if(midRide.bannerPauseAt !== 0.70 || midRide.bannerPauseCount < 1)
        throw new Error('Scroll did not pause at the project banner for reading')
    if(midRide.bannerFacingDot < 0.97)
        throw new Error('Camera is not facing the banner directly; dot=' + midRide.bannerFacingDot.toFixed(3))

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight))
    await page.waitForFunction(() => window.game.view.scrollTour.progress > 0.96, null, { timeout: 30000 })

    const endRide = await page.evaluate(() => ({
        progress: window.game.view.scrollTour.progress,
        chapters: Array.from(document.querySelectorAll('section[data-chapter]')).map(section => section.id),
        contact: document.querySelector('.js-contact-card')?.textContent
    }))

    if(!endRide.chapters.includes('contact'))
        throw new Error('Contact chapter missing from the scroll route')
    if(!endRide.contact?.includes('tanushchawla16@gmail.com'))
        throw new Error('Resume contact details were not rendered')

    if(pageErrors.length)
        throw new Error('Browser errors: ' + pageErrors.join(' | '))
    if(consoleErrors.length)
        throw new Error('Console errors: ' + consoleErrors.join(' | ').slice(0, 900))

    console.log(JSON.stringify({
        status: 'PASS',
        backend: initial.backend,
        frames: initial.frames,
        chapters: initial.chapters,
        resumeSections: {
            skills: initial.skills,
            experience: initial.experience,
            projects: initial.projects,
            projectZones: initial.projectZones,
            certifications: initial.certifications,
            achievements: initial.achievements
        },
        scrollRide: {
            midProgress: Number(midRide.progress.toFixed(3)),
            riderTravelled: Number(positionChange.toFixed(2)),
            cameraTravelled: Number(cameraChange.toFixed(2)),
            wheelsAnimated: Math.abs(midRide.wheel - initial.wheel) > 10,
            signFocus: { weight: Number(midRide.storyFocusWeight.toFixed(3)), stop: midRide.storyFocusStop, pauseAt: midRide.bannerPauseAt, pauseCount: midRide.bannerPauseCount, facingDot: Number(midRide.bannerFacingDot.toFixed(3)) },
            endProgress: Number(endRide.progress.toFixed(3))
        },
        triangles: initial.triangles,
        visualEffects: {
            loaderStage: initial.loaderStage,
            loaderProgress: initial.loaderProgress,
            scrollReactiveLightNodes: initial.energyNodes,
            ambientMotes: initial.ambientMotes,
            inWorldStoryBoards: initial.storyBoards,
            maxBannerLines: initial.maxBannerLines,
            facadeProjectLabels: initial.facadeLabels,
            animatedEnergyGates: initial.riftGates,
            foregroundPanelsHidden: initial.foregroundPanelsHidden && initial.projectPopupHidden,
            parkedAircraft: initial.aircraft,
            floatingInformationCardsRemoved: !initial.flyingNote && !initial.airportPamphlet
        }
    }, null, 2))
}
finally
{
    await browser.close()
}
