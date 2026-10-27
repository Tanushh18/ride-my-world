import * as THREE from 'three/webgpu'

import { Debug } from './Debug.js'
import { Ticker } from './Ticker.js'
import { Viewport } from './Viewport.js'
import { Quality } from './Quality.js'
import { Inputs } from './Inputs/Inputs.js'
import { Rendering } from './Rendering.js'
import { Physics } from './Physics/Physics.js'
import { PhysicsVehicle } from './Physics/PhysicsVehicle.js'
import { Objects } from './Objects.js'
import { Player } from './Player.js'
import { Zones } from './Zones.js'
import { View } from './View.js'
import { Fog } from './Fog.js'
import { Lighting } from './Lighting.js'
import { Materials } from './Materials.js'
import { World } from './World/World.js'
import { ProjectCard } from './Interface/ProjectCard.js'
import palette from '../data/palette.js'

/**
 * Singleton that owns every subsystem.
 *
 * Construction order below is the dependency order, and it is load-bearing:
 * materials read the lighting and fog uniforms while building their shader
 * graphs, so those two must exist first. The render loop starts last, so no
 * system can ever tick against a half-built world.
 */
export class Game
{
    static instance = null

    static getInstance()
    {
        return Game.instance
    }

    constructor()
    {
        if(Game.instance)
            return Game.instance

        Game.instance = this

        this.readyPromise = this.init()
    }

    setLoadingStage(stage, title, note)
    {
        document.dispatchEvent(new CustomEvent('portfolio:loading', {
            detail: { stage, title, note }
        }))
    }

    async init()
    {
        this.setLoadingStage('boot', 'Warming up the engine', 'Starting the renderer and preparing the scene…')
        this.domElement = document.querySelector('.js-game')
        this.canvasElement = this.domElement.querySelector('.js-canvas')

        this.scene = new THREE.Scene()

        // Only ever seen for a frame — the sky dome covers the view. `scene.fog`
        // is deliberately left unset: the stylised materials apply their own,
        // and three would otherwise apply it a second time.
        this.scene.background = new THREE.Color(palette.skyHorizon)

        // Core services
        this.debug = new Debug()
        await this.debug.init()

        this.ticker = new Ticker()
        this.quality = new Quality()
        this.viewport = new Viewport(this.domElement)
        this.inputs = new Inputs()

        this.rendering = new Rendering()
        await this.rendering.setRenderer()
        this.setLoadingStage('renderer', 'Painting the world', 'WebGL renderer ready · shaping the light…')

        // Rapier ships as WASM, so it is imported dynamically and awaited
        this.RAPIER = await import('@dimforge/rapier3d')
        this.setLoadingStage('physics', 'Tuning the ride', 'Preparing the road physics and rider…')

        // Simulation
        this.physics = new Physics()
        this.objects = new Objects()
        this.physicsVehicle = new PhysicsVehicle()
        this.player = new Player()
        this.zones = new Zones()

        // Presentation
        this.view = new View()
        this.fog = new Fog()
        this.lighting = new Lighting()
        this.materials = new Materials()
        this.setLoadingStage('world', 'Building the city', 'Trees, river, waterfall and skyline are coming into view…')
        this.world = new World()

        // After the world, because the zones it reacts to are registered there
        this.projectCard = new ProjectCard()

        this.rendering.setPostProcessing()
        this.setLoadingStage('ready', 'The road is yours', 'Almost there · your journey is ready.')

        // Switch to banner-first mode only after the 3D world is fully ready.
        // If initialisation fails, semantic HTML chapters remain visible as fallback.
        document.documentElement.classList.add('is-ready', 'is-tour-ready')

        // Last, so the first tick sees a complete game
        this.rendering.start()

        return this
    }
}
