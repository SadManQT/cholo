import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const dir = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => {
  const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${port}/trailer.html`);
await page.waitForFunction(() => window.READY);
await page.waitForTimeout(300);
const mode = process.argv[2];
const stage = await page.$('#stage');
if (mode === 'preview') {
  fs.mkdirSync(path.join(dir, 'prev'), { recursive: true });
  for (const t of process.argv.slice(3).map(Number)) {
    await page.evaluate(t => render(t), t);
    await stage.screenshot({ path: path.join(dir, 'prev', `t${t}.jpg`), type: 'jpeg', quality: 80 });
  }
} else {
  const fps = 30, total = 78, out = process.argv[3];
  const ff = spawn(process.env.FFMPEG, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-i', path.join(dir, 'music.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < fps * total; i++) {
    await page.evaluate(t => render(t), i / fps);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.error('frame', i);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
console.log(errs.length ? 'ERRORS: ' + errs.join('\n') : 'ok');
await browser.close(); server.close();
