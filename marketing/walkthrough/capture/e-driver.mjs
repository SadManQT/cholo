import { launch, context, login, beat, smoothScroll, APP } from './lib.mjs';
const ONLY = process.env.ONLY?.split(','); const B = (pg, n, ...a) => (!ONLY || ONLY.includes(n) ? beat(pg, n, ...a) : null);
const b = await launch();
const c1 = await context(b); const s = await c1.newPage(); s.on('pageerror', (e) => console.log('ERR', e.message));
await login(s, '01799886655');
await B(s, 'drv-apply', `${APP}/driver/apply`, async (r) => {
  await s.waitForTimeout(1200);
  const start = s.getByRole('button', { name: /Start application|Apply/ }).first();
  await r.type(s.getByLabel('National ID (NID) number'), '1990123456789', 70);
  await r.type(s.getByLabel('Driving license number'), 'DK0412345C00071', 60);
  const exp = s.getByLabel('License expiry date'); await r.tap(exp); await exp.fill('2025-03-14'); await s.waitForTimeout(500);
  await r.tap(start); r.mark('expired'); await s.waitForTimeout(2200);
  await r.tap(exp); await exp.fill('2031-06-30'); await s.waitForTimeout(900); r.mark('valid');
  await r.tap(start); await s.waitForTimeout(3500); r.mark('submitted');
});
await c1.close();
const c2 = await context(b, { geo: { latitude: 23.7562, longitude: 90.3752 } }); const d = await c2.newPage(); d.on('pageerror', (e) => console.log('ERR', e.message));
await login(d, '01810000002');
await B(d, 'drv-docs', `${APP}/driver/documents`, async (r) => {
  await d.waitForTimeout(1200); await smoothScroll(d, 500, 1400); await d.waitForTimeout(800);
  const up = d.getByRole('button', { name: /Upload a new copy|Edit|Replace file/ }).first();
  if (await up.isVisible().catch(() => false)) {
    await r.tap(up); await d.waitForTimeout(900);
    const file = d.locator('input[type=file]').first(); await file.setInputFiles('/home/user/cholo/client/public/icon-512.png').catch(() => {}); await d.waitForTimeout(900);
    const ex = d.getByLabel('Expiry date').first(); if (await ex.isVisible().catch(() => false)) { await r.tap(ex); await ex.fill('2024-01-10'); await d.waitForTimeout(500); }
    const sub = d.getByRole('button', { name: /Submit for review|Save changes/ }).first(); if (await sub.isVisible().catch(() => false)) { await r.tap(sub); r.mark('expired'); await d.waitForTimeout(2500); }
    const cancel = d.getByRole('button', { name: 'Cancel' }).first(); if (await cancel.isVisible().catch(() => false)) await r.tap(cancel);
  }
  await d.waitForTimeout(1000);
});
await B(d, 'drv-vehicles', `${APP}/driver/vehicles`, async () => { await d.waitForTimeout(1400); await smoothScroll(d, 450, 1400); await d.waitForTimeout(1200); });
await B(d, 'drv-earnings', `${APP}/driver/earnings`, async (r) => {
  await d.waitForTimeout(1800); const r7 = d.getByRole('radio', { name: '7 days' }).or(d.getByRole('button', { name: '7 days' })).first();
  if (await r7.isVisible().catch(() => false)) { await r.tap(r7); await d.waitForTimeout(1600); }
  const r30 = d.getByRole('radio', { name: '30 days' }).or(d.getByRole('button', { name: '30 days' })).first();
  if (await r30.isVisible().catch(() => false)) { await r.tap(r30); await d.waitForTimeout(1600); }
  await smoothScroll(d, 650, 1700); await d.waitForTimeout(1300); await smoothScroll(d, 650, 1700); await d.waitForTimeout(1300);
});
await B(d, 'drv-statements', `${APP}/driver/statements`, async (r) => {
  await d.waitForTimeout(1500); const m = d.locator('a[href*="/driver/statements/"]').first();
  if (await m.isVisible().catch(() => false)) { await r.tap(m); await d.waitForTimeout(2500); r.mark('month'); await smoothScroll(d, 700, 1800); await d.waitForTimeout(1500); }
});
await B(d, 'drv-withdraw', `${APP}/driver/withdrawals`, async (r) => {
  await d.waitForTimeout(1600); const amt = d.getByLabel('Amount (৳)').first(); await amt.fill(''); await r.type(amt, '2000', 150); await d.waitForTimeout(600);
  await r.tap(d.getByRole('button', { name: 'Request withdrawal' }).first()); r.mark('requested'); await d.waitForTimeout(3000);
  await smoothScroll(d, 600, 1600); await d.waitForTimeout(1500);
});
await b.close();
