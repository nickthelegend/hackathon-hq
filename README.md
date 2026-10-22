# Hackathon HQ

A local-first hackathon pipeline for Nick's team. This is a React, Vite, TypeScript, and Tailwind single-page app with no backend. Board placement, notes, checklist progress, and custom entries persist in this browser's local storage.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type-checks and produces the production bundle. `npm run lint` runs ESLint.

### Browser E2E (`e2e/`)

Playwright in the installed Google Chrome, desktop 1280×800 and mobile 375×812, with video and traces, against the production build served by `vite preview` on 127.0.0.1:4180:

```sh
cd e2e && npm install
npm run stack        # npm run build, then vite preview; PID in e2e/.run/pids
npm run test:e2e     # 21 tests x 2 viewports (also: npm run test:e2e from the repo root)
npm run stack:stop   # kills that PID
```

Expected values come from the seed files (`src/data/hackathons.json`, `src/data/projects.ts`) and the real clock, not from the app's own code. Every test fails on a console error or a failed same-origin request.

## Deployment

The `main` branch deploys to [Hackathon HQ on GitHub Pages](https://nickthelegend.github.io/hackathon-hq/) through `.github/workflows/pages.yml`. Set the repository's Pages source to **GitHub Actions** to enable deployment.

## Seed data

`data-import/hacklist.json` is the only seed source. `src/data/hackathons.json` contains one mapped record for each of its 195 deduplicated entries. Keep the source fields current when regenerating the seed.

Each object follows this schema:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable, unique ID generated from the title. |
| `name` | string | Imported `title`. |
| `organizer` | string | Organizer name. |
| `track` | `web3`, `ai`, or `both` | Imported `category`, normalized to lowercase. |
| `prize` | string | Imported prize text; an empty value becomes `TBA`. |
| `startDate` | `YYYY-MM-DD` or `null` | Published opening/start date. |
| `deadline` | `YYYY-MM-DD` or `null` | Published end/submission date. |
| `rolling` | boolean | True when no fixed deadline is listed. |
| `format` | `online`, `in-person`, or `hybrid` | Normalized from the imported format. |
| `location` | string or `null` | Published event location. |
| `country` | string or `null` | Published country. |
| `url` | string | Event page URL. |
| `source` | string | Original source label; cards can filter by `hacklist.io` or `hackathons.fun`. |
| `description` | string or `null` | Imported event description. |
| `free` | boolean or `null` | Imported entry fee flag. |
| `judgeScore` | number from 0 to 10 or `null` | Imported team score, editable in the details drawer. |
| `judgeIdea` | string or `null` | Imported idea association, shown as a card tag and used by the idea filter. |
| `status` | `discovered` | Imported `Backlog` entries map to the Discovered column. |

`notes` and `checklist` are board-only fields stored in local storage. Dates are ISO calendar dates. Null deadlines display safely, and rolling events show a `Rolling` badge. The board defaults to judge score descending and lets the team filter by format, source, and idea.

## Ideas & Projects board

The second tab (also reachable at `#projects`) tracks project ideas through Idea → Building → Verified → Submitted. Its seed lives in `src/data/projects.ts`; each project has a `name`, one-line `pitch`, `targets`, nullable `judgeScore` (plus an optional `scoreNote`), `status`, `progress` (0–100), `repo`, `nextStep`, and an optional `flag` such as `Parked`.

A target with a `hackathonId` links to that hackathon card and uses its deadline for the countdown. A target for an event that isn't on the hackathons board yet sets `hackathonId: null` and its own `deadline`. Hackathon cards show how many projects target them.

Saved state uses the same merge rule as the hackathons board: seed facts (name, pitch, targets) always come from `projects.ts`, while stage, progress, score, next step, repo, notes and custom projects are restored from local storage.

## Current seed

The seed contains exactly 195 entries from the final `data-import/hacklist.json` list.
