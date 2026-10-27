# Tanush Portfolio — Cinematic Scroll-Driven 3D Experience

**Live site:** https://ride-my-world.vercel.app/  
**Repository:** https://github.com/Tanushh18/ride-my-world

Tanush Portfolio is a scroll-driven portfolio built on an original, procedural Three.js world. Visitors use ordinary page scrolling to travel through an atmospheric jungle road, a river and waterfall crossing, a city skyline, a learning-campus landmark, and a final airport viewpoint. Real HTML content sits above the 3D canvas so project details remain accessible, selectable, and responsive.

## Experience

- Fixed WebGL canvas with a continuous scroll-controlled camera path.
- Scroll sections for introduction, about, skills, experience, projects, education, experiments, and contact.
- Procedural curved road, river, animated waterfall streams, bridge, city buildings, learning-campus landmark, and airport terminal/runway.
- Stylized scooter and rider model retained in the world; mandatory driving controls are not required for browsing.
- Project cards with verified GitHub links and current live links where known.
- Mobile-aware layout, direct section navigation, progress indicator, and reduced-motion camera behavior.
- Graceful fallback content if WebGL initialization fails.
- A centralized resume-ready content file at `sources/data/portfolio.js`.

## Featured projects

- **Stashr** — encrypted password vault and project workspace. [GitHub](https://github.com/Tanushh18/password-manager)
- **WeCode** — real-time collaborative coding platform. [Live](https://wecode-2.onrender.com) · [GitHub](https://github.com/Tanushh18/WeCode)
- **DealRadar** — searchable deal discovery and price tracking. [Live](https://dealradar.ggnhome.com) · [GitHub](https://github.com/Tanushh18/Deal_Radar)
- **RAG Intelligence Agent** — retrieval-augmented research workflows. [GitHub](https://github.com/Tanushh18/rag-intelligence-agent)

Project copy is intentionally concise and should be reviewed against each current repository before public use. Add verified contributions, outcomes, and more project details as they become available.

## Portfolio content

Update personal text and skill groups in `sources/data/portfolio.js`. Employment, education, email, LinkedIn, and resume-download details are kept generic or omitted until confirmed. The four project showcase cards currently live in `sources/index.html`; the proximity-system project metadata remains in `sources/data/projects.js` for compatibility with the underlying scene and tests.

## Development

Requires Node.js 22 or a compatible current Node release.

```bash
npm ci
npm run dev
```

Vite will print the local development URL.

## Tests and production build

```bash
npm test
npm run build
npm run preview
```

The production output is written to the repository-root `dist/` directory.

A GitHub Actions workflow in `.github/workflows/ci.yml` is configured to run unit tests and the production build on pushes and pull requests.

## Controls and accessibility

Scrolling is the primary navigation. Use the header links to jump directly to the main sections. The scroll camera path can be retraced naturally by scrolling upward. The existing game driving controls are retained for debug and physics tests, not required for visitors.

`prefers-reduced-motion` reduces the camera interpolation and interface transitions. When WebGL cannot initialize, the HTML portfolio content stays available.

## Vercel deployment

Connect this repository to Vercel and deploy the `main` branch with:

- **Framework preset:** Vite
- **Root directory:** repository root (leave blank/default)
- **Build command:** `npm ci && npm run build`
- **Output directory:** `dist`

The Vite configuration already sets the application root to `sources/`, serves static assets from `static/`, and writes production output into the root-level `dist/` directory. Leave the Vercel root directory blank.

With automatic deployments enabled, new commits on `main` trigger a deployment.

## Attribution and licensing

This repository began as a fork/adaptation of [MMubazar's car-game](https://github.com/MMubazar/car-game). Preserve upstream attribution and comply with the upstream license and any third-party asset or dependency licenses. Check the original repository's current license terms before redistribution or commercial reuse.
