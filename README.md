# Hackathon HQ

A local-first hackathon pipeline for Nick's team. This is a React, Vite, TypeScript, and Tailwind single-page app with no backend. Board placement, notes, checklist progress, and custom entries persist in this browser's local storage.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type-checks and produces the production bundle. `npm run lint` runs ESLint.

## Seed data

`data-import/hacklist.json` is the team's source of truth. Merge its records into `src/data/hackathons.json`, deduplicating by normalized name or URL while retaining entries unique to either list. The optional `source` field records the listing or directory used to verify the event.

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
| `rolling` | boolean | True when the event accepts submissions on a rolling basis and has no fixed deadline. |
| `mode` | string | `Online` or the published event location. |
| `url` | string | Direct official event page URL. |
| `source` | string, optional | Listing or directory page used to verify the event. |
| `description` | string or `null`, optional | Imported event description. |
| `prizeDescription` | string or `null`, optional | Original prize text, retained when the amount or currency is not a simple value. |
| `judgeScore` | number from 0 to 10 or `null` | Team's assessment of the opportunity; editable on the card detail drawer. |
| `ideas` | string array | Team ideas targeting this event, using `Blackbox Receipts`, `TasteProbe`, `LEASH`, `Mnemosyne`, or `SensorSeal`. |
| `status` | `discovered` | Initial board column; imported `Backlog` entries map to `discovered`. |

`notes` and `checklist` are board-only fields stored in local storage. Dates are ISO calendar dates. Null deadlines display as `TBA`, unless `rolling` is true; deadlines today and earlier display as `Closing today` and `Closed` in red. Missing prizes and dates render as `TBA`.

## Current seed

The seed contains 196 entries: 191 from HackList and 5 unique entries from the previous 17-entry list, after duplicate removal. Imported team ideas come from `data-import/top5-ideas.md`; judge scores come from `data-import/hacklist.json`.
