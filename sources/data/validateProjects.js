import palette from './palette.js'

const REQUIRED = [ 'id', 'title', 'role', 'year', 'description', 'tags', 'links', 'building' ]
const REQUIRED_BUILDING = [ 'floors', 'width', 'depth', 'roof', 'accent' ]
const ROOFS = [ 'flat', 'pitched', 'stepped' ]

/**
 * Fails loudly on malformed project data.
 *
 * This is authored content, not user input, so a missing field is a bug and the
 * right response is to stop rather than to render three buildings and leave the
 * fourth silently absent. The app's failure page catches the throw.
 *
 * @returns the same array, so it can be used inline at the point of import
 */
export const validateProjects = (projects) =>
{
    const seen = new Set()

    for(const project of projects)
    {
        const id = project.id ?? '(no id)'

        for(const field of REQUIRED)
            if(project[field] === undefined)
                throw new Error(`projects > "${id}" is missing "${field}"`)

        if(seen.has(project.id))
            throw new Error(`projects > duplicate id "${id}"`)

        seen.add(project.id)

        if(!Array.isArray(project.tags))
            throw new Error(`projects > "${id}" field "tags" must be an array`)

        if(!Array.isArray(project.links))
            throw new Error(`projects > "${id}" field "links" must be an array`)

        for(const link of project.links)
            if(!link.label || !link.url)
                throw new Error(`projects > "${id}" has a link missing "label" or "url"`)

        for(const field of REQUIRED_BUILDING)
            if(project.building[field] === undefined)
                throw new Error(`projects > "${id}" is missing "building.${field}"`)

        if(!ROOFS.includes(project.building.roof))
            throw new Error(`projects > "${id}" has roof "${project.building.roof}", expected one of ${ROOFS.join(', ')}`)

        // The builder's window banding and proportions are only sensible in this
        // range; outside it the result reads as a mistake rather than a choice
        if(project.building.floors < 2 || project.building.floors > 6)
            throw new Error(`projects > "${id}" has floors ${project.building.floors}, expected 2 to 6`)

        if(palette[project.building.accent] === undefined)
            throw new Error(`projects > "${id}" has accent "${project.building.accent}", which is not a palette key`)
    }

    return projects
}
