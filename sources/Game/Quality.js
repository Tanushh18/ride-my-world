/**
 * Chooses how much work the renderer is allowed to do.
 *
 * Two presets for now, picked from the user agent and overridable with
 * `#quality=low` or `#quality=high`. Phase 6 turns this into a runtime toggle
 * with automatic downgrading; today it exists because mobile GPUs and the
 * software rasterizer used in headless tests cannot afford the full grass field.
 */
const presets = {
    high: {
        grassSubdivisions: 300,
        grassSize: 58,
        shadowMapSize: 2048,
        sceneryScale: 1
    },
    low: {
        grassSubdivisions: 110,
        grassSize: 42,
        shadowMapSize: 1024,
        sceneryScale: 0.45
    }
}

export class Quality
{
    constructor()
    {
        const forced = window.location.hash.match(/quality=(low|high)/i)
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

        this.level = forced ? forced[1].toLowerCase() : (isMobile ? 'low' : 'high')

        Object.assign(this, presets[this.level])

        console.log(`Quality > ${this.level}`)
    }
}
