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

One kanban pipeline combines event details, deadline countdowns, prize information, team notes, and project readiness in a local-first dashboard.

## Operating Context

The team evaluates Web3 and AI hackathons. The board starts with a curated JSON list and stores ongoing board changes in browser local storage.

## Capabilities and Constraints

- Six stages: Discovered, Shortlisted, Approved by Judge, Building, Submitted, and Results.
- Users can move cards, search and filter opportunities, sort by deadline, add events, track checklist progress, and save notes.
- No backend; local storage is the persistence layer. Seed data is maintained in `src/data/hackathons.json`.
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
