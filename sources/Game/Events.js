/**
 * Priority-aware event emitter.
 *
 * Every subsystem listens to `tick` with an explicit priority number, which is
 * what keeps frame ordering deterministic. Lower numbers run first. Listeners
 * registered without a priority run last, in registration order.
 */
export class Events
{
    constructor()
    {
        this.listeners = new Map()
    }

    on(name, callback, priority = 1000)
    {
        if(!this.listeners.has(name))
            this.listeners.set(name, [])

        const list = this.listeners.get(name)
        list.push({ callback, priority })
        list.sort((a, b) => a.priority - b.priority)

        return () => this.off(name, callback)
    }

    off(name, callback)
    {
        const list = this.listeners.get(name)

        if(!list)
            return

        const index = list.findIndex(listener => listener.callback === callback)

        if(index !== -1)
            list.splice(index, 1)
    }

    trigger(name, args = [])
    {
        const list = this.listeners.get(name)

        if(!list)
            return

        // Iterate a copy so a listener may unsubscribe itself safely
        for(const listener of [ ...list ])
            listener.callback(...args)
    }
}
