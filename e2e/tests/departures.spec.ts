import { projectSeed } from '../../src/data/projects.ts';
import { test, expect, BASE, seed, endMs, departures, ourFlights, expectInViewport, expectNoHorizontalScroll, isMobile, logButtons, shown } from './fixtures.ts';

const PAGE = 30;
const fmt = (ms: number, tz: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { time: `${p.hour}:${p.minute}`, date: `${p.month} ${p.day}` };
};
const byId = new Map(seed.map((h) => [h.id, h]));

/** The next departure, worked out from the seed without the app's code: the soonest future, dated
 * deadline among targets of projects that are not submitted and not marked "not entered"/portfolio. */
function expectedNext(now: number) {
  let best: { label: string; project: string; end: number } | null = null;
  for (const p of projectSeed) {
    if (p.status === 'submitted') continue;
    for (const t of p.targets) {
      const notEntering = /not entered/i.test(t.label) || /^not entered/i.test(p.flag ?? '') || /^portfolio$/i.test(p.flag ?? '');
      const h = t.hackathonId ? byId.get(t.hackathonId) : undefined;
      if (notEntering || h?.rolling || (h && (h.status === 'submitted' || h.status === 'results'))) continue;
      const end = endMs(h ? h.deadline : t.deadline);
      if (end === null || end <= now) continue;
      if (!best || end < best.end) best = { label: t.label, project: p.name.replace(/\s*\(.*\)\s*$/, ''), end };
    }
  }
  return best;
}

