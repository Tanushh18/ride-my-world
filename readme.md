# Ride My World — Tanushh18

**Live portfolio:** https://ride-my-world.vercel.app/  
**Source:** https://github.com/Tanushh18/ride-my-world

Ride My World is a personal, interactive 3D developer portfolio. Instead of presenting work as a conventional list of cards, visitors drive through a stylized world and approach project landmarks to reveal real project details and links.

## Personal portfolio features

- Branded welcome screen and portfolio navigation for Tanushh18.
- Scooter and rider visual model with Rapier-powered vehicle simulation.
- Procedurally generated scenery with a warm twilight and lush-green palette.
- Project landmarks that reveal accessible HTML cards when the visitor gets close.
- Featured projects linked to their actual GitHub repositories and known live demos.
- Keyboard driving controls on desktop and on-screen touch controls on small screens.
- Vite production build with Three.js WebGPU rendering and a WebGL2 fallback.

## Featured projects

The project cards are maintained in `sources/data/projects.js`.

- **Stashr** — encrypted password vault and project workspace. [GitHub](https://github.com/Tanushh18/password-manager)
- **WeCode** — real-time collaborative coding platform. [Live](https://wecode-2.onrender.com) · [GitHub](https://github.com/Tanushh18/WeCode)
- **DealRadar** — searchable deal discovery and price tracking. [Live](https://dealradar.ggnhome.com) · [GitHub](https://github.com/Tanushh18/Deal_Radar)
- **RAG Intelligence Agent** — LangGraph-based retrieval and multi-step research foundation. [GitHub](https://github.com/Tanushh18/rag-intelligence-agent)

Update descriptions, technologies and URLs in `sources/data/projects.js` as the projects evolve. The project buildings are generated from that data; adding or removing a project automatically changes the plaza layout.

## Run locally

Requires a current Node.js LTS release.

```bash
npm ci
npm run dev
```

Vite prints the local development URL in the terminal.

## Test and build

```bash
npm test
npm run build
npm run preview
```

The production build is written to `dist/`.

## Controls

| Input | Action |
|---|---|
| `W A S D` or arrow keys | Drive and steer |
| `Shift` | Boost |
| `Ctrl` or `B` | Brake |
| `R` | Respawn |
| `P` | Reset interactive objects |
| Mouse drag | Move the camera |
| Mouse wheel | Zoom |
| Touch controls | Drive, reverse, steer, boost, brake and reset on narrow screens |

## Helpful development switches

| URL hash | Effect |
|---|---|
| `#debug` | Opens the Tweakpane debug panel and exposes `window.game` in the console |
| `#quality=low` | Lower grass and scenery detail |
| `#quality=high` | Higher scene quality |
| `#bloom` | Enables bloom post-processing |

Hashes can be combined, for example `https://ride-my-world.vercel.app/#quality=low`.

## Deploy on Vercel

The Vercel project should be linked to this repository and the `main` branch.

- **Framework preset:** Vite
- **Root directory:** repository root
- **Build command:** `npm ci && npm run build`
- **Output directory:** `dist`

`vite.config.js` already sets the app root to `sources/`, serves `static/` as the public directory, and writes the production build into the repository-root `dist/` folder. Leave the Vercel root directory blank/default.

With automatic deployments enabled, pushing a commit to `main` triggers a new deployment.

## Attribution

This repository is a personalized adaptation of the interactive driving-portfolio project by [MMubazar](https://github.com/MMubazar/car-game). Keep upstream attribution and follow the upstream repository's licensing terms when using or redistributing its source. Check the upstream repository for the current license and usage requirements.
