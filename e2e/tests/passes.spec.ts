import { projectSeed } from '../../src/data/projects.ts';
import { test, expect, BASE, expectNoHorizontalScroll, logButtons } from './fixtures.ts';

const short = (n: string) => n.replace(/\s*\(.*\)\s*$/, '').trim() || n;
const passes = (page: import('@playwright/test').Page) => page.locator('.pass');

test.describe('boarding passes', () => {
  test('one pass per seeded project; stage filter counts match the seed', async ({ page }, ti) => {
    await page.goto(BASE + '#projects');
    await expect(page.getByRole('heading', { name: 'One pass per project' })).toBeVisible();
    await expect(passes(page)).toHaveCount(projectSeed.length);
    await expect(page.locator('.tab[aria-current="page"]')).toContainText('Boarding passes');
    const stages = page.getByRole('group', { name: 'Filter by stage' });
    for (const [id, title] of [['idea', 'Idea'], ['building', 'Building'], ['verified', 'Verified'], ['submitted', 'Submitted']] as const) {
      const n = projectSeed.filter((p) => p.status === id).length;
      await stages.getByRole('button', { name: new RegExp(`^${title}`) }).click();
      await expect(passes(page)).toHaveCount(n);
      await expect(page.locator('.result-line')).toHaveText(new RegExp(`^${n} of ${projectSeed.length} passes`));
      if (n === 0) {
        await expect(page.getByRole('heading', { name: 'No passes match' })).toBeVisible();
        await page.screenshot({ path: ti.outputPath(`passes-empty-${ti.project.name}.png`) });
        await page.locator('.empty-state').getByRole('button', { name: 'Clear filters' }).click();
        await expect(passes(page)).toHaveCount(projectSeed.length);
      }
    }
    await stages.getByRole('button', { name: /^All/ }).click();
    await expect(passes(page)).toHaveCount(projectSeed.length);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: ti.outputPath(`passes-${ti.project.name}.png`) });
  });

  test('search, destination filter and sort', async ({ page }) => {
    await page.goto(BASE + '#projects');
    await page.getByLabel('Search projects').fill('leash');
    await expect(passes(page).first()).toContainText('LEASH');
    await page.locator('.result-line').getByRole('button', { name: 'Clear filters' }).click();
    await expect(passes(page)).toHaveCount(projectSeed.length);
    const dest = page.locator('.select-field', { hasText: 'Destination' }).locator('select');
    await dest.selectOption({ label: 'No destination' });
    await expect(passes(page)).toHaveCount(projectSeed.filter((p) => p.targets.length === 0).length);
    await dest.selectOption({ label: 'Qloo Agentic' });
    const qloo = projectSeed.filter((p) => p.targets.some((t) => t.label === 'Qloo Agentic'));
    await expect(passes(page)).toHaveCount(qloo.length);
    await expect(passes(page).locator('h3')).toHaveText(qloo.map((p) => short(p.name)), { ignoreCase: true });
    await dest.selectOption('all');
    const sort = page.locator('.select-field', { hasText: 'Sort' }).locator('select');
    await sort.selectOption('progress');
    const prog = (await passes(page).locator('.pass-fields div', { hasText: 'Progress' }).locator('dd').allTextContents()).map((t) => parseInt(t));
    expect(prog).toEqual([...prog].sort((a, b) => b - a));
    await sort.selectOption('judgeScore');
    const js = (await passes(page).locator('.pass-fields div', { hasText: 'Judge score' }).locator('dd').allTextContents()).filter((t) => t !== '—').map(Number);
    expect(js).toEqual([...js].sort((a, b) => b - a));
  });

  test('each pass shows its seed facts: score, progress, stage, repo link', async ({ page }) => {
    await page.goto(BASE + '#projects');
    for (const p of projectSeed) {
      const pass = page.locator('.pass', { has: page.locator(`#pass-${p.id}`) });
      await expect(pass.locator('h3')).toHaveText(short(p.name), { ignoreCase: true });
      await expect(pass.locator('.pass-fields div', { hasText: 'Judge score' }).locator('dd')).toHaveText(p.judgeScore === null ? '—' : String(p.judgeScore));
      await expect(pass.locator('.pass-fields div', { hasText: 'Progress' }).locator('dd')).toHaveText(`${p.progress}%`);
      if (p.repo) await expect(pass.locator('.stub-repo')).toHaveAttribute('href', p.repo);
    }
  });

  test('opening a pass: Stage select saves, Escape closes, focus returns to the pass', async ({ page }, ti) => {
    await page.goto(BASE + '#projects');
    const p = projectSeed.find((x) => x.status !== 'submitted')!;
    const opener = page.locator(`#pass-${p.id}`).getByRole('button');
    await opener.click();
    const drawer = page.getByRole('dialog', { name: `${p.name} details` });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    const stage = drawer.getByRole('combobox', { name: /^Stage/ });
    await expect(stage).toHaveValue(p.status);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: ti.outputPath(`pass-drawer-${ti.project.name}.png`) });
    await stage.selectOption('submitted');
    // Saved at once: the pass behind the drawer already shows it.
    const pass = page.locator('.pass', { has: page.locator(`#pass-${p.id}`) });
    await expect(pass.locator('.pass-fields div', { hasText: 'Stage' }).locator('dd')).toHaveText('Submitted');
    await expect(drawer.locator('.drawer-tags .status-tag')).toHaveText('Departed');
    await drawer.getByLabel('Progress percent').fill('95');
    await expect(pass.locator('.pass-fields div', { hasText: 'Progress' }).locator('dd')).toHaveText('95%');
    await drawer.getByLabel('Notes').fill('e2e pass note');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    // Survives a reload, and Reset to seed restores the seed stage.
    await page.reload();
    await expect(page.locator('.pass', { has: page.locator(`#pass-${p.id}`) }).locator('.pass-fields div', { hasText: 'Stage' }).locator('dd')).toHaveText('Submitted');
    await page.locator(`#pass-${p.id}`).getByRole('button').click();
    await expect(page.getByRole('dialog').getByLabel('Notes')).toHaveValue('e2e pass note');
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Reset to seed' }).click();
    const title = (await page.locator('.pass-fields').first().textContent()) && (await page.locator('.pass', { has: page.locator(`#pass-${p.id}`) }).locator('.pass-fields div', { hasText: 'Stage' }).locator('dd').textContent());
    expect(title?.toLowerCase()).toBe(p.status);
  });

  test('a pass route link opens the hackathon drawer', async ({ page }) => {
    await page.goto(BASE + '#projects');
    const link = page.locator('.route-link').first();
    const label = (await link.textContent())!.trim();
    await link.click();
    await expect(page.getByRole('dialog').locator('.eyebrow')).toHaveText('Flight details');
    await page.keyboard.press('Escape');
    await expect(page.locator('.route-link', { hasText: label }).first()).toBeFocused();
  });

  test('Add project issues a pass; Escape on the dialog returns focus', async ({ page }) => {
    await page.goto(BASE + '#projects');
    await page.getByRole('button', { name: 'Add project' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Add a project' });
    await dlg.getByLabel('Project name').fill('E2E Pass');
    await dlg.getByLabel('GitHub repo').fill('https://github.com/nickthelegend/e2e-pass');
    await dlg.getByRole('button', { name: 'Issue pass' }).click();
    await expect(dlg).toBeHidden();
    await expect(passes(page)).toHaveCount(projectSeed.length + 1);
    await expect(page.locator('.tab', { hasText: 'Boarding passes' })).toContainText(String(projectSeed.length + 1));
    await page.getByRole('button', { name: 'Add project' }).first().click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add project' }).first()).toBeFocused();
  });

  test('no button labelled "log" on the passes board or its drawer', async ({ page }) => {
    await page.goto(BASE + '#projects');
    expect(await logButtons(page)).toHaveLength(0);
    await page.locator('.pass-open').first().click();
    expect(await logButtons(page)).toHaveLength(0);
  });
});

