import fs from 'node:fs';
import { launch, context, recorder, db, APP } from './lib.mjs';
const LOG = '/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/api.log';
const q = await db(); const PHONE = '01799886655';
await q.query(`delete from users where phone=$1`, [PHONE]).catch(async () => { await q.query(`update users set phone='0179900' || id where phone=$1`, [PHONE]); });
const b = await launch(); const ctx = await context(b); const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`${APP}/register`); await p.waitForTimeout(2500);
const r = await recorder(p, 'auth');
r.mark('register'); await p.waitForTimeout(900);
await r.type(p.getByLabel('Full name'), 'Sadia Rahman', 70);
await r.type(p.getByLabel('Phone'), PHONE, 75);
await r.type(p.getByLabel('Password', { exact: true }), 'DemoPass123', 60);
await p.waitForTimeout(700);
const before = fs.statSync(LOG).size;
await r.tap(p.getByRole('button', { name: 'Create account' })); r.mark('otp');
await p.getByText('Verify your phone').first().waitFor({ timeout: 15000 }); await p.waitForTimeout(1200);
let code = null; for (let i = 0; i < 30 && !code; i++) { const tail = fs.readFileSync(LOG, 'utf8').slice(before); code = tail.match(/Cholo OTP is (\d{4,6})/)?.[1]; if (!code) await p.waitForTimeout(300); }
console.log('otp', code);
await r.tap(p.getByLabel('Digit 1 of', { exact: false }).first());
for (const ch of code) { await p.keyboard.type(ch); await p.waitForTimeout(260); }
await p.waitForTimeout(600);
const v = p.getByRole('button', { name: 'Verify' }); if (await v.isEnabled().catch(() => false) && await v.isVisible()) await r.tap(v);
r.mark('verified'); await p.waitForTimeout(5000); r.mark('home');
await r.stop();
const c2 = await context(b); const p2 = await c2.newPage(); await p2.goto(`${APP}/login`); await p2.waitForTimeout(2000);
const r2 = await recorder(p2, 'login'); r2.mark('login'); await p2.waitForTimeout(600);
await r2.type(p2.getByLabel('Phone'), '01710000001', 75); await r2.type(p2.getByLabel('Password', { exact: true }), 'DemoPass123', 60);
await r2.tap(p2.locator('button[type=submit]')); await p2.waitForTimeout(4000); r2.mark('end'); await r2.stop();
await b.close(); await q.end();
