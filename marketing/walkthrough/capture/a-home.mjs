import { launch, context, recorder, APP } from './lib.mjs';
const b = await launch();
for (const [mode, mobile] of [['home-mobile', true], ['home-desktop', false]]) {
  const ctx = await context(b, { mobile }); const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  const r = await recorder(p, mode, mobile ? {} : { maxWidth: 2160, maxHeight: 1350 });
  r.mark('load'); await p.goto(`${APP}/welcome`);
  await p.waitForTimeout(8500); r.mark('scene1');
  for (let i = 2; i <= 11; i++) { await p.waitForTimeout(4200); await p.keyboard.press('ArrowDown'); r.mark(`scene${i}`); }
  await p.waitForTimeout(4500); r.mark('end');
  await r.stop(); await ctx.close();
}
await b.close();
