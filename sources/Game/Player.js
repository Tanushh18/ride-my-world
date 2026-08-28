import { Game } from './Game.js'
import { damp } from './utilities/maths.js'

/**
 * Turns named input actions into vehicle intent.
 *
 * Keeping this separate from PhysicsVehicle means steering feel can be tuned
 * without touching the simulation, and an AI or replay could drive the same
 * vehicle by writing the same four values.
 */
export class Player
{
    constructor()
    {
        this.game = Game.getInstance()

        this.accelerating = 0
        this.steering = 0
        this.braking = 0
        this.boosting = 0

        // A key is binary; steering should not be. Damping towards the target
        // is what makes keyboard driving feel analogue.
        this.steeringSmoothing = 0.0001

        this.distanceDriven = 0

        this.game.ticker.events.on('tick', () => { this.updatePrePhysics() }, 1)
        this.game.ticker.events.on('tick', () => { this.updatePostPhysics() }, 6)

        this.game.inputs.events.on('press', (action) =>
        {
            if(action === 'respawn')
                this.respawn()
            else if(action === 'reset')
                this.game.objects.resetAll()
        })
    }

    updatePrePhysics()
    {
        const actions = this.game.inputs.actions

        this.accelerating = actions.forward - actions.backward
        this.braking = actions.brake
        this.boosting = actions.boost

        const steeringTarget = actions.left - actions.right
        this.steering = damp(this.steering, steeringTarget, this.steeringSmoothing, this.game.ticker.delta)
    }

    updatePostPhysics()
    {
        const vehicle = this.game.physicsVehicle

        this.distanceDriven += vehicle.velocity.length()

        // Falling out of the world, or landing on the roof with no way back
        if(vehicle.position.y < -20)
            this.respawn()
    }

    respawn()
    {
        this.game.physicsVehicle.moveTo({ x: 0, y: 3, z: 0 }, 0)
    }
}
