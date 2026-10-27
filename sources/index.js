import './style/index.css'
import './style/tour.css'
import './style/system.css'
import { Game } from './Game/Game.js'
import { ScrollTour } from './Game/ScrollTour.js'
import portfolio from './data/portfolio.js'

const root = document.documentElement
root.classList.add('js')

const loader = document.querySelector('#portfolio-loader')
const loaderTitle = document.querySelector('[data-loader-title]')
const loaderNote = document.querySelector('[data-loader-note]')
const loaderPercent = document.querySelector('[data-loader-percent]')
const loaderBar = document.querySelector('[data-loader-bar]')
const loaderStart = document.querySelector('[data-loader-start]')
const loaderHint = document.querySelector('[data-loader-hint]')
root.classList.add('is-loading')

// Progress is eased on screen so the bar glides between real loading steps
// instead of jumping, and never moves backwards.
const loaderState = { target: 4, shown: 0, frame: 0, last: performance.now() }
const paintLoader = () =>
{
    loaderState.frame = 0
    const now = performance.now()
    const dt = Math.min(1, (now - loaderState.last) / 1000)
    loaderState.last = now
    // Time-based easing: smooth at 60fps, and still catches up after a long frame
    loaderState.shown += (loaderState.target - loaderState.shown) * (1 - Math.exp(-dt * 7))
    if(loaderState.target - loaderState.shown < 0.2)
        loaderState.shown = loaderState.target
    const value = Math.round(loaderState.shown)
    if(loader)
        loader.style.setProperty('--loader-progress', loaderState.shown.toFixed(2) + '%')
    if(loaderPercent)
        loaderPercent.textContent = value + '%'
    loaderBar?.setAttribute('aria-valuenow', String(value))
    if(loaderState.shown < loaderState.target)
        loaderState.frame = window.requestAnimationFrame(paintLoader)
}
const setLoaderTarget = (value) =>
{
    loaderState.target = Math.max(loaderState.target, Math.min(100, value))
    if(!loaderState.frame)
        loaderState.frame = window.requestAnimationFrame(paintLoader)
}

document.addEventListener('portfolio:loading', (event) =>
{
    const { title, note, stage, progress } = event.detail ?? {}
    const stageProgress = { boot: 6, renderer: 22, physics: 38, world: 58, life: 70, ready: 100 }
    if(loaderTitle && title)
        loaderTitle.textContent = title
    if(loaderNote && note)
        loaderNote.textContent = note
    if(loader)
        loader.dataset.stage = stage ?? 'boot'
    setLoaderTarget(progress ?? stageProgress[stage] ?? 8)
})
paintLoader()

const debugMode = window.location.hash.match(/debug/i)
const game = new Game()

if(debugMode)
    window.game = game

const THREEClamp = (value, min, max) => Math.min(max, Math.max(min, value))

const element = (tag, className = '', text = '') =>
{
    const node = document.createElement(tag)
    if(className)
        node.className = className
    if(text !== undefined && text !== null && text !== '')
        node.textContent = text
    return node
}

const link = (label, url, className = '') =>
{
    const node = element('a', className, label)
    node.href = url
    if(/^https?:/.test(url))
    {
        node.target = '_blank'
        node.rel = 'noopener noreferrer'
    }
    return node
}

const addText = (parent, tag, className, value) =>
{
    const node = element(tag, className, value)
    parent.append(node)
    return node
}

const appendTags = (parent, tags, className = 'tile-tags') =>
{
    const list = element('div', className)
    list.replaceChildren(...tags.map(tag => element('span', '', tag)))
    parent.append(list)
    return list
}

document.title = portfolio.title + ' — ' + portfolio.name

const brandTitle = document.querySelector('.brand-copy strong')
if(brandTitle)
    brandTitle.textContent = portfolio.name.toUpperCase()

const brandSubline = document.querySelector('.brand-copy small')
if(brandSubline)
    brandSubline.textContent = portfolio.roleLine

const roleLine = document.querySelector('.js-role-line')
if(roleLine)
    roleLine.textContent = portfolio.roleLine

const heroCopy = document.querySelector('.js-hero-copy')
if(heroCopy)
    heroCopy.textContent = portfolio.about.lede + ' ' + portfolio.about.description

const heroMeta = document.querySelector('.js-hero-meta')
if(heroMeta)
{
    const first = heroMeta.querySelector('span')
    if(first)
        first.textContent = portfolio.location.toUpperCase()
}

const githubLink = document.querySelector('.js-github-link')
if(githubLink)
    githubLink.href = portfolio.links.github

const resumeLink = document.querySelector('.js-resume-link')
if(resumeLink)
    resumeLink.href = portfolio.resumeUrl

const aboutLede = document.querySelector('.js-about-lede')
if(aboutLede)
    aboutLede.textContent = portfolio.about.lede

const aboutDescription = document.querySelector('.js-about-description')
if(aboutDescription)
    aboutDescription.textContent = portfolio.about.description

