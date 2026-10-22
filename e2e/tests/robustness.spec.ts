import { projectSeed } from '../../src/data/projects.ts';
import { test, expect, BASE, seed, endMs, departures, shown } from './fixtures.ts';

// Ultra round (Oct 22): saved-state, overlay, link and first-paint behaviour. Expected values come
// from the seed files and the real clock; every test still fails on any console error.
const BOARD_KEY = 'hackathon-hq-board-v3';
const PROJECTS_KEY = 'hackathon-hq-projects-v1';
const passes = (page: import('@playwright/test').Page) => page.locator('.pass');
const store = (page: import('@playwright/test').Page, entries: Record<string, unknown>) =>
  page.evaluate((e) => { for (const [k, v] of Object.entries(e)) localStorage.setItem(k, JSON.stringify(v)); }, entries);
const closedNow = (h: (typeof seed)[number], now: number) => !h.rolling && endMs(h.deadline) !== null && endMs(h.deadline)! <= now;
const unticked = () => [false, false, false, false, false, false];

test.describe('saved boards', () => {
  test('a board saved under an older seed shows the current seed score; notes, ticks and stage edits stay', async ({ page }) => {
    const target = seed.find((h) => h.id === 'impulse-hack-4-143')!;
    const staged = seed.find((h) => h.id !== target.id && !closedNow(h, Date.now()))!;
    expect(target.judgeScore).toBe(1.5);
    // Every card as an older build saved it on first visit: this card was unscored in that seed.
    const legacy = { items: seed.map((h) => ({ ...h, notes: '', checklist: unticked(),
      ...(h.id === target.id ? { judgeScore: null, notes: 'kept note', checklist: [true, false, false, false, false, false] } : {}),
      ...(h.id === staged.id ? { status: 'shortlisted' } : {}) })) };
    await page.goto(BASE);
    await store(page, { [BOARD_KEY]: legacy });
    await page.reload();
    await page.getByLabel('Search hackathons').fill(target.name);
    const row = departures(page).filter({ hasText: target.name });
    await expect(row.locator('.c-score')).toHaveText(`Score${target.judgeScore}`);
    await row.locator('.row-link').click();
    const drawer = page.getByRole('dialog', { name: `${target.name} details` });
    await expect(drawer.getByLabel('Judge score (0–10)')).toHaveValue('1.5');
    await expect(drawer.getByLabel('Team notes')).toHaveValue('kept note');
    await expect(drawer.getByRole('heading', { name: /Build checklist/ })).toContainText('1 of 6');
    // A score typed in the drawer is the user's own and survives a reload.
    await drawer.getByLabel('Judge score (0–10)').fill('9');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByLabel('Search hackathons').fill(target.name);
    await expect(departures(page).filter({ hasText: target.name }).locator('.c-score')).toHaveText('Score9');
    // The stage someone changed under the old build is theirs too.
    await page.getByLabel('Search hackathons').fill(staged.name);
    await departures(page).filter({ hasText: staged.name }).first().locator('.row-link').click();
    await expect(page.getByRole('dialog').getByLabel('Board stage')).toHaveValue('shortlisted');
  });

  test('two tabs: notes typed in one and a tick in the other both survive', async ({ page, context }) => {
    await page.goto(BASE);
    const other = await context.newPage();
    await other.goto(BASE);
    const names = await departures(page).locator('.row-link').allTextContents();
    // Tab A: notes on the first departure.
    await departures(page).nth(0).locator('.row-link').click();
    await page.getByRole('dialog').getByLabel('Team notes').fill('notes from tab A');
    await page.keyboard.press('Escape');
    // Tab B, opened before A typed: a tick on the second departure.
    await departures(other).nth(1).locator('.row-link').click();
    await other.getByRole('dialog').getByRole('checkbox', { name: 'Repo' }).check({ force: true });
    await other.keyboard.press('Escape');
    // A sees B's tick without a reload.
    await departures(page).nth(1).locator('.row-link').click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: /Build checklist/ })).toContainText('1 of 6');
    await page.keyboard.press('Escape');
    // Both survive a reload.
    await page.reload();
    await page.locator('.row-link', { hasText: names[0] }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Team notes')).toHaveValue('notes from tab A');
    await page.keyboard.press('Escape');
    await page.locator('.row-link', { hasText: names[1] }).first().click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: /Build checklist/ })).toContainText('1 of 6');
    await page.keyboard.press('Escape');

    // Boarding passes: a note in A, a stage change in B (opened before A typed).
    await page.goto(BASE + '#projects');
    await other.goto(BASE + '#projects');
    const [p0, p1] = projectSeed.filter((p) => p.status !== 'submitted');
    await page.locator(`#pass-${p0.id}`).getByRole('button').click();
    await page.getByRole('dialog').getByLabel('Notes').fill('pass note from tab A');
    await page.keyboard.press('Escape');
    await other.locator(`#pass-${p1.id}`).getByRole('button').click();
    await other.getByRole('dialog').getByRole('combobox', { name: /^Stage/ }).selectOption('submitted');
    await other.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('.pass', { has: page.locator(`#pass-${p1.id}`) }).locator('.pass-fields div', { hasText: 'Stage' }).locator('dd')).toHaveText('Submitted');
    await page.locator(`#pass-${p0.id}`).getByRole('button').click();
    await expect(page.getByRole('dialog').getByLabel('Notes')).toHaveValue('pass note from tab A');
    await other.close();
  });

  test('Reset to seed asks first, names what will be lost, and Cancel keeps everything', async ({ page }, ti) => {
    await page.goto(BASE);
    const first = (await departures(page).first().locator('.row-link').textContent())!;
    await departures(page).first().locator('.row-link').click();
    await page.getByRole('dialog').getByLabel('Team notes').fill('keep me');
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Repo' }).check({ force: true });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add hackathon' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Add a hackathon' });
    await dlg.getByLabel('Hackathon name').fill('E2E Reset Hack');
    await dlg.getByLabel('Organizer / platform').fill('Nick');
    await dlg.getByLabel('End / deadline').fill('2026-12-31');
    await dlg.getByLabel('Official event link').fill('https://example.com/reset');
    await dlg.getByRole('button', { name: 'Add to departures' }).click();
    await expect(dlg).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    const reset = page.getByRole('button', { name: 'Reset to seed' });
    await reset.click();
    const confirm = page.getByRole('alertdialog', { name: 'Reset the departures board?' });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('1 team note');
    await expect(confirm).toContainText('1 checklist tick');
    await expect(confirm).toContainText('1 custom hackathon');
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.screenshot({ path: ti.outputPath(`reset-confirm-${ti.project.name}.png`) });
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(reset).toBeFocused();
    await expect(page.locator('.tab', { hasText: 'Departures' })).toContainText(String(seed.length + 1));
    await page.locator('.row-link', { hasText: first }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Team notes')).toHaveValue('keep me');
    await page.keyboard.press('Escape');

    // Reset sits well away from Add (a mis-tap on a phone can't hit it).
    const a = (await page.getByRole('button', { name: 'Add hackathon' }).first().boundingBox())!;
    const r = (await reset.boundingBox())!;
    const gap = Math.max(r.y - (a.y + a.height), a.y - (r.y + r.height), r.x - (a.x + a.width), a.x - (r.x + r.width));
    expect(gap).toBeGreaterThanOrEqual(48);

    await reset.click();
    await confirm.getByRole('button', { name: 'Reset board' }).click();
    await expect(confirm).toBeHidden();
    await expect(page.locator('.tab', { hasText: 'Departures' })).toContainText(String(seed.length));
    await page.locator('.row-link', { hasText: first }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Team notes')).toHaveValue('');
    await page.keyboard.press('Escape');

    // Boarding passes ask too.
    await page.goto(BASE + '#projects');
    const p = projectSeed[0];
    await page.locator(`#pass-${p.id}`).getByRole('button').click();
    await page.getByRole('dialog').getByLabel('Notes').fill('pass note');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Reset to seed' }).click();
    const confirmPasses = page.getByRole('alertdialog', { name: 'Reset the boarding passes?' });
    await expect(confirmPasses).toContainText('1 note');
    await confirmPasses.getByRole('button', { name: 'Reset board' }).click();
    await page.locator(`#pass-${p.id}`).getByRole('button').click();
    await expect(page.getByRole('dialog').getByLabel('Notes')).toHaveValue('');
  });
});

