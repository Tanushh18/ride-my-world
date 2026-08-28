import { Events } from './Events.js'

/**
 * Window size and pixel ratio.
 *
 * Emits `change` on every resize and `throttleChange` once the user stops
 * dragging, so expensive rebuilds (grass geometry, render targets) happen once.
 */
export class Viewport
{
    constructor(domElement)
    {
        this.domElement = domElement
        this.events = new Events()
        this.throttleDuration = 300
        this.throttleTimeout = null

        this.measure()

        window.addEventListener('resize', () =>
        {
            this.measure()
            this.events.trigger('change')

            clearTimeout(this.throttleTimeout)
            this.throttleTimeout = setTimeout(() =>
            {
                this.events.trigger('throttleChange')
            }, this.throttleDuration)
        })
    }

    measure()
    {
        this.width = this.domElement.offsetWidth
        this.height = this.domElement.offsetHeight
        this.ratio = this.width / this.height
        this.pixelRatio = Math.min(window.devicePixelRatio, 2)
    }
}
