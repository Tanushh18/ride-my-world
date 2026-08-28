/**
 * Headless smoke test: boots the app in real Chrome, waits for the car to
 * settle on its suspension, drives it, and asserts what actually happened.
 *
 * Progress is measured in FRAMES, not milliseconds — a software rasterizer runs
 * at about 1fps, so a time-based test would only ever prove that nothing had
 * happened yet.
 *
 * Run with the dev server listening:
 *   node tests/smoke.mjs                    headless, software rendering
 *   HEADLESS=0 node tests/smoke.mjs         headed, real GPU (WebGL backend)
 *   HEADLESS=0 WEBGPU=1 node tests/smoke.mjs  headed, WebGPU backend
 *
 * Chrome on Linux does not enable WebGPU by default, so WEBGPU=1 passes the
 * flags that turn it on. Without them the app takes its WebGL2 fallback path.
 */
import { chromium } from 'playwright'

// Headless means software rendering, which cannot afford the full grass field
const URL = process.env.SMOKE_URL
    ?? (process.env.HEADLESS === '0'
        ? 'http://localhost:5173/#debug'
        : 'http://localhost:5173/#debug&quality=low')
const SHOT = process.env.SMOKE_SHOT ?? '/tmp/folio-smoke.png'
const HEADLESS = process.env.HEADLESS !== '0'

const WEBGPU = process.env.WEBGPU === '1'

const args = [ '--window-size=1280,800' ]

if(HEADLESS)
    args.push('--enable-unsafe-swiftshader', '--use-angle=swiftshader')

if(WEBGPU)
    args.push('--enable-unsafe-webgpu', '--enable-features=Vulkan')

