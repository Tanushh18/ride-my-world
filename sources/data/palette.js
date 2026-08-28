/**
 * Every colour in the world comes from here.
 *
 * A shared palette is what makes a procedural world read as one place instead
 * of a pile of shapes. Nothing else in the project should hardcode a colour.
 */
export default {
    // Sky and atmosphere
    skyZenith: '#3aa8ff',
    skyHorizon: '#d6f4ff',
    fog: '#cfeeff',
    sun: '#fff4dd',

    // Shadows are a light, cool MULTIPLIER, not a colour to blend towards.
    // A saturated purple multiplied into grass green lands on grey; a pale
    // lavender darkens it while keeping the hue and shifting it cool.
    shadow: '#9a95d8',

    // Ground
    grassLight: '#a9d557',
    grassMid: '#84c247',
    grassDark: '#5fa63c',
    dirt: '#dda45f',
    dirtDark: '#b87c42',

    // Plants
    trunk: '#96603c',
    foliageLight: '#7ac94b',
    foliageMid: '#5eae3d',
    foliageDeep: '#3f8f34',
    blossom: '#ff8fb8',

    // Rock and built things
    rock: '#a8a49b',
    rockDark: '#8a857b',
    concrete: '#e6e9f0',
    wood: '#cf854f',
    metal: '#8f9bb3',

    // The car
    carPaint: '#ff5c3d',
    carPaintDark: '#e0432a',
    carDark: '#2c3149',
    carGlass: '#93dcff',
    tyre: '#24262f',
    rim: '#f4f6fa',

    // Accents for signage and interactive bits
    accent: '#ffc23d',
    accentWarm: '#ff7a3d',
    accentCool: '#41d6ff'
}
