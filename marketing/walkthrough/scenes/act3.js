actCard('card3', '03', 'Drive & Earn', 'The চলো driver app', { label: '03 · Drive & Earn' });
const D3 = '03 · Drive & Earn';
scene({ id: 'd-join', dur: 8.5, act: 3, label: D3,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pb', { x: 1300, y: 115 })}
    ${tb({ id: 't', num: '01', eyebrow: 'Become a driver', hl: 'Apply in-app.|~Verified fast.', bullets: ['NID and licence numbers', 'Licence expiry checked by BD rules', 'Documents reviewed within 48 hours'], x: 150, y: 220, w: 660, sm: true })}
    ${chip('c1', 150, 720, 'Expired licence? Caught instantly.', 'alert')}`,
  play: [{ el: 'pa', clip: 'd-apply', start: 0.2, rate: 1.9 }, { el: 'pb', clip: 'd-docs', start: 0.8, rate: 1.3 }],
  caps: [[0.4, 4.4, 'Any rider can apply to drive: NID, licence number and expiry date.'], [4.5, 9.0, 'An expired licence or document is rejected on the spot, before it ever reaches review.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pb', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 3.6); } });
scene({ id: 'd-go', dur: 11, act: 3, label: D3,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pb', { x: 1300, y: 115 })}
    ${tb({ id: 't', num: '02', eyebrow: 'On duty', hl: 'Go online.|~Get offers.', sub: 'Pick the vehicle on duty, flip the switch, and offers arrive with fare, distance and a countdown.', x: 150, y: 250, w: 660, sm: true })}
    ${chip('c1', 150, 680, 'Offer · ৳182 · 7.2 km · 0.7 km away', 'zap')}`,
  play: [{ el: 'pa', clip: 'd-vehicles', start: 0.2, rate: 1 }, { el: 'pb', clip: 'd-online', start: 0.4, rate: 1, end: 4.5 }, { el: 'pb', clip: 'd-offer', start: 4.5, rate: 0.95 }],
  caps: [[0.4, 4.4, 'Rahim’s green CNG is approved and on duty. He goes online.'], [4.6, 11.7, 'A ride offer slides in — fare, distance, pickup — with fourteen seconds to accept.']],
  sfx: [[4.7, 'ding']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pb', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 5.2); } });
const PINK = '#E11D74';
function wDriverApp() {
  return `<div class="app"><div class="apphdr" style="justify-content:space-between"><img src="logo.svg"><span class="chip" style="background:#EAF4EE;color:#0C684F"><span style="width:8px;height:8px;border-radius:50%;background:#16A34A"></span>Online</span></div>
    <div class="abs" style="left:14px;right:14px;top:106px">
      <div class="row" style="gap:12px"><div class="av" style="width:52px;height:52px;background:${PINK};font-size:20px">F</div><div><div style="font-weight:900;font-size:19px">Farhana Akter</div><div style="font-size:13px;color:#5E6C65">★ 4.97 · White Axio · GA 27-4512</div></div></div>
      <div class="ucard" style="margin-top:14px;padding:14px 16px">
        <div style="font-size:12px;letter-spacing:2px;font-weight:800;color:#5E6C65">RIDE PREFERENCES</div>
        <div class="row" style="justify-content:space-between;margin-top:10px"><div><div style="font-weight:800;font-size:17px">Women riders only</div><div style="font-size:12.5px;color:#5E6C65;margin-top:2px">Offers only from verified women</div></div>
          <div id="wsw" style="width:56px;height:32px;border-radius:16px;background:#D6D3CB;position:relative;flex:none"><div id="wkn" style="position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25)"></div></div></div></div>
      <div id="wtoast" class="row" style="gap:8px;margin-top:12px;padding:10px 12px;border-radius:14px;background:#FDE7F0;color:#9D174D;font-size:13.5px;font-weight:700;opacity:0">${icb('shield', 16, '#BE185D', 2.4)}<span id="wtt">Women-only mode on</span></div>
      <div id="woffer" class="ucard" style="margin-top:12px;padding:14px 16px;border:2px solid ${PINK};opacity:0">
        <div class="row" style="justify-content:space-between"><span class="tag" style="background:#FDE7F0;color:#BE185D">WOMAN RIDER · VERIFIED</span><span id="wcd" style="font-weight:900;color:#BE185D;font-size:15px">14s</span></div>
        <div class="row" style="gap:10px;margin-top:10px"><div class="av" style="width:40px;height:40px;background:#F472B6;font-size:15px">S</div><div><div style="font-weight:800;font-size:16px">Sadia R. · ★ 4.9</div><div style="font-size:12.5px;color:#5E6C65">NID + selfie verified</div></div></div>
        <div style="font-size:14px;margin-top:10px;font-weight:600">Dhanmondi 27 → Banani 11</div>
        <div class="row" style="justify-content:space-between;margin-top:8px"><span style="font-size:26px;font-weight:900">৳260</span><span style="font-size:14px;color:#5E6C65;font-weight:700">9.4 km · 1.1 km away</span></div>
        <div id="wacc" class="btn" style="margin-top:10px;background:${PINK}">Accept</div></div>
      <div class="ucard row" style="margin-top:12px;padding:12px 16px;justify-content:space-between"><div><div style="font-size:12px;letter-spacing:2px;font-weight:800;color:#5E6C65">TODAY</div><div style="font-size:24px;font-weight:900">৳1,840</div></div>
        <div style="text-align:right;font-size:13px;color:#5E6C65;font-weight:700">7 trips · 5.2 h online<br><span style="color:#BE185D">100% women riders</span></div></div>
    </div>
    <div class="apptabs">${[['home', 'Drive'], ['trend', 'Earnings'], ['wallet', 'Wallet'], ['bell', 'Inbox'], ['user', 'Account']].map(([i, n], k) => `<div class="${k === 0 ? 'on' : ''}">${icb(i, 20)}${n}</div>`).join('')}</div></div>`;
}
scene({ id: 'd-women', dur: 12, act: 3, label: D3, mood: { pink: 1 },
  html: () => `${phone('pw', { x: 1220, y: 115, clip: false, inner: wDriverApp() })}
    ${tb({ id: 't', num: '03', eyebrow: 'Women drivers', hl: 'Women drive.|^Women ride.|^Safe together.', bullets: ['One switch: women riders only', 'Every rider verified with NID + selfie', 'SOS auto-call on every trip'], x: 150, y: 190, w: 980, tint: 'pink', sm: true })}
    ${chip('c1', 150, 690, '3 requests from men skipped automatically', 'shield')}`,
  caps: [[0.4, 5.6, 'Farhana drives for Cholo. One switch turns on “Women riders only”.'], [5.7, 12.2, 'Every offer she gets is from a verified woman rider — requests from men never reach her.']],
  sfx: [[2.2, 'tick'], [4.2, 'ding'], [8.6, 'tick'], [8.7, 'chime']],
  update(lt, d, r) {
    devIn($('#pw', r), lt, { from: 'right' }); animTB($('#t', r), lt);
    const k = P(lt, 2.2, 2.5, E.inOut); $('#wsw', r).style.background = k > 0.5 ? PINK : '#D6D3CB'; S($('#wkn', r), { x: k * 24 });
    const kt = P(lt, 2.6, 3.0); S($('#wtoast', r), { op: kt, y: (1 - kt) * -10 });
    $('#wtt', r).textContent = lt > 6.6 ? '3 requests from men skipped' : 'Women-only mode on';
    const ko = P(lt, 4.2, 4.7, E.back); S($('#woffer', r), { op: clamp(ko * 2), s: L(0.9, 1, Math.max(0, ko)), y: (1 - ko) * 30 });
    $('#wcd', r).textContent = lt > 8.6 ? 'Accepted ✓' : `${Math.max(1, 14 - Math.floor(clamp(lt - 4.2, 0, 13)))}s`;
    const acc = $('#wacc', r); acc.textContent = lt > 8.6 ? 'On the way to Sadia' : 'Accept'; acc.style.background = lt > 8.6 ? '#0C684F' : PINK; S(acc, { s: lt > 8.3 && lt < 8.7 ? 0.95 : 1 });
    popChip($('#c1', r), lt, 6.6);
  } });
const WK = [5200, 6900, 8800, 11550];
scene({ id: 'd-women-earn', dur: 11, act: 3, label: D3, mood: { pink: 1 },
  html: `${tb({ id: 't', num: '04', eyebrow: 'Her income', hl: 'Her city.|^Her money.|^Her rules.', x: 150, y: 170, w: 760, tint: 'pink' })}
    <div class="glass" id="we" style="left:960px;top:150px;width:820px;height:440px;padding:30px 36px">
      <div class="row" style="justify-content:space-between"><div><div class="lbl">Farhana · this month</div><div id="wtot" class="pinkt" style="font-size:76px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1">৳0</div></div>
        <div class="pill light" id="wbk" style="position:relative;opacity:0">${ic('check')}Paid to her bKash</div></div>
      <div class="row" style="gap:26px;align-items:flex-end;height:220px;margin-top:20px">${WK.map((v, i) => `<div style="flex:1;text-align:center"><div class="wb" style="height:${v / 60}px;border-radius:12px 12px 4px 4px;background:linear-gradient(180deg,#F9A8D4,${PINK});transform-origin:50% 100%"></div><div style="font-size:16px;color:rgba(255,255,255,.6);font-weight:700;margin-top:8px">Week ${i + 1}</div></div>`).join('')}</div></div>
    <div class="card" id="wq" style="left:960px;top:630px;width:820px;padding:26px 32px;border-left:8px solid ${PINK};opacity:0">
      <div style="font-size:30px;font-weight:800;line-height:1.3">“I pay my own rent now — and I feel safe on every single trip.”</div>
      <div class="row" style="gap:12px;margin-top:14px"><div class="av" style="width:44px;height:44px;background:${PINK};font-size:17px">F</div><div style="font-size:18px;color:#5E6C65;font-weight:700">Farhana Akter · Cholo driver, Mirpur</div></div></div>
    <div class="abs" id="wch" style="left:150px;top:640px;width:760px">${['Drive the hours you choose', 'Paid every day to bKash or Nagad', 'Women-safe night routes', 'A 24/7 women’s safety desk'].map((b) => `<div class="wc row" style="gap:14px;font-size:25px;font-weight:600;margin-bottom:16px"><span class="ck" style="background:rgba(240,80,140,.16);border-color:rgba(244,114,182,.6)">${icb('check', 18, '#F9A8D4', 3)}</span>${b}</div>`).join('')}</div>`,
  caps: [[0.4, 5.4, 'She picks her own hours and gets paid every day, straight to her own bKash.'], [5.5, 11.3, 'Earning on her own terms and feeling safe in Dhaka is still rare. Cholo makes it normal.']],
  sfx: [[3.6, 'coin']],
  update(lt, d, r) {
    animTB($('#t', r), lt); panelIn($('#we', r), lt, 0.5);
    $$('.wb', r).forEach((b, i) => { b.style.transform = `scaleY(${P(lt, 1.0 + i * 0.25, 1.8 + i * 0.25, E.out5)})`; });
    $('#wtot', r).textContent = `৳${Math.round(32450 * P(lt, 1.0, 3.6, E.out)).toLocaleString('en-IN')}`;
    const kb = P(lt, 3.6, 4.1, E.back); S($('#wbk', r), { op: clamp(kb * 2), s: Math.max(0, kb) });
    $$('.wc', r).forEach((el, i) => { const k = P(lt, 1.8 + i * 0.3, 2.3 + i * 0.3); S(el, { x: (1 - k) * -30, op: k }); });
    const kq = P(lt, 5.4, 6.2, E.out5); S($('#wq', r), { y: (1 - kq) * 40, op: kq });
  } });
scene({ id: 'd-earn', dur: 9, act: 3, label: D3,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '05', eyebrow: 'Earnings', hl: 'Take trips.|~See every taka.', sub: 'Gross fares, commission and your earnings — by day and by trip, cash and in-app kept separate.', x: 150, y: 220, w: 980 })}
    <div class="abs" id="kp" style="left:150px;top:600px;display:flex;gap:16px">${[['Trip fares · 30 days', 5958, 0], ['Your earnings', 5064.3, 2], ['Available to withdraw', 3367.25, 2]].map(([l, v, dd], i) => `<div class="glass kpi" style="position:relative;padding:20px 26px;border-radius:22px;min-width:270px"><div class="lbl">${l}</div><div class="kv ${i === 1 ? 'goldt' : ''}" data-v="${v}" data-d="${dd}" style="font-size:44px;font-weight:900;font-variant-numeric:tabular-nums">৳0</div></div>`).join('')}</div>`,
  play: [{ el: 'pa', clip: 'd-earn', start: 0.2, fit: true }],
  caps: [[0.4, 9.6, 'Rahim earned ৳5,064 in thirty days. Every trip and every commission is listed.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); $$('.kpi', r).forEach((el, i) => { const k = P(lt, 1.6 + i * 0.2, 2.2 + i * 0.2, E.back); S(el, { y: (1 - k) * 30, s: Math.max(0, k), op: clamp(k * 2) }); const kv = $('.kv', el); kv.textContent = tk(+kv.dataset.v * P(lt, 1.8 + i * 0.2, 3.6 + i * 0.2), +kv.dataset.d); }); } });
scene({ id: 'd-state', dur: 6, act: 3, label: D3,
  html: `${phone('pa', { x: 300, y: 115 })}${tb({ id: 't', num: '06', eyebrow: 'Statements', hl: 'Monthly statements,|~ready to print.', sub: 'Trips, fares, commission and earnings for every month — save it as a PDF in one tap.', x: 870, y: 270, w: 950 })}`,
  play: [{ el: 'pa', clip: 'd-state', start: 0.2, fit: true }],
  caps: [[0.4, 6.6, 'A statement for every month: trips, fares, the 15% commission and what he kept.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt); } });
scene({ id: 'd-cash', dur: 7.5, act: 3, label: D3,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '07', eyebrow: 'Withdrawals', hl: 'Cash out to|~bKash or Nagad.', sub: 'Request any amount from ৳50. Finance reviews it, and the money lands in your account.', x: 150, y: 270, w: 980 })}
    ${chip('c1', 150, 660, '৳2,000 requested to bKash ···002', 'wallet')}`,
  play: [{ el: 'pa', clip: 'd-withdraw', start: 0.2, fit: true }],
  caps: [[0.4, 8.1, 'Rahim withdraws ৳2,000 to his bKash. He can follow it in his history.']],
  sfx: [[3.8, 'coin']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 3.8); } });
