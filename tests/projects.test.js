import { describe, expect, it } from 'vitest'
import palette from '../sources/data/palette.js'
import projects from '../sources/data/projects.js'
import world from '../sources/data/world.js'
import { validateProjects } from '../sources/data/validateProjects.js'

describe('world data', () =>
{
    it('puts the plaza where it is visible through the fog but not on top of spawn', () =>
    {
        const { center } = world.projectsArea
        const distance = Math.hypot(center.x, center.z)

        expect(distance).toBeGreaterThan(60)
        expect(distance).toBeLessThan(140)
    })

    it('faces the entrance back towards spawn', () =>
    {
        const { center, entranceFacing } = world.projectsArea
        const bearingToSpawn = Math.atan2(-center.z, -center.x)

        expect(Math.cos(entranceFacing - bearingToSpawn)).toBeCloseTo(1, 3)
    })

    it('reserves a clearing wide enough for the whole ring', () =>
    {
        const { ringRadius, clearingRadius } = world.projectsArea
        expect(clearingRadius).toBeGreaterThan(ringRadius)
    })
})

describe('projects data', () =>
{
    it('ships four projects', () =>
    {
        expect(projects).toHaveLength(4)
    })

    it('gives every project a unique id', () =>
    {
        const ids = projects.map(project => project.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('passes its own validator', () =>
    {
        expect(() => validateProjects(projects)).not.toThrow()
    })

    it('only uses accent colours that exist in the palette', () =>
    {
        for(const project of projects)
            expect(palette[project.building.accent]).toBeDefined()
    })
})

describe('validateProjects', () =>
{
    const valid = () => ([ {
        id: 'a',
        title: 'A',
        role: 'Engineer',
        year: '2024',
        description: 'Does a thing.',
        tags: [ 'JS' ],
        links: [ { label: 'Live', url: 'https://example.com' } ],
        building: { floors: 3, width: 7, depth: 6, roof: 'flat', accent: 'accent' }
    } ])

    it('names the id and the field when something is missing', () =>
    {
        const broken = valid()
        delete broken[0].title

        expect(() => validateProjects(broken)).toThrow(/"a".*title/)
    })

    it('rejects a roof it cannot build', () =>
    {
        const broken = valid()
        broken[0].building.roof = 'dome'

        expect(() => validateProjects(broken)).toThrow(/roof/)
    })

    it('rejects a floor count outside the range the builder handles', () =>
    {
        const broken = valid()
        broken[0].building.floors = 12

        expect(() => validateProjects(broken)).toThrow(/floors/)
    })

    it('rejects an accent that is not a palette key', () =>
    {
        const broken = valid()
        broken[0].building.accent = 'chartreuse'

        expect(() => validateProjects(broken)).toThrow(/accent/)
    })

    it('rejects duplicate ids', () =>
    {
        const broken = [ ...valid(), ...valid() ]

        expect(() => validateProjects(broken)).toThrow(/duplicate/)
    })

    it('returns the array it was given so it can be used inline', () =>
    {
        const list = valid()
        expect(validateProjects(list)).toBe(list)
    })
})
