import { LifeContext } from './context.js'
import { Vegetation } from './Vegetation.js'
import { Wildlife } from './Wildlife.js'
import { VehicleFactory } from './Vehicles.js'
import { Traffic } from './Traffic.js'
import { Pedestrians } from './Pedestrians.js'
import { RoadProps } from './RoadProps.js'
import { AirportLife } from './AirportLife.js'
import { Effects } from './Effects.js'

/**
 * Orchestrates the systems that make the world feel inhabited. Each system is
 * built behind its own guard so one failing feature costs that feature only —
 * never the whole scene — and all of them are updated from one tick listener.
 *
 * A small adaptive-quality governor watches real frame times: when the page
 * can't hold ~30fps it trims optional work in steps (particles, then
 * post-processing and pixel ratio) instead of letting the ride stutter.
 */
export class WorldLife
{
    constructor(world)
    {
        this.world = world
        this.game = world.game
        this.ctx = new LifeContext(world)
        this.systems = {}
        this.counts = {}
        this.failed = []
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        this.detail = 0
        this.rawDelta = 1 / 60
        this.lastNow = performance.now()
        this.slowFor = 0
        this.warm = 4
        this.adaptive = !/noadapt/i.test(window.location.hash)

        this.vehicles = null
    }

    /** Build every system in turn, reporting progress and yielding between them. */
    async build(report = async () => {})
    {
        const guard = async (name, label, progress, factory) =>
        {
            await report(label, progress)
            try
            {
                this.systems[name] = factory()
                this.counts[name] = this.systems[name].counts ?? true
            }
            catch(error)
            {
                this.failed.push(name)
                console.warn(`WorldLife > ${name} failed to build`, error)
            }
        }

        this.vehicles = new VehicleFactory(this.ctx)
        await guard('vegetation', 'Planting trees, grass and flowers…', 64, () =>
        {
            const vegetation = new Vegetation(this.ctx)
            vegetation.counts = { ...vegetation.counts, total: Object.values(vegetation.counts).reduce((a, b) => a + b, 0) }
            return vegetation
        })
        await guard('roadProps', 'Marking roads and setting out street furniture…', 76, () => new RoadProps(this.ctx, this.vehicles))
        await guard('airport', 'Lighting the runway…', 83, () => new AirportLife(this.ctx, this.vehicles))
        await guard('traffic', 'Starting the traffic…', 88, () => new Traffic(this.ctx, this.vehicles))
        await guard('pedestrians', 'Waking the neighbourhood…', 92, () => new Pedestrians(this.ctx, this.vehicles))
        await guard('wildlife', 'Letting the wildlife out…', 95, () => new Wildlife(this.ctx))
        await guard('effects', 'Adding light and atmosphere…', 98, () => new Effects(this.ctx))
        this.built = true
    }

    update()
    {
        const now = performance.now()
        this.rawDelta = Math.min(0.25, (now - this.lastNow) / 1000)
        this.lastNow = now

        const tour = this.game.view?.scrollTour
        const progress = tour?.progress ?? 0
        const camera = this.game.view?.camera
        const reduced = this.reducedMotion
        const time = reduced ? 0 : this.game.ticker.elapsed
        const delta = reduced ? 0 : this.game.ticker.delta

        const { wildlife, traffic, pedestrians, effects, airport } = this.systems
        wildlife?.update(time, delta, progress)
        traffic?.update(time, delta, progress, camera?.position, tour)
        pedestrians?.update(time, delta, progress, tour)
        airport?.update(time)
        if(effects)
        {
            if(reduced)
                effects.updateGlow(this.game.ticker.delta, tour, camera)
            else
                effects.update(time, delta, progress, tour, camera)
        }

        this.govern()
    }

    /** Step down optional work when frame times stay poor. */
    govern()
    {
        if(!this.adaptive || this.detail >= 2)
            return
        const frame = this.rawDelta
        if(this.warm > 0)
        {
            this.warm -= frame
            return
        }
        if(frame > 1 / 28)
            this.slowFor += frame
        else
            this.slowFor = Math.max(0, this.slowFor - frame * 2)

        if(this.slowFor > 2.5)
        {
            this.slowFor = 0
            this.warm = 3
            this.setDetail(this.detail + 1)
        }
    }

    setDetail(level)
    {
        this.detail = level
        const { effects, wildlife } = this.systems
        effects?.setDetail(level)
        if(wildlife)
            for(const swarm of wildlife.swarms)
                swarm.items.length = Math.min(swarm.items.length, level >= 1 ? Math.ceil(swarm.items.length / 2) : swarm.items.length)

        const rendering = this.game.rendering
        if(level >= 1)
            rendering.renderer?.setPixelRatio(Math.min(1, this.game.viewport.pixelRatio))
        if(level >= 2 && rendering.postProcessing)
        {
            rendering.postProcessing = null
            console.info('WorldLife > post-processing disabled to protect frame rate')
        }
        console.info(`WorldLife > adaptive quality detail level ${level}`)
    }

    destroy()
    {
        this.systems.effects?.destroy?.()
    }
}
