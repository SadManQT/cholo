import { launch, context, login, beat, smoothScroll, db, APP } from './lib.mjs';
const q = await db();
const b = await launch(); const ctx = await context(b); const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
await login(p, '01710000001');
const ONLY = process.env.ONLY?.split(',');
const _beat = beat; const beatSel = (pg, n, ...a) => (!ONLY || ONLY.includes(n) ? _beat(pg, n, ...a) : null);
await beatSel(p, 'hub-trips', `${APP}/trips`, async () => { await p.waitForTimeout(1500); await smoothScroll(p, 700, 1600); await p.waitForTimeout(1200); });
const { rows: [last] } = await q.query(`select trip_code from trips where passenger_id=1 and status='completed' order by id desc limit 1`);
await beatSel(p, 'hub-receipt', `${APP}/trips/${last.trip_code}`, async () => { await p.waitForTimeout(1500); await smoothScroll(p, 650, 1700); await p.waitForTimeout(1500); await smoothScroll(p, 650, 1700); await p.waitForTimeout(1200); });
await beatSel(p, 'hub-wallet', `${APP}/wallet`, async (r) => {
  await p.waitForTimeout(1800);
  const amt = p.getByLabel('Amount (৳)').first(); await amt.fill(''); await r.type(amt, '500', 140); await p.waitForTimeout(700);
  const bk = p.getByRole('radio', { name: /bKash/ }).first(); if (await bk.isVisible().catch(() => false)) await r.tap(bk);
  await p.waitForTimeout(700); await r.tap(p.getByRole('button', { name: /^Add ৳/ }).first());
  await p.waitForURL(/5557\/checkout/, { timeout: 20000 }); r.mark('checkout'); await p.waitForTimeout(1600);
  await r.tap(p.locator('#bk')); await p.waitForTimeout(700); await r.type(p.locator('#acct'), '01710000001', 60); await r.type(p.locator('#pin'), '12345', 110);
  await r.tap(p.getByRole('button', { name: /Confirm payment/ })); await p.waitForURL(/localhost:4173/, { timeout: 30000 }); r.mark('paid'); await p.waitForTimeout(3500);
  await p.goto(`${APP}/wallet`); r.mark('wallet-after'); await p.waitForTimeout(2500); await smoothScroll(p, 600, 1500); await p.waitForTimeout(1500);
});
await beatSel(p, 'hub-promos', `${APP}/promos`, async () => { await p.waitForTimeout(1600); await smoothScroll(p, 500, 1400); await p.waitForTimeout(1000); });
await beatSel(p, 'hub-places', `${APP}/account/places`, async () => { await p.waitForTimeout(2200); });
await beatSel(p, 'hub-inbox', `${APP}/notifications`, async () => { await p.waitForTimeout(1500); await smoothScroll(p, 500, 1400); await p.waitForTimeout(1000); });
await beatSel(p, 'hub-support', `${APP}/support`, async (r) => {
  await p.waitForTimeout(1500); const first = p.locator('a[href*="/support/"], li button, [data-ticket]').first();
  if (await first.isVisible().catch(() => false)) { await r.tap(first); await p.waitForTimeout(2500); }
  await smoothScroll(p, 400, 1200); await p.waitForTimeout(1200);
});
await beatSel(p, 'hub-account', `${APP}/account`, async (r) => {
  await p.waitForTimeout(1200); await smoothScroll(p, 520, 1500); await p.waitForTimeout(900);
  await r.tap(p.getByRole('radio', { name: 'Dark' }).or(p.getByRole('button', { name: 'Dark', exact: true })).first()); r.mark('dark'); await p.waitForTimeout(2200);
  const sel = p.getByLabel('Preferred language'); await r.tap(sel); await sel.selectOption('bn'); await p.waitForTimeout(600);
  await r.tap(p.getByRole('button', { name: 'Save profile' })); r.mark('bangla'); await p.waitForTimeout(2500);
  await smoothScroll(p, -900, 1500); await p.waitForTimeout(2500); r.mark('bn-top');
  await p.goto(`${APP}/`); await p.waitForTimeout(3500); r.mark('bn-book'); await p.waitForTimeout(1500);
});
await beatSel(p, 'hub-reset', `${APP}/account`, async () => {
  await p.getByLabel(/Preferred language|পছন্দের ভাষা|ভাষা/).first().selectOption('en').catch(() => {});
  await p.getByRole('button', { name: /Save profile|সংরক্ষণ|সেভ/ }).first().click().catch(() => {}); await p.waitForTimeout(1500);
  await p.getByRole('radio', { name: /Light|লাইট/ }).or(p.getByRole('button', { name: /^(Light|লাইট)$/ })).first().click().catch(() => {}); await p.waitForTimeout(800);
});
await b.close(); await q.end();
