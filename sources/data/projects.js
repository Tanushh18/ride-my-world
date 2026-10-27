import { validateProjects } from './validateProjects.js'

/**
 * Resume-first featured projects for the 3D landmark plaza.
 * The HTML portfolio renders richer details from portfolio.js; this module
 * supplies the compact labels and hover-card content used by the 3D buildings.
 */
export default validateProjects([
    {
        id: 'ggnhome',
        title: 'GGN Home',
        role: 'AI real estate · Full stack',
        year: 'LIVE',
        description: 'A live, production full-stack real-estate platform for property listings, intelligent search, role-based dashboards, AI-based recommendations, and pricing analytics using EDA, regression, and clustering.',
        tags: [ 'React.js', 'Node.js', 'MongoDB', 'AI recommendations', 'Power BI' ],
        links: [
            { label: 'Live platform', url: 'https://www.ggnhome.com' }
        ],
        building: { floors: 5, width: 10, depth: 8, roof: 'stepped', accent: 'accent' }
    },
    {
        id: 'nids',
        title: 'NIDS',
        role: 'Cybersecurity · Machine learning',
        year: 'GITHUB',
        description: 'An end-to-end intrusion-detection system built with Python and Scikit-learn to classify normal network traffic and attacks including DoS, Probe, R2L, and U2R. Model inference is served through a Dockerised Flask app.',
        tags: [ 'Python', 'Scikit-learn', 'Flask', 'Docker', 'NSL-KDD' ],
        links: [
            { label: 'GitHub', url: 'https://github.com/Tanushh18/NIDS' }
        ],
        building: { floors: 4, width: 9, depth: 8, roof: 'flat', accent: 'accentWarm' }
    },
    {
        id: 'rag-intelligence-agent',
        title: 'RAG Research Agent',
        role: 'AI research · Retrieval workflows',
        year: 'GITHUB',
        description: 'An AI research agent combining large language models and vector-based semantic retrieval. Its document-ingestion, embedding, and retrieval pipeline is designed to produce context-aware answers with stronger factual grounding.',
        tags: [ 'Python', 'LangChain', 'Vector databases', 'LLMs' ],
        links: [
            { label: 'GitHub', url: 'https://github.com/Tanushh18/rag-intelligence-agent' }
        ],
        building: { floors: 5, width: 11, depth: 7, roof: 'stepped', accent: 'blossom' }
    },
    {
        id: 'stashr',
        title: 'Stashr',
        role: 'Encrypted vault · Web + Android',
        year: 'FEATURED',
        description: 'An encrypted password vault and project workspace for credentials, hosting details, environment variables, and project configurations.',
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
        description: 'A collaborative coding platform with synchronized editing, real-time audio/video, structured DSA learning resources, and a community layer.',
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
        description: 'A deal discovery platform that turns marketplace posts into a searchable catalogue with deduplication, price tracking, and notifications.',
        tags: [ 'Search', 'Telegram', 'Price tracking', 'Notifications' ],
        links: [
            { label: 'Live', url: 'https://dealradar.ggnhome.com' },
            { label: 'GitHub', url: 'https://github.com/Tanushh18/Deal_Radar' }
        ],
        building: { floors: 3, width: 10, depth: 6, roof: 'pitched', accent: 'accentWarm' }
    }
])
