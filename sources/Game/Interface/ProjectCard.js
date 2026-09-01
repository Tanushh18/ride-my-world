import { Game } from '../Game.js'

/**
 * The panel that names the project the car is next to.
 *
 * The world stays 3D and the words stay in the DOM. Body text baked into a
 * texture is unreadable at driving distance and impossible to tap on a phone,
 * and a link has to be a real link.
 *
 * It holds no proximity logic of its own: it only reacts to a decision `Zones`
 * already made this frame at priority 8, so it can never disagree with the
 * world about where the car is.
 */
export class ProjectCard
{
    constructor()
    {
        this.game = Game.getInstance()

        this.element = document.querySelector('.js-card')
        this.yearElement = this.element.querySelector('.js-card-year')
        this.roleElement = this.element.querySelector('.js-card-role')
        this.titleElement = this.element.querySelector('.js-card-title')
        this.descriptionElement = this.element.querySelector('.js-card-description')
        this.tagsElement = this.element.querySelector('.js-card-tags')
        this.linksElement = this.element.querySelector('.js-card-links')

        this.game.zones.events.on('enter', (zone) => { this.show(zone.data) })
        this.game.zones.events.on('leave', () => { this.hide() })
    }

    show(project)
    {
        this.yearElement.textContent = project.year
        this.roleElement.textContent = project.role
        this.titleElement.textContent = project.title
        this.descriptionElement.textContent = project.description

        this.tagsElement.replaceChildren(...project.tags.map((tag) =>
        {
            const item = document.createElement('li')
            item.textContent = tag
            return item
        }))

        this.linksElement.replaceChildren(...project.links.map((link) =>
        {
            const anchor = document.createElement('a')
            anchor.textContent = link.label
            anchor.href = link.url
            anchor.target = '_blank'
            anchor.rel = 'noopener noreferrer'
            return anchor
        }))

        this.element.classList.add('is-visible')
    }

    hide()
    {
        // Content is left in place: it fades out, and clearing it mid-transition
        // would empty the card before the visitor's eye had left it
        this.element.classList.remove('is-visible')
    }
}
