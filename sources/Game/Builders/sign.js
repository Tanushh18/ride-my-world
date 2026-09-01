import * as THREE from 'three/webgpu'

/**
 * A board with a name on it.
 *
 * The card carries the detail; this only has to answer "which one is that?"
 * from across the plaza, before the car is close enough for a card to appear.
 *
 * Text is drawn to a 2D canvas rather than built as geometry: an extruded font
 * would need a font file, which the "no shipped assets" rule rules out, and
 * would cost more triangles than the rest of the building.
 *
 * Where no canvas exists — a headless environment, or a browser refusing a 2D
 * context — this returns `texture: null` and the caller falls back to a plain
 * accent board. A sign is not worth failing a world over.
 *
 * @param {object} options
 * @param {string} options.text
 * @param {number} options.width   World units
 * @param {number} options.height  World units
 * @returns {{ geometry: THREE.PlaneGeometry, texture: THREE.CanvasTexture|null }}
 */
export const buildSign = ({ text, width, height }) =>
{
    const geometry = new THREE.PlaneGeometry(width, height)

    return { geometry, texture: makeTexture(text, width, height) }
}

const makeTexture = (text, width, height) =>
{
    if(typeof document === 'undefined')
        return null

    const pixelsPerUnit = 128
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelsPerUnit)
    canvas.height = Math.round(height * pixelsPerUnit)

    const context = canvas.getContext('2d')

    if(!context)
        return null

    // Transparent ground: the board behind it supplies the colour, so the sign
    // picks up the same shading and fog as everything else
    context.clearRect(0, 0, canvas.width, canvas.height)

    context.fillStyle = '#1d2233'
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    // Shrink to fit rather than wrap: a long project name on two lines at this
    // size is less readable than the same name slightly smaller on one
    let fontSize = canvas.height * 0.5
    const maxWidth = canvas.width * 0.88

    do
    {
        context.font = `700 ${fontSize}px system-ui, sans-serif`
        fontSize -= 2
    }
    while(context.measureText(text).width > maxWidth && fontSize > 8)

    context.fillText(text, canvas.width * 0.5, canvas.height * 0.54)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4

    return texture
}
