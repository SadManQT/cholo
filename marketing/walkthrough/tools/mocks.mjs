import http from 'node:http';
import { ARTERIALS, localGrids } from './dhaka.mjs';
const hav = (a, b) => { const R = 6371, r = (d) => d * Math.PI / 180; const dLat = r(b[1] - a[1]), dLng = r(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const nodes = []; const adj = [];
const addNode = (p) => { nodes.push(p); adj.push([]); return nodes.length - 1; };
const link = (a, b, w = 1) => { const d = hav(nodes[a], nodes[b]) * w; adj[a].push([b, d]); adj[b].push([a, d]); };
const art = [];
for (const coords of Object.values(ARTERIALS)) {
  let prev = null;
  for (let i = 0; i < coords.length; i++) {
    const pts = [coords[i]];
    if (i + 1 < coords.length) { const n = Math.ceil(hav(coords[i], coords[i + 1]) / 0.18); for (let k = 1; k < n; k++) pts.push([coords[i][0] + (coords[i + 1][0] - coords[i][0]) * k / n, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * k / n]); }
    for (const p of pts) { const id = addNode(p); art.push(id); if (prev != null) link(prev, id, 0.8); prev = id; }
  }
}
for (let i = 0; i < art.length; i++) for (let j = i + 1; j < art.length; j++) if (hav(nodes[art[i]], nodes[art[j]]) < 0.12) link(art[i], art[j], 0.8);
for (const g of localGrids()) {
  const ids = g.nodes.map((col) => col.map((p) => (p ? addNode(p) : null)));
  for (let i = 0; i <= g.nx; i++) for (let j = 0; j <= g.ny; j++) { const id = ids[i][j]; if (id == null) continue;
    if (i < g.nx && ids[i + 1][j] != null) link(id, ids[i + 1][j]); if (j < g.ny && ids[i][j + 1] != null) link(id, ids[i][j + 1]);
    for (const a of art) if (hav(nodes[id], nodes[a]) < 0.22) link(id, a); }
}
const nearest = (p) => { let best = 0, bd = Infinity; nodes.forEach((n, i) => { const d = hav(n, p); if (d < bd) { bd = d; best = i; } }); return best; };
function path(a, b) {
  const s = nearest(a), t = nearest(b); const dist = new Float64Array(nodes.length).fill(Infinity), prev = new Int32Array(nodes.length).fill(-1), done = new Uint8Array(nodes.length);
  dist[s] = 0;
  for (;;) { let u = -1, bd = Infinity; for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === t) break; done[u] = 1; for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } }
  const out = []; for (let u = t; u >= 0; u = prev[u]) { out.push(nodes[u]); if (u === s) break; }
  return [a, ...out.reverse(), b];
}
http.createServer((req, res) => {
  const coords = decodeURIComponent(req.url.split('/driving/')[1]?.split('?')[0] ?? '').split(';').map((p) => p.split(',').map(Number));
  let line = [coords[0]];
  for (let i = 1; i < coords.length; i++) line = line.concat(path(coords[i - 1], coords[i]).slice(1));
  let km = 0; for (let i = 1; i < line.length; i++) km += hav(line[i - 1], line[i]);
  const meters = km * 1000;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ code: 'Ok', routes: [{ distance: meters, duration: meters / 6.2, geometry: { type: 'LineString', coordinates: line } }] }));
}).listen(5555);
const PLACES = [
  ['Gulshan 2 Circle', 'Gulshan', 23.7925, 90.4148], ['Gulshan 1 Circle', 'Gulshan', 23.7806, 90.4167], ['Banani Road 11', 'Banani', 23.7937, 90.4066],
  ['Dhanmondi 27', 'Dhanmondi', 23.756, 90.375], ['Dhanmondi Lake', 'Dhanmondi', 23.746, 90.377], ['Bashundhara City', 'Panthapath', 23.7509, 90.3905],
  ['Jamuna Future Park', 'Baridhara', 23.8137, 90.4243], ['Hazrat Shahjalal International Airport', 'Kurmitola', 23.8433, 90.3978],
  ['Kamalapur Railway Station', 'Motijheel', 23.732, 90.426], ['Motijheel Commercial Area', 'Motijheel', 23.733, 90.418], ['Farmgate', 'Tejgaon', 23.758, 90.39],
  ['Karwan Bazar', 'Tejgaon', 23.751, 90.393], ['Mirpur 10 Circle', 'Mirpur', 23.807, 90.368], ['Uttara Sector 7', 'Uttara', 23.869, 90.399],
  ['Uttara North Metro Station', 'Uttara', 23.8692, 90.3673], ['New Market', 'Azimpur', 23.733, 90.385], ['Shahbagh', 'Shahbagh', 23.738, 90.396],
  ['University of Dhaka', 'Shahbagh', 23.734, 90.393], ['Sadarghat Launch Terminal', 'Old Dhaka', 23.706, 90.411], ['Square Hospital', 'Panthapath', 23.7525, 90.3815],
  ['Evercare Hospital', 'Bashundhara', 23.81, 90.433], ['Star Kabab', 'Dhanmondi', 23.747, 90.374], ['Agargaon', 'Sher-e-Bangla Nagar', 23.778, 90.38],
  ['Mohakhali Bus Terminal', 'Mohakhali', 23.781, 90.4], ['Rampura TV Center', 'Rampura', 23.7612, 90.421], ['Lalbagh Fort', 'Old Dhaka', 23.719, 90.388],
  ['North South University', 'Bashundhara', 23.8151, 90.4256], ['BRAC University', 'Mohakhali', 23.7802, 90.4073], ['Gulshan Avenue', 'Gulshan', 23.786, 90.4155],
];
const feat = ([name, district, lat, lng]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { name, district, city: 'Dhaka', country: 'Bangladesh', countrycode: 'BD' } });
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); res.setHeader('content-type', 'application/json');
  if (u.pathname.startsWith('/reverse')) {
    const p = [Number(u.searchParams.get('lon')), Number(u.searchParams.get('lat'))];
    const best = [...PLACES].sort((a, b) => hav([a[3], a[2]], p) - hav([b[3], b[2]], p))[0];
    return res.end(JSON.stringify({ features: [{ ...feat(best), properties: { street: `Road ${3 + Math.round(Math.abs(p[1] * 1000) % 24)}`, district: best[1], city: 'Dhaka', country: 'Bangladesh', countrycode: 'BD' } }] }));
  }
  const q = (u.searchParams.get('q') ?? '').toLowerCase().trim(); const limit = Number(u.searchParams.get('limit') ?? 5);
  const words = q.split(/\s+/).filter(Boolean);
  const scored = PLACES.map((p) => { const hay = `${p[0]} ${p[1]}`.toLowerCase(); const s = words.reduce((acc, w) => acc + (hay.includes(w) ? 2 : hay.split(' ').some((h) => h.startsWith(w.slice(0, 3))) ? 1 : 0), 0); return [s, p]; })
    .filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, p]) => feat(p));
  res.end(JSON.stringify({ features: scored }));
}).listen(5556);
console.log('mocks up', nodes.length, 'graph nodes');
const SESSIONS = new Map();
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => r(d)); });
const CHECKOUT = (s, tran) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Secure checkout</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#EEF2F6;color:#0F172A}
.top{background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;padding:22px 20px 70px}.top small{opacity:.8;letter-spacing:2px;font-weight:700;font-size:11px}
.top h1{margin:6px 0 0;font-size:20px}.card{background:#fff;margin:-52px 16px 16px;border-radius:18px;box-shadow:0 18px 40px -18px rgba(15,23,42,.35);padding:18px}
.row{display:flex;justify-content:space-between;align-items:center}.amt{font-size:30px;font-weight:800}.muted{color:#64748B;font-size:13px}
.tabs{display:flex;gap:8px;margin:18px 0 12px}.tab{flex:1;text-align:center;padding:10px;border-radius:12px;background:#F1F5F9;font-weight:700;font-size:13px}.tab.on{background:#DBEAFE;color:#1D4ED8}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.m{border:2px solid #E2E8F0;border-radius:14px;padding:14px 6px;text-align:center;font-weight:800;font-size:14px;cursor:pointer}
.m b{display:block;width:40px;height:40px;margin:0 auto 8px;border-radius:12px;color:#fff;line-height:40px;font-size:20px}.m.on{border-color:#E2136E;background:#FFF1F7}
#pay{display:none;margin-top:16px}label{display:block;font-size:12px;font-weight:700;color:#475569;margin:10px 0 6px}input{width:100%;padding:13px;border-radius:12px;border:2px solid #E2E8F0;font-size:16px}
button{width:100%;margin-top:16px;padding:15px;border:0;border-radius:14px;background:#E2136E;color:#fff;font-weight:800;font-size:16px}
.lock{margin-top:14px;text-align:center;font-size:12px;color:#64748B}</style></head><body>
<div class="top"><small>SSLCOMMERZ · SANDBOX</small><h1>Secure checkout</h1></div>
<div class="card"><div class="row"><div><div class="muted">Pay to</div><div style="font-weight:800;font-size:17px">Cholo Rides Ltd.</div></div><div style="text-align:right"><div class="muted">Amount</div><div class="amt">৳${Number(s.total_amount).toFixed(2)}</div></div></div>
<div class="tabs"><div class="tab on">Mobile banking</div><div class="tab">Cards</div><div class="tab">Net banking</div></div>
<div class="grid"><div class="m" id="bk" onclick="pick()"><b style="background:#E2136E">b</b>bKash</div><div class="m"><b style="background:#F6921E">N</b>Nagad</div><div class="m"><b style="background:#8C3494">R</b>Rocket</div></div>
<form id="pay" method="post" action="${s.success_url}"><input type="hidden" name="val_id" value="VAL${tran}"><input type="hidden" name="tran_id" value="${tran}"><input type="hidden" name="status" value="VALID">
<label>bKash account number</label><input id="acct" inputmode="numeric" placeholder="01XXXXXXXXX"><label>PIN</label><input id="pin" type="password" placeholder="•••••"><button type="submit">Confirm payment ৳${Number(s.total_amount).toFixed(2)}</button></form>
<div class="lock">🔒 256-bit encrypted · Verified by your bank</div></div>
<script>function pick(){document.getElementById('bk').classList.add('on');document.getElementById('pay').style.display='block'}</script></body></html>`;
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/gwprocess')) {
    const body = Object.fromEntries(new URLSearchParams(await readBody(req)));
    SESSIONS.set(body.tran_id, body);
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ status: 'SUCCESS', GatewayPageURL: `http://localhost:5557/checkout/${body.tran_id}`, sessionkey: `S${Date.now()}` }));
  }
  if (u.pathname.startsWith('/checkout/')) {
    const tran = u.pathname.split('/').pop(); const s = SESSIONS.get(tran);
    res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(s ? CHECKOUT(s, tran) : 'expired');
  }
  if (u.pathname.startsWith('/validator')) {
    const tran = (u.searchParams.get('val_id') ?? '').replace(/^VAL/, ''); const s = SESSIONS.get(tran);
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(s ? { status: 'VALID', tran_id: tran, amount: s.total_amount, bank_tran_id: `BK${Date.now()}` } : { status: 'INVALID' }));
  }
  res.statusCode = 404; res.end();
}).listen(5557);
