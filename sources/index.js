import './style/index.css'
import './style/tour.css'
import { Game } from './Game/Game.js'
import { ScrollTour } from './Game/ScrollTour.js'

// Handy in the console while developing.
const debugMode = window.location.hash.match(/debug/i)
const game = new Game()
if(debugMode)
    window.game = game

game.readyPromise.then(() =>
{
    // The original follow-camera remains available for debugging, but the
    // portfolio experience uses document scroll as the only camera driver.
    game.view.scrollTour = new ScrollTour(game)
    document.documentElement.classList.add('is-tour-ready')
}).catch((error) =>
{
    console.error(error)
    document.documentElement.classList.add('is-failed')
    const message = document.querySelector('.js-error-message')
    if(message)
        message.textContent = error?.message ?? String(error)
})
