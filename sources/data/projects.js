import { validateProjects } from './validateProjects.js'

/**
 * Featured projects from Tanushh18's public GitHub portfolio.
 *
 * The plaza re-spaces itself from this list. Replace descriptions or links here
 * as projects evolve; no scene layout code needs to change.
 */
export default validateProjects([
    {
        id: 'stashr',
        title: 'Stashr',
        role: 'Encrypted vault · Web + Android',
        year: 'FEATURED',
        description: 'An encrypted password vault and project workspace for storing credentials, hosting details, environment variables, and project configurations. Includes cross-platform sync and security tools.',
        tags: [ 'Node.js', 'Web + Android', 'AES-256-GCM', 'TOTP' ],
        links: [
            { label: 'GitHub', url: 'https://github.com/Tanushh18/password-manager' }
        ],
        building: { floors: 6, width: 9, depth: 7, roof: 'stepped', accent: 'accent' }
    },
    {
        id: 'wecode',
        title: 'WeCode',
        role: 'Real-time collaborative coding',
        year: 'FEATURED',
        description: 'A collaborative coding platform with a synchronized editor, live video and audio, structured DSA learning resources, and a community layer.',
        tags: [ 'MERN', 'Socket.IO', 'WebRTC', 'Monaco Editor' ],
        links: [
            { label: 'Live', url: 'https://wecode-2.onrender.com' },
            { label: 'GitHub', url: 'https://github.com/Tanushh18/WeCode' }
        ],
        building: { floors: 4, width: 8, depth: 8, roof: 'flat', accent: 'accentCool' }
    },
    {
        id: 'deal-radar',
        title: 'DealRadar',
        role: 'Deal discovery · Web + Android',
        year: 'FEATURED',
        description: 'A deal discovery platform that turns Telegram marketplace posts into a searchable catalog, with deduplication, price tracking, and notifications for useful finds.',
        tags: [ 'Search', 'Telegram', 'Price tracking', 'Notifications' ],
        links: [
            { label: 'Live', url: 'https://dealradar.ggnhome.com' },
            { label: 'GitHub', url: 'https://github.com/Tanushh18/Deal_Radar' }
        ],
        building: { floors: 3, width: 10, depth: 6, roof: 'pitched', accent: 'accentWarm' }
    },
    {
        id: 'rag-intelligence-agent',
        title: 'RAG Intelligence Agent',
        role: 'AI research · Retrieval workflows',
        year: 'FEATURED',
        description: 'A LangGraph-based retrieval-augmented generation foundation for document indexing, context-aware retrieval, multi-step research, and configurable model and vector-store backends.',
        tags: [ 'LangGraph', 'RAG', 'Vector stores', 'LLMs' ],
        links: [
            { label: 'GitHub', url: 'https://github.com/Tanushh18/rag-intelligence-agent' }
        ],
        building: { floors: 5, width: 11, depth: 7, roof: 'stepped', accent: 'blossom' }
    }
])