test.describe('adding', () => {
  test('a new hackathon is shown and announced at once, even when it has closed; blank names are refused', async ({ page }, ti) => {
    await page.goto(BASE);
    const open = async () => { await page.getByRole('button', { name: 'Add hackathon' }).first().click(); return page.getByRole('dialog', { name: 'Add a hackathon' }); };
    // Spaces only: refused with an inline error, nothing added.
    let dlg = await open();
    await dlg.getByLabel('Hackathon name').fill('   ');
    await dlg.getByLabel('Organizer / platform').fill('   ');
    await dlg.getByLabel('Official event link').fill('https://example.com/blank');
    await dlg.getByRole('button', { name: 'Add to departures' }).click();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText('Enter the hackathon name.')).toBeVisible();
    await expect(dlg.getByText('Enter the organizer or platform.')).toBeVisible();
    await expect(dlg.getByLabel('Hackathon name')).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.tab', { hasText: 'Departures' })).toContainText(String(seed.length));

    const add = async (name: string, deadline: string) => {
      dlg = await open();
      await dlg.getByLabel('Hackathon name').fill(name);
      await dlg.getByLabel('Organizer / platform').fill('Nick');
      await dlg.getByLabel('End / deadline').fill(deadline);
      await dlg.getByLabel('Official event link').fill('https://example.com/added');
      await dlg.getByRole('button', { name: 'Add to departures' }).click();
      await expect(dlg).toBeHidden();
    };
    await add('E2E Future Hack', '2026-12-31');
    await expect(page.getByRole('dialog', { name: 'E2E Future Hack details' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Added E2E Future Hack to departures');
    await page.keyboard.press('Escape');
    const row = departures(page).filter({ hasText: 'E2E Future Hack' });
    await expect(row).toBeVisible();
    await expect(row).toBeInViewport();
    await expect(row.locator('.row-link')).toBeFocused();
    await expect(page.getByLabel('Search hackathons')).toHaveValue('');
    await page.screenshot({ path: ti.outputPath(`added-row-${ti.project.name}.png`) });

    // Already closed: the board shows closed rows so the new card is still there.
    await add('E2E Past Hack', '2026-01-15');
    await expect(page.getByRole('dialog', { name: 'E2E Past Hack details' }).locator('.drawer-tags .status-tag')).toHaveText('Gate closed');
    await page.keyboard.press('Escape');
    const past = departures(page).filter({ hasText: 'E2E Past Hack' });
    await expect(past).toBeInViewport();
    await expect(past.locator('.status-tag')).toHaveText('Gate closed');

    // Projects: a name of spaces is refused too.
    await page.goto(BASE + '#projects');
    await page.getByRole('button', { name: 'Add project' }).first().click();
    const pdlg = page.getByRole('dialog', { name: 'Add a project' });
    await pdlg.getByLabel('Project name').fill('    ');
    await pdlg.getByRole('button', { name: 'Issue pass' }).click();
    await expect(pdlg.getByText('Enter the project name.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(passes(page)).toHaveCount(projectSeed.length);
  });
});

test.describe('overlays', () => {
  test('drawers and dialogs keep focus inside, lock the page scroll, and the board has an h1', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const inside = (sel: string) => page.evaluate((s) => Boolean(document.activeElement?.closest(s)), sel);
    const tabAround = async (sel: string, n: number) => {
      for (let i = 0; i < n; i++) { await page.keyboard.press('Tab'); expect(await inside(sel), `Tab ${i + 1} stays in ${sel}`).toBe(true); }
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Shift+Tab'); expect(await inside(sel), `Shift+Tab ${i + 1} stays in ${sel}`).toBe(true); }
    };
    const locked = () => page.evaluate(() => ({ body: getComputedStyle(document.body).overflowY, inert: (document.querySelector('main') as HTMLElement & { inert: boolean }).inert }));

    await departures(page).first().locator('.row-link').click();
    await tabAround('.drawer', 40);
    expect(await locked()).toEqual({ body: 'hidden', inert: true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await locked()).toEqual({ body: 'visible', inert: false });

    await page.getByRole('button', { name: 'Add hackathon' }).first().click();
    await tabAround('.dialog', 25);
    expect(await locked()).toEqual({ body: 'hidden', inert: true });
    await page.keyboard.press('Escape');

    await page.goto(BASE + '#projects');
    await page.locator('.pass-open').first().click();
    await tabAround('.drawer', 30);
    await page.keyboard.press('Escape');
    expect(await locked()).toEqual({ body: 'visible', inert: false });
  });
});

test.describe('links and storage shape', () => {
  test('links are https-only: a javascript: repo is refused in the drawer and never rendered from storage', async ({ page }) => {
    await page.goto(BASE + '#projects');
    const p = projectSeed.find((x) => x.repo)!;
    await page.locator(`#pass-${p.id}`).getByRole('button').click();
    const drawer = page.getByRole('dialog');
    const repo = drawer.getByLabel('GitHub repo');
    for (const bad of ['javascript:alert(document.domain)', 'github.com/x']) {
      await repo.fill(bad);
      await expect(drawer.getByText('The link must start with https://')).toBeVisible();
      await expect(repo).toHaveAttribute('aria-invalid', 'true');
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.pass', { has: page.locator(`#pass-${p.id}`) }).locator('.stub-repo')).toHaveAttribute('href', p.repo!);
    await page.reload();
    expect(await page.evaluate((k) => localStorage.getItem(k) ?? '', PROJECTS_KEY)).not.toContain('javascript:');
    await expect(page.locator('.pass', { has: page.locator(`#pass-${p.id}`) }).locator('.stub-repo')).toHaveAttribute('href', p.repo!);

    // Stored by an older build: a custom hackathon and a custom project with javascript: links.
    await store(page, {
      [BOARD_KEY]: { items: [{ id: 'custom-evil', name: 'E2E Evil Hack', organizer: 'x', track: 'ai', prize: 'TBA', startDate: null, deadline: '2026-12-31', rolling: false, format: 'online', location: null, country: null, url: 'javascript:alert(1)', source: 'manual', description: null, free: null, judgeScore: null, judgeIdea: null, status: 'discovered', notes: '', checklist: [] }] },
      [PROJECTS_KEY]: { version: 26, items: [{ id: 'custom-evil-pass', name: 'E2E Evil Pass', pitch: '', targets: [], judgeScore: null, status: 'idea', progress: 0, repo: 'javascript:alert(1)', nextStep: '', notes: '' }] },
    });
    await page.reload();
    await expect(passes(page)).toHaveCount(projectSeed.length + 1);
    await expect(page.locator('a[href^="javascript:" i]')).toHaveCount(0);
    await page.goto(BASE + '#hackathons');
    await page.getByLabel('Search hackathons').fill('E2E Evil Hack');
    await departures(page).first().locator('.row-link').click();
    await expect(page.getByRole('dialog')).toContainText('No https event link saved');
    await expect(page.locator('a[href^="javascript:" i]')).toHaveCount(0);
  });

  test('a saved board in an unreadable shape still renders; malformed entries are dropped or repaired', async ({ page }) => {
    await page.goto(BASE);
    await store(page, {
      [PROJECTS_KEY]: { version: 26, items: [{ id: 'x', name: 'E2E Broken Pass', targets: [null, 7, { label: 3 }] }] },
      [BOARD_KEY]: { items: [{ id: 'custom-bad', name: 'E2E Bad Hack', organizer: 5, deadline: 123, location: {}, country: [], url: 'https://example.com', status: 'discovered' }, null, 'junk', { id: 'custom-nameless' }] },
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'All departures' })).toBeVisible();
    await expect(page.locator('.tab', { hasText: 'Departures' })).toContainText(String(seed.length + 1));
    await page.getByLabel('Search hackathons').fill('E2E Bad Hack');
    await expect(departures(page)).toHaveCount(1);
    await departures(page).first().locator('.row-link').click();
    await expect(page.getByRole('dialog', { name: 'E2E Bad Hack details' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto(BASE + '#projects');
    await expect(passes(page)).toHaveCount(projectSeed.length + 1);
    await expect(page.locator('.pass', { hasText: 'E2E Broken Pass' })).toContainText('Internal: no hackathon target.');
  });

  test('a render error shows a recovery screen that clears the saved board', async ({ page, watch }) => {
    // Stand-in for a saved board this build can't draw: while the marker is stored, the clock throws.
    watch.allowConsoleError(/boom from the e2e test/);
    await page.addInitScript((key) => {
      const real = Intl.DateTimeFormat.prototype.formatToParts;
      Intl.DateTimeFormat.prototype.formatToParts = function (...args) {
        if ((localStorage.getItem(key) ?? '').includes('e2e-boom')) throw new TypeError('boom from the e2e test');
        return real.apply(this, args);
      };
    }, BOARD_KEY);
    await page.goto(BASE);
    await store(page, { [BOARD_KEY]: { format: 2, edits: {}, custom: [], marker: 'e2e-boom' } });
    await page.reload();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('The board could not be shown');
    await alert.getByRole('button', { name: 'Clear the saved board and reload' }).click();
    await expect(page.getByRole('heading', { name: 'All departures' })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k) ?? '', BOARD_KEY)).not.toContain('e2e-boom');
  });
});

test.describe('first paint and counts', () => {
  test('split flaps show real digits on the first frame, not blanks', async ({ page }, ti) => {
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.locator('.world-clock .flap').first().waitFor({ state: 'attached' });
    const r = await page.evaluate(() => {
      const flaps = [...document.querySelectorAll('.flap')];
      const text = (f: Element, sel: string) => f.querySelector(`:scope > ${sel}`)?.textContent?.trim();
      return { total: flaps.length, blank: flaps.filter((f) => !text(f, '.flap-top:not(.flap-leaf-top)') || !text(f, '.flap-bottom:not(.flap-leaf-bottom)') || text(f, '.flap-leaf-top') === '').length };
    });
    expect(r.total).toBeGreaterThan(8);
    expect(r.blank).toBe(0);
    await page.screenshot({ path: ti.outputPath(`first-paint-${ti.project.name}.png`) });
  });

  test("'closed hidden' counts only closed rows that match the filters", async ({ page }) => {
    await page.goto(BASE);
    const now = Date.now();
    const line = page.locator('.board .result-line');
    const check = async (match: typeof seed) => {
      const closed = match.filter((h) => closedNow(h, now)).length;
      expect((await shown(page)).total).toBe(match.length - closed);
      if (closed) await expect(line).toContainText(`${closed} closed hidden`);
      else await expect(line).not.toContainText('closed hidden');
      if (closed) {
        await line.getByRole('button', { name: 'Show closed' }).click();
        expect((await shown(page)).total).toBe(match.length);
        await line.getByRole('button', { name: 'Hide closed' }).click();
      }
    };
    await page.getByLabel('Search hackathons').fill('tokyo');
    await check(seed.filter((h) => `${h.name} ${h.organizer} ${h.location ?? ''} ${h.country ?? ''} ${h.source}`.toLowerCase().includes('tokyo')));
    await page.getByLabel('Search hackathons').fill('');
    await page.locator('.select-field', { hasText: 'Format' }).locator('select').selectOption('in-person');
    await check(seed.filter((h) => h.format === 'in-person'));
  });

  test('a pass whose judge score and self-review differ by 2 or more says so', async ({ page }) => {
    await page.goto(BASE + '#projects');
    let flagged = 0;
    for (const p of projectSeed) {
      const m = (p.scoreNote ?? '').match(/Self-review ([A-Z][a-z]{2} \d{1,2})[^:]*:\s*(\d+(?:\.\d+)?)(?:\s*→\s*(\d+(?:\.\d+)?))?/);
      const review = m ? Number(m[3] ?? m[2]) : null;
      const disagree = p.judgeScore !== null && review !== null && Math.abs(p.judgeScore - review) >= 2;
      const flag = page.locator('.pass', { has: page.locator(`#pass-${p.id}`) }).locator('.score-flag');
      if (disagree) { flagged++; await expect(flag).toContainText('Scores disagree'); await expect(flag).toContainText(`${p.judgeScore}`); }
      else await expect(flag).toHaveCount(0);
    }
    expect(flagged).toBeGreaterThan(0);
    await expect(page.locator('.pass', { has: page.locator('#pass-blackbox-receipts') }).locator('.score-flag')).toContainText('Scores disagree');
  });
});
