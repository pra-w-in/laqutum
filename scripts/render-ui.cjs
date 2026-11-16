/* Isolated renderer: launches its own headless executable and fresh context.
 * Never connects to a running browser or reads a user's browser profile.
 * Dependency: npm install --prefix "$env:TEMP/laqutum-render-deps" playwright-core
 * Run: node scripts/render-ui.cjs (design-server.py must serve port 8080).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(path.join(process.env.UI_RENDER_DEPS || path.join(os.tmpdir(), 'laqutum-render-deps'), 'node_modules', 'playwright-core'));
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'ui-rebuild');
const executablePath = process.env.UI_RENDER_CHROME || path.join(os.homedir(), '.cache', 'puppeteer', 'chrome-headless-shell', 'win64-152.0.7977.42', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const base = process.env.UI_RENDER_URL || 'http://127.0.0.1:8080/__preview';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  const report = { mode: 'isolated headless; fresh contexts; no existing browser connection', base, captures: [] };
  try {
    for (const [size, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, laptop: { width: 820, height: 900 }, mobile: { width: 390, height: 844 }, compact: { width: 320, height: 700 } })) {
      if (process.env.UI_RENDER_SIZES && !process.env.UI_RENDER_SIZES.split(',').includes(size)) continue;
      for (const screen of ['home', 'lesson', 'practice', 'feedback', 'tutor', 'group', 'challenge', 'route', 'notebook', 'coverage', 'auth']) {
        if (process.env.UI_RENDER_SCREENS && !process.env.UI_RENDER_SCREENS.split(',').includes(screen)) continue;
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
        page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
        const result = { size, screen, errors };
        try {
          await page.goto(screen === 'auth' ? new URL('/', base).href : base, { waitUntil: 'networkidle' });
          if (screen === 'auth') {
            await page.locator('#authModalOverlay:not(.hidden)').waitFor();
          } else {
          await page.locator('#dashboard-content .home-start-btn').waitFor();
          if (['lesson', 'practice', 'feedback'].includes(screen)) {
            await page.locator('#dashboard-content .home-start-btn').first().click();
            await page.locator('#screen-lesson.active, #screen-quiz.active').waitFor();
            if (screen !== 'lesson') {
              await page.locator('.preview-screen.active [data-comp="understood"]').click();
              await page.locator('#btn-practice-independently').click();
              await page.locator('.practice-option-btn').first().waitFor();
              if (screen === 'feedback') {
                await page.locator('.practice-option-btn').first().click();
                await page.locator('#practice-submit-btn').click();
                await page.locator('#practice-next-btn').waitFor();
              }
            }
          } else if (['route', 'notebook', 'coverage'].includes(screen)) {
            await page.locator(`[data-dtab="${screen}"]`).click();
          } else if (screen !== 'home') {
            const targets = { tutor: ['app-nav-ask', 'screen-ask'], group: ['app-nav-socio', 'screen-socio'], challenge: ['app-nav-battle', 'screen-battle'] };
            const [button, target] = targets[screen];
            await page.locator('#' + button).click();
            await page.locator('#' + target + '.active').waitFor();
          }
          }
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(350);
          result.layout = await page.evaluate(() => {
            const width = innerWidth;
            const main = document.querySelector('.preview-main');
            const overflowing = [...document.querySelectorAll('.preview-screen.active *')].filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && (r.right > width + 1 || r.left < -1) && getComputedStyle(el).visibility !== 'hidden';
            }).slice(0, 15).map(el => ({ tag: el.tagName, id: el.id, class: el.className, text: el.textContent.trim().slice(0, 80) }));
            return { viewport: width, documentWidth: document.documentElement.scrollWidth, mainWidth: main?.clientWidth, mainScrollWidth: main?.scrollWidth, overflowing };
          });
          result.file = `${size}-${screen}.png`;
          await page.screenshot({ path: path.join(output, result.file), fullPage: true });
          result.ok = !errors.length && result.layout.documentWidth <= viewport.width + 1 && !result.layout.overflowing.length;
        } catch (error) { result.failure = error.message; result.ok = false; }
        report.captures.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'render-report.json'), JSON.stringify(report, null, 2));
  }
  const failures = report.captures.filter(result => !result.ok);
  console.log(JSON.stringify({ captures: report.captures.length, failures: failures.map(({ size, screen, errors, failure, layout }) => ({ size, screen, errors, failure, layout })), report: path.join(output, 'render-report.json') }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
