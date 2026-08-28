import { Game } from './Game.js'

/**
 * Registry that keeps visual objects in sync with their rigid bodies.
 *
 * Runs at priority 4 — right after the physics step, before anything reads a
 * transform.
 */
export class Objects
{
    constructor()
    {
        this.game = Game.getInstance()
        this.items = []

        this.game.ticker.events.on('tick', () => { this.update() }, 4)
    }

    /**
     * @param {THREE.Object3D|null} visual  Synced to the body each frame
     * @param {object} physicalDescription  Passed to Physics.add()
     */
    add(visual, physicalDescription)
    {
        const physical = this.game.physics.add(physicalDescription)
        const object = { visual, physical }

        // Lets collision callbacks find their way back to the object
        physical.body.userData = { object }

        this.items.push(object)

        return object
    }

    resetAll()
    {
        for(const object of this.items)
        {
            if(object.physical.type !== 'dynamic')
                continue

            const { position, rotation } = object.physical.initialState
            object.physical.body.setTranslation(position, true)
            object.physical.body.setRotation(rotation, true)
            object.physical.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            object.physical.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }
    }

    update()
    {
        for(const object of this.items)
        {
            if(!object.visual)
                continue

            object.visual.position.copy(object.physical.body.translation())
            object.visual.quaternion.copy(object.physical.body.rotation())
        }
    }
}
