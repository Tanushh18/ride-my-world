import { Events } from '../Events.js'
import { Keyboard } from './Keyboard.js'

/**
 * Aggregates every input device into one set of named actions.
 *
 * Continuous actions live in `actions` as 0..1 floats (so a gamepad trigger and
 * a key both fit). One-shot actions arrive as `press` events.
 */
export class Inputs
{
    constructor()
    {
        this.actions = {
            forward: 0,
            backward: 0,
            left: 0,
            right: 0,
            brake: 0,
            boost: 0
        }

        this.events = new Events()
        this.keyboard = new Keyboard(this)
    }
}