test.describe('boards and storage', () => {
  test('the URL hash switches boards, including back and forward', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('.tab[aria-current="page"]')).toContainText('Departures');
    await page.locator('.tab', { hasText: 'Boarding passes' }).click();
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.getByRole('heading', { name: 'One pass per project' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'One pass per project' })).toBeHidden();
    await expect(page.locator('.tab[aria-current="page"]')).toContainText('Departures');
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'One pass per project' })).toBeVisible();
    await page.evaluate(() => { location.hash = '#hackathons'; });
    await expect(page.getByRole('heading', { name: 'All departures' })).toBeVisible();
    await page.goto(BASE + '#projects');
    await expect(page.getByRole('heading', { name: 'One pass per project' })).toBeVisible();
  });

  test('storage unavailable: both boards still work for the session, no errors', async ({ page }, ti) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
    });
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: 'All departures' })).toBeVisible();
    await page.locator('.board .row-link').first().click();
    await page.getByRole('dialog').getByLabel('Board stage').selectOption('shortlisted');
    await expect(page.getByRole('dialog').getByLabel('Board stage')).toHaveValue('shortlisted');
    await page.keyboard.press('Escape');
    await page.locator('.tab', { hasText: 'Boarding passes' }).click();
    await expect(passes(page)).toHaveCount(projectSeed.length);
    await page.locator('.pass-open').first().click();
    await page.getByRole('dialog').getByRole('combobox', { name: /^Stage/ }).selectOption('idea');
    await expect(page.getByRole('dialog').getByRole('combobox', { name: /^Stage/ })).toHaveValue('idea');
    await page.screenshot({ path: ti.outputPath(`storage-blocked-${ti.project.name}.png`) });
  });
});