const aboutNote = document.querySelector('.js-about-note')
if(aboutNote)
    aboutNote.textContent = portfolio.about.note

const profileLinks = document.querySelector('.js-profile-links')
if(profileLinks)
{
    profileLinks.replaceChildren(
        link('LinkedIn ↗', portfolio.links.linkedin),
        link('GitHub ↗', portfolio.links.github),
        link('LeetCode ↗', portfolio.links.leetcode)
    )
}

const skillsLede = document.querySelector('.js-skills-lede')
if(skillsLede)
    skillsLede.textContent = portfolio.skills.lede

const skillGrid = document.querySelector('.js-skill-grid')
if(skillGrid)
{
    const cards = portfolio.skills.items.map((skill) =>
    {
        const card = element('article', 'skill-tile')
        addText(card, 'span', 'tile-index', skill.code)
        const icon = addText(card, 'span', 'tile-icon', skill.icon)
        icon.setAttribute('aria-hidden', 'true')
        addText(card, 'h3', '', skill.title)
        addText(card, 'p', '', skill.description)
        appendTags(card, skill.tags)
        return card
    })
    skillGrid.replaceChildren(...cards)
}

const experienceList = document.querySelector('.js-experience-list')
if(experienceList)
{
    const entries = portfolio.experience.map((experience, index) =>
    {
        const card = element('article', 'experience-entry')
        const rail = element('div', 'experience-rail')
        const dot = element('span', 'experience-dot')
        dot.setAttribute('aria-hidden', 'true')
        rail.append(dot)

        const body = element('div', 'experience-body')
        const meta = element('div', 'experience-meta')
        meta.append(
            element('span', 'experience-kind', experience.kind),
            element('span', 'experience-dates', experience.dates)
        )
        body.append(meta)
        addText(body, 'h3', '', experience.title)
        addText(body, 'p', 'experience-company', experience.company)
        if(experience.location)
            addText(body, 'p', 'experience-location', experience.location)

        const bullets = element('ul', 'experience-bullets')
        bullets.replaceChildren(...experience.bullets.map(text => element('li', '', text)))
        body.append(bullets)

        const serial = element('span', 'experience-serial', String(index + 1).padStart(2, '0'))
        card.append(serial, rail, body)
        return card
    })
    experienceList.replaceChildren(...entries)
}

const projectGrid = document.querySelector('.js-project-grid')
if(projectGrid)
{
    const cards = portfolio.projects.map((project) =>
    {
        const card = element('article', 'project-card project-card--' + project.accent)
        const topline = element('div', 'project-topline')
        topline.append(
            element('span', 'project-number', project.number + ' / 06'),
            element('span', 'project-category', project.category)
        )
        card.append(topline)

        const glyph = element('div', 'project-glyph', project.id === 'ggnhome' ? 'GGN' :
            project.id === 'nids' ? 'NIDS' :
            project.id === 'rag' ? 'RAG' :
            project.id === 'stashr' ? '⌑' :
            project.id === 'wecode' ? '{ }' : '◎')
        glyph.setAttribute('aria-hidden', 'true')
        card.append(glyph)

        addText(card, 'h3', '', project.title)
        addText(card, 'p', 'project-subtitle', project.subtitle)
        addText(card, 'p', 'project-description', project.description)

        if(project.details?.length)
        {
            const details = element('ul', 'project-details')
            details.replaceChildren(...project.details.map(text => element('li', '', text)))
            card.append(details)
        }

        appendTags(card, project.tags, 'project-tags')

        const actions = element('div', 'project-actions')
        project.links.forEach((item) =>
        {
            actions.append(link(item.label + ' ↗', item.url, item.primary ? 'project-action-primary' : 'project-action'))
        })
        card.append(actions)

        // A restrained, pointer-aware tilt gives the project tiles a tactile
        // glass-card feel on desktop without moving the scroll-driven camera.
        if(window.matchMedia('(pointer: fine) and (hover: hover)').matches)
        {
            card.addEventListener('pointermove', (event) =>
            {
                const rect = card.getBoundingClientRect()
                const x = THREEClamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1)
                const y = THREEClamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1)
                card.style.setProperty('--tilt-x', ((0.5 - y) * 3.8).toFixed(2) + 'deg')
                card.style.setProperty('--tilt-y', ((x - 0.5) * 5.8).toFixed(2) + 'deg')
                card.style.setProperty('--shine-x', (x * 100).toFixed(1) + '%')
                card.style.setProperty('--shine-y', (y * 100).toFixed(1) + '%')
            })

            card.addEventListener('pointerleave', () =>
            {
                card.style.setProperty('--tilt-x', '0deg')
                card.style.setProperty('--tilt-y', '0deg')
                card.style.setProperty('--shine-x', '50%')
                card.style.setProperty('--shine-y', '20%')
            })
        }

        return card
    })
    projectGrid.replaceChildren(...cards)
}

