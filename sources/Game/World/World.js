import { Game } from '../Game.js'
import { Floor } from './Floor.js'
import { Playground } from './Playground.js'
import { VisualVehicle } from './VisualVehicle.js'

/**
 * Owns everything visible in the scene.
 *
 * Built in one step for Phase 1; later phases split construction so the intro
 * can render before the heavy systems exist.
 */
export class World
{
    constructor()
    {
        this.game = Game.getInstance()

        this.floor = new Floor()
        this.visualVehicle = new VisualVehicle()
        this.playground = new Playground()
    }
}
