/* Functional UI smoke checks in a fresh, isolated headless browser. */
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(path.join(process.env.UI_RENDER_DEPS || path.join(os.tmpdir(), 'laqutum-render-deps'), 'node_modules', 'playwright-core'));
const executablePath = process.env.UI_RENDER_CHROME || path.join(os.homedir(), '.cache', 'puppeteer', 'chrome-headless-shell', 'win64-152.0.7977.42', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const base = process.env.UI_RENDER_URL || 'http://127.0.0.1:8080/__preview';

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith('http://127.0.0.1:8080/')) failures.push(`${response.status()} ${response.url()}`); });
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('#dashboard-content .dashboard-topic-card').first().waitFor();
      assert.equal(await page.locator('#library-result-count').innerText(), '47 topics');
      await page.locator('#workspace-category').selectOption('starter');
      assert.equal(await page.locator('#all-topics-grid-container .dashboard-topic-card').count(), 6);
      await page.locator('#all-topics-live-search').fill('not-a-real-topic');
      await page.locator('#clear-topic-filters').click();
      assert.equal(await page.locator('#all-topics-grid-container .dashboard-topic-card').count(), 47);
      await page.locator('#dashboard-content .dashboard-topic-card').first().click();
      await page.locator('#screen-lesson.active').waitFor();
      await page.locator('[data-comp="understood"]').click();
      await page.locator('#btn-practice-independently').click();
      await page.locator('.practice-option-btn').first().click();
      await page.locator('#practice-submit-btn').click();
      assert.equal(await page.locator('#practice-result-heading').count(), 1);
      await page.locator('#practice-next-btn').click();
      await page.locator('#screen-quiz.active, #screen-lesson.active').waitFor();
      await page.locator('#pv-back').click();
      await page.locator('#dashboard-content .dashboard-topic-card').first().waitFor();
      for (const [tab, target] of [['route', '#route-manager-inner'], ['notebook', '.mistake-notebook-wrap'], ['coverage', '#dash-active-tab-container']]) {
        await page.locator(`[data-dtab="${tab}"]`).click();
        await page.locator(target).waitFor();
      }
      await page.locator('[data-dtab="patterns"]').click();
      for (const [nav, target] of [['app-nav-ask', 'screen-ask'], ['app-nav-socio', 'screen-socio'], ['app-nav-battle', 'screen-battle']]) {
        await page.locator(`#${nav}`).click();
        await page.locator(`#${target}.active`).waitFor();
      }
      assert.deepEqual(failures, []);
      results.push({ width: viewport.width, flows: 'topic search/filter, lesson, practice, feedback, plan, notebook, guide, tutor, group, challenge', ok: true });
      await context.close();
    }
    const auth = await browser.newPage();
    await auth.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    await auth.locator('#authModalOverlay:not(.hidden)').waitFor();
    await auth.locator('#switchToSignin').click();
    assert.equal(await auth.locator('#formSignin').isVisible(), true);
    await auth.locator('#switchToSignup').click();
    assert.equal(await auth.locator('#formSignup').isVisible(), true);
    results.push({ flow: 'sign-up/sign-in switching', ok: true });
    await auth.close();
  } finally { await browser.close(); }
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
