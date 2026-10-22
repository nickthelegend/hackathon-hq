import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';

export { BASE } from '../global-setup.ts';
export const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** The seed exactly as the app imports it (read, never changed). */
export type SeedHackathon = { id: string; name: string; organizer: string; track: 'web3' | 'ai' | 'both'; prize: string; deadline: string | null; rolling: boolean; format: string; location: string | null; country: string | null; url: string; source: string; judgeScore: number | null; judgeIdea: string | null; status: string };
export const seed: SeedHackathon[] = JSON.parse(readFileSync(resolve(REPO_ROOT, 'src/data/hackathons.json'), 'utf8'));

/** End of a deadline: date-only values close at 23:59:59 UTC (the board's stated rule). */
export const endMs = (d: string | null | undefined) => (d ? Date.parse(d.includes('T') ? d : `${d}T23:59:59Z`) : null);

type Allowed = { url: RegExp; status: number };

/**
 * Every test gets a `watch` that records console errors, page errors, failed same-origin requests and
 * same-origin HTTP errors, and asserts at the end that there were none. A test may `allow()` a status
 * on a URL, or `allowFailure()` a URL. No test in this suite uses either: nothing is excused.
 */
export const test = base.extend<{ watch: { allow: (url: RegExp, status: number) => void; allowFailure: (url: RegExp) => void } }>({
  watch: [
    async ({ page }, use, testInfo) => {
      const allowed: Allowed[] = [];
      const mayFail: RegExp[] = [];
      const problems: string[] = [];
      const isAllowed = (url: string, status: number) => allowed.some((a) => a.status === status && a.url.test(url));
      const sameOrigin = (url: string) => {
        try {
          return new URL(url).origin === new URL(page.url()).origin;
        } catch {
          return false;
        }
      };
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const loc = m.location().url || '';
        const st = /status of (\d{3})/.exec(m.text());
        if (st && isAllowed(loc, Number(st[1]))) return;
        if (/net::ERR_/.test(m.text()) && mayFail.some((r) => r.test(loc))) return;
        problems.push(`console.error: ${m.text()} @ ${loc}`);
      });
      page.on('requestfailed', (r) => {
        if (!sameOrigin(r.url())) return;
        const why = r.failure()?.errorText || '';
        if (why === 'net::ERR_ABORTED') return;
        if (mayFail.some((re) => re.test(r.url()))) return;
        problems.push(`requestfailed: ${r.method()} ${r.url()} ${why}`);
      });
      page.on('response', (r) => {
        if (!sameOrigin(r.url()) || r.status() < 400) return;
        if (isAllowed(r.url(), r.status())) return;
        problems.push(`HTTP ${r.status()}: ${r.request().method()} ${r.url()}`);
      });
      await use({ allow: (url, status) => allowed.push({ url, status }), allowFailure: (url) => mayFail.push(url) });
      if (problems.length) await testInfo.attach('problems', { body: problems.join('\n') });
      expect(problems, 'console errors / failed same-origin requests').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** No horizontal page scroll (the 375 px check), and no element sticking out past the right edge. */
export async function expectNoHorizontalScroll(page: Page) {
  const r = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const h = el as HTMLElement;
      if (h.closest('[hidden], .sr, .sr-only')) continue;
      const b = h.getBoundingClientRect();
      if (!b.width || b.right <= cw + 1) continue;
      // Clipped by a scroll/overflow container that itself fits: not a page overflow.
      let clipped = false;
      for (let a = h.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= cw + 1) { clipped = true; break; }
      }
      if (!clipped) out.push(`${h.tagName.toLowerCase()}.${h.className || ''} right=${Math.round(b.right)}`);
    }
    return { sw: document.documentElement.scrollWidth, bsw: document.body.scrollWidth, cw, out: out.slice(0, 8) };
  });
  expect(r.sw, `page scrollWidth ${r.sw} > clientWidth ${r.cw}`).toBeLessThanOrEqual(r.cw);
  expect(r.bsw, `body scrollWidth ${r.bsw} > clientWidth ${r.cw}`).toBeLessThanOrEqual(r.cw);
  expect(r.out, 'elements past the right edge').toEqual([]);
}

/** The element's top is near the top of the viewport (below the sticky header). */
export async function expectInViewport(page: Page, selector: string) {
  await expect.poll(async () => page.evaluate((sel) => { const r = document.querySelector(sel)!.getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight * 0.7; }, selector), { message: `${selector} in view` }).toBe(true);
}

/** Every element with role=button whose accessible name contains "log" (Nick: "Can't use the log button"). */
export async function logButtons(page: Page) {
  return page.getByRole('button', { name: /log/i }).all();
}

export const isMobile = (name: string) => name === 'mobile';

/** "Showing N of M" from the departures result line. */
export async function shown(page: Page) {
  const t = (await page.locator('.board .result-line').textContent()) ?? '';
  const m = /Showing (\d+) of (\d+)/.exec(t);
  if (!m) throw new Error(`no result line: ${t}`);
  return { visible: Number(m[1]), total: Number(m[2]), text: t };
}

export const departures = (page: Page) => page.getByRole('region', { name: 'All departures board' }).locator('.fids-row');
export const ourFlights = (page: Page) => page.getByRole('region', { name: 'Our flights board' }).locator('.fids-row');
