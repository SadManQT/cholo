actCard('card3', '03', 'Drive & Earn', 'The চলো driver app', { label: '03 · Drive & Earn' });
const D3 = '03 · Drive & Earn';
scene({ id: 'd-join', dur: 11, act: 3, label: D3,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pb', { x: 1300, y: 115 })}
    ${tb({ id: 't', num: '01', eyebrow: 'Become a driver', hl: 'Apply in-app.|~Verified fast.', bullets: ['NID and licence numbers', 'Licence expiry checked by BD rules', 'Documents reviewed within 48 hours'], x: 150, y: 220, w: 660, sm: true })}
    ${chip('c1', 150, 720, 'Expired licence? Caught instantly.', 'alert')}`,
  play: [{ el: 'pa', clip: 'd-apply', start: 0.2, rate: 1.45 }, { el: 'pb', clip: 'd-docs', start: 0.8, rate: 1.0 }],
  caps: [[0.4, 6.2, 'Any rider can apply to drive: NID, licence number and expiry date.'], [6.4, 12.2, 'An expired licence or document is rejected on the spot, before it ever reaches review.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pb', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 4.8); } });
scene({ id: 'd-go', dur: 11, act: 3, label: D3,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pb', { x: 1300, y: 115 })}
    ${tb({ id: 't', num: '02', eyebrow: 'On duty', hl: 'Go online.|~Get offers.', sub: 'Pick the vehicle on duty, flip the switch, and offers arrive with fare, distance and a countdown.', x: 150, y: 250, w: 660, sm: true })}
    ${chip('c1', 150, 680, 'Offer · ৳182 · 7.2 km · 0.7 km away', 'zap')}`,
  play: [{ el: 'pa', clip: 'd-vehicles', start: 0.2, rate: 1 }, { el: 'pb', clip: 'd-online', start: 0.4, rate: 1, end: 4.5 }, { el: 'pb', clip: 'd-offer', start: 4.5, rate: 0.95 }],
  caps: [[0.4, 4.4, 'Rahim’s green CNG is approved and on duty. He goes online.'], [4.6, 11.7, 'A ride offer slides in — fare, distance, pickup — with fourteen seconds to accept.']],
  sfx: [[4.7, 'ding']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pb', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 5.2); } });
scene({ id: 'd-earn', dur: 10.5, act: 3, label: D3,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '03', eyebrow: 'Earnings', hl: 'Take trips.|~See every taka.', sub: 'Gross fares, commission and your earnings — by day and by trip, cash and in-app kept separate.', x: 150, y: 220, w: 980 })}
    <div class="abs" id="kp" style="left:150px;top:600px;display:flex;gap:16px">${[['Trip fares · 30 days', 5958, 0], ['Your earnings', 5064.3, 2], ['Available to withdraw', 3367.25, 2]].map(([l, v, dd], i) => `<div class="glass kpi" style="position:relative;padding:20px 26px;border-radius:22px;min-width:270px"><div class="lbl">${l}</div><div class="kv ${i === 1 ? 'goldt' : ''}" data-v="${v}" data-d="${dd}" style="font-size:44px;font-weight:900;font-variant-numeric:tabular-nums">৳0</div></div>`).join('')}</div>`,
  play: [{ el: 'pa', clip: 'd-earn', start: 0.2, fit: true }],
  caps: [[0.4, 11.7, 'Rahim earned ৳5,064 in thirty days. Every trip and every commission is listed.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); $$('.kpi', r).forEach((el, i) => { const k = P(lt, 1.6 + i * 0.2, 2.2 + i * 0.2, E.back); S(el, { y: (1 - k) * 30, s: Math.max(0, k), op: clamp(k * 2) }); const kv = $('.kv', el); kv.textContent = tk(+kv.dataset.v * P(lt, 1.8 + i * 0.2, 3.6 + i * 0.2), +kv.dataset.d); }); } });
scene({ id: 'd-state', dur: 8, act: 3, label: D3,
  html: `${phone('pa', { x: 300, y: 115 })}${tb({ id: 't', num: '04', eyebrow: 'Statements', hl: 'Monthly statements,|~ready to print.', sub: 'Trips, fares, commission and earnings for every month — save it as a PDF in one tap.', x: 870, y: 270, w: 950 })}`,
  play: [{ el: 'pa', clip: 'd-state', start: 0.2, fit: true }],
  caps: [[0.4, 8.7, 'A statement for every month: trips, fares, the 15% commission and what he kept.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt); } });
scene({ id: 'd-cash', dur: 9, act: 3, label: D3,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '05', eyebrow: 'Withdrawals', hl: 'Cash out to|~bKash or Nagad.', sub: 'Request any amount from ৳50. Finance reviews it, and the money lands in your account.', x: 150, y: 270, w: 980 })}
    ${chip('c1', 150, 660, '৳2,000 requested to bKash ···002', 'wallet')}`,
  play: [{ el: 'pa', clip: 'd-withdraw', start: 0.2, fit: true }],
  caps: [[0.4, 9.7, 'Rahim withdraws ৳2,000 to his bKash. He can follow it in his history.']],
  sfx: [[4.4, 'coin']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 4.4); } });