const educationList = document.querySelector('.js-education-list')
if(educationList)
{
    const entries = portfolio.education.map((education, index) =>
    {
        const card = element('article', 'education-entry')
        const indexTag = element('span', 'education-index', String(index + 1).padStart(2, '0'))
        const body = element('div', 'education-body')
        const heading = element('div', 'education-heading')
        addText(heading, 'h3', '', education.title)
        addText(heading, 'span', 'education-result', education.result)
        body.append(heading)
        if(education.subject)
            addText(body, 'p', 'education-subject', education.subject)
        addText(body, 'p', 'education-institution', education.institution)
        if(education.location)
            addText(body, 'p', 'education-location', education.location)
        if(education.details)
            addText(body, 'p', 'education-details', education.details)
        card.append(indexTag, body)
        return card
    })
    educationList.replaceChildren(...entries)
}

const certificationList = document.querySelector('.js-certification-list')
if(certificationList)
{
    const entries = portfolio.certifications.map((certification, index) =>
    {
        const card = element('article', 'certification-entry')
        const serial = element('span', 'certification-index', String(index + 1).padStart(2, '0'))
        const body = element('div', 'certification-body')
        addText(body, 'h3', '', certification.title)
        addText(body, 'p', 'certification-issuer', certification.issuer)
        if(certification.date)
            addText(body, 'span', 'certification-date', certification.date)
        card.append(serial, body)
        if(certification.url)
            card.append(link('View credential ↗', certification.url, 'certification-link'))
        return card
    })
    certificationList.replaceChildren(...entries)
}

const achievementGrid = document.querySelector('.js-achievement-grid')
if(achievementGrid)
{
    const entries = portfolio.achievements.map((achievement, index) =>
    {
        const card = element('article', 'achievement-card')
        addText(card, 'span', 'achievement-index', String(index + 1).padStart(2, '0'))
        addText(card, 'strong', 'achievement-value', achievement.value)
        addText(card, 'h3', '', achievement.title)
        addText(card, 'p', '', achievement.description)
        if(achievement.url)
            card.append(link('Explore GGN Home ↗', achievement.url, 'achievement-link'))
        return card
    })
    achievementGrid.replaceChildren(...entries)
}

const contactCard = document.querySelector('.js-contact-card')
if(contactCard)
{
    const rows = [
        { label: 'EMAIL', value: portfolio.contact.email, href: 'mailto:' + portfolio.contact.email },
        { label: 'PHONE', value: portfolio.contact.phone, href: 'tel:' + portfolio.contact.phone.replace(/[^\d+]/g, '') },
        { label: 'LOCATION', value: portfolio.contact.location }
    ]

    contactCard.replaceChildren(...rows.map((row) =>
    {
        const item = element('div', 'contact-detail')
        addText(item, 'span', 'contact-detail-label', row.label)
        const value = row.href ? link(row.value, row.href) : element('span', 'contact-detail-value', row.value)
        if(row.href)
            value.classList.add('contact-detail-value')
        item.append(value)
        return item
    }))
}

const contactActions = document.querySelector('.js-contact-actions')
if(contactActions)
{
    contactActions.replaceChildren(
        link('LinkedIn ↗', portfolio.links.linkedin, 'secondary-action'),
        link('GitHub ↗', portfolio.links.github, 'secondary-action'),
        link('LeetCode ↗', portfolio.links.leetcode, 'secondary-action'),
        link('View resume ↗', portfolio.resumeUrl, 'primary-action')
    )
}

game.readyPromise.then(() =>
{
    // Keep the original ramps/crates available in debug mode for physics tests,
    // but hide them during the portfolio tour so the road and city read cleanly.
    if(!debugMode && game.world.playground?.group)
        game.world.playground.group.visible = false

    // ScrollTour synchronizes the scooter, camera and lighting with one road curve.
    game.view.scrollTour = new ScrollTour(game)
    root.classList.add('is-tour-ready')
    root.classList.remove('is-loading')

    const dismissLoader = () =>
    {
        root.classList.remove('is-awaiting-start')
        if(loader)
        {
            loader.setAttribute('aria-hidden', 'true')
            loader.classList.add('is-loader-finished')
        }
    }

    // Real visitors get a Start gate (a calm moment before the ride begins).
    // Automated browsers skip it unless `#gate` is in the URL.
    const skipGate = (navigator.webdriver && !/gate/i.test(window.location.hash)) || !loaderStart
    if(skipGate)
    {
        dismissLoader()
        return
    }

    root.classList.add('is-awaiting-start')
    if(loaderTitle)
        loaderTitle.textContent = 'The road is yours'
    if(loaderNote)
        loaderNote.textContent = 'Everything is loaded. Press start when you are ready.'
    loaderStart.hidden = false
    if(loaderHint)
        loaderHint.hidden = false
    loaderStart.focus({ preventScroll: true })
    loaderStart.addEventListener('click', dismissLoader, { once: true })
}).catch((error) =>
{
    console.error(error)
    root.classList.add('is-failed')
    const message = document.querySelector('.js-error-message')
    if(message)
        message.textContent = error?.message ?? String(error)
})