const browser = await chromium.launch({ channel: 'chrome', headless: HEADLESS, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const logs = []
const errors = []

// Console errors matter as much as thrown ones: a shader that fails to
// compile reports there and nowhere else.
const consoleErrors = []

page.on('console', (message) =>
{
    logs.push(`[${message.type()}] ${message.text()}`)

    if(message.type() === 'error')
        consoleErrors.push(message.text())
})
page.on('pageerror', (error) => { errors.push(String(error)) })

/** Block until the page has rendered `count` more frames. */
const waitFrames = async (count, timeout = 120000) =>
{
    const start = await page.evaluate(() => window.game.ticker.frame)
    await page.waitForFunction(
        (target) => window.game.ticker.frame >= target,
        start + count,
        { timeout, polling: 100 }
    )
}

const readState = () => page.evaluate(() =>
{
    const game = window.game
    return {
        backend: game.rendering.backend,
        frame: game.ticker.frame,
        elapsed: game.ticker.elapsed,
        drawCalls: game.rendering.renderer.info.render.drawCalls,
        triangles: game.rendering.renderer.info.render.triangles,
        position: { ...game.physicsVehicle.position },
        speed: game.physicsVehicle.speed,
        yRotation: game.physicsVehicle.yRotation,
        wheelsInContact: game.physicsVehicle.wheels.inContactCount,
        suspension: game.physicsVehicle.wheels.items.map(wheel => Number(wheel.suspensionLength.toFixed(3))),
        wheelRotation: game.physicsVehicle.wheels.items[0].rotation,
        objectCount: game.objects.items.length
    }
})

await page.goto(URL, { waitUntil: 'load' })

await page.waitForFunction(
    () => document.documentElement.classList.contains('is-ready')
        || document.documentElement.classList.contains('is-failed'),
    null,
    { timeout: 60000 }
)

if(await page.evaluate(() => document.documentElement.classList.contains('is-failed')))
{
    console.log('FAILED TO START:', await page.textContent('.js-error-message'))
    console.log(logs.join('\n'))
    await browser.close()
    process.exit(1)
}

// Let the car drop onto its wheels before measuring anything
await page.waitForFunction(
    () => window.game.physicsVehicle.wheels.inContactCount === 4,
    null,
    { timeout: 120000, polling: 100 }
).catch(() => {})

const settled = await readState()

if(process.env.SMOKE_SHOT_REST)
    await page.screenshot({ path: process.env.SMOKE_SHOT_REST })

// Drive: throttle for 90 frames, then add steering for 90 more
const before = await readState()

await page.evaluate(() =>
{
    // Sample every frame. End-of-run snapshots lie: the car often finishes
    // against a tree (hiding its top speed) or having turned a full circle
    // (hiding that it steered at all).
    window.__probe = { topSpeed: 0, turned: 0, maxSteer: 0 }

    let previousYaw = window.game.physicsVehicle.yRotation

    window.game.ticker.events.on('tick', () =>
    {
        const vehicle = window.game.physicsVehicle
        const probe = window.__probe

        probe.topSpeed = Math.max(probe.topSpeed, vehicle.speed)
        probe.maxSteer = Math.max(probe.maxSteer, Math.abs(vehicle.wheels.items[0].steering))

        // Shortest signed step, accumulated as absolute heading change
        let delta = (vehicle.yRotation - previousYaw) % (Math.PI * 2)
        if(delta > Math.PI) delta -= Math.PI * 2
        if(delta < -Math.PI) delta += Math.PI * 2

        probe.turned += Math.abs(delta)
        previousYaw = vehicle.yRotation
    }, 500)
})

await page.keyboard.down('w')
await waitFrames(90)
await page.keyboard.down('a')
await waitFrames(90)
await page.keyboard.up('a')
await page.keyboard.up('w')
await waitFrames(10)

const probe = await page.evaluate(() => window.__probe)

const after = await readState()
const fps = (after.frame - settled.frame) / Math.max(after.elapsed - settled.elapsed, 0.001)

await page.screenshot({ path: SHOT })
await browser.close()

const moved = Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z)
const restLength = 0.62

const checks = [
    [ 'no page errors',           errors.length === 0,                          errors.join(' | ') || 'clean' ],
    [ 'no console errors',        consoleErrors.length === 0,                   consoleErrors.join(' | ').slice(0, 200) || 'clean' ],
    [ 'expected backend',         WEBGPU ? after.backend === 'WebGPU' : true,   after.backend ],
    [ 'renderer drew the scene',  after.drawCalls > 20,                         `${after.drawCalls} draw calls, ${after.triangles} tris` ],
    [ 'car settled on 4 wheels',  settled.wheelsInContact === 4,                `${settled.wheelsInContact}/4` ],
    [ 'suspension compressed',    settled.suspension.every(l => l > 0 && l < restLength), `lengths ${settled.suspension.join(', ')} (rest ${restLength})` ],
    [ 'car drove forward',        moved > 3,                                    `moved ${moved.toFixed(2)}m in 180 frames` ],
    [ 'car reached real speed',   probe.topSpeed > 8,                           `top ${probe.topSpeed.toFixed(2)} m/s` ],
    [ 'steering reached wheels',  probe.maxSteer > 0.2,                         `max ${probe.maxSteer.toFixed(3)} rad` ],
    [ 'car changed heading',      probe.turned > 1,                             `turned ${probe.turned.toFixed(2)} rad total` ],
    [ 'wheels spun',              Math.abs(after.wheelRotation) > 1,            `${after.wheelRotation.toFixed(2)} rad` ],
    [ 'car did not fall through',  after.position.y > 0.5 && after.position.y < 30, `y = ${after.position.y.toFixed(2)}` ]
]

console.log(`backend: ${after.backend}   fps: ${fps.toFixed(1)}   objects: ${after.objectCount}`)
console.log('')

let failures = 0

for(const [ name, passed, detail ] of checks)
{
    console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}  (${detail})`)
    if(!passed)
        failures++
}

console.log(`\nscreenshot: ${SHOT}`)

if(failures > 0)
{
    console.log('\n--- console ---')
    console.log(logs.slice(-40).join('\n'))
}

process.exit(failures > 0 ? 1 : 0)
