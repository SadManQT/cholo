import { launch, context, login, beat, smoothScroll, APP } from './lib.mjs';
const ONLY = process.env.ONLY?.split(','); 
const b = await launch(); const ctx = await context(b, { mobile: false }); const a = await ctx.newPage(); a.on('pageerror', (e) => console.log('ERR', e.message));
const REC = { rec: { maxWidth: 2160, maxHeight: 1350 } };
const B = (n, url, fn) => (!ONLY || ONLY.includes(n) ? beat(a, n, url, fn, REC) : null);
const cursor = async (x, y, steps = 20) => { await a.mouse.move(x, y, { steps }); };
await login(a, '01510009993');
await B('adm-dash', `${APP}/admin`, async (r) => {
  await a.waitForTimeout(2500); const city = a.getByLabel('City').first();
  if (await city.isVisible().catch(() => false)) { await r.tap(city, { touch: false }); await city.selectOption({ label: 'Chattogram' }); r.mark('ctg'); await a.waitForTimeout(2600); await city.selectOption({ label: 'Dhaka' }); r.mark('dhaka'); await a.waitForTimeout(2600); }
  await smoothScroll(a, 700, 1800); await a.waitForTimeout(1500); await smoothScroll(a, 700, 1800); await a.waitForTimeout(1500);
});
await B('adm-analytics', `${APP}/admin/analytics`, async () => { await a.waitForTimeout(2500); for (let i = 0; i < 4; i++) { await smoothScroll(a, 620, 1500); await a.waitForTimeout(1300); } });
await B('adm-commissions', `${APP}/admin/commissions`, async (r) => {
  await a.waitForTimeout(2000); const p30 = a.getByRole('button', { name: 'Last 30 days' }).first();
  if (await p30.isVisible().catch(() => false)) { await r.tap(p30, { touch: false }); await a.waitForTimeout(2500); }
  const city = a.getByLabel(/City/).first(); if (await city.isVisible().catch(() => false)) { await r.tap(city, { touch: false }); await city.selectOption({ label: 'Dhaka' }).catch(() => {}); await a.waitForTimeout(2200); await city.selectOption({ index: 0 }).catch(() => {}); await a.waitForTimeout(1500); }
  await smoothScroll(a, 650, 1700); await a.waitForTimeout(1500); await smoothScroll(a, 650, 1700); await a.waitForTimeout(1500);
});
await B('adm-drivers', `${APP}/admin/drivers`, async (r) => {
  await a.waitForTimeout(2200); const ap = a.getByRole('button', { name: /^Approve driver$|^Approve$/ }).first();
  if (await ap.isVisible().catch(() => false)) { await r.tap(ap, { touch: false }); await a.waitForTimeout(1200); const conf = a.getByRole('dialog').getByRole('button', { name: /Approve/ }).first(); if (await conf.isVisible().catch(() => false)) await r.tap(conf, { touch: false }); r.mark('approved'); await a.waitForTimeout(2500); }
  await smoothScroll(a, 500, 1500); await a.waitForTimeout(1200);
});
await B('adm-docs', `${APP}/admin/documents`, async () => { await a.waitForTimeout(2200); await smoothScroll(a, 600, 1600); await a.waitForTimeout(1500); });
await B('adm-users', `${APP}/admin/users`, async () => { await a.waitForTimeout(2200); await smoothScroll(a, 600, 1600); await a.waitForTimeout(1500); });
await B('adm-pricing', `${APP}/admin/pricing`, async (r) => {
  await a.waitForTimeout(2000); const nr = a.getByRole('button', { name: /New rate card/ }).first();
  if (await nr.isVisible().catch(() => false)) { await r.tap(nr, { touch: false }); await a.waitForTimeout(2200); }
  await smoothScroll(a, 600, 1600); await a.waitForTimeout(1500);
});
await B('adm-zones', `${APP}/admin/zones`, async (r) => {
  await a.waitForTimeout(3000); const city = a.getByLabel('City').first();
  await r.tap(city, { touch: false }); await city.selectOption({ label: 'Sylhet' }); r.mark('sylhet'); await a.waitForTimeout(3000);
  await city.selectOption({ label: 'Chattogram' }); r.mark('ctg'); await a.waitForTimeout(3000);
  await city.selectOption({ label: 'Dhaka' }); r.mark('dhaka'); await a.waitForTimeout(3200);
  await r.tap(a.getByRole('button', { name: 'New zone' }), { touch: false }); await a.waitForTimeout(1200); r.mark('draw');
  const map = await a.locator('.leaflet-container').first().boundingBox();
  const pts = [[0.30, 0.36], [0.44, 0.30], [0.52, 0.44], [0.40, 0.55], [0.28, 0.50]];
  for (const [fx, fy] of pts) { const x = map.x + map.width * fx, y = map.y + map.height * fy; await cursor(x, y, 18); await a.waitForTimeout(150); await r.tap({ boundingBox: async () => ({ x: x - 1, y: y - 1, width: 2, height: 2 }), waitFor: async () => {}, evaluate: async () => {} }, { touch: false }); await a.waitForTimeout(450); }
  const name = a.getByLabel('Name').first(); await r.type(name, 'Tejgaon Event Zone', 60);
  const type = a.getByLabel('Type').first(); if (await type.isVisible().catch(() => false)) { await type.selectOption({ index: 3 }).catch(() => {}); await a.waitForTimeout(800); }
  const save = a.getByRole('button', { name: /Save|Create zone/ }).first(); if (await save.isVisible().catch(() => false)) { await r.tap(save, { touch: false }); r.mark('saved'); await a.waitForTimeout(2500); }
});
await B('adm-surge', `${APP}/admin/surge`, async () => { await a.waitForTimeout(2500); await smoothScroll(a, 500, 1500); await a.waitForTimeout(1500); });
await B('adm-promos', `${APP}/admin/promos`, async () => { await a.waitForTimeout(2200); await smoothScroll(a, 500, 1500); await a.waitForTimeout(1300); });
await B('adm-payouts', `${APP}/admin/payouts`, async (r) => {
  await a.waitForTimeout(2200); const ap = a.getByRole('button', { name: /^Approve$/ }).first();
  if (await ap.isVisible().catch(() => false)) { await r.tap(ap, { touch: false }); await a.waitForTimeout(1200); const conf = a.getByRole('dialog').getByRole('button', { name: /Approve|Confirm/ }).first(); if (await conf.isVisible().catch(() => false)) await r.tap(conf, { touch: false }); r.mark('approved'); await a.waitForTimeout(2500); }
  await smoothScroll(a, 400, 1300); await a.waitForTimeout(1200);
});
await B('adm-sos', `${APP}/admin/sos`, async () => { await a.waitForTimeout(3500); await smoothScroll(a, 450, 1500); await a.waitForTimeout(1500); });
await B('adm-disputes', `${APP}/admin/disputes`, async () => { await a.waitForTimeout(2200); await smoothScroll(a, 450, 1400); await a.waitForTimeout(1200); });
await B('adm-reports', `${APP}/admin/reports`, async () => { await a.waitForTimeout(2200); await smoothScroll(a, 450, 1400); await a.waitForTimeout(1200); });
await B('adm-support', `${APP}/admin/support`, async () => { await a.waitForTimeout(2200); await smoothScroll(a, 450, 1400); await a.waitForTimeout(1200); });
await B('adm-audit', `${APP}/admin/audit`, async () => { await a.waitForTimeout(2200); await smoothScroll(a, 600, 1800); await a.waitForTimeout(1200); });
await b.close();
