import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { style } from '../tools/style.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
export const APP = 'http://localhost:4173';
export const OUT = process.env.SHOTS ?? path.resolve('../shots');
fs.mkdirSync(OUT, { recursive: true });
const FONTS = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../fonts');
const face = (fam, w, file, range = '') => `@font-face{font-family:'${fam}';font-weight:${w};font-display:block;src:url(https://fonts.gstatic.com/local/${file}) format('woff2');${range ? `unicode-range:${range};` : ''}}`;
const FONT_CSS = [200, 400, 500, 600, 700].map((w) => face('Inter', w, `inter-latin-${w}-normal.woff2`)).join('')
  + [400, 500, 600, 700].map((w) => face('Noto Sans Bengali', w, `noto-sans-bengali-bengali-${w}-normal.woff2`, 'U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1')).join('')
  + face('Anton', 400, 'anton-latin-400-normal.woff2');
const STYLES = { light: JSON.stringify(style('light')), dark: JSON.stringify(style('dark')) };
export async function launch() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-color-profile=srgb', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
export async function context(browser, { mobile = true, theme = 'light', lang = 'en', geo = { latitude: 23.756, longitude: 90.375 } } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: geo, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'] }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, geolocation: geo, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'] });
  await ctx.route('https://tiles.openfreemap.org/**', (route) => {
    const dark = route.request().url().includes('/dark');
    route.fulfill({ status: 200, contentType: 'application/json', body: dark ? STYLES.dark : STYLES.light });
  });
  await ctx.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
  await ctx.route('https://fonts.gstatic.com/local/**', (route) => route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(FONTS, route.request().url().split('/').pop())) }));
  await ctx.addInitScript(([t, l]) => { try { if (!sessionStorage.getItem('video.init')) { sessionStorage.setItem('video.init', '1'); localStorage.setItem('cholo.theme', t); if (l) localStorage.setItem('cholo.lang', l); } } catch {} }, [theme, lang]);
  return ctx;
}
export async function login(page, phone) {
  await page.goto(`${APP}/login`);
  await page.getByLabel('Phone').fill(phone);
  await page.getByLabel('Password', { exact: true }).fill('DemoPass123');
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}
export async function shot(page, name, { wait = 600, full = false } = {}) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log('shot', name);
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const RAW = process.env.RAW ?? '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/raw';
export async function recorder(page, name, { maxWidth = 780, maxHeight = 1688 } = {}) {
  const dir = path.join(RAW, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; const events = []; let writes = Promise.resolve();
  cdp.on('Page.screencastFrame', (f) => {
    const ts = f.metadata.timestamp; const file = `${frames.length.toString().padStart(6, '0')}.jpg`;
    frames.push([ts, file]); const buf = Buffer.from(f.data, 'base64');
    writes = writes.then(() => fs.promises.writeFile(path.join(dir, file), buf));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth, maxHeight, everyNthFrame: 1 });
  const now = () => Date.now() / 1000;
  const rec = {
    mark(label) { events.push({ t: now(), kind: 'mark', label }); },
    async tap(locator, { touch = true } = {}) {
      await locator.waitFor({ state: 'visible', timeout: 20000 });
      await locator.evaluate(async (node) => {
        const r = node.getBoundingClientRect(); const vh = innerHeight; const top = 80, bottom = vh - 96;
        if (r.top >= top && r.bottom <= bottom) return;
        let el = node.parentElement; while (el && !(el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
        el = el ?? document.scrollingElement; const er = el === document.scrollingElement ? { top: 0, bottom: vh } : el.getBoundingClientRect();
        const want = r.top - Math.max(er.top, top) - (Math.min(er.bottom, bottom) - Math.max(er.top, top)) * 0.45 + r.height / 2;
        const start = el.scrollTop, dur = 650, t0 = performance.now();
        await new Promise((res) => { const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; el.scrollTop = start + want * e; if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      });
      await page.waitForTimeout(320);
      const b = await locator.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
      events.push({ t: now(), kind: 'tap', x, y });
      if (touch && page.context()._options?.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    },
    async type(locator, text, delay = 85) { await rec.tap(locator); for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(delay + Math.random() * 40); } },
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {}); await writes;
      fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ frames, events, viewport: page.viewportSize() }));
      console.log('recorded', name, frames.length, 'frames', events.filter((e) => e.kind === 'mark').map((e) => e.label).join(','));
    },
  };
  return rec;
}
export async function db() {
  const require2 = createRequire('/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/app/server/package.json');
  const pg = require2('pg'); const c = new pg.Client({ connectionString: 'postgresql://postgres@127.0.0.1:5433/cholo_video' }); await c.connect(); return c;
}
export async function smoothScroll(page, dy, dur = 900, selector = null) {
  await page.evaluate(async ([dy, dur, selector]) => {
    let el = selector ? document.querySelector(selector) : null;
    if (!el) { const all = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 200); el = all.sort((a, b) => b.clientHeight - a.clientHeight)[0] ?? document.scrollingElement; }
    if (document.scrollingElement.scrollHeight > innerHeight + 40 && !selector) el = document.scrollingElement;
    const start = el.scrollTop, t0 = performance.now();
    await new Promise((res) => { const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; el.scrollTop = start + dy * e; if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  }, [dy, dur, selector]);
  await page.waitForTimeout(350);
}
export async function beat(page, name, url, fn, opts = {}) {
  try {
    if (url) { await page.goto(url); await page.waitForTimeout(opts.settle ?? 2600); }
    await page.locator('[role=status] button, button[aria-label*="ismiss"]').first().click({ timeout: 600 }).catch(() => {});
    const r = await recorder(page, name, opts.rec); r.mark('start'); await page.waitForTimeout(500);
    await fn(r); r.mark('end'); await page.waitForTimeout(400); await r.stop();
  } catch (e) { console.log('BEAT FAIL', name, e.message.split('\n')[0]); await page.screenshot({ path: `/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/peek/fail-${name}.png`, timeout: 5000 }).catch(() => {}); console.log('  at url', page.url()); }
}
