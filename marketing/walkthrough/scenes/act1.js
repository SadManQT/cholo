actCard('card1', '01', 'Welcome', 'The real চলো website', { label: '01 · Welcome' });
scene({ id: 'home-desk', dur: 9, act: 1, label: '01 · Welcome',
  html: `${laptop('lp1', { x: 300, y: 150, scale: 1.0, url: 'cholo-cholo7.vercel.app' })}
    <div class="abs" id="hd-e" style="left:300px;top:100px"><span class="eyebrow"><span class="n">01</span>The home page</span></div>`,
  play: [{ el: 'lp1', clip: 'home-desk', start: 0.4, fit: true }],
  caps: [[0.6, 4.6, 'Everything starts on cholo-cholo7.vercel.app.'], [4.7, 9.6, 'The home page tells one ride, step by step — from booking to rating.']],
  sfx: [[0.3, 'whoosh']],
  update(lt, d, r) { const k = P(lt, 0, 1.1, E.out5); const el = $('#lp1', r); el.style.transform = `translate(0,${(1 - k) * 300}px) perspective(2400px) rotateX(${(1 - k) * 18}deg) scale(${L(0.86, 0.94, k) + P(lt, 1, d, E.lin) * 0.03})`; el.style.opacity = clamp(k * 2); S($('#hd-e', r), { op: P(lt, 0.6, 1.2) }); } });
const HSTEPS = ['Book', 'Match', 'Women-only', 'Arrive', 'Board', 'Ride', 'Detour', 'Pay', 'Rate', 'Metro + ride', 'Digital twin'];
scene({ id: 'home-mob', dur: 12.5, act: 1, label: '01 · Welcome',
  html: `${phone('ph1', { x: 300, y: 115, bar: 'dark' })}
    ${tb({ id: 'tb1', num: '01', eyebrow: 'On your phone', hl: 'One ride,|~step by step.', x: 870, y: 150, w: 900 })}
    <div class="abs" id="hsteps" style="left:870px;top:440px;width:900px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px 28px">${HSTEPS.map((s, i) => `<div class="hs row" style="gap:14px;font-size:25px;font-weight:700;padding:10px 18px;border-radius:16px;border:1.5px solid rgba(255,255,255,.12)"><span style="font-size:15px;color:var(--gold);font-weight:800;width:30px">${String(i + 1).padStart(2, '0')}</span>${s}</div>`).join('')}</div>`,
  play: [{ el: 'ph1', clip: 'home-mob', start: 0.5, fit: true }],
  caps: [[0.5, 6.3, 'On a phone, swipe through all eleven moments of a চলো ride.'], [6.4, 13.2, 'Book, match, women-only, arrive, board, ride, detour, pay, rate, Metro and the digital twin.']],
  update(lt, d, r) {
    devIn($('#ph1', r), lt, { from: 'left', ry: 8 }); animTB($('#tb1', r), lt);
    const ct = Math.max(0, lt - 0.5) * SCENES.find((s) => s.id === 'home-mob').play[0].rate; const cur = clamp(Math.floor((ct + 0.2) / 4.2), 0, 10);
    $$('.hs', r).forEach((el, i) => { const k = P(lt, 0.8 + i * 0.07, 1.3 + i * 0.07); el.style.opacity = k * (i === cur ? 1 : 0.55); el.style.background = i === cur ? 'rgba(251,191,46,.16)' : 'transparent'; el.style.borderColor = i === cur ? 'rgba(251,191,46,.7)' : 'rgba(255,255,255,.12)'; S(el, { x: (1 - k) * 30, s: i === cur ? 1.03 : 1 }); el.style.opacity = k * (i === cur ? 1 : 0.55); });
  } });
scene({ id: 'lang', dur: 9, act: 1, label: '01 · Welcome',
  html: `${phone('ph2', { x: 980, y: 115 })}${phone('ph3', { x: 1420, y: 115 })}
    ${tb({ id: 'tb2', num: '02', eyebrow: 'Made for Bangladesh', hl: 'Bangla or English.|~Light or dark.', sub: 'Switch language and theme in one tap. The whole app follows.', x: 150, y: 260, w: 820 })}`,
  play: [{ el: 'ph2', clip: 'hub-dark', start: 0.4, rate: 1 }, { el: 'ph3', clip: 'hub-bn', start: 0.8, rate: 1 }],
  caps: [[0.5, 9.6, 'Dark mode, and a fully Bangla interface — every screen, every label.']],
  update(lt, d, r) { devIn($('#ph2', r), lt, { from: 'right', a: 0, ry: -8 }); devIn($('#ph3', r), lt, { from: 'right', a: 0.25, ry: -8 }); animTB($('#tb2', r), lt, 0.3); } });
