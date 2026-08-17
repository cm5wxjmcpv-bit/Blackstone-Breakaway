# Blackstone Breakaway

Blackstone Breakaway is a standalone browser-based mining incremental game. Begin as an underpaid Blackstone Mining Co. employee, rise through the company's ranks, buy out your contract, build an independent mining company, expand through deeper mines, and eventually acquire your former employer.

Version 0.9 expands the opening into a complete Blackstone chapter:

**New Hire → Mine Worker → Senior Miner → Shift Lead → Buy Your Freedom → Independent Miner**

Four data-driven employee assignments introduce progressively stronger company-issued tools, more valuable deposits, visible Shift Lead coworkers, promotion requirements, six Foreman Cole story scenes, contextual dialogue at Miller's, and a real wage-versus-company-value ledger. The $5,000 release clause remains hidden until the Shift Lead paperwork scene, and the transaction-safe Walkout survives reloads without charging twice.

The existing long game remains intact: ten progressively richer mines, three connected skill trees, 23 level-gated equipment choices, seven fictional lottery tiers, automated XP training, and separately assigned worksites for Hired Miners, Mining Crews, and Mechanical Drills. Representative workers visibly mine their own deposits without taking over the player's personal rock face.

## Play

The hosted game is published through GitHub Pages. Each browser stores its own local save; no account, real-money purchase, or cloud service is required.

## Run locally

Because the game loads its data through `fetch`, serve the repository through a local static server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

## Test

```bash
npm install
npx playwright install chromium
npm run audit
```

The audit validates the standalone data contract, incremental runtime, save migrations, gameplay progression, desktop rendering, mobile layout, and save/reload behavior.

Existing version 0.8 saves migrate automatically to the version 0.9 employment-chapter schema. Independent players remain independent and receive the completed Blackstone chapter in Story/Company History. Employed players are placed at the closest reasonable rank from their existing level, employee deposits, and Blackstone value without a flood of automatic scenes.

All six Chapter 1 cinematics use individually approved, mobile-safe 16:9 artwork. Assets are stored as optimized WebP files and resolved from package data, with a safe visual fallback if an asset cannot load. See [`docs/v0.9-blackstone-story.md`](docs/v0.9-blackstone-story.md) and [`games/miner-incremental/data/cinematic-art-manifest.json`](games/miner-incremental/data/cinematic-art-manifest.json).

## Repository scope

This repository contains only the playable game, its incremental runtime, game data, tests, and deployment workflow. It does not include the L-C Forge builder, adventure/RPG runtime, Supabase creator storage, or controlled publishing tools.

The fictional lottery uses earned in-game currency only and has no real-world value.
