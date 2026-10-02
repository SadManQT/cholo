import { launch, context, recorder, login, db, APP, sleep } from './lib.mjs';
const q = await db();
const PICK = { lat: 23.7562, lng: 90.3752 };
const DRV0 = { lat: 23.7618, lng: 90.3712 };
await q.query(`update trips set status='cancelled' where status in ('assigned','arrived','in_progress')`);
await q.query(`update trips set payment_status='paid' where payment_status='unpaid' and passenger_id=1`);
await q.query(`update ride_requests set status='cancelled' where status in ('pending','searching','matched')`);
await q.query(`update driver_availability set status='offline' where driver_id<>2`);
await q.query(`update driver_availability set status='offline', current_lat=$1, current_lng=$2 where driver_id=2`, [DRV0.lat, DRV0.lng]);
const { rows: [w] } = await q.query(`select w.id, w.balance from wallets w where user_id=1`);
const diff = 60 - Number(w.balance);
if (diff) await q.query(`insert into wallet_transactions (wallet_id, txn_type, direction, amount, reference_type, idempotency_key) values ($1,'adjustment',$2,$3,'manual',$4)`, [w.id, diff > 0 ? 'credit' : 'debit', Math.abs(diff), `video-${Date.now()}`]);
const bP = await launch(); const bD = await launch(); const bF = await launch();
const P = await context(bP, { geo: { latitude: PICK.lat, longitude: PICK.lng } });
const D = await context(bD, { geo: { latitude: DRV0.lat, longitude: DRV0.lng } });
const F = await context(bF, { geo: { latitude: 23.7925, longitude: 90.4148 } });
const p = await P.newPage(); const d = await D.newPage();
for (const [n, x] of [['P', p], ['D', d]]) { x.on('pageerror', (e) => console.log(n, 'ERR', e.message)); }
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function routeTo(from, to) {
  const r = await (await fetch(`http://localhost:5555/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`)).json();
  return r.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}
