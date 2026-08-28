import { uniform } from 'three/tsl'
import { Events } from './Events.js'

/**
 * The single loop of the application.
 *
 * `Rendering` hands control to it through `renderer.setAnimationLoop`, so there
 * is exactly one requestAnimationFrame in the whole project. Delta is clamped
 * because a tab regaining focus after a minute must not teleport the physics.
 */
export class Ticker
{
    constructor()
    {
        this.elapsed = 0
        this.delta = 1 / 60
        this.maxDelta = 1 / 30
        this.deltaAverage = this.delta
        this.frame = 0
        this.lastDeltas = []
        this.waits = []

        // Exposed to shaders so materials can animate without extra plumbing
        this.elapsedUniform = uniform(this.elapsed)
        this.deltaUniform = uniform(this.delta)

        this.events = new Events()
    }

    update(elapsedMilliseconds)
    {
        const elapsed = elapsedMilliseconds / 1000

        this.delta = Math.min(elapsed - this.elapsed, this.maxDelta)
        this.elapsed = elapsed
        this.frame++

        // Rolling average, used by the vehicle controller and the quality system
        this.lastDeltas.push(this.delta)
        if(this.lastDeltas.length > 30)
            this.lastDeltas.shift()
        this.deltaAverage = this.lastDeltas.reduce((total, value) => total + value, 0) / this.lastDeltas.length

        this.elapsedUniform.value = this.elapsed
        this.deltaUniform.value = this.delta

        for(let i = this.waits.length - 1; i >= 0; i--)
        {
            const wait = this.waits[i]
            wait.frames--

            if(wait.frames <= 0)
            {
                this.waits.splice(i, 1)
                wait.callback()
            }
        }

        this.events.trigger('tick')
    }

    /** Run a callback after a number of rendered frames. */
    wait(frames, callback)
    {
        this.waits.push({ frames, callback })
    }
}
