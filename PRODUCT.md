# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript + Tailwind (user specified); no backend.

## Users

Nick's hackathon team, coordinating opportunities and build work in one shared workspace. Team roles beyond this are not specified.

## Product Purpose

Track hackathon opportunities from discovery through results, and keep the team's progress, notes, and deadlines easy to scan. Success means the team can prioritize events and follow a submission checklist without a backend.

## Positioning

An airport departures board for hackathons: the next deadline we're flying to counts down in split flaps, every project × deadline pair is a flight with a status, and every project carries a boarding pass. Local-first, no backend.

## Operating Context

The team evaluates Web3 and AI hackathons. The board starts with curated seed files (`src/data/hackathons.json`, `src/data/projects.ts`) and stores only the team's own changes in browser local storage.

## Capabilities and Constraints

- Departures view: Next departure (split-flap countdown, destination, gate, UTC and IST closing time); Our flights with statuses Boarding, Delayed, On time, Gate closed, Departed and Cancelled, filterable by status; All departures with search, track, format, source, idea and stage filters, sort by Closes soonest (default), Closes latest or Judge score, closed events behind Show closed, 30 rows per page.
- Boarding passes view (`#projects`): one pass per project with destinations, judge score and self-review (flagged when 2 or more apart), progress, stage, missing keys, bundle and head; filter by stage or destination, sort by next departure, judge score or progress.
- Flight drawer: stage, judge score, six-step build checklist and team notes. Pass drawer: stage, judge score, progress, next step, https-only repo link and notes.
- Users can add hackathons and projects; Reset to seed confirms and names what would be lost.
- No backend; local storage is the persistence layer and holds only the user's changes. Seed facts always come from the seed files.
- Event details must come from official event pages. Unknown values remain unset and display as TBA.

## Evidence on Hand

The seed data links to event pages and the official platform directories used for verification. No separate brand assets were provided at project start.

## Brand Commitments

Use a text wordmark and original UI styling. No external brand assets are provided.

## Product Principles

- Keep decisions and upcoming deadlines visible.
- Preserve source links alongside event details.
- Make progress easy to update during a build.
- Avoid presenting unknown event facts as known.
