/**
 * Maps physical keys onto named actions.
 *
 * Nothing outside this file knows a key code, which is what lets touch and
 * gamepad input drop in later without touching the Player.
 */
const bindings = {
    forward:  [ 'ArrowUp', 'KeyW' ],
    backward: [ 'ArrowDown', 'KeyS' ],
    left:     [ 'ArrowLeft', 'KeyA' ],
    right:    [ 'ArrowRight', 'KeyD' ],
    brake:    [ 'ControlLeft', 'KeyB' ],
    boost:    [ 'ShiftLeft', 'ShiftRight' ]
}

const pressBindings = {
    respawn: [ 'KeyR' ],
    reset:   [ 'KeyP' ]
}

export class Keyboard
{
    constructor(inputs)
    {
        this.inputs = inputs

        window.addEventListener('keydown', (event) => { this.onKey(event, true) })
        window.addEventListener('keyup', (event) => { this.onKey(event, false) })

        // Releasing everything on blur avoids a key staying stuck down when the
        // user alt-tabs mid-corner.
        window.addEventListener('blur', () =>
        {
            for(const action in bindings)
                this.inputs.actions[action] = 0
        })
    }

    onKey(event, down)
    {
        if(event.repeat)
            return

        for(const action in bindings)
        {
            if(bindings[action].includes(event.code))
            {
                this.inputs.actions[action] = down ? 1 : 0
                event.preventDefault()
            }
        }

        if(!down)
            return

        for(const action in pressBindings)
        {
            if(pressBindings[action].includes(event.code))
                this.inputs.events.trigger('press', [ action ])
        }
    }
}
