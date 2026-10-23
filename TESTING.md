# Testing

Hackathon HQ has no backend and calls no external API, so the whole test surface is the built app in a real browser plus lint and the type check.

| Check | Command | Count | Last local run (Oct 23, 2026) |
| --- | --- | --- | --- |
| Type check + production build | `npm run build` | 1 | passes |
| ESLint, no warnings allowed | `npm run lint` | 0 problems | passes |
| Playwright E2E, Google Chrome, desktop 1280×800 | `npm run test:e2e` | 32 | 32 pass |
| Playwright E2E, Google Chrome, mobile 375×812 | (same run) | 32 | 32 pass |
| **E2E total** |  | **64** | **64 pass, 0 skipped, 0 retries** |

CI (`.github/workflows/ci.yml`) runs the same lint and E2E commands on every pull request and branch push, and `pages.yml` runs them before each deploy of `main`. The suite was also run from a fresh clone with `npm ci` exactly as the workflow does: 64/64.

## How the suite works

- `e2e/stack.sh` builds the production bundle and serves it with `vite preview` on 127.0.0.1:4180 (the same `dist/` GitHub Pages serves); `stack.sh stop` kills that PID.
- Real Google Chrome (`channel: 'chrome'`; `PW_CHANNEL` picks another), timezone Asia/Kolkata, video, trace and screenshot on.
- Expected values come from the seed files and the real clock, never from the app's code.
- Every test fails on a console error, a page error or a failed same-origin request. One test excuses one console error: the error-boundary test, for the error it throws on purpose.
- No mocks: there is nothing external to mock.

## What each spec covers

**`departures.spec.ts`** (12)

1. UTC and IST clocks show the real time
2. Next departure is the soonest open deadline of ours; the flaps spell the countdown
3. A minute later the clocks and countdowns flip by exactly one minute (Playwright clock)
4. Reduced motion: no falling leaves, both halves of every flap match
5. Our flights: each status filter shows only that status and the counts add up
6. All departures: closed hidden by default, Show/Hide closed, 30 per page to the end
7. Search, track, format, source, idea and stage filters match the seed; empty state; judge-score sort
8. Flight drawer: stage select saves, Escape closes, focus returns; Reset to seed (confirmed) restores the stage
9. Destination opens the flight drawer, gate opens the pass drawer, focus returns
10. Add hackathon: https required; the new row is on screen and focused without searching
11. No button labelled "log" anywhere
12. Skip link and footer

**`passes.spec.ts`** (9)

1. One pass per seeded project; stage filter counts match the seed
2. Search, destination filter and sort
3. Each pass shows its seed score, progress, stage and repo link
4. Pass drawer: stage and progress save at once, survive a reload; Reset to seed (confirmed) restores them
5. A route link opens the flight drawer
6. Add project issues a pass; focus returns
7. No button labelled "log"
8. The URL hash switches boards, including back and forward
9. Storage unavailable: both boards still work, no errors

**`robustness.spec.ts`** (11, added in the Oct 22 ultra round; all 11 failed on e7cf26c before the fixes)

1. A board saved under an older seed shows the current seed score; notes, ticks and stage edits stay
2. Two tabs: notes typed in one and a tick in the other both survive (and passes likewise)
3. Reset to seed asks first, names what will be lost, Cancel keeps everything; Reset sits 48 px or more from Add
4. A new hackathon is shown, opened and announced at once, even when already closed; names of spaces are refused
5. Drawers and dialogs trap Tab and Shift+Tab, the page behind is inert and doesn't scroll; the view has one h1
6. https-only links: a `javascript:` or relative repo is refused in the drawer and never rendered from storage
7. Malformed saved entries (null targets, non-string fields) are repaired or dropped; the page renders
8. A render error shows the recovery screen, which clears the saved board
9. Split flaps show real digits on the first frame
10. "N closed hidden" counts only rows that match the active filters
11. A pass whose judge score and self-review are 2 or more apart says so
