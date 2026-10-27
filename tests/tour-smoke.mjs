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
            certifications: document.querySelectorAll('.js-certification-list .certification-entry').length,
            achievements: document.querySelectorAll('.js-achievement-grid .achievement-card').length,
            name: document.querySelector('.brand-copy strong')?.textContent,
            rider: game.world.visualVehicle.group.position.toArray(),
            camera: game.view.camera.position.toArray(),
            wheel: game.world.visualVehicle.wheels[0].spinner.rotation.z,
            triangles: game.rendering.renderer.info.render.triangles
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
    if(initial.certifications !== 4)
        throw new Error('Resume certifications did not render; got ' + initial.certifications)
    if(initial.achievements !== 5)
        throw new Error('Resume achievements did not render; got ' + initial.achievements)
    if(!initial.name?.includes('TANUSH'))
        throw new Error('Expected Tanush branding; got ' + initial.name)
    if(initial.triangles <= 0)
        throw new Error('Renderer did not draw the 3D scene')

    await page.evaluate(() =>
    {
        document.documentElement.style.scrollBehavior = 'auto'
        const projects = document.getElementById('projects')
        const target = projects.getBoundingClientRect().top + window.scrollY + projects.offsetHeight * 0.62
        window.scrollTo(0, target)
    })

    await page.waitForFunction(() => window.game.view.scrollTour.progress > 0.66, null, { timeout: 30000 })

    const midRide = await page.evaluate(() =>
    {
        const game = window.game
        return {
            progress: game.view.scrollTour.progress,
            rider: game.world.visualVehicle.group.position.toArray(),
            camera: game.view.camera.position.toArray(),
            wheel: game.world.visualVehicle.wheels[0].spinner.rotation.z
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
            certifications: initial.certifications,
            achievements: initial.achievements
        },
        scrollRide: {
            midProgress: Number(midRide.progress.toFixed(3)),
            riderTravelled: Number(positionChange.toFixed(2)),
            cameraTravelled: Number(cameraChange.toFixed(2)),
            wheelsAnimated: Math.abs(midRide.wheel - initial.wheel) > 10,
            endProgress: Number(endRide.progress.toFixed(3))
        },
        triangles: initial.triangles
    }, null, 2))
}
finally
{
    await browser.close()
}