test.describe('departures board', () => {
  test('live UTC and IST clocks show the real time', async ({ page }, ti) => {
    await page.goto(BASE);
    const now = Date.now();
    for (const [zone, tz] of [['UTC', 'UTC'], ['IST', 'Asia/Kolkata']] as const) {
      const label = await page.locator('.world-clock .clock', { hasText: zone }).getByRole('img').getAttribute('aria-label');
      // Allow a minute rollover between reading Date.now() and the page.
      const ok = [now, now + 60_000].map((ms) => fmt(ms, tz)).map((c) => `${c.time} ${zone}, ${c.date}`);
      expect(ok).toContain(label);
    }
    await expect(page.locator('.world-clock .flap').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: ti.outputPath(`departures-top-${ti.project.name}.png`) });
  });

  test('next departure: the soonest open deadline of ours, counting down in split flaps', async ({ page }, ti) => {
    await page.goto(BASE);
    const now = Date.now();
    const next = expectedNext(now)!;
    const nd = page.getByRole('region', { name: 'Next departure' });
    await expect(nd.locator('.nd-field', { hasText: 'Destination' })).toContainText(next.label);
    await expect(nd.locator('.nd-field', { hasText: 'Gate' })).toContainText(next.project);
    const utc = fmt(next.end, 'UTC');
    await expect(nd.locator('.nd-field', { hasText: 'Closes' })).toContainText(`${utc.time}UTC${utc.date}`);
    const ist = fmt(next.end, 'Asia/Kolkata');
    await expect(nd.locator('.dc-ist')).toContainText(`${ist.time}IST${ist.date}`);
    const left = (ms: number) => { const m = Math.max(0, Math.floor((next.end - Math.floor(ms / 60000) * 60000) / 60000)); return `${Math.floor(m / 1440)} days ${Math.floor((m % 1440) / 60)} hours ${m % 60} minutes left`; };
    const spoken = await nd.locator('.flap-countdown').getAttribute('aria-label');
    expect([left(now), left(now + 60_000)]).toContain(spoken);
    // The flaps spell the same numbers: dd hh mm.
    const digits = (await nd.locator('.flap-countdown .flap > .flap-top:not(.flap-leaf-top)').allTextContents()).join('');
    const [d, h, m] = spoken!.match(/\d+/g)!.map(Number);
    expect(digits).toBe(`${String(d).padStart(2, '0')}${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`);
    // On first paint every flap flips in (the board's one animation).
    expect(await nd.locator('.flap-leaf-top').count()).toBeGreaterThan(0);
    expect(await nd.locator('.flap-leaf-top').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('flap-fall');
    await page.screenshot({ path: ti.outputPath(`next-departure-${ti.project.name}.png`) });
  });

  test('a minute later the clocks and countdowns flip by exactly one minute', async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await page.goto(BASE);
    const nd = page.getByRole('region', { name: 'Next departure' }).locator('.flap-countdown');
    const utc = page.locator('.world-clock .clock', { hasText: 'UTC' }).getByRole('img');
    const mins = (s: string | null) => { const [d, h, m] = s!.match(/\d+/g)!.map(Number); return d * 1440 + h * 60 + m; };
    const before = { left: mins(await nd.getAttribute('aria-label')), clock: await utc.getAttribute('aria-label') };
    await page.clock.runFor(60_000);
    await expect.poll(async () => mins(await nd.getAttribute('aria-label'))).toBe(before.left - 1);
    await expect(utc).not.toHaveAttribute('aria-label', before.clock!);
  });

  test('reduced motion: flaps render statically, no falling leaves', async ({ page }, ti) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE);
    await expect(page.getByRole('region', { name: 'Next departure' }).locator('.flap').first()).toBeVisible();
    expect(await page.locator('.flap-leaf-top, .flap-leaf-bottom').count()).toBe(0);
    // Each flap's two halves show the same character: no half-flipped state.
    const mismatched = await page.locator('.flap').evaluateAll((fs) => fs.filter((f) => f.querySelector('.flap-top')!.textContent !== f.querySelector('.flap-bottom')!.textContent).length);
    expect(mismatched).toBe(0);
    await page.screenshot({ path: ti.outputPath(`reduced-motion-${ti.project.name}.png`) });
  });

  test('our flights: status filter shows only that status, counts match, toggles back', async ({ page }, ti) => {
    await page.goto(BASE);
    const group = page.getByRole('group', { name: 'Filter by status' });
    const all = await ourFlights(page).count();
    expect(all).toBe(projectSeed.reduce((n, p) => n + p.targets.length, 0));
    await expect(group.getByRole('button', { name: /^All/ })).toHaveText(`All${all}`);
    const buttons = group.getByRole('button');
    const n = await buttons.count();
    let sum = 0;
    for (let i = 1; i < n; i++) {
      const b = buttons.nth(i);
      const [, label, count] = /^(.*?)(\d+)$/.exec((await b.textContent())!.trim())!;
      await b.click();
      await expect(b).toHaveAttribute('aria-pressed', 'true');
      await expect(ourFlights(page)).toHaveCount(Number(count));
      await expect(ourFlights(page).locator('.status-tag')).toHaveText(Array(Number(count)).fill(label));
      // The departures list follows the same status.
      await expect(page.locator('.board .result-line')).toContainText(`${label} only`);
      sum += Number(count);
      if (label === 'Delayed') await page.screenshot({ path: ti.outputPath(`flights-delayed-${ti.project.name}.png`) });
      await b.click(); // pressing it again clears it
      await expect(group.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
    }
    expect(sum).toBe(all);
    await page.locator('.legend summary').click();
    await expect(page.locator('.legend li')).toHaveCount(8);
    await expectNoHorizontalScroll(page);
  });

  test('all departures: closed hidden by default, Show/Hide closed, 30 per page to the end', async ({ page }, ti) => {
    await page.goto(BASE);
    const now = Date.now();
    const closed = seed.filter((h) => !h.rolling && endMs(h.deadline) !== null && endMs(h.deadline)! <= now).length;
    await expect(page.locator('.board .result-line')).toContainText(`${closed} closed hidden`);
    let s = await shown(page);
    expect(s).toMatchObject({ visible: PAGE, total: seed.length - closed });
    await expect(departures(page)).toHaveCount(PAGE);
    await expect(departures(page).locator('.status-tag', { hasText: 'Gate closed' })).toHaveCount(0);
    // Soonest first: dated rows ascend.
    const firstEnds = seed.filter((h) => !h.rolling && endMs(h.deadline) && endMs(h.deadline)! > now).map((h) => endMs(h.deadline)!).sort((a, b) => a - b);
    const name0 = await departures(page).first().locator('.row-link').textContent();
    expect(endMs(seed.find((h) => h.name === name0)!.deadline)).toBe(firstEnds[0]);

    // Page through to the end.
    let pages = 1;
    while (await page.getByRole('button', { name: /^Show \d+ more departures/ }).count()) {
      const left = s.total - s.visible;
      await expect(page.getByRole('button', { name: /^Show \d+ more departures/ })).toHaveText(`Show ${Math.min(PAGE, left)} more departures (${left} left)`);
      await page.getByRole('button', { name: /^Show \d+ more departures/ }).click();
      pages++;
      s = await shown(page);
      expect(s.visible).toBe(Math.min(pages * PAGE, s.total));
      await expect(departures(page)).toHaveCount(s.visible);
    }
    expect(s.visible).toBe(s.total);

    await page.getByRole('button', { name: 'Show closed' }).click();
    s = await shown(page);
    expect(s.total).toBe(seed.length);
    await expect(departures(page).locator('.status-tag', { hasText: 'Gate closed' })).toHaveCount(closed);
    await page.screenshot({ path: ti.outputPath(`departures-closed-shown-${ti.project.name}.png`) });
    await page.getByRole('button', { name: 'Hide closed' }).click();
    expect((await shown(page)).total).toBe(seed.length - closed);
    await expectNoHorizontalScroll(page);
  });

  test('all departures: search, track, format, source, idea and stage filters match the seed', async ({ page }, ti) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Show closed' }).click(); // compare against the whole seed
    const total = async () => (await shown(page)).total;
    expect(await total()).toBe(seed.length);

    const search = page.getByRole('textbox', { name: 'Search hackathons' });
    await search.fill('tokyo');
    expect(await total()).toBe(seed.filter((h) => `${h.name} ${h.organizer} ${h.location ?? ''} ${h.country ?? ''} ${h.source}`.toLowerCase().includes('tokyo')).length);
    await expect(departures(page).first()).toContainText(/tokyo/i);
    await page.screenshot({ path: ti.outputPath(`search-tokyo-${ti.project.name}.png`) });
    await page.locator('.board .result-line').getByRole('button', { name: 'Clear filters' }).click();
    await expect(search).toHaveValue('');
    expect(await total()).toBe(seed.length);

    const track = page.getByRole('group', { name: 'Filter by track' });
    await track.getByRole('button', { name: 'Web3' }).click();
    expect(await total()).toBe(seed.filter((h) => h.track !== 'ai').length);
    await track.getByRole('button', { name: 'AI' }).click();
    expect(await total()).toBe(seed.filter((h) => h.track !== 'web3').length);
    await track.getByRole('button', { name: 'All' }).click();

    const select = (label: string) => page.locator('.select-field', { hasText: label }).locator('select');
    for (const [value, f] of [['online', 'online'], ['in-person', 'in-person'], ['hybrid', 'hybrid']]) {
      await select('Format').selectOption(value);
      expect(await total()).toBe(seed.filter((h) => h.format === f).length);
    }
    await select('Format').selectOption('all');
    for (const src of ['hacklist.io', 'hackathons.fun']) {
      await select('Source').selectOption(src);
      expect(await total()).toBe(seed.filter((h) => h.source.startsWith(src)).length);
    }
    await select('Source').selectOption('all');
    const ideas = [...new Set(seed.map((h) => h.judgeIdea).filter(Boolean))] as string[];
    for (const idea of ideas) {
      await select('Idea').selectOption(idea);
      expect(await total()).toBe(seed.filter((h) => h.judgeIdea === idea).length);
    }
    await select('Idea').selectOption('all');
    await select('Stage').selectOption('discovered');
    expect(await total()).toBe(seed.filter((h) => h.status === 'discovered').length);
    // A stage nothing is in: the empty state, with a working Clear filters.
    await select('Stage').selectOption('results');
    await expect(page.getByRole('heading', { name: 'No departures match' })).toBeVisible();
    await page.screenshot({ path: ti.outputPath(`departures-empty-${ti.project.name}.png`) });
    await page.getByRole('region', { name: 'All departures board' }).getByRole('button', { name: 'Clear filters' }).click();
    expect(await total()).toBe(seed.length);

    // Sort by judge score: scored rows descend, unscored last.
    await select('Sort').selectOption('judgeScore');
    const scores = (await departures(page).locator('.c-score').allTextContents()).map((t) => t.replace('Score', '').trim());
    const nums = scores.filter((x) => x !== '—').map(Number);
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
    expect(scores.slice(nums.length).every((x) => x === '—')).toBe(true);
    await select('Sort').selectOption('latest');
    await expectNoHorizontalScroll(page);
  });

  test('a departure opens its drawer: stage select saves, Escape closes, focus returns', async ({ page }, ti) => {
    await page.goto(BASE);
    const row = departures(page).first();
    const name = (await row.locator('.row-link').textContent())!;
    await row.locator('.row-link').click();
    const drawer = page.getByRole('dialog', { name: `${name} details` });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    const h = seed.find((x) => x.name === name)!;
    await expect(drawer.getByRole('link', { name: /Open official page/ })).toHaveAttribute('href', h.url);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: ti.outputPath(`hackathon-drawer-${ti.project.name}.png`) });
    // Board stage → Submitted: the row departs and the choice survives a reload.
    await drawer.getByLabel('Board stage').selectOption('submitted');
    await expect(drawer.locator('.drawer-tags .status-tag')).toHaveText('Departed');
    await drawer.getByRole('checkbox', { name: 'Repo' }).check({ force: true });
    await expect(drawer.getByRole('heading', { name: /Build checklist/ })).toContainText('1 of 6');
    await drawer.getByLabel('Team notes').fill('e2e note');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.locator('.row-link', { hasText: name })).toBeFocused();
    await page.reload();
    await page.getByRole('button', { name: 'Show closed' }).click();
    await page.getByLabel('Search hackathons').fill(name.slice(0, 20));
    await page.locator('.row-link', { hasText: name }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Board stage')).toHaveValue('submitted');
    await expect(page.getByRole('dialog').getByLabel('Team notes')).toHaveValue('e2e note');
    // The backdrop closes it on desktop (on phones the drawer is full width, so the Close button);
    // Reset to seed (after its confirmation, which names the stage change) puts the stage back.
    if (isMobile(ti.project.name)) await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    else await page.getByRole('button', { name: 'Close details' }).click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Reset to seed' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('1 stage change');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reset board' }).click();
    await page.locator('.row-link', { hasText: name }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Board stage')).toHaveValue('discovered');
  });

  test('our flights links: destination opens the hackathon drawer, the gate opens the pass drawer', async ({ page }) => {
    await page.goto(BASE);
    const row = ourFlights(page).filter({ has: page.locator('.row-link') }).first();
    const dest = (await row.locator('.row-link').textContent())!;
    const gate = (await row.locator('.gate-chip').textContent())!;
    await row.locator('.row-link').click();
    const drawer = page.getByRole('dialog', { name: / details$/ });
    await expect(drawer).toBeVisible();
    // A gate inside the hackathon drawer opens that project's pass drawer.
    await drawer.locator('.gate-row').first().click();
    await expect(page.getByRole('dialog', { name: / details$/ }).locator('.eyebrow')).toHaveText('Pass details');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('.row-link', { hasText: dest }).first()).toBeFocused();
    await row.locator('.gate-chip').click();
    await expect(page.getByRole('dialog').locator('h2')).toContainText(gate.trim(), { ignoreCase: true });
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(row.locator('.gate-chip')).toBeFocused();
    // The next-departure gate link opens its pass.
    await page.getByRole('region', { name: 'Next departure' }).locator('.nd-field', { hasText: 'Gate' }).getByRole('button').click();
    await expect(page.getByRole('dialog').locator('.eyebrow')).toHaveText('Pass details');
  });

  test('Add hackathon: https is required; a valid entry lands on the board, visible without searching', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Add hackathon' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Add a hackathon' });
    await dlg.getByLabel('Hackathon name').fill('E2E Test Hack');
    await dlg.getByLabel('Organizer / platform').fill('Nick');
    await dlg.getByLabel('Official event link').fill('http://example.com');
    await dlg.getByRole('button', { name: 'Add to departures' }).click();
    // Either the browser's own url check or the app's https rule stops it.
    await expect(dlg).toBeVisible();
    await dlg.getByLabel('Official event link').fill('https://example.com/e2e');
    await dlg.getByLabel('End / deadline').fill('2026-12-31');
    await dlg.getByRole('button', { name: 'Add to departures' }).click();
    await expect(dlg).toBeHidden();
    // Its drawer opens; closing it lands on the new row, already on screen, no search needed.
    await expect(page.getByRole('dialog', { name: 'E2E Test Hack details' })).toBeVisible();
    await page.keyboard.press('Escape');
    const added = departures(page).filter({ hasText: 'E2E Test Hack' });
    await expect(added).toHaveCount(1);
    await expect(added).toBeInViewport();
    await expect(added.locator('.row-link')).toBeFocused();
    await expect(page.locator('.tab', { hasText: 'Departures' })).toContainText(String(seed.length + 1));
    await page.getByRole('button', { name: 'Add hackathon' }).first().click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add hackathon' }).first()).toBeFocused();
  });

  test('no button labelled "log" on the departures board, the drawers or the dialog', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Show closed' }).click();
    while (await page.getByRole('button', { name: /^Show \d+ more departures/ }).count()) await page.getByRole('button', { name: /^Show \d+ more departures/ }).click();
    await page.locator('.legend summary').click();
    expect(await logButtons(page)).toHaveLength(0);
    await departures(page).first().locator('.row-link').click();
    expect(await logButtons(page)).toHaveLength(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add hackathon' }).first().click();
    expect(await logButtons(page)).toHaveLength(0);
  });
});

test('skip link and footer', async ({ page }, ti) => {
  await page.goto(BASE);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to board' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  if (!isMobile(ti.project.name)) await expectInViewport(page, '#main');
  await expect(page.locator('.foot')).toContainText('Times in UTC and IST (UTC+5:30).');
});
