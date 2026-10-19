# Hackathon HQ

A local-first hackathon pipeline for Nick's team. This is a React, Vite, TypeScript, and Tailwind single-page app with no backend. Board placement, notes, checklist progress, and custom entries persist in this browser's local storage.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type-checks and produces the production bundle. `npm run lint` runs ESLint.

## Seed data

Update `src/data/hackathons.json` to refresh the Discovered column. Keep each event on its official organizer or platform page, and only include events currently open or upcoming as of the update date. The optional `source` field records the official directory used to verify the event listing.

Each object follows this schema:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable, unique identifier; do not reuse IDs. |
| `name` | string | Official hackathon name. |
| `organizer` | string | Organizer or hosting platform. |
| `track` | `web3`, `ai`, or `both` | Main eligible track; use `both` only when the official listing supports both. |
| `prizeAmount` | number or `null` | Published prize pool amount, without formatting; unknown values stay `null`. |
| `currency` | string or `null` | ISO 4217 currency code for `prizeAmount`; `null` when the amount is unknown. |
| `startDate` | `YYYY-MM-DD` or `null` | Published opening/start date; `null` when not provided. |
| `deadline` | `YYYY-MM-DD` or `null` | Published end or submission deadline; `null` when not provided. |
| `mode` | string | `Online` or the published event location. |
| `url` | string | Direct official event page URL. |
| `source` | string, optional | Official listing or directory page used to verify the event. |

Do not add board-only fields (`status`, `notes`, `checklist`) to the seed; the app initializes those locally and keeps every seed entry in `discovered`. Dates are ISO calendar dates in UTC. Missing prizes and dates render as `TBA`.

## Current seed

The seed was reviewed on October 19, 2026. Event availability, deadlines, and prizes can change; confirm them at the linked official page before committing team time. The current list contains 17 Web3 and AI opportunities from ETHGlobal and Devpost.
