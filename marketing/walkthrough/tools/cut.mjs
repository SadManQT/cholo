import fs from 'node:fs'; import path from 'node:path';
import { CLIPS } from './clips.mjs';
const RAW = '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/raw';
const OUT = '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/clips';
fs.mkdirSync(OUT, { recursive: true });
const load = (n) => JSON.parse(fs.readFileSync(path.join(RAW, n, 'index.json')));
const meta = {};
const only = process.argv.slice(2);
for (const [id, raw, from, to, ref] of CLIPS) {
  if (only.length && !only.includes(id)) continue;
  const src = load(raw), mk = load(ref ?? raw);
  const mark = ([m, off]) => { const e = mk.events.find((x) => x.kind === 'mark' && x.label === m); if (!e) throw new Error(`${id}: no mark ${m}`); return e.t + off; };
  const t0 = mark(from), t1 = mark(to); const n = Math.round((t1 - t0) * 30);
  const dir = path.join(OUT, id); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + k / 30; while (j + 1 < src.frames.length && src.frames[j + 1][0] <= t) j++;
    fs.linkSync(path.join(RAW, raw, src.frames[j][1]), path.join(dir, `${String(k).padStart(5, '0')}.jpg`));
  }
  const taps = src.events.filter((e) => e.kind === 'tap' && e.t >= t0 && e.t <= t1).map((e) => ({ t: +(e.t - t0).toFixed(3), x: e.x, y: e.y }));
  meta[id] = { n, dur: +(n / 30).toFixed(2), vw: src.viewport.width, vh: src.viewport.height, taps };
  console.log(id, n, 'frames', meta[id].dur + 's', taps.length, 'taps');
}
const mf = path.join(OUT, 'clips.json'); const prev = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf)) : {};
fs.writeFileSync(mf, JSON.stringify({ ...prev, ...meta }, null, 1));
