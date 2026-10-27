import './style/index.css'
import { Game } from './Game/Game.js'

// Handy in the console while developing
if(window.location.hash.match(/debug/i))
    window.game = new Game()

const root = document.documentElement
const enterButton = document.querySelector('.js-enter-world')

enterButton?.addEventListener('click', () =>
{
    root.classList.add('is-entered')
})

/**
 * The on-screen controls emit the same key events as a physical keyboard, so
 * the existing input layer stays the single source of driving behaviour.
 */
const dispatchKey = (type, code) =>
{
    window.dispatchEvent(new KeyboardEvent(type, {
        code,
        bubbles: true,
        cancelable: true
    }))
}

document.querySelectorAll('[data-key]').forEach((control) =>
{
    let activePointer = null
    const code = control.dataset.key

    const press = (event) =>
    {
        event.preventDefault()

        if(activePointer !== null)
            return

        activePointer = event.pointerId
        control.setPointerCapture?.(event.pointerId)
        control.classList.add('is-active')
        dispatchKey('keydown', code)
    }

    const release = (event) =>
    {
        if(activePointer === null)
            return

        if(event?.pointerId !== undefined && event.pointerId !== activePointer)
            return

        event?.preventDefault()
        activePointer = null
        control.classList.remove('is-active')
        dispatchKey('keyup', code)
    }

    control.addEventListener('pointerdown', press)
    control.addEventListener('pointerup', release)
    control.addEventListener('pointercancel', release)
    control.addEventListener('lostpointercapture', release)
    window.addEventListener('blur', release)
})

document.querySelectorAll('[data-press]').forEach((control) =>
{
    const code = control.dataset.press

    control.addEventListener('pointerdown', (event) =>
    {
        event.preventDefault()
        control.classList.add('is-active')
        dispatchKey('keydown', code)
        dispatchKey('keyup', code)
    })

    control.addEventListener('pointerup', () => control.classList.remove('is-active'))
    control.addEventListener('pointercancel', () => control.classList.remove('is-active'))
})

const game = new Game()

game.readyPromise.catch((error) =>
{
    console.error(error)
    document.documentElement.classList.add('is-failed')
    const message = document.querySelector('.js-error-message')
    if(message)
        message.textContent = error?.message ?? String(error)
})
