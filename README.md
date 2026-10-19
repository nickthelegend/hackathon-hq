# Hackathon HQ

A local-first hackathon pipeline for Nick's team. This is a React, Vite, TypeScript, and Tailwind single-page app with no backend. Board placement, notes, checklist progress, and custom entries persist in this browser's local storage.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type-checks and produces the production bundle. `npm run lint` runs ESLint.

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

## Current seed

The seed contains exactly 195 entries from the final `data-import/hacklist.json` list.
