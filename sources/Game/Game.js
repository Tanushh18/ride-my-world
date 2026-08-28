import * as THREE from 'three/webgpu'

import { Debug } from './Debug.js'
import { Ticker } from './Ticker.js'
import { Viewport } from './Viewport.js'
import { Inputs } from './Inputs/Inputs.js'
import { Rendering } from './Rendering.js'
import { Physics } from './Physics/Physics.js'
import { PhysicsVehicle } from './Physics/PhysicsVehicle.js'
import { Objects } from './Objects.js'
import { Player } from './Player.js'
import { View } from './View.js'
import { Lighting } from './Lighting.js'
import { World } from './World/World.js'

/**
 * Singleton that owns every subsystem.
 *
 * Construction order is the dependency order; the render loop only starts once
 * everything exists, so no system can tick against a half-built world.
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

    async init()
    {
        this.domElement = document.querySelector('.js-game')
        this.canvasElement = this.domElement.querySelector('.js-canvas')

        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color('#a9e2ff')
        this.scene.fog = new THREE.Fog('#a9e2ff', 70, 220)

        // Core services
        this.debug = new Debug()
        await this.debug.init()

        this.ticker = new Ticker()
        this.viewport = new Viewport(this.domElement)
        this.inputs = new Inputs()

        this.rendering = new Rendering()
        await this.rendering.setRenderer()

        // Rapier ships as WASM, so it is imported dynamically and awaited
        this.RAPIER = await import('@dimforge/rapier3d')

        // Simulation
        this.physics = new Physics()
        this.objects = new Objects()
        this.physicsVehicle = new PhysicsVehicle()
        this.player = new Player()

        // Presentation
        this.view = new View()
        this.lighting = new Lighting()
        this.world = new World()

        document.documentElement.classList.add('is-ready')

        // Last, so the first tick sees a complete game
        this.rendering.start()

        return this
    }
}
