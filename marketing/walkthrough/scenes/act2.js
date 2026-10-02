actCard('card2', '02', 'Ride', 'Book · ride · pay', { label: '02 · Ride' });
const R = '02 · Ride';
scene({ id: 'signup', dur: 6.5, act: 2, label: R,
  html: `${phone('pa', { x: 300, y: 115 })}${tb({ id: 't', num: '01', eyebrow: 'Get started', hl: 'Sign up|~in seconds.', sub: 'Name, phone, password — then a six-digit code by SMS. That’s it.', x: 870, y: 270, w: 880 })}
    ${chip('c1', 870, 640, 'Secure login · OTP by SMS', 'lock')}${chip('c2', 870, 720, 'Your phone number is your account', 'phone')}`,
  play: [{ el: 'pa', clip: 'auth', start: 0.3, fit: true }],
  caps: [[0.4, 7.0, 'Create an account with your phone number. A six-digit code arrives by SMS.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt, 0.3); popChip($('#c1', r), lt, 2.4); popChip($('#c2', r), lt, 3.0); } });
scene({ id: 'where', dur: 10, act: 2, label: R,
  html: `${phone('pa', { x: 1220, y: 115 })}${tb({ id: 't', num: '02', eyebrow: 'Book a ride', hl: 'Where to?|~Just type it.', bullets: ['Live address search', 'Routes drawn on real roads', 'Add stops on the way'], x: 150, y: 250, w: 900 })}
    ${chip('c1', 760, 700, 'Gulshan 2 Circle · 7.2 km · 19 min', 'pin', 'light')}`,
  play: [{ el: 'pa', clip: 'p-where', start: 0.3, fit: true }],
  caps: [[0.4, 5.3, 'Type where you’re going — suggestions appear as you type.'], [5.4, 10.6, 'The route is drawn on real roads. Need a stop on the way? Add it.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 4.2); } });
scene({ id: 'choose', dur: 8, act: 2, label: R,
  html: `${phone('pa', { x: 300, y: 115 })}${tb({ id: 't', num: '03', eyebrow: 'Choose a ride', hl: 'Every fare,|~upfront.', sub: 'Bike, CNG, car or premium — you see the price before you book.', x: 870, y: 240, w: 900 })}
    <div class="abs" id="fares" style="left:870px;top:600px;display:flex;gap:16px">${[['Bike', '136'], ['CNG', '182'], ['Car', '276'], ['Premium', '383']].map(([n, p], i) => `<div class="glass fr" style="position:relative;padding:18px 24px;border-radius:20px;${i === 1 ? 'border-color:rgba(251,191,46,.8);background:rgba(251,191,46,.14)' : ''}"><div style="font-size:18px;color:rgba(255,255,255,.65);font-weight:700">${n}</div><div style="font-size:38px;font-weight:900" class="${i === 1 ? 'goldt' : ''}">৳${p}</div></div>`).join('')}</div>`,
  play: [{ el: 'pa', clip: 'p-choose', start: 0.2, fit: true }],
  caps: [[0.4, 9.6, 'Every vehicle shows its fare before you book. No haggling, no surprises.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt); $$('.fr', r).forEach((el, i) => { const k = P(lt, 1.6 + i * 0.15, 2.2 + i * 0.15, E.back); S(el, { y: (1 - k) * 30, s: Math.max(0, k), op: clamp(k * 2) }); }); } });
scene({ id: 'extras', dur: 8.5, act: 2, label: R,
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
const FAM = { c: [23.7885, 90.4158], k: 16000, w: 374, h: 400 };
function famView() {
  const pts = road('Gulshan Avenue', FAM.c, FAM.k, FAM.w, FAM.h);
  return `<div class="app" style="background:#fff"><div class="apphdr" style="justify-content:space-between"><img src="logo.svg"><span class="chip" style="background:#FDE7F0;color:#BE185D"><span id="fdot" style="width:8px;height:8px;border-radius:50%;background:#E11D74"></span>LIVE</span></div>
    <div class="abs" style="left:0;top:92px;width:${FAM.w}px;height:${FAM.h}px;overflow:hidden">${dmap({ w: FAM.w, h: FAM.h, center: FAM.c, k: FAM.k, theme: 'light' })}
      <svg class="abs" viewBox="0 0 ${FAM.w} ${FAM.h}" style="inset:0;width:${FAM.w}px;height:${FAM.h}px"><polyline points="${polyStr(pts)}" fill="none" stroke="#0C684F" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/></svg>
      <div class="abs" id="fdst" style="left:0;top:0"></div><div class="abs" id="fcar" style="left:0;top:0">${carSVG('#16A34A', 0.9)}</div></div>
    <div class="abs" style="left:12px;right:12px;top:${92 + FAM.h - 26}px;background:#fff;border-radius:22px;box-shadow:0 -10px 30px -12px rgba(0,0,0,.25);padding:16px 16px 12px">
      <div style="font-size:12px;letter-spacing:2px;font-weight:800;color:#BE185D">NUSRAT’S TRIP · SHARED WITH YOU</div>
      <div style="font-size:21px;font-weight:900;margin-top:4px">On the way to Gulshan 2</div>
      <div class="row" style="gap:10px;margin-top:8px"><span class="chip" style="background:#EAF4EE;color:#0C684F">${icb('clock', 14)}<span id="feta">12 min</span></span><span class="chip" style="background:#F4F1EA;color:#0E261F"><span id="fkm">4.1</span>&nbsp;km left</span></div>
      <div class="row" style="gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid #EAE3D4"><div class="av" style="width:38px;height:38px;background:#0C684F;font-size:15px">R</div>
        <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:15px">Rahim Hossain · ★ 4.63</div><div style="font-size:12px;color:#5E6C65;white-space:nowrap">Green CNG · DHAKA METRO-THA 11-2345</div></div></div>
      <div class="row" style="gap:8px;margin-top:12px"><div class="btn" style="flex:1;padding:11px;font-size:14px">Call Nusrat</div><div class="btn" style="flex:1;padding:11px;font-size:14px;background:#fff;color:#DC2626;border:2px solid #DC2626">Call 999</div></div></div></div>`;
}
function famUpdate(r, lt) {
  const pts = road('Gulshan Avenue', FAM.c, FAM.k, FAM.w, FAM.h); const f = L(0.08, 0.62, P(lt, 0, 8.5, E.inOut));
  placeCar($('#fcar', r), pts, f, 18, 10); const [dx, dy] = along(pts, 0.66);
  $('#fdst', r).innerHTML = `<div style="position:absolute;left:${dx - 9}px;top:${dy - 9}px;width:18px;height:18px;border-radius:50%;background:#DC2626;border:4px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`;
  $('#feta', r).textContent = `${Math.max(2, Math.round(12 - P(lt, 0, 8.5, E.lin) * 7))} min`; $('#fkm', r).textContent = (4.1 - P(lt, 0, 8.5, E.lin) * 2.6).toFixed(1);
  $('#fdot', r).style.opacity = 0.4 + 0.6 * Math.abs(Math.sin(lt * 4));
}
scene({ id: 'share', dur: 11, act: 2, label: R,
  html: () => `${phone('pa', { x: 820, y: 115 })}${phone('pf', { x: 1300, y: 115, clip: false, inner: famView() })}
    <div class="abs lbl" style="left:890px;top:72px;color:rgba(255,255,255,.7)">Nusrat · in the CNG</div><div class="abs lbl" style="left:1380px;top:72px;color:rgba(249,168,212,.9)">Ammu · at home</div>
    ${tb({ id: 't', num: '08', eyebrow: 'Share your trip', hl: 'Family follows|~every turn.', sub: 'One tap copies a private link. Anyone you trust watches the car live — no app needed.', x: 150, y: 270, w: 640, sm: true })}
    ${chip('c1', 150, 690, 'Private link · expires after the trip', 'link')}`,
  play: [{ el: 'pa', clip: 'p-share', start: 0.2, rate: 1 }],
  caps: [[0.4, 4.6, 'Nusrat taps “Share trip”. The link is copied.'], [4.7, 11.7, 'Ammu opens it at home: the CNG, the driver, the plate and the ETA — all live.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pf', r), lt, { from: 'right', a: 2.2, ry: -10 }); animTB($('#t', r), lt); popChip($('#c1', r), lt, 3.0); famUpdate(r, lt - 2.6); } });
const SOSR = [['Ammu · SOS contact', 'Automated call · ringing', 'call'], ['Police · 999', 'Automated call · location sent', 'call'], ['Abbu', 'Live map link by SMS', 'ok'], ['চলো Safety Team', 'Calling you now…', 'call'], ['Live location', 'Updating every second', 'ok'], ['Audio recording', 'Started automatically', 'rec']];
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
    ${tb({ id: 't', num: '09', eyebrow: 'SOS · one tap', hl: 'In danger?|!One tap.|!Help is here.', sub: 'One tap auto-calls your saved SOS contact and police 999. A recorded voice reads out exactly where you are.', x: 780, y: 200, w: 1000, tint: 'red', sm: true })}
    <div class="card" id="sms" style="left:1330px;top:60px;width:520px;padding:18px 22px;border-radius:22px;border-left:8px solid #DC2626;opacity:0">
      <div class="row" style="gap:10px;font-size:13px;font-weight:900;letter-spacing:2px;color:#DC2626"><span style="width:10px;height:10px;border-radius:50%;background:#DC2626"></span><span class="bnd" style="letter-spacing:0">চলো</span> SOS ALERT · NOW</div>
      <div style="font-weight:900;font-size:21px;margin-top:6px">Nusrat needs help right now!</div><div style="font-size:15px;color:#5E6C65;margin-top:3px">Live location: Gulshan Avenue · CNG Tha 11-2345</div></div>
    <div class="abs" id="sosb" style="left:780px;top:740px;display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;width:1000px">${['Automated call to your SOS contact', 'Automated call to police 999', 'Your live location read out loud', 'Family gets a live map link by SMS'].map((b) => `<div class="sb row" style="gap:12px;font-size:22px;font-weight:600"><span class="ck" style="background:rgba(220,38,38,.18);border-color:rgba(248,113,113,.7)">${icb('check', 18, '#FCA5A5', 3)}</span>${b}</div>`).join('')}</div>`,
  play: [{ el: 'pa', clip: 'p-sos', start: 0.3, rate: 1 }],
  caps: [[0.4, 6.6, 'Feel unsafe? The red SOS button is always on the trip screen.'], [6.8, 15.2, 'One tap: Cholo auto-calls your SOS contact and 999, and sends your live location to family.']],
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
const SOSVO = 'This is an automated emergency call from Cholo. Nusrat Jahan has pressed SOS. Her live location: Gulshan Avenue, near Gulshan 2 Circle, Dhaka. She is in a green CNG, DHAKA METRO-THA 11-2345, driver Rahim Hossain. Press 1 to repeat. Press 2 to call Nusrat.';
const NINE = [['user', 'Caller', 'Nusrat Jahan · 01710-000001'], ['pin', 'Live location', 'Gulshan Ave, near Gulshan 2 Circle'], ['id', 'Vehicle', 'Green CNG · DHAKA METRO-THA 11-2345'], ['user', 'Driver', 'Rahim Hossain · verified'], ['shield', 'Nearest patrol', 'Gulshan PS · 4 min away'], ['check', 'Status', 'Patrol dispatched']];
scene({ id: 'sos-call', dur: 14.5, act: 2, label: R, mood: { red: 1 },
  html: () => `${phone('pc', { x: 130, y: 115, clip: false, dark: true, inner: `<div class="abs" style="inset:0;top:38px;background:linear-gradient(180deg,#450A0A,#7F1D1D 55%,#B91C1C);color:#fff;padding:30px 22px 0;text-align:center">
      <div id="cst" style="font-size:13px;letter-spacing:2.5px;font-weight:800;color:#FECACA">INCOMING AUTOMATED CALL</div>
      <div id="cav" class="av" style="width:92px;height:92px;margin:20px auto 0;background:#DC2626;font-size:30px"><span class="bnd">চলো</span></div>
      <div style="font-size:28px;font-weight:900;margin-top:12px">চলো SOS</div><div style="font-size:16px;opacity:.85;margin-top:2px">for Nusrat Jahan · to Ammu</div>
      <div id="ctm" style="font-size:18px;font-weight:800;margin-top:8px;font-variant-numeric:tabular-nums;opacity:0">00:00</div>
      <div class="row" id="cwv" style="gap:4px;justify-content:center;height:46px;margin-top:6px;opacity:0">${[...Array(22)].map(() => '<span class="wv" style="width:5px;border-radius:3px;background:#FECACA;height:6px"></span>').join('')}</div>
      <div id="ctx" style="text-align:left;font-size:15px;line-height:1.45;font-weight:600;background:rgba(0,0,0,.28);border-radius:16px;padding:12px 14px;margin-top:8px;height:250px;opacity:0"></div>
      <div class="row" id="cbt" style="justify-content:space-around;position:absolute;left:0;right:0;bottom:48px"><div style="text-align:center"><div style="width:68px;height:68px;border-radius:50%;background:#EF4444;display:flex;align-items:center;justify-content:center">${icb('x', 30, '#fff', 3)}</div><div style="font-size:13px;margin-top:6px">Decline</div></div>
        <div style="text-align:center"><div id="cac" style="width:68px;height:68px;border-radius:50%;background:#22C55E;display:flex;align-items:center;justify-content:center">${icb('phone', 30, '#fff', 2.6)}</div><div style="font-size:13px;margin-top:6px">Accept</div></div></div></div>` })}
    <div class="abs lbl" style="left:200px;top:72px;color:#FCA5A5">Ammu’s phone</div>
    ${tb({ id: 't', num: '09', eyebrow: 'SOS auto-call', hl: 'Two calls.|!One tap.', x: 640, y: 70, w: 560, tint: 'red', sm: true })}
    ${[['Ammu · SOS contact', 'Connected · location read out'], ['Police · 999', 'Connected · location sent']].map(([n, st], i) => `<div class="glass cp row" style="left:1160px;top:${84 + i * 104}px;width:680px;height:88px;padding:0 22px;gap:16px;border-radius:24px;border-color:rgba(248,113,113,.4);opacity:0">
      <div class="cpi" style="width:52px;height:52px;border-radius:50%;background:#DC2626;display:flex;align-items:center;justify-content:center">${icb('phone', 24, '#fff', 2.4)}</div>
      <div style="flex:1"><div style="font-size:24px;font-weight:800">${n}</div><div class="cps" data-on="${st}" style="font-size:18px;font-weight:700;color:#FCA5A5">Calling automatically…</div></div><div class="cpt" style="font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.7)"></div></div>`).join('')}
    <div class="glass" id="nine" style="left:640px;top:330px;width:1200px;height:610px;border-color:rgba(248,113,113,.45);overflow:hidden;opacity:0">
      <div class="row" style="justify-content:space-between;padding:20px 28px;border-bottom:1px solid rgba(255,255,255,.12)"><div class="row" style="gap:14px"><div style="width:56px;height:52px;border-radius:14px;background:#DC2626;display:flex;align-items:center;justify-content:center;font:900 22px Inter">999</div>
        <div><div style="font-size:24px;font-weight:900">National Emergency Service · Dhaka</div><div style="font-size:16px;color:#FCA5A5;font-weight:700">Incoming automated call from চলো SOS</div></div></div><div id="nlive" class="tag" style="background:#DC2626;color:#fff;font-size:16px">● LIVE CALL</div></div>
      <div class="abs" style="left:28px;top:118px;width:560px;height:464px;border-radius:20px;overflow:hidden">${dmap({ w: 560, h: 464, center: [23.7905, 90.4148], k: 26000, theme: 'light', labels: 13 })}
        <div id="npr" class="abs" style="left:250px;top:202px;width:60px;height:60px;border-radius:50%;background:rgba(220,38,38,.35)"></div><div class="abs" style="left:268px;top:220px;width:24px;height:24px;border-radius:50%;background:#DC2626;border:5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.4)"></div>
        <div class="abs" style="left:14px;bottom:14px;background:#fff;color:#0E261F;border-radius:12px;padding:8px 12px;font-size:15px;font-weight:800">23.7905° N, 90.4148° E · ±6 m</div></div>
      <div class="abs" style="left:620px;top:112px;width:550px">${NINE.map(([i, k, v], j) => `<div class="nr row" style="gap:14px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.1)"><div style="width:40px;height:40px;border-radius:12px;background:${j === 5 ? '#16A34A' : 'rgba(248,113,113,.18)'};display:flex;align-items:center;justify-content:center">${icb(i, 20, j === 5 ? '#fff' : '#FCA5A5', 2.4)}</div><div><div style="font-size:13px;letter-spacing:2px;font-weight:800;color:rgba(255,255,255,.55);text-transform:uppercase">${k}</div><div style="font-size:21px;font-weight:700">${v}</div></div></div>`).join('')}</div></div>`,
  caps: [[0.4, 4.6, 'Tap SOS and Cholo instantly places an automated call to your saved SOS contact.'], [4.7, 9.4, 'A voice reads out where you are — the street, the landmark, the car and its plate.'], [9.5, 14.3, 'At the same moment, 999 gets an automated call with your exact live location.']],
  sfx: [[0.3, 'ring'], [1.6, 'ring'], [2.7, 'ding'], [5.0, 'alert2']],
  update(lt, d, r) {
    devIn($('#pc', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt, 0.3);
    const on = lt > 2.7; const pulse = (lt * 1.4) % 1;
    $('#cav', r).style.boxShadow = on ? 'none' : `0 0 0 ${pulse * 34}px rgba(248,113,113,${0.6 * (1 - pulse)})`;
    $('#cst', r).textContent = on ? 'AUTOMATED CALL · CONNECTED' : 'INCOMING AUTOMATED CALL';
    S($('#cac', r), { s: on ? 1 : 1 + 0.12 * Math.abs(Math.sin(lt * 7)) }); S($('#cbt', r), { op: 1 - P(lt, 2.8, 3.2) });
    S($('#ctm', r), { op: P(lt, 2.8, 3.2) }); $('#ctm', r).textContent = `00:${String(Math.floor(clamp(lt - 2.8, 0, 59))).padStart(2, '0')}`;
    S($('#cwv', r), { op: P(lt, 2.9, 3.3) }); $$('.wv', r).forEach((w, i) => { w.style.height = `${on ? 8 + Math.abs(Math.sin(lt * 9 + i * 1.7) * Math.sin(lt * 3.1 + i)) * 38 : 6}px`; });
    S($('#ctx', r), { op: P(lt, 3.0, 3.4) }); typeText($('#ctx', r), SOSVO, lt, 3.1, 40);
    $$('.cp', r).forEach((el, i) => { const a = 0.8 + i * 0.5, on2 = lt > (i ? 5.0 : 2.7); const k = P(lt, a, a + 0.6, E.out5); S(el, { x: (1 - k) * 60, op: k });
      $('.cps', el).textContent = on2 ? $('.cps', el).dataset.on : 'Calling automatically…'; $('.cps', el).style.color = on2 ? '#86EFAC' : '#FCA5A5';
      $('.cpi', el).style.background = on2 ? '#16A34A' : '#DC2626'; const pu = (lt * 1.5 + i * 0.3) % 1; $('.cpi', el).style.boxShadow = on2 ? 'none' : `0 0 0 ${pu * 16}px rgba(248,113,113,${0.6 * (1 - pu)})`;
      $('.cpt', el).textContent = on2 ? `00:${String(Math.floor(clamp(lt - (i ? 5.0 : 2.7), 0, 59))).padStart(2, '0')}` : ''; });
    const kn = P(lt, 5.0, 5.8, E.out5); S($('#nine', r), { y: (1 - kn) * 80, op: clamp(kn * 1.6) }); $('#nlive', r).style.opacity = 0.5 + 0.5 * Math.abs(Math.sin(lt * 4));
    $$('.nr', r).forEach((el, i) => { const k = P(lt, 5.8 + i * 0.6, 6.3 + i * 0.6); S(el, { x: (1 - k) * 40, op: k }); });
    const c = (lt * 1.2) % 1; S($('#npr', r), { s: 0.5 + c * 1.6, op: 1 - c });
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
scene({ id: 'receipt', dur: 7.5, act: 2, label: R,
  html: `${phone('pa', { x: 820, y: 115 })}${phone('pb', { x: 1300, y: 115 })}
    ${tb({ id: 't', num: '12', eyebrow: 'Receipt & rating', hl: 'Every taka,|~explained.', sub: 'Base fare, distance, time, promo — then rate your driver and save them as a favourite.', x: 150, y: 270, w: 640, sm: true })}`,
  play: [{ el: 'pa', clip: 'hub-receipt', start: 0.2, rate: 1.0 }, { el: 'pb', clip: 'p-receipt', start: 0.8, rate: 0.72 }],
  caps: [[0.4, 8.2, 'A clear receipt for every trip. Five stars for Rahim — and he’s a favourite now.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'bottom', ry: -6 }); devIn($('#pb', r), lt, { from: 'bottom', a: 0.15, ry: -6 }); animTB($('#t', r), lt); } });
const HUB = [['hub-trips', 'Trips'], ['hub-wallet', 'Wallet'], ['hub-promos', 'Promos'], ['hub-inbox', 'Inbox'], ['hub-places', 'Saved places']];
scene({ id: 'hub', dur: 8, act: 2, label: R,
  html: `<div class="center" style="top:70px"><span class="eyebrow" id="he"><span class="n">13</span>Your rider hub</span><div id="ht" style="margin-top:14px;font-size:64px;font-weight:900;letter-spacing:-2px">Everything, <span class="goldt">in one place.</span></div></div>
    ${HUB.map(([c, n], i) => phone('h' + i, { x: 130 + i * 330, y: 250, scale: 0.7 }) + `<div class="abs lbl hl${i}" style="left:${130 + i * 330 + 80}px;top:345px;width:240px;text-align:center;color:rgba(255,255,255,.8)">${n}</div>`).join('')}`,
  play: HUB.map(([c], i) => ({ el: 'h' + i, clip: c, start: 0.6 + i * 0.25, rate: c === 'hub-wallet' ? 2.3 : 1.25 })),
  caps: [[0.4, 8.7, 'Trip history, wallet top-ups, promos, inbox and saved places — all one tap away.']],
  update(lt, d, r) { S($('#he', r), { op: P(lt, 0.1, 0.6) }); const k = P(lt, 0.2, 0.9, E.out5); S($('#ht', r), { y: (1 - k) * 30, op: k });
    HUB.forEach((_, i) => { const el = $('#h' + i, r); const kk = P(lt, 0.4 + i * 0.14, 1.3 + i * 0.14, E.out5); el.style.transform = `translate(0,${(1 - kk) * 400 + Math.sin(lt * 1.2 + i) * 6}px) rotate(${(i - 2) * 2.2 * kk}deg) scale(0.7)`; el.style.opacity = clamp(kk * 2); S($('.hl' + i, r), { op: P(lt, 1.2 + i * 0.1, 1.6 + i * 0.1) }); }); } });
