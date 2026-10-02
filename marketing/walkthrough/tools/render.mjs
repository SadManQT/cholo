import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { spawn, execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCR = '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad';
const CLIPDIR = path.join(SCR, 'clips');
const FF = fs.readFileSync(path.join(SCR, 'ffpath'), 'utf8').trim();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  const f = u.startsWith('/scenes/clips/') ? path.join(CLIPDIR, u.slice('/scenes/clips/'.length)) : path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=3600' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text()));
await page.goto(`http://localhost:${port}/scenes/index.html`);
await page.waitForFunction(() => window.READY, null, { timeout: 120000 });
const [mode, ...rest] = process.argv.slice(2);
const stage = await page.$('#stage');
if (mode === 'timeline') {
  const tl = await page.evaluate(() => window.TIMELINE); fs.writeFileSync(rest[0], JSON.stringify(tl, null, 1)); console.log('total', tl.total.toFixed(2), 'scenes', tl.scenes.length, 'caps', tl.caps.length, 'cues', tl.cues.length);
} else if (mode === 'preview') {
  const out = path.join(SCR, 'prev'); fs.mkdirSync(out, { recursive: true });
  for (const spec of rest) {
    let t = Number(spec); if (Number.isNaN(t)) { const [id, off] = spec.split('+'); t = await page.evaluate(([id, off]) => window.TIMELINE.scenes.find((s) => s.id === id).a + Number(off ?? 0), [id, off]); }
    await page.evaluate((t) => render(t), t); await stage.screenshot({ path: path.join(out, `${spec}.jpg`), type: 'jpeg', quality: 82 });
  }
} else if (mode === 'segment') {
  const [from, to, outFile] = [Number(rest[0]), Number(rest[1]), rest[2]]; const fps = 30;
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  for (let i = f0; i < f1; i++) {
    await page.evaluate((t) => render(t), i / fps);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((i - f0) % 300 === 0) console.error(path.basename(outFile), i - f0, '/', f1 - f0);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
}
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0, 8).join('\n') : 'ok');
await browser.close(); server.close();
