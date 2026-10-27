# Tanush Portfolio — Scroll-Driven 3D Scooter Journey

**Live site:** https://ride-my-world.vercel.app/  
**Source:** https://github.com/Tanushh18/ride-my-world

A personal portfolio by Tanush Chawla, built on Three.js/WebGPU with WebGL fallback. Browser scrolling is the throttle: a scooter and rider travel along a curved road while a chase camera, environment and story chapters follow the same route.

The experience moves from a lush forest road into a river and waterfall crossing, across a pastel city boulevard with tram tracks and storefronts, past learning/campus architecture, and toward an airport/runway sunset. Resume content is rendered as real HTML so it remains readable, selectable, responsive and accessible.

## Highlights

- One shared Catmull–Rom road curve drives the road geometry, rider position, wheel rotation, camera, and shadow focus.
- Cinematic camera staging: establishing shot, close scooter chase, waterfall reveal, city skyline reveal, and wider airport finale.
- Original procedural 3D environment: instanced roadside trees, faceted mountains, river/waterfall, bridge, city buildings, storefronts, sidewalk strips, tram rails, crosswalks, campus landmark and airport.
- Custom sunset fog for distant geometry, stylized low-poly architecture, soft sky fill, warm rim lighting and directional shadows.
- Real HTML story chapters: About, Skills, Experience, Projects, Education, Certifications, Achievements and Contact.
- Resume-backed content is centralized in `sources/data/portfolio.js`.
- Responsive nav, progress indicator, reduced-motion camera, downloadable resume link and contact actions.
- Existing Rapier vehicle and debug controls remain available for physics testing; they are not required to navigate the public portfolio.
- CI checks unit tests, production build and browser-level scooter/scroll/data behavior.

## Professional information shown

The content module includes Tanush Chawla's AI/ML, data analytics and backend engineering summary; Python, SQL, C++, JavaScript, ML/AI, analytics, database, web and cloud skills; three roles/internships; education; Microsoft Azure credentials; achievements; and six project showcases.

Resume-derived projects are GGN Home, Network Intrusion Detection System (NIDS), and the RAG-Based Intelligence Research Agent. Additional existing repositories in the profile include Stashr, WeCode and DealRadar. Employment details remain exactly as represented in the resume, including “Product-Based Company” where no company name is provided.

## Edit content

Update `sources/data/portfolio.js` to revise the personal summary, skill groups, experience timeline, project descriptions and links, education, credentials, achievements, or contact details. The visual scene and section renderer do not need to be rewritten when content changes.

The procedural world and scroll camera are implemented in:

- `sources/Game/World/ScrollWorld.js`
- `sources/Game/ScrollTour.js`
- `sources/Game/World/VisualVehicle.js`
- `sources/Game/Lighting.js`

The page structure and responsive style live in `sources/index.html` and `sources/style/tour.css`.

## Development

Requires Node.js 22 or a compatible current Node.js release.

```bash
npm ci
npm run dev
```

Vite uses `sources/` as its app root and serves the `static/` folder as public assets.

## Quality checks

```bash
npm test
npm run build
npm run smoke:tour
```

The browser smoke test assumes the Vite development server is already running at `http://127.0.0.1:5173` and Playwright Chromium is installed. It verifies renderer startup, the real resume sections, scooter travel, wheel rotation, camera movement and the contact details.

Production output is written to the root-level `dist/` directory.

## Vercel deployment

- **Framework preset:** Vite
- **Root directory:** repository root (blank/default)
- **Build command:** `npm ci && npm run build`
- **Output directory:** `dist`

The application root remains configured as `sources/` in `vite.config.js`.

## Attribution and licensing

This repository began as a fork/adaptation of [MMubazar's car-game](https://github.com/MMubazar/car-game). Preserve upstream attribution and follow the original repository's license terms, along with licenses for third-party dependencies and assets.
