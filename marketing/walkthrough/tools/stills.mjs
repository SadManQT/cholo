// Thumbnail (1920x1080 + 1280x720) and the vertical-cut overlay (1080x1920, transparent), built with the scene CSS/fonts.
// usage: node stills.mjs <outdir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCR = '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad';
const OUT = path.resolve(process.argv[2]); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u.startsWith('/scenes/clips/') ? path.join(SCR, 'clips', u.slice(14)) : path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1920 } });
await page.goto(`http://localhost:${server.address().port}/scenes/index.html`);
await page.waitForFunction(() => window.READY, null, { timeout: 120000 });

// pick a mid-trip passenger frame (live map + driver card)
const clipFrame = (id, f) => `clips/${id}/${String(f).padStart(5, '0')}.jpg`;
const enroute = clipFrame('p-enroute', 160);

await page.evaluate(({ enroute }) => {
  const st = document.getElementById('stage'); st.innerHTML = ''; st.style.cssText = 'width:1920px;height:1080px;background:var(--night)';
  st.innerHTML = `
  <div class="abs" style="inset:0;background:radial-gradient(1300px 900px at 72% 40%,#0E5A45 0%,#073026 45%,#03140F 100%)"></div>
  <div class="abs" style="inset:-100px;background-image:radial-gradient(rgba(255,255,255,.07) 1.6px,transparent 1.8px);background-size:46px 46px"></div>
  <svg class="abs" style="left:880px;top:0" width="1040" height="1080" viewBox="0 0 1040 1080">
    <path d="M140 1080 C 260 820, 380 700, 520 560 S 820 260, 1040 120" fill="none" stroke="#E11D48" stroke-width="20" stroke-linecap="round" opacity=".95"/>
    ${[[205, 950], [330, 760], [520, 560], [700, 380], [880, 230]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="#fff" stroke="#E11D48" stroke-width="9"/>`).join('')}
  </svg>
  <div class="abs" style="left:96px;top:250px;width:860px">
    <img src="logo-light.svg" style="height:230px;display:block;margin-left:-8px">
    <div style="margin-top:44px;font:900 108px/1.0 Inter;letter-spacing:-3px;color:#fff">Ride. Safe.<br><span style="color:var(--gold)">Smart.</span></div>
    <div style="margin-top:38px;display:inline-flex;align-items:center;gap:14px;padding:14px 26px;border-radius:40px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);font:700 30px Inter;color:#fff">Full walkthrough<span style="opacity:.5">·</span><span style="color:var(--gold2)">11 min</span></div>
  </div>
  <div style="position:absolute;left:1180px;top:40px;transform:rotate(6deg) scale(1.08);transform-origin:50% 50%">${phone('tp', { scale: 1, clip: false, inner: `<img src="${enroute}" style="position:absolute;left:0;top:38px;width:374px;height:809px;object-fit:cover">` })}</div>
  <div class="abs" style="left:960px;top:770px;width:420px;padding:22px 26px;border-radius:26px;background:#fff;color:var(--ink);box-shadow:0 40px 80px -20px rgba(0,0,0,.6);transform:rotate(-3deg)">
    <div style="display:flex;align-items:center;gap:14px"><div style="width:58px;height:58px;border-radius:16px;background:var(--mrt);color:#fff;display:flex;align-items:center;justify-content:center;font:900 22px Inter">M6</div>
    <div><div style="font:800 28px Inter">Bike + MRT Line 6</div><div style="font:600 21px Inter;color:var(--muted)">Uttara → Motijheel</div></div></div>
    <div style="display:flex;gap:12px;margin-top:16px"><span style="padding:8px 16px;border-radius:20px;background:#E7F5EE;color:var(--g700);font:800 22px Inter">25 min faster</span><span style="padding:8px 16px;border-radius:20px;background:#FFF4D6;color:#9A5B00;font:800 22px Inter">৳140</span></div>
  </div>
  <div class="abs" style="inset:0;background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.45) 100%)"></div>`;
}, { enroute });
await page.waitForTimeout(600);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => 0))));
const stage = await page.$('#stage');
await stage.screenshot({ path: path.join(OUT, 'thumbnail.png') });

// vertical overlay: logo band on top, call to action at the bottom; the 16:9 video sits at y 656..1264
await page.evaluate(() => {
  document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent';
  const st = document.getElementById('stage'); st.style.cssText = 'width:1080px;height:1920px;background:transparent;position:relative;overflow:hidden';
  st.innerHTML = `
  <div class="abs" style="left:0;right:0;top:0;height:656px;background:linear-gradient(180deg,rgba(3,20,15,.92),rgba(3,20,15,.55) 75%,rgba(3,20,15,0))"></div>
  <div class="abs" style="left:0;right:0;bottom:0;height:656px;background:linear-gradient(0deg,rgba(3,20,15,.92),rgba(3,20,15,.55) 75%,rgba(3,20,15,0))"></div>
  <div class="abs" style="left:0;right:0;top:190px;text-align:center"><img src="logo-light.svg" style="height:170px">
    <div style="margin-top:34px;font:900 72px/1 Inter;letter-spacing:-2px;color:#fff">Ride. Safe. <span style="color:var(--gold)">Smart.</span></div></div>
  <div class="abs" style="left:0;right:0;top:1400px;text-align:center">
    <div style="font:700 40px/1.3 Inter;color:#fff">Bangladesh’s ride app —<br>from SOS to the Metro.</div>
    <div style="margin:40px auto 0;display:inline-block;padding:20px 40px;border-radius:50px;background:var(--gold);color:var(--ink);font:800 36px Inter">cholo-cholo7.vercel.app</div></div>`;
});
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => 0))));
await stage.screenshot({ path: path.join(OUT, 'vertical-overlay.png'), omitBackground: true });
await browser.close(); server.close(); console.log('ok');
