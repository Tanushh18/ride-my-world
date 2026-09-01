import { Game } from '../Game.js'
import { Grass } from './Grass.js'
import { Ground } from './Ground.js'
import { Playground } from './Playground.js'
import { Scenery } from './Scenery.js'
import { Sky } from './Sky.js'
import { VisualVehicle } from './VisualVehicle.js'
import { ProjectsArea } from './Areas/ProjectsArea.js'

/**
 * Owns everything visible in the scene.
 *
 * Order matters only in that the ground should exist before things are placed
 * on it; the rest is independent.
 */
export class World
{
    constructor()
    {
        this.game = Game.getInstance()

        this.sky = new Sky()
        this.ground = new Ground()
        this.grass = new Grass()
        this.visualVehicle = new VisualVehicle()
        this.scenery = new Scenery()
        this.playground = new Playground()
        this.projectsArea = new ProjectsArea()
    }
}
