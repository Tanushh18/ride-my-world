import './style/index.css'
import './style/tour.css'
import { Game } from './Game/Game.js'
import { ScrollTour } from './Game/ScrollTour.js'
import portfolio from './data/portfolio.js'

const root = document.documentElement
const debugMode = window.location.hash.match(/debug/i)
const game = new Game()

if(debugMode)
    window.game = game

/**
 * All resume-sensitive copy is hydrated from one data module. This keeps the
 * world layout independent from personal facts that will be added later.
 */
const readContent = (path) => path.split('.').reduce((value, key) => value?.[key], portfolio)

document.querySelectorAll('[data-content]').forEach((element) =>
{
    const value = readContent(element.dataset.content)
    if(typeof value === 'string')
        element.textContent = value
})

document.title = portfolio.title + ' — ' + portfolio.name

const brandTitle = document.querySelector('.brand-copy strong')
if(brandTitle)
    brandTitle.textContent = portfolio.title.toUpperCase()

const githubLink = document.querySelector('.masthead .github-link')
if(githubLink)
    githubLink.href = portfolio.contact.github

const skillGrid = document.querySelector('.js-skill-grid')
if(skillGrid)
{
    const cards = portfolio.skills.items.map((skill) =>
    {
        const card = document.createElement('article')
        card.className = 'skill-tile'

        const index = document.createElement('span')
        index.className = 'tile-index'
        index.textContent = skill.code

        const icon = document.createElement('span')
        icon.className = 'tile-icon'
        icon.setAttribute('aria-hidden', 'true')
        icon.textContent = skill.icon

        const title = document.createElement('h3')
        title.textContent = skill.title

        const description = document.createElement('p')
        description.textContent = skill.description

        const tags = document.createElement('div')
        tags.className = 'tile-tags'
        tags.replaceChildren(...skill.tags.map((tag) =>
        {
            const chip = document.createElement('span')
            chip.textContent = tag
            return chip
        }))

        card.append(index, icon, title, description, tags)
        return card
    })

    skillGrid.replaceChildren(...cards)
}

const learningPath = document.querySelector('.js-learning-path')
if(learningPath)
{
    const nodes = []
    portfolio.education.items.forEach((item, index) =>
    {
        if(index > 0)
        {
            const line = document.createElement('div')
            line.className = 'path-line'
            line.setAttribute('aria-hidden', 'true')
            nodes.push(line)
        }

        const node = document.createElement('div')
        node.className = 'path-node'

        const number = document.createElement('span')
        number.textContent = String(index + 1).padStart(2, '0')

        const body = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = item.title
        const description = document.createElement('p')
        description.textContent = item.description
        body.append(title, description)
        node.append(number, body)
        nodes.push(node)
    })

    learningPath.replaceChildren(...nodes)
}

game.readyPromise.then(() =>
{
    // Keep the original ramps/crates available in debug mode for physics tests,
    // but hide them during the portfolio tour so the road and city read cleanly.
    if(!debugMode && game.world.playground?.group)
        game.world.playground.group.visible = false

    // Scrolling is the camera's sole owner for the portfolio experience.
    game.view.scrollTour = new ScrollTour(game)
    root.classList.add('is-tour-ready')
}).catch((error) =>
{
    console.error(error)
    root.classList.add('is-failed')
    const message = document.querySelector('.js-error-message')
    if(message)
        message.textContent = error?.message ?? String(error)
})
