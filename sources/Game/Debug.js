/**
 * Tweakpane panel, only built when the URL contains `#debug`.
 *
 * Tweakpane is imported dynamically so it never reaches a visitor's bundle.
 */
export class Debug
{
    constructor()
    {
        this.active = window.location.hash.match(/debug/i) !== null
        this.panel = null
    }

    async init()
    {
        if(!this.active)
            return

        const { Pane } = await import('tweakpane')

        this.pane = new Pane({ title: 'Debug' })
        this.panel = this.pane
        this.pane.element.parentElement.style.zIndex = 100
    }

    /** Add a folder, or return a no-op stand-in when debug is off. */
    addFolder(options)
    {
        if(!this.active || !this.panel)
            return null

        return this.panel.addFolder({ expanded: false, ...options })
    }
}
