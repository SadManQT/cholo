actCard('card2', '02', 'Ride', 'Book · ride · pay', { label: '02 · Ride' });
const R = '02 · Ride';
scene({ id: 'signup', dur: 9, act: 2, label: R,
  html: `${phone('pa', { x: 300, y: 115 })}${tb({ id: 't', num: '01', eyebrow: 'Get started', hl: 'Sign up|~in seconds.', sub: 'Name, phone, password — then a six-digit code by SMS. That’s it.', x: 870, y: 270, w: 880 })}
    ${chip('c1', 870, 640, 'Secure login · OTP by SMS', 'lock')}${chip('c2', 870, 720, 'Your phone number is your account', 'phone')}`,
  play: [{ el: 'pa', clip: 'auth', start: 0.3, fit: true }],
  caps: [[0.4, 9.6, 'Create an account with your phone number. A six-digit code arrives by SMS.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt, 0.3); popChip($('#c1', r), lt, 3.6); popChip($('#c2', r), lt, 4.4); } });
scene({ id: 'where', dur: 12, act: 2, label: R,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '02', eyebrow: 'Book a ride', hl: 'Where to?|~Just type it.', bullets: ['Live address search', 'Routes drawn on real roads', 'Add stops on the way'], x: 150, y: 250, w: 900 })}
    ${chip('c1', 760, 700, 'Gulshan 2 Circle · 7.2 km · 19 min', 'pin', 'light')}`,
  play: [{ el: 'pa', clip: 'p-where', start: 0.3, fit: true }],
  caps: [[0.4, 6.5, 'Type where you’re going — suggestions appear as you type.'], [6.7, 13.2, 'The route is drawn on real roads. Need a stop on the way? Add it.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 4.2); } });
scene({ id: 'choose', dur: 9, act: 2, label: R,
  html: `${phone('pa', { x: 300, y: 115 })}${tb({ id: 't', num: '03', eyebrow: 'Choose a ride', hl: 'Every fare,|~upfront.', sub: 'Bike, CNG, car or premium — you see the price before you book.', x: 870, y: 240, w: 900 })}
    <div class="abs" id="fares" style="left:870px;top:600px;display:flex;gap:16px">${[['Bike', '136'], ['CNG', '182'], ['Car', '276'], ['Premium', '383']].map(([n, p], i) => `<div class="glass fr" style="position:relative;padding:18px 24px;border-radius:20px;${i === 1 ? 'border-color:rgba(251,191,46,.8);background:rgba(251,191,46,.14)' : ''}"><div style="font-size:18px;color:rgba(255,255,255,.65);font-weight:700">${n}</div><div style="font-size:38px;font-weight:900" class="${i === 1 ? 'goldt' : ''}">৳${p}</div></div>`).join('')}</div>`,
  play: [{ el: 'pa', clip: 'p-choose', start: 0.2, fit: true }],
  caps: [[0.4, 9.6, 'Every vehicle shows its fare before you book. No haggling, no surprises.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt); $$('.fr', r).forEach((el, i) => { const k = P(lt, 1.6 + i * 0.15, 2.2 + i * 0.15, E.back); S(el, { y: (1 - k) * 30, s: Math.max(0, k), op: clamp(k * 2) }); }); } });
scene({ id: 'extras', dur: 9.5, act: 2, label: R,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '04', eyebrow: 'Your ride, your way', hl: 'Promos, schedules|~and women-only.', bullets: ['Promo codes like CHOLO20', 'Schedule up to 7 days ahead', 'Women-only driver preference'], x: 150, y: 250, w: 950 })}`,
  play: [{ el: 'pa', clip: 'p-extras', start: 0.2, fit: true }],
  caps: [[0.4, 10.1, 'Add a promo code, schedule for tomorrow morning, or ask for a woman driver.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); } });
scene({ id: 'match', dur: 10.5, act: 2, label: R,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pd', { x: 1300, y: 115 })}
    <div class="abs lbl" id="l1" style="left:890px;top:72px;color:rgba(255,255,255,.7)">Nusrat · passenger</div><div class="abs lbl" id="l2" style="left:1380px;top:72px;color:rgba(255,255,255,.7)">Rahim · driver</div>
    ${tb({ id: 't', num: '05', eyebrow: 'Matching', hl: 'Matched|~in seconds.', sub: 'The nearest driver gets the offer with the fare and distance. One tap to accept.', x: 150, y: 270, w: 640, sm: true })}
    ${chip('c1', 150, 700, 'Driver found · 0.7 km away', 'check')}`,
  play: [{ el: 'pa', clip: 'p-match', start: 0.4, rate: 1 }, { el: 'pd', clip: 'd-match', start: 0.4, rate: 1 }],
  caps: [[0.4, 5.4, 'Nusrat confirms. Rahim’s phone lights up with the offer: ৳182, 7.2 km.'], [5.6, 10.7, 'He accepts — and Nusrat sees her driver straight away.']],
  sfx: [[5.2, 'ding']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pd', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); S($('#l1', r), { op: P(lt, 0.8, 1.3) }); S($('#l2', r), { op: P(lt, 0.9, 1.4) }); popChip($('#c1', r), lt, 5.3); } });
scene({ id: 'enroute', dur: 7.5, act: 2, label: R,
  html: `${phone('pa', { x: 300, y: 115 })}${tb({ id: 't', num: '06', eyebrow: 'Live tracking', hl: 'Watch your driver|~arrive.', sub: 'The car moves on the map in real time, with the plate and rating to check.', x: 870, y: 270, w: 900 })}
    ${chip('c1', 870, 660, 'Rahim · Green CNG · DHAKA METRO-THA 11-2345', 'id')}`,
  play: [{ el: 'pa', clip: 'p-enroute', start: 0.2, fit: true }],
  caps: [[0.4, 7.7, 'Rahim drives to the pickup. Every move shows live on Nusrat’s map.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 2.6); } });
const STEPS = [['Driver: “I’ve arrived”', 1.0], ['Rider: “He’s not here”', 4.4], ['Driver arrives again', 7.6], ['Rider: “I’m in the car”', 12.3], ['Trip starts', 15.6]];
scene({ id: 'pickup', dur: 16.5, act: 2, label: R,
  html: `${phone('pa', { x: 820, y: 105, scale: 0.86 })}${phone('pd', { x: 1300, y: 105, scale: 0.86 })}
    <div class="abs lbl" style="left:890px;top:62px;color:rgba(255,255,255,.7)">Nusrat · passenger</div><div class="abs lbl" style="left:1380px;top:62px;color:rgba(255,255,255,.7)">Rahim · driver</div>
    ${tb({ id: 't', num: '07', eyebrow: 'Signature safety', hl: 'No fake pickups.|~You confirm|~the start.', x: 150, y: 200, w: 660, sm: true })}
    <div class="abs" style="left:150px;top:560px;width:620px">${STEPS.map(([s], i) => `<div class="st row" style="gap:14px;margin-bottom:12px;padding:12px 18px;border-radius:16px;border:1.5px solid rgba(255,255,255,.12);font-size:22px;font-weight:700"><span class="st-n" style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;background:rgba(255,255,255,.1)">${i + 1}</span>${s}</div>`).join('')}</div>`,
  play: [{ el: 'pa', clip: 'p-pickup', start: 0.2, rate: 1.42 }, { el: 'pd', clip: 'd-pickup', start: 0.2, rate: 1.42 }],
  caps: [[0.4, 4.2, 'Rahim slides “I’ve arrived”. But the trip can’t start yet.'], [4.3, 8.9, 'If he isn’t really there, Nusrat taps “My driver isn’t here” — and he’s sent back.'], [9.0, 13.6, 'When he’s truly at the pickup, Nusrat confirms she’s in the car.'], [13.7, 17.2, 'Only then can the trip start. No fake pickups, ever.']],
  sfx: [[4.4, 'alert2', 0.5], [12.3, 'ding'], [15.6, 'chime']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', base: 0.86, ry: -6 }); devIn($('#pd', r), lt, { from: 'bottom', a: 0.15, base: 0.86, ry: -6 }); animTB($('#t', r), lt);
    const cur = STEPS.reduce((acc, [, at], i) => (lt >= at ? i : acc), -1);
    $$('.st', r).forEach((el, i) => { const k = P(lt, 0.8 + i * 0.12, 1.3 + i * 0.12); const on = i === cur, done = i < cur; el.style.opacity = k * (on ? 1 : done ? 0.75 : 0.45); el.style.borderColor = on ? (i === 1 ? 'rgba(248,113,113,.8)' : 'rgba(251,191,46,.8)') : 'rgba(255,255,255,.12)'; el.style.background = on ? (i === 1 ? 'rgba(220,38,38,.16)' : 'rgba(251,191,46,.14)') : 'transparent';
      const n = $('.st-n', el); n.style.background = done || on ? (i === 1 ? '#DC2626' : '#FBBF2E') : 'rgba(255,255,255,.1)'; n.style.color = done || on ? '#0A3D30' : '#fff'; S(el, { x: (1 - k) * 30 }); }); } });
scene({ id: 'share', dur: 11, act: 2, label: R,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pf', { x: 1300, y: 115 })}
    <div class="abs lbl" style="left:890px;top:72px;color:rgba(255,255,255,.7)">Nusrat · in the CNG</div><div class="abs lbl" style="left:1380px;top:72px;color:rgba(249,168,212,.9)">Ammu · at home</div>
    ${tb({ id: 't', num: '08', eyebrow: 'Share your trip', hl: 'Family follows|~every turn.', sub: 'One tap copies a private link. Anyone you trust watches the car live — no app needed.', x: 150, y: 270, w: 640, sm: true })}
    ${chip('c1', 150, 690, 'Private link · expires after the trip', 'link')}`,
  play: [{ el: 'pa', clip: 'p-share', start: 0.2, rate: 1 }, { el: 'pf', clip: 'f-share', start: 2.4, rate: 1.4, from: 0.2 }],
  caps: [[0.4, 4.6, 'Nusrat taps “Share trip”. The link is copied.'], [4.7, 11.7, 'Ammu opens it at home and watches the CNG move, live.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pf', r), lt, { from: 'right', a: 2.2, ry: -10 }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 3.0); } });
const SOSR = [['Ammu', 'Live location sent', 'ok'], ['Abbu', 'Live location sent', 'ok'], ['Rafi (brother)', 'Live location sent', 'ok'], ['চলো Safety Team', 'Calling you now…', 'call'], ['Police · 999', 'Nearest station alerted', 'ok'], ['Audio recording', 'Started automatically', 'rec']];
scene({ id: 'sos', dur: 14.5, act: 2, label: R, mood: { red: 1 },
  html: `${phone('pa', { x: 230, y: 115, inner: `<div id="sflood" class="abs" style="inset:0;top:38px;background:linear-gradient(180deg,#B91C1C,#7F1D1D);z-index:30;padding:40px 22px 0;opacity:0">
      <div class="row" style="justify-content:space-between;color:#fff"><div><div style="font-size:14px;letter-spacing:3px;font-weight:800;opacity:.8">SOS ACTIVE</div><div style="font-size:23px;font-weight:900;white-space:nowrap">Help is on the way</div></div>
      <div id="stime" style="font-size:22px;font-weight:900;font-variant-numeric:tabular-nums;background:rgba(0,0,0,.25);padding:8px 12px;border-radius:12px">00:00</div></div>
      <div class="row" style="gap:10px;margin:16px 0 14px;color:#FEE2E2;font-size:15px;font-weight:700"><span id="sdot" style="width:10px;height:10px;border-radius:50%;background:#FECACA"></span>Sharing live location · Gulshan Ave</div>
      ${SOSR.map(([n, s, k]) => `<div class="srow row" style="gap:12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:8px 12px;margin-bottom:7px;color:#fff">
        <div class="av" style="width:34px;height:34px;background:rgba(255,255,255,.2);font-size:14px">${n === 'Audio recording' ? '●' : n[0]}</div>
        <div style="flex:1"><div style="font-weight:800;font-size:16px">${n}</div><div style="font-size:13px;opacity:.8">${s}</div></div>
        <div class="sst" style="width:30px;height:30px;border-radius:50%;background:${k === 'ok' ? '#fff' : k === 'call' ? '#FBBF2E' : '#FCA5A5'};display:flex;align-items:center;justify-content:center">${k === 'ok' ? icb('check', 18, '#B91C1C', 3.4) : k === 'call' ? icb('headset', 16, '#7F1D1D', 2.6) : '<span style="width:10px;height:10px;border-radius:50%;background:#7F1D1D"></span>'}</div></div>`).join('')}
      <div id="smap" style="position:relative;height:150px;border-radius:16px;overflow:hidden;margin-top:4px;background:#FDE8E8">
        <svg viewBox="0 0 330 150" style="position:absolute;inset:0;width:100%;height:100%"><g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"><path d="M-10 90h350"/><path d="M120 -10v170"/><path d="M-10 30 C80 40 200 10 340 50"/><path d="M250 -10v170"/></g></svg>
        <div id="spr" class="abs" style="left:150px;top:60px;width:60px;height:60px;border-radius:50%;background:rgba(220,38,38,.35)"></div>
        <div class="abs" style="left:170px;top:80px;width:20px;height:20px;border-radius:50%;background:#DC2626;border:4px solid #fff"></div>
        <div class="abs" style="left:10px;bottom:8px;font-size:12px;font-weight:800;color:#7F1D1D;background:#fff;padding:4px 10px;border-radius:999px">LIVE · updating every second</div></div></div>` })}
    ${tb({ id: 't', num: '09', eyebrow: 'SOS · one tap', hl: 'In danger?|!One tap.|!Help is here.', sub: 'Your family gets your live location and a danger alert. Our 24/7 safety team calls you, and police are alerted in seconds.', x: 780, y: 200, w: 1000, tint: 'red', sm: true })}
    <div class="card" id="sms" style="left:1330px;top:60px;width:520px;padding:18px 22px;border-radius:22px;border-left:8px solid #DC2626;opacity:0">
      <div class="row" style="gap:10px;font-size:13px;font-weight:900;letter-spacing:2px;color:#DC2626"><span style="width:10px;height:10px;border-radius:50%;background:#DC2626"></span><span class="bnd" style="letter-spacing:0">চলো</span> SOS ALERT · NOW</div>
      <div style="font-weight:900;font-size:21px;margin-top:6px">Nusrat needs help right now!</div><div style="font-size:15px;color:#5E6C65;margin-top:3px">Live location: Gulshan Avenue · CNG Tha 11-2345</div></div>
    <div class="abs" id="sosb" style="left:780px;top:740px;display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;width:1000px">${['Family alerted with your live location', '24/7 safety team calls you instantly', 'Police 999 alerted automatically', 'Audio recording starts on its own'].map((b) => `<div class="sb row" style="gap:12px;font-size:22px;font-weight:600"><span class="ck" style="background:rgba(220,38,38,.18);border-color:rgba(248,113,113,.7)">${icb('check', 18, '#FCA5A5', 3)}</span>${b}</div>`).join('')}</div>`,
  play: [{ el: 'pa', clip: 'p-sos', start: 0.3, rate: 1 }],
  caps: [[0.4, 6.6, 'Feel unsafe? The red SOS button is always on the trip screen.'], [6.8, 15.2, 'One tap: family, the safety team and police 999 are alerted with your live location.']],
  sfx: [[1.8, 'tick'], [3.4, 'impact', 0.6], [3.6, 'alarm'], [7.0, 'alarm']],
  update(lt, d, r) {
    devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt, 0.3);
    const kf = P(lt, 6.6, 7.3, E.inOut); const fl = $('#sflood', r); fl.style.opacity = kf > 0 ? 1 : 0; fl.style.clipPath = `circle(${kf * 140}% at 85% 8%)`;
    $('#stime', r).textContent = `00:0${Math.min(9, Math.floor(clamp(lt - 6.8, 0, 99)))}`; $('#sdot', r).style.opacity = 0.4 + 0.6 * Math.abs(Math.sin(lt * 5));
    $$('.srow', r).forEach((el, i) => { const k = P(lt, 7.4 + i * 0.3, 7.9 + i * 0.3, E.out5); S(el, { x: (1 - k) * 60, op: k }); S($('.sst', el), { s: Math.max(0, P(lt, 7.7 + i * 0.3, 8.1 + i * 0.3, E.back)) }); });
    const km = P(lt, 9.3, 9.8); S($('#smap', r), { y: (1 - km) * 30, op: km }); const c = (lt * 1.2) % 1; S($('#spr', r), { s: 0.5 + c * 1.4, op: 1 - c });
    const ks = P(lt, 8.2, 8.8, E.back); S($('#sms', r), { y: (1 - ks) * -60 + Math.sin(lt * 14) * (lt > 8.2 && lt < 8.9 ? 4 : 0), s: L(0.9, 1, ks), op: clamp(ks * 2) });
    $$('.sb', r).forEach((el, i) => { const k = P(lt, 9.6 + i * 0.25, 10.1 + i * 0.25); S(el, { y: (1 - k) * 20, op: k }); });
  } });
scene({ id: 'stop', dur: 11, act: 2, label: R,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pd', { x: 1300, y: 115 })}
    <div class="abs lbl" style="left:890px;top:72px;color:rgba(255,255,255,.7)">Nusrat</div><div class="abs lbl" style="left:1380px;top:72px;color:rgba(255,255,255,.7)">Rahim</div>
    ${tb({ id: 't', num: '10', eyebrow: 'Stop here', hl: 'Get out early.|~Pay only for|~the distance.', x: 150, y: 220, w: 660, sm: true })}
    <div class="glass" id="fare" style="left:150px;top:620px;padding:22px 30px;border-radius:24px;opacity:0"><div class="lbl">Final fare</div>
      <div class="row" style="gap:18px;margin-top:6px"><span style="font-size:40px;font-weight:800;color:rgba(255,255,255,.45);text-decoration:line-through">৳182</span>${icb('arrow', 34, '#FBBF2E', 2.6)}<span class="goldt" style="font-size:64px;font-weight:900">৳134</span></div>
      <div style="font-size:19px;color:rgba(255,255,255,.65);font-weight:600">4.6 km driven of 7.2 km</div></div>`,
  play: [{ el: 'pa', clip: 'p-stop', start: 0.2, fit: true }, { el: 'pd', clip: 'd-stop', start: 0.2, fit: true }],
  caps: [[0.4, 5.6, 'Nusrat wants to get out early. She taps “Stop here”.'], [5.8, 11.7, 'Rahim ends the trip where they are — and the fare covers only the distance driven.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pd', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); const k = P(lt, 7.5, 8.2, E.back); S($('#fare', r), { s: Math.max(0, k), op: clamp(k * 2) }); } });
scene({ id: 'pay', dur: 11, act: 2, label: R,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '11', eyebrow: 'Pay your way', hl: 'bKash, Nagad,|~card or cash.', sub: 'Pay on the secure SSLCommerz page, then you’re straight back to your receipt.', x: 150, y: 250, w: 950 })}
    <div class="abs" id="pm" style="left:150px;top:640px;display:flex;gap:14px">${[['৳', 'Cash', '#F2A81D', '#0E261F'], ['b', 'bKash', '#E2136E', '#fff'], ['N', 'Nagad', '#F6921E', '#fff'], ['▭', 'Card', '#111827', '#fff'], ['W', 'Wallet', '#0C684F', '#fff']].map(([m, n, bg, fg]) => `<div class="pmi" style="width:118px;height:118px;border-radius:26px;background:${bg};color:${fg};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 20px 40px -20px rgba(0,0,0,.7)"><div style="font-size:44px;font-weight:900;line-height:1">${m}</div><div style="font-size:16px;font-weight:800;margin-top:8px">${n}</div></div>`).join('')}</div>
    ${chip('c1', 760, 820, 'Paid ৳134 · bKash', 'check', 'light')}`,
  play: [{ el: 'pa', clip: 'p-pay', start: 0.2, fit: true }],
  caps: [[0.4, 6.2, 'Nusrat chose bKash. She’s taken to the secure checkout.'], [6.4, 11.7, 'Account number, PIN, confirm — paid. Rahim’s earnings land in his wallet.']],
  sfx: [[9.1, 'coin']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); $$('.pmi', r).forEach((el, i) => { const k = P(lt, 1.6 + i * 0.12, 2.2 + i * 0.12, E.back); S(el, { y: (1 - k) * 40, s: Math.max(0, k), op: clamp(k * 2) }); }); popChip($('#c1', r), lt, 9.1); } });
scene({ id: 'receipt', dur: 8.5, act: 2, label: R,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pb', { x: 1300, y: 115 })}
    ${tb({ id: 't', num: '12', eyebrow: 'Receipt & rating', hl: 'Every taka,|~explained.', sub: 'Base fare, distance, time, promo — then rate your driver and save them as a favourite.', x: 150, y: 270, w: 640, sm: true })}`,
  play: [{ el: 'pa', clip: 'hub-receipt', start: 0.2, rate: 1.0 }, { el: 'pb', clip: 'p-receipt', start: 0.8, rate: 0.62 }],
  caps: [[0.4, 9.2, 'A clear receipt for every trip. Five stars for Rahim — and he’s a favourite now.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pb', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); } });
const HUB = [['hub-trips', 'Trips'], ['hub-wallet', 'Wallet'], ['hub-promos', 'Promos'], ['hub-inbox', 'Inbox'], ['hub-places', 'Saved places']];
scene({ id: 'hub', dur: 10, act: 2, label: R,
  html: `<div class="center" style="top:70px"><span class="eyebrow" id="he"><span class="n">13</span>Your rider hub</span><div id="ht" style="margin-top:14px;font-size:64px;font-weight:900;letter-spacing:-2px">Everything, <span class="goldt">in one place.</span></div></div>
    ${HUB.map(([c, n], i) => phone('h' + i, { x: 130 + i * 330, y: 250, scale: 0.7 }) + `<div class="abs lbl hl${i}" style="left:${130 + i * 330 + 80}px;top:345px;width:240px;text-align:center;color:rgba(255,255,255,.8)">${n}</div>`).join('')}`,
  play: HUB.map(([c], i) => ({ el: 'h' + i, clip: c, start: 0.6 + i * 0.25, rate: c === 'hub-wallet' ? 1.75 : 0.95 })),
  caps: [[0.4, 11.7, 'Trip history, wallet top-ups, promos, inbox and saved places — all one tap away.']],
  update(lt, d, r) { S($('#he', r), { op: P(lt, 0.1, 0.6) }); const k = P(lt, 0.2, 0.9, E.out5); S($('#ht', r), { y: (1 - k) * 30, op: k });
    HUB.forEach((_, i) => { const el = $('#h' + i, r); const kk = P(lt, 0.4 + i * 0.14, 1.3 + i * 0.14, E.out5); el.style.transform = `translate(0,${(1 - kk) * 400 + Math.sin(lt * 1.2 + i) * 6}px) rotate(${(i - 2) * 2.2 * kk}deg) scale(0.7)`; el.style.opacity = clamp(kk * 2); S($('.hl' + i, r), { op: P(lt, 1.2 + i * 0.1, 1.6 + i * 0.1) }); }); } });
