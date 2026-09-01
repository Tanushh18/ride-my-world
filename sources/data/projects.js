import { validateProjects } from './validateProjects.js'

/**
 * The flagship projects, in the order they appear around the plaza.
 *
 * PLACEHOLDER CONTENT — the text below is scaffolding so the pipeline can be
 * built and seen. Replace `title`, `role`, `year`, `description`, `tags` and
 * `links` with the real thing; the `building` block is what gives each one its
 * shape, and is worth keeping varied.
 *
 * Adding a fifth project is one more object in this array. Nothing else needs
 * to change: the ring re-spaces itself and a zone is registered per entry.
 */
export default validateProjects([
    {
        id: 'wholesale-marketplace',
        title: 'Wholesale Marketplace',
        role: 'Senior Full Stack Engineer',
        year: '2024',
        description: 'A B2B marketplace connecting wholesale suppliers with retail buyers. Rebuilt the catalogue and search layer, cutting median result time from seconds to milliseconds across millions of listings.',
        tags: [ 'React', 'Node.js', 'PostgreSQL', 'Elasticsearch' ],
        links: [ { label: 'Live', url: 'https://example.com' } ],
        building: { floors: 6, width: 9, depth: 7, roof: 'stepped', accent: 'accent' }
    },
    {
        id: 'inventory-sync',
        title: 'Inventory Sync Engine',
        role: 'Lead Engineer',
        year: '2023',
        description: 'A synchronisation service keeping stock levels consistent across half a dozen sales channels. Event-driven, idempotent, and designed so a channel going offline never corrupts the others.',
        tags: [ 'TypeScript', 'Redis', 'Queues', 'Docker' ],
        links: [ { label: 'Case study', url: 'https://example.com' } ],
        building: { floors: 4, width: 8, depth: 8, roof: 'flat', accent: 'accentCool' }
    },
    {
        id: 'analytics-dashboard',
        title: 'Seller Analytics',
        role: 'Full Stack Engineer',
        year: '2023',
        description: 'A dashboard giving sellers their traffic, conversion and revenue in one place. The hard part was making a year of per-hour data feel instant on a laptop.',
        tags: [ 'Vue', 'ClickHouse', 'D3' ],
        links: [ { label: 'Live', url: 'https://example.com' } ],
        building: { floors: 3, width: 10, depth: 6, roof: 'pitched', accent: 'accentWarm' }
    },
    {
        id: 'design-system',
        title: 'Component Library',
        role: 'Maintainer',
        year: '2022',
        description: 'The shared component library behind four internal products. Accessible by default, themed from one token file, and documented well enough that teams stopped rebuilding buttons.',
        tags: [ 'React', 'Storybook', 'a11y' ],
        links: [ { label: 'Docs', url: 'https://example.com' }, { label: 'GitHub', url: 'https://example.com' } ],
        building: { floors: 2, width: 11, depth: 7, roof: 'pitched', accent: 'blossom' }
    }
])
