import './style/index.css'
import { Game } from './Game/Game.js'

const game = new Game()

// Handy in the console while developing
if(window.location.hash.match(/debug/i))
    window.game = game

game.readyPromise.catch((error) =>
{
    console.error(error)
    document.documentElement.classList.add('is-failed')
    const message = document.querySelector('.js-error-message')
    if(message)
        message.textContent = error?.message ?? String(error)
})