async function drive(ctx, pts, ms = 260) {
  const dense = []; for (let i = 1; i < pts.length; i++) for (let k = 0; k < 4; k++) dense.push({ lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * k / 4, lng: pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * k / 4 });
  dense.push(pts.at(-1)); for (const pt of dense) { await ctx.setGeolocation({ latitude: pt.lat, longitude: pt.lng }); await sleep(ms); }
}
async function touchDrag(page, from, toX) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= 24; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((toX - from.x) * i) / 24, y: from.y }] }); await page.waitForTimeout(22); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function slide(page, label, rec) {
  const thumb = page.locator(`button[aria-label^="${label}"]`).first(); await thumb.waitFor({ timeout: 20000 }); await page.waitForTimeout(700);
  const tb = await thumb.boundingBox(); const track = await thumb.locator('..').boundingBox();
  rec.mark(`slide:${label}`); await touchDrag(page, { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 }, track.x + track.width - 4);
}
let rp, rd;
try {
  await login(d, '01810000002'); await d.goto(`${APP}/driver`); await d.waitForTimeout(2500);
  await login(p, '01710000001'); await p.goto(`${APP}/`); await p.waitForTimeout(2500);
  for (const x of [p, d]) await x.locator('button[aria-label*="ismiss"], [role=status] button').first().click({ timeout: 1500 }).catch(() => {});
  rd = await recorder(d, 'ride-driver'); rp = await recorder(p, 'ride-passenger');
  rd.mark('online-start'); await d.waitForTimeout(1200);
  await rd.tap(d.locator('[role=switch]').first()); await d.waitForTimeout(2500); rd.mark('online-end');
  rp.mark('book-start'); await p.waitForTimeout(1500);
  const drop = p.getByPlaceholder('Where to?').first();
  rp.mark('type-start'); await rp.type(drop, 'Gulshan 2 Circle'); await p.waitForTimeout(1600); rp.mark('type-end');
  const sugg = p.getByRole('option', { name: /Gulshan 2 Circle/ }).first();
  if (await sugg.isVisible().catch(() => false)) await rp.tap(sugg); else await rp.tap(p.getByRole('button', { name: 'Find' }).nth(1));
  rp.mark('route-start'); await p.getByText('Choose a ride').first().waitFor({ timeout: 20000 }); await p.waitForTimeout(3000); rp.mark('route-end');
  rp.mark('stop-start'); await rp.tap(p.getByText('+ Add a stop').first()); await p.waitForTimeout(900);
  const stopIn = p.locator('input').filter({ hasNot: p.locator('[type=hidden]') }).nth(2);
  await rp.type(stopIn, 'Banani Road 11'); await p.waitForTimeout(700);
  await rp.tap(p.getByRole('button', { name: /Find stop|Find/ }).nth(2)); await p.waitForTimeout(3500); rp.mark('stop-end');
  await rp.tap(p.getByRole('button', { name: /Remove stop/ }).first()); await p.waitForTimeout(3000);

  const sheetY = 640;
  async function wheel(page, total) {
    await page.evaluate(async (dy) => {
      const el = document.querySelector('[role=dialog] .overflow-y-auto') ?? document.scrollingElement; const start = el.scrollTop, dur = 750, t0 = performance.now();
      await new Promise((res) => { const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; el.scrollTop = start + dy * e; if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    }, total);
    await page.waitForTimeout(450);
  }
  async function expandSheet(page, toY = 96) {
    const h = page.locator('[role=dialog] > div.cursor-grab').first(); const bb = await h.boundingBox(); if (!bb) return;
    const cdp = await page.context().newCDPSession(page); const x = bb.x + bb.width / 2, y0 = bb.y + bb.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 26; i++) { const k = i / 26, e = 1 - Math.pow(1 - k, 2); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (toY - y0) * e }] }); await page.waitForTimeout(18); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(900);
  }
  log('pickup now', await p.locator('input').first().inputValue());
  rp.mark('expand'); await expandSheet(p); log('sheet h', await p.locator('[role=dialog]').first().evaluate((e) => e.style.height));
  rp.mark('options-start'); await wheel(p, 330); await p.waitForTimeout(1200);
  await rp.tap(p.getByText('Bike', { exact: true }).first()); await p.waitForTimeout(1300);
  await rp.tap(p.getByText('CNG', { exact: true }).first()); await p.waitForTimeout(1500); rp.mark('options-end'); log('options-end', await p.locator('input').first().inputValue());
  rp.mark('pay-start'); await wheel(p, 300); await p.waitForTimeout(1500);
  await rp.tap(p.getByRole('radio', { name: /bKash/ }).first()); await p.waitForTimeout(1500); rp.mark('pay-end'); log('pay-end', await p.locator('input').first().inputValue());
  rp.mark('promo-start'); await wheel(p, 240); await rp.type(p.getByLabel('Promo (optional)'), 'CHOLO20', 110); await p.waitForTimeout(1200); rp.mark('promo-end'); log('promo-end', await p.locator('input').first().inputValue());
  rp.mark('schedule-start'); await rp.tap(p.getByRole('radio', { name: 'Schedule' })); await p.waitForTimeout(900);
  const tmr = new Date(Date.now() + 86400000); const pad = (n) => String(n).padStart(2, '0');
  await p.locator('input[type=datetime-local]').fill(`${tmr.getFullYear()}-${pad(tmr.getMonth() + 1)}-${pad(tmr.getDate())}T08:30`); await p.waitForTimeout(400);
  await wheel(p, 200); await p.waitForTimeout(2200); rp.mark('schedule-end'); log('schedule-end', await p.locator('input').first().inputValue());
  await rp.tap(p.getByRole('radio', { name: 'Ride now' })); await p.waitForTimeout(1000);
  rp.mark('women-start'); await rp.tap(p.getByLabel('Women-only driver preference')); await p.waitForTimeout(2200); rp.mark('women-end'); log('women-end', await p.locator('input').first().inputValue());
  await rp.tap(p.getByLabel('Women-only driver preference')); await p.waitForTimeout(900);
  log('pickup before confirm', await p.locator('input').first().inputValue());
  rp.mark('confirm-start'); await rp.tap(p.getByRole('button', { name: /^Confirm CNG/ })); rp.mark('searching');
  rd.mark('offer-wait'); const accept = d.getByRole('button', { name: /Accept/ }).first(); await accept.waitFor({ timeout: 40000 }); rd.mark('offer'); await d.waitForTimeout(3000);
  await rd.tap(accept); rd.mark('accepted'); rp.mark('matched');
  await p.waitForURL(/\/trips\/.+\/live/, { timeout: 30000 }); const code = p.url().split('/trips/')[1].split('/')[0]; log('trip', code);
  await p.waitForTimeout(2500); rp.mark('enroute');
  await d.waitForURL(/\/driver\/trip/, { timeout: 15000 }).catch(() => d.goto(`${APP}/driver/trip`)); await d.waitForTimeout(1500);
  await drive(D, await routeTo(DRV0, PICK), 230); await d.waitForTimeout(1500); rp.mark('near');
  await slide(d, 'Slide to mark arrived', rd); await d.waitForTimeout(1500);
  await p.getByText('Is your driver here?').first().waitFor({ timeout: 20000 }); rp.mark('arrived-ask'); await p.waitForTimeout(3000);
  rp.mark('dispute-start'); await rp.tap(p.getByRole('button', { name: "My driver isn't here" }).first()); await p.waitForTimeout(1800);
  await rp.tap(p.getByRole('button', { name: "My driver isn't here" }).last()); await p.waitForTimeout(1500); rp.mark('dispute-end');
  await d.getByText('Your rider says you are not at the pickup', { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {}); rd.mark('disputed'); await d.waitForTimeout(3000);
  await slide(d, 'Slide to mark arrived', rd); await d.waitForTimeout(1200);
  await p.getByText('Is your driver here?').first().waitFor({ timeout: 20000 }); await p.waitForTimeout(1500);
  rp.mark('confirm-in-car'); await rp.tap(p.getByRole('button', { name: "I'm in the car" })); await p.waitForTimeout(1800);
  await slide(d, 'Slide to start trip', rd); rd.mark('started'); await p.getByText('You are on your way').first().waitFor({ timeout: 20000 }); rp.mark('in-progress'); await p.waitForTimeout(1500);
  const DROP = { lat: 23.7925, lng: 90.4148 }; const tripRoute = await routeTo(PICK, DROP);
  const driving = drive(D, tripRoute.slice(0, Math.floor(tripRoute.length * 0.62)), 330);
  let shareUrl = null; p.on('response', async (r) => { if (r.request().method() === 'POST' && /share/.test(r.url())) { try { const j = await r.json(); shareUrl = JSON.stringify(j); } catch {} } });
  rp.mark('share-start'); await rp.tap(p.getByRole('button', { name: /Share trip/ }).first()); await p.waitForTimeout(2500); rp.mark('share-end');
  log('share response', shareUrl?.slice(0, 200));
  const surl = shareUrl && JSON.parse(shareUrl).data?.url;
  let famDone = Promise.resolve();
  if (surl) famDone = (async () => { const f = await F.newPage(); const rf = await recorder(f, 'ride-family'); rf.mark('open'); await f.goto(surl); await f.waitForTimeout(16000); rf.mark('end'); await rf.stop(); })();
  rp.mark('sos-start'); await rp.tap(p.getByRole('button', { name: /^SOS$|Send SOS alert/ }).first()); await p.waitForTimeout(1800);
  await rp.tap(p.getByRole('button', { name: 'Send SOS' }).last()); await p.waitForTimeout(3000); rp.mark('sos-end');
  await driving; await famDone;
  rp.mark('stop-ask'); await rp.tap(p.getByRole('button', { name: 'Stop here', exact: true }).first()); await p.waitForTimeout(1600);
  await rp.tap(p.getByRole('button', { name: 'Ask driver to stop' }).last()); await p.waitForTimeout(2200);
  await d.getByText('The rider asked to stop here.').first().waitFor({ timeout: 15000 }).catch(() => {}); rd.mark('stop-asked'); await d.waitForTimeout(2200);
  await rd.tap(d.getByRole('button', { name: /End trip here/ }).first()); await d.waitForTimeout(1300);
  await rd.tap(d.getByRole('button', { name: /End trip here|End trip/ }).last()); rd.mark('ended'); await d.waitForTimeout(3500);
  rp.mark('complete'); await p.waitForTimeout(5000);
  log('passenger url', p.url());
  rp.mark('pay-due'); const go = p.getByRole('button', { name: /Continue to bKash/ }).first(); await go.waitFor({ timeout: 20000 }); await p.waitForTimeout(2500);
  await rp.tap(go); await p.waitForURL(/5557\/checkout/, { timeout: 20000 }); rp.mark('checkout'); await p.waitForTimeout(2200);
  await rp.tap(p.locator('#bk')); await p.waitForTimeout(900); await rp.type(p.locator('#acct'), '01710000001', 70); await rp.type(p.locator('#pin'), '12345', 120); await p.waitForTimeout(700);
  await rp.tap(p.getByRole('button', { name: /Confirm payment/ })); rp.mark('paying');
  await p.waitForURL(/localhost:4173/, { timeout: 30000 }); await p.waitForTimeout(4500); rp.mark('paid'); log('after pay', p.url());
  await p.goto(`${APP}/trips/${code}`); await p.waitForTimeout(3000); rp.mark('receipt');
  await wheel(p, 900, 30); await p.waitForTimeout(1500); rp.mark('rate-start');
  const star = p.getByRole('button', { name: /^5 stars?/ }).first(); if (await star.isVisible().catch(() => false)) { await rp.tap(star); await p.waitForTimeout(900); }
  const note = p.getByPlaceholder(/Anything to add/).first(); if (await note.isVisible().catch(() => false)) await rp.type(note, 'Very polite, safe driving!', 55);
  const sub = p.getByRole('button', { name: 'Submit rating' }); if (await sub.isVisible().catch(() => false)) { await rp.tap(sub); await p.waitForTimeout(2200); }
  const fav = p.getByRole('button', { name: /Add to favourites/ }).first(); if (await fav.isVisible().catch(() => false)) { await rp.tap(fav); await p.waitForTimeout(2500); }
  rp.mark('rate-end'); await p.waitForTimeout(1500);
  log('ride done');
} catch (e) { log('FAIL', e.message.split('\n')[0]); await p.screenshot({ path: '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/peek/fail-p.png' }); await d.screenshot({ path: '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/peek/fail-d.png' }); }
await rp?.stop(); await rd?.stop(); await bP.close(); await bD.close(); await bF.close(); await q.end();
