import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.resolve('..'); const CL = '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/clips';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/scenes/clips/') ? path.join(CL, u.slice(14)) : path.join(ROOT, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200); fs.createReadStream(f).pipe(r); }).listen(0);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://localhost:${srv.address().port}/scenes/index.html`); await p.waitForFunction(() => window.READY);
console.log(await p.evaluate(async (expr) => { await eval(expr.pre); return eval(expr.q); }, { pre: process.argv[2], q: process.argv[3] }));
await b.close(); srv.close();
