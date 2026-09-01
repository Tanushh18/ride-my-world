import { Game } from './Game.js'
import { Events } from './Events.js'
import { resolveActiveZone } from './utilities/zones.js'

/**
 * Registry of places worth reacting to.
 *
 * Deliberately general and deliberately not part of any area: every area will
 * want this, and its interface is already settled even though the areas' are
 * not. Ticks at priority 8, so it reads the vehicle position written at 5.
 *
 * The decision itself lives in `utilities/zones.js` — this class is only the
 * plumbing that feeds it the car and turns its answer into events.
 */
export class Zones
{
    constructor()
    {
        this.game = Game.getInstance()
        this.events = new Events()
        this.items = []
        this.active = null
        this.hysteresis = 1.25

        this.game.ticker.events.on('tick', () => { this.update() }, 8)
    }

    /**
     * @param {object} zone
     * @param {string} zone.id
     * @param {{x: number, z: number}} zone.position
     * @param {number} zone.radius
     * @param {*} [zone.data]  Handed back to listeners untouched
     */
    register(zone)
    {
        if(this.items.some(item => item.id === zone.id))
            throw new Error(`Zones > duplicate zone id "${zone.id}"`)

        this.items.push(zone)

        return zone
    }

    update()
    {
        const currentId = this.active ? this.active.id : null
        const nextId = resolveActiveZone(
            this.items,
            this.game.physicsVehicle.position,
            currentId,
            this.hysteresis
        )

        if(nextId === currentId)
            return

        // Leave before enter, so a listener never sees two zones active at once
        if(this.active)
        {
            const left = this.active
            this.active = null
            this.events.trigger('leave', [ left ])
        }

        if(nextId)
        {
            this.active = this.items.find(item => item.id === nextId)
            this.events.trigger('enter', [ this.active ])
        }
    }
}
