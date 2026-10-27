/**
 * Resume-verified professional information for Tanush Chawla.
 * Scene and layout code stays separate from this data so future edits are easy.
 */
export default {
    name: 'Tanush Chawla',
    handle: 'Tanushh18',
    title: 'Tanush Portfolio',
    roleLine: 'AI/ML · DATA ANALYTICS · BACKEND ENGINEERING',
    location: 'Gurugram, India',
    phone: '+91-8130483894',
    email: 'tanushchawla16@gmail.com',
    resumeUrl: 'https://github.com/Tanushh18/Resume/blob/main/Tanush_Chawla.pdf?raw=1',
    links: {
        github: 'https://github.com/Tanushh18',
        linkedin: 'https://www.linkedin.com/in/tanush-chawla-57478728a/',
        leetcode: 'https://leetcode.com/u/tanushchawla16/'
    },
    about: {
        headline: 'AI. Data. Backend systems.',
        lede: 'AI/ML and data analytics practitioner with a strong foundation in machine learning, statistical analysis, and backend engineering.',
        description: 'Experienced in exploratory data analysis, feature engineering, and end-to-end model development using Python, SQL, and modern ML tooling. I also build production REST APIs and deploy data-driven applications, bringing data and backend engineering together to solve practical problems.',
        note: 'Microsoft-certified across Azure cloud and AI services.'
    },
    skills: {
        lede: 'A resume-backed toolkit across software engineering, machine learning, data analytics, and cloud infrastructure.',
        items: [
            {
                code: '01',
                icon: '⌘',
                title: 'Languages',
                description: 'Programming and query languages used across application and data work.',
                tags: ['Python', 'SQL', 'C++', 'JavaScript']
            },
            {
                code: '02',
                icon: '✳',
                title: 'Machine learning & AI',
                description: 'Model development and retrieval-based systems.',
                tags: ['Regression', 'Classification', 'Clustering', 'Scikit-learn', 'LangChain', 'RAG', 'LLMs']
            },
            {
                code: '03',
                icon: '▥',
                title: 'Data & analytics',
                description: 'From data preparation to exploration, visualization, and insight.',
                tags: ['Pandas', 'NumPy', 'Matplotlib', 'Power BI', 'Excel', 'EDA', 'Feature Engineering']
            },
            {
                code: '04',
                icon: '▤',
                title: 'Databases',
                description: 'Data storage and querying for applications and analysis.',
                tags: ['MySQL', 'PostgreSQL', 'MongoDB']
            },
            {
                code: '05',
                icon: '⌘',
                title: 'Web & backend',
                description: 'Full-stack product development and server-side APIs.',
                tags: ['React.js', 'Node.js', 'Express.js', 'REST APIs']
            },
            {
                code: '06',
                icon: '◈',
                title: 'Tools & cloud',
                description: 'Engineering workflow, containerization, cloud and notebooks.',
                tags: ['Git', 'Docker', 'Microsoft Azure', 'Jupyter Notebook']
            }
        ]
    },
    experience: [
        {
            title: 'Backend Developer',
            company: 'Product-Based Company',
            dates: 'July 2026 – Present',
            location: '',
            kind: 'PROFESSIONAL EXPERIENCE',
            bullets: [
                'Develop and maintain backend services and REST APIs powering a production-grade product platform.',
                'Collaborate with cross-functional teams to design scalable, maintainable server-side architecture.',
                'Work across databases and cloud infrastructure to improve application performance and reliability.'
            ]
        },
        {
            title: 'IT Intern',
            company: 'Konverge Technologies Pvt. Ltd.',
            dates: 'June 2025 – August 2025',
            location: 'Gurugram, India',
            kind: 'INTERNSHIP',
            bullets: [
                'Analysed IT operations datasets to identify recurring incident patterns and service delivery trends.',
                'Performed data cleaning, preprocessing, and exploratory data analysis using Python and Excel.',
                'Applied machine learning techniques to automate ticket categorisation and priority prediction.'
            ]
        },
        {
            title: 'Software Development Intern (SDE)',
            company: 'Bluestock Fintech',
            dates: 'April 2025 – May 2025',
            location: 'Remote',
            kind: 'INTERNSHIP',
            bullets: [
                'Contributed to backend development for fintech applications using Node.js and REST APIs.',
                'Designed and queried MongoDB collections supporting core financial application workflows.'
            ]
        }
    ],
    projects: [
        {
            id: 'ggnhome',
            number: '01',
            category: 'REAL ESTATE · FULL-STACK + AI',
            title: 'GGN Home',
            subtitle: 'AI-Powered Real Estate Platform',
            description: 'A live full-stack real estate platform supporting property listings, analytics workflows, and intelligent search.',
            details: [
                'Built and shipped the production platform with Node.js, Express.js, and MongoDB.',
                'Implemented role-based dashboards for Admins, Agents, and Users with granular listing management.',
                'Developed an AI-based recommendation engine that matches listings to user preferences.',
                'Applied EDA, regression, and clustering to model real estate pricing trends.'
            ],
            tags: ['Python', 'SQL', 'React.js', 'Node.js', 'Express.js', 'MongoDB', 'Power BI'],
            links: [
                { label: 'Live platform', url: 'https://www.ggnhome.com', primary: true }
            ],
            accent: 'mint'
        },
        {
            id: 'nids',
            number: '02',
            category: 'CYBERSECURITY · MACHINE LEARNING',
            title: 'Network Intrusion Detection System',
            subtitle: 'NIDS',
            description: 'An end-to-end ML system that classifies network traffic as normal or attack traffic, including DoS, Probe, R2L, and U2R categories.',
            details: [
                'Built preprocessing, feature-engineering, and model-training workflows using the NSL-KDD dataset.',
                'Deployed inference as a Dockerised Flask web application for portable use.'
            ],
            tags: ['Python', 'Scikit-learn', 'Flask', 'Docker', 'NSL-KDD'],
            links: [
                { label: 'GitHub repository', url: 'https://github.com/Tanushh18/NIDS', primary: true }
            ],
            accent: 'amber'
        },
        {
            id: 'rag',
            number: '03',
            category: 'GENERATIVE AI · RETRIEVAL',
            title: 'RAG-Based Intelligence Research Agent',
            subtitle: 'Context-aware research',
            description: 'An AI research agent combining large language models with vector-based semantic retrieval to produce context-aware responses.',
            details: [
                'Built an end-to-end document pipeline for ingestion, embedding generation, and retrieval using LangChain and vector databases.',
                'Used structured retrieval-augmented generation to improve factual grounding and reduce hallucinations.'
            ],
            tags: ['Python', 'LangChain', 'Vector Databases', 'LLMs', 'RAG'],
            links: [
                { label: 'GitHub repository', url: 'https://github.com/Tanushh18/rag-intelligence-agent', primary: true }
            ],
            accent: 'violet'
        },
        {
            id: 'stashr',
            number: '04',
            category: 'SECURITY · DEVELOPER TOOLING',
            title: 'Stashr',
            subtitle: 'Encrypted vault and project workspace',
            description: 'An encrypted password vault and project workspace for credentials, hosting details, environment variables, and project configurations.',
            details: [],
            tags: ['Node.js', 'AES-256-GCM', 'TOTP', 'Web + Android'],
            links: [
                { label: 'GitHub repository', url: 'https://github.com/Tanushh18/password-manager', primary: true }
            ],
            accent: 'mint'
        },
        {
            id: 'wecode',
            number: '05',
            category: 'COLLABORATION · FULL-STACK',
            title: 'WeCode',
            subtitle: 'Real-time collaborative coding',
            description: 'A collaborative coding platform with synchronized editing, live communication, and structured DSA learning resources.',
            details: [],
            tags: ['MERN', 'Socket.IO', 'WebRTC', 'Monaco Editor'],
            links: [
                { label: 'Live demo', url: 'https://wecode-2.onrender.com', primary: true },
                { label: 'GitHub', url: 'https://github.com/Tanushh18/WeCode' }
            ],
            accent: 'amber'
        },
        {
            id: 'dealradar',
            number: '06',
            category: 'DATA PIPELINES · DISCOVERY',
            title: 'DealRadar',
            subtitle: 'Deal discovery and price tracking',
            description: 'A deal discovery platform that turns marketplace posts into a searchable catalogue with deduplication, price tracking, and notifications.',
            details: [],
            tags: ['Search', 'Telegram', 'Price tracking', 'Notifications'],
            links: [
                { label: 'Live demo', url: 'https://dealradar.ggnhome.com', primary: true },
                { label: 'GitHub', url: 'https://github.com/Tanushh18/Deal_Radar' }
            ],
            accent: 'violet'
        }
    ],
    education: [
        {
            title: 'B.Tech — Computer Science Engineering',
            subject: 'Artificial Intelligence & Machine Learning',
            institution: 'VIT Bhopal University',
            location: 'Madhya Pradesh, India',
            result: 'CGPA 8.59 / 10',
            dates: '',
            details: 'Applied Machine Learning, Artificial Neural Networks, Deep Learning, Reinforcement Learning, Data Mining, DBMS, and Data Structures.'
        },
        {
            title: 'Senior Secondary (Class XII), CBSE',
            subject: '',
            institution: 'Blue Bells Model School',
            location: 'Gurugram',
            result: '90%',
            dates: '',
            details: ''
        },
        {
            title: 'Secondary (Class X), CBSE',
            subject: '',
            institution: 'Our Lady of Fatima Convent School',
            location: 'Gurugram',
            result: '90%',
            dates: '',
            details: ''
        }
    ],
    certifications: [
        {
            title: 'Microsoft Certified: Azure AI Apps and Agents Developer Associate (AI-102)',
            issuer: 'Microsoft',
            date: 'September 2026',
            url: 'https://drive.google.com/file/d/1I04o4OFJHXtasUZr5cJUWQvGsUMBlOh6/view?usp=drivesdk'
        },
        {
            title: 'Microsoft Certified: Azure AI Fundamentals (AI-900)',
            issuer: 'Microsoft',
            date: 'June 2026',
            url: 'https://drive.google.com/file/d/1wZZL4w6pVdzQvuQPgOLTemT-yedaSaPW/view?usp=sharing'
        },
        {
            title: 'Microsoft Certified: Azure Fundamentals (AZ-900)',
            issuer: 'Microsoft',
            date: 'May 2026',
            url: 'https://drive.google.com/file/d/1IgFGVA71O5gy30dmv5EamKsYVJfCCKmm/view?usp=sharing'
        },
        {
            title: 'Google IT Support Professional Certificate',
            issuer: 'Google / Coursera',
            date: '',
            url: ''
        }
    ],
    achievements: [
        {
            value: '500+',
            title: 'DSA problems solved',
            description: 'Across LeetCode and HackerRank, building depth in algorithmic problem-solving and time-complexity optimisation.'
        },
        {
            value: '04',
            title: 'Industry certifications',
            description: 'Earned alongside full-time coursework, including three Microsoft Azure credentials spanning cloud fundamentals and AI application development.'
        },
        {
            value: '8.59',
            title: 'B.Tech CGPA / 10',
            description: 'Computer Science Engineering (AI & ML), while shipping production software and completing three industry internships.'
        },
        {
            value: '90%',
            title: 'CBSE Class X & XII',
            description: 'Scored 90% in both secondary and senior-secondary examinations.'
        },
        {
            value: 'LIVE',
            title: 'GGN Home platform',
            description: 'Independently designed, built, and deployed a production real-estate platform with full-stack engineering, AI recommendations, and pricing analytics.',
            url: 'https://www.ggnhome.com'
        }
    ],
    contact: {
        email: 'tanushchawla16@gmail.com',
        phone: '+91-8130483894',
        location: 'Gurugram, India',
        resume: 'https://github.com/Tanushh18/Resume/blob/main/Tanush_Chawla.pdf?raw=1'
    }
}
