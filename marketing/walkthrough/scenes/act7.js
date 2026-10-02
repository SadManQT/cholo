actCard('card7', '07', 'Start up with চলো', 'For founders & investors', { label: '07 · For founders' });
const F7 = '07 · For founders';
const inr = (v) => Math.round(v).toLocaleString('en-IN');

const COST = [['Hosting · Vercel', 'globe', 2400], ['Database · Supabase', 'db', 2900], ['Maps · OpenStreetMap + OSRM', 'map', 0], ['SMS codes · pay per use', 'chat', 1000], ['Payments · SSLCommerz, per sale', 'wallet', 0]];
const TYP = [['Paid map & routing APIs', 600000], ['Dedicated servers', 150000], ['DevOps on call', 80000]];
scene({ id: 'biz-cost', dur: 11.5, act: 7, label: F7,
  html: `${tb({ id: 't', num: '01', eyebrow: 'Running cost', hl: 'Run a ride app|~for the price|~of a tea stall.', x: 150, y: 140, w: 820, sm: true })}
    <div class="glass" id="bc" style="left:960px;top:120px;width:820px;padding:26px 34px">
      <div class="lbl">চলো · monthly running cost</div>
      ${COST.map(([n, i, v]) => `<div class="cr row" style="gap:16px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.1)"><div style="width:44px;height:44px;border-radius:14px;background:rgba(251,191,46,.15);display:flex;align-items:center;justify-content:center">${icb(i, 22, '#FBBF2E', 2.2)}</div>
        <div style="flex:1;font-size:23px;font-weight:600">${n}</div><div style="font-size:26px;font-weight:900;font-variant-numeric:tabular-nums" class="${v ? '' : 'goldt'}">${v ? '৳' + inr(v) : '৳0'}</div></div>`).join('')}
      <div class="row" style="justify-content:space-between;margin-top:16px"><span style="font-size:24px;font-weight:800">Total</span><span id="btot" class="goldt" style="font-size:54px;font-weight:900;font-variant-numeric:tabular-nums">৳0</span></div></div>
    <div class="abs" id="bvs" style="left:150px;top:600px;width:760px">
      <div class="lbl" style="margin-bottom:12px">Typical ride-app stack · per month</div>
      ${TYP.map(([n, v]) => `<div class="tr row" style="justify-content:space-between;font-size:22px;font-weight:600;color:rgba(255,255,255,.7);padding:7px 0"><span>${n}</span><span style="font-weight:800">৳${inr(v)}</span></div>`).join('')}
      <div style="margin-top:18px"><div class="row" style="gap:14px"><span style="width:110px;font-size:18px;font-weight:800">Others</span><div style="flex:1;height:26px;border-radius:13px;background:rgba(255,255,255,.08)"><div id="bar1" style="height:100%;width:0;border-radius:13px;background:linear-gradient(90deg,#F87171,#DC2626)"></div></div></div>
        <div class="row" style="gap:14px;margin-top:12px"><span style="width:110px;font-size:18px;font-weight:800" class="goldt">চলো</span><div style="flex:1;height:26px;border-radius:13px;background:rgba(255,255,255,.08)"><div id="bar2" style="height:100%;width:0;border-radius:13px;background:linear-gradient(90deg,#FFE58A,#FBBF2E)"></div></div></div></div></div>
    ${chip('c1', 960, 760, '99% cheaper to run · no map bills · no servers to babysit', 'zap')}`,
  caps: [[0.4, 5.6, 'Cholo runs on a lean, serverless stack — open maps, no licence fees, and you pay as you grow.'], [5.7, 11.9, 'Launch for about ৳6,300 a month instead of lakhs. No map bills, no servers to babysit.']],
  sfx: [[4.6, 'coin']],
  update(lt, d, r) {
    animTB($('#t', r), lt); panelIn($('#bc', r), lt, 0.3);
    $$('.cr', r).forEach((el, i) => { const k = P(lt, 0.9 + i * 0.35, 1.4 + i * 0.35); S(el, { x: (1 - k) * 30, op: k }); });
    $('#btot', r).textContent = `৳${inr(6300 * P(lt, 2.8, 4.6, E.out))}`;
    $$('.tr', r).forEach((el, i) => { const k = P(lt, 5.0 + i * 0.3, 5.5 + i * 0.3); S(el, { op: k }); });
    $('#bar1', r).style.width = `${100 * P(lt, 6.2, 7.6, E.out)}%`; $('#bar2', r).style.width = `${0.9 * P(lt, 7.4, 8.0, E.out) + 1.2}%`;
    S($('#bvs', r), { op: P(lt, 4.8, 5.3) }); popChip($('#c1', r), lt, 8.2);
  } });

const WHY7 = [['check', 'Launch-ready today', 'Rider, driver and admin apps — done'], ['zap', 'Near-zero running cost', 'Serverless, pay as you grow'], ['map', 'No map licence fees', 'Open maps and open routing'], ['wallet', 'Local payments built in', 'bKash, Nagad, cards, cash'], ['globe', 'Any city in a day', 'Zones, rate cards, approvals'], ['shield', 'Safety that sells', 'SOS auto-call · women-only'], ['cpu', 'AI as the moat', 'Voice, dispatch, forecasting'], ['users', 'Bangla-first for 170M', 'CNG, bike, car — all built in']];
scene({ id: 'biz-why', dur: 11, act: 7, label: F7,
  html: `<div class="center" id="yt" style="top:80px"><span class="eyebrow"><span class="n">02</span>Why build on চলো</span><div style="margin-top:14px;font-size:76px;font-weight:900;letter-spacing:-3px">A whole startup, <span class="goldt">already built.</span></div></div>
    <div class="abs" style="left:150px;top:330px;width:1620px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px">${WHY7.map(([i, h, s2]) => `<div class="glass wy" style="position:relative;padding:24px 24px;height:230px;border-radius:26px;display:flex;flex-direction:column;justify-content:space-between">
      <div style="width:56px;height:56px;border-radius:18px;background:rgba(251,191,46,.16);display:flex;align-items:center;justify-content:center">${icb(i, 30, '#FBBF2E', 2)}</div>
      <div><div style="font-size:27px;font-weight:800;line-height:1.15">${h}</div><div style="font-size:19px;color:rgba(255,255,255,.62);font-weight:500;margin-top:6px">${s2}</div></div></div>`).join('')}</div>`,
  caps: [[0.4, 5.6, 'Why start up with Cholo? Rider, driver and admin apps, payments, safety and AI are all built.'], [5.7, 11.3, 'Open a new city in a day: draw the zones, set the rate card, approve drivers — and go live.']],
  sfx: WHY7.map((_, i) => [0.9 + i * 0.22, 'tick', 0.5]),
  update(lt, d, r) { const b = P(lt, 0.1, 0.8, E.out5); S($('#yt', r), { y: (1 - b) * 40, op: b });
    $$('.wy', r).forEach((el, i) => { const dl = 0.8 + i * 0.22; const k = P(lt, dl, dl + 0.6, E.back); S(el, { s: L(0.6, 1, Math.max(0, k)), op: clamp(k * 2), y: (1 - k) * 40 + Math.sin(lt * 1.3 + i) * 3 }); }); } });

// three states: 2 = yes, 1 = partly, 0 = no
const UBER = [['Driver commission', '15%', '~25%'], ['Women drivers take women riders only', 2, 0], ['SOS auto-calls your contact and 999, with your location', 2, 1], ['Bangla voice booking', 2, 0], ['Metro + ride trip planner', 2, 0], ['Flood-aware routing for the monsoon', 2, 0], ['Book from a basic phone · *CHOLO#', 2, 0], ['Built and owned in Bangladesh', 2, 0]];
const mark = (v) => typeof v === 'string' ? `<span style="font-size:30px;font-weight:900">${v}</span>`
  : v === 2 ? `<div class="mk" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(180deg,#FFE58A,#E88A12);display:flex;align-items:center;justify-content:center">${icb('check', 28, '#0A3D30', 3.4)}</div>`
  : v === 1 ? `<div class="mk" style="width:48px;height:48px;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:linear-gradient(90deg,rgba(255,255,255,.35) 50%,transparent 50%)"></div>`
  : `<div class="mk" style="width:48px;height:48px;border-radius:50%;border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center">${icb('x', 22, 'rgba(255,255,255,.45)', 2.6)}</div>`;
scene({ id: 'biz-uber', dur: 12, act: 7, label: F7, mood: { blue: 0.6 },
  html: `<div class="center" id="ut" style="top:50px"><span class="eyebrow"><span class="n">03</span>চলো vs Uber</span><div style="margin-top:12px;font-size:72px;font-weight:900;letter-spacing:-3px">Built for Dhaka. <span class="goldt">Not adapted to it.</span></div></div>
    <div class="glass" id="ub" style="left:260px;top:250px;width:1400px;padding:14px 46px">
      <div class="row" style="height:62px;font-size:18px;letter-spacing:3px;font-weight:700;color:rgba(255,255,255,.55)"><div style="flex:1"></div><div style="width:210px;text-align:center"><img src="logo-light.svg" style="height:46px;vertical-align:middle"></div><div style="width:210px;text-align:center;font-size:24px;letter-spacing:1px;color:rgba(255,255,255,.75)">Uber</div></div>
      ${UBER.map(([f, a, b], i) => `<div class="ur row" style="height:72px;border-top:1px solid rgba(255,255,255,.12);font-size:26px;font-weight:600"><div style="flex:1">${f}</div>
        <div style="width:210px;display:flex;justify-content:center" class="${i === 0 ? 'goldt' : ''}">${mark(a)}</div><div style="width:210px;display:flex;justify-content:center;color:rgba(255,255,255,.6)">${mark(b)}</div></div>`).join('')}</div>
    <div class="center" id="un" style="top:935px;font-size:15px;color:rgba(255,255,255,.45);font-weight:600">Based on public information about Uber in Bangladesh; features and rates vary by market.</div>`,
  caps: [[0.4, 5.9, 'Cholo versus Uber: drivers keep more — 15% commission instead of around 25%.'], [6.0, 12.3, 'Women-only matching, SOS auto-calls, Metro and flood routing — and profits stay in Bangladesh.']],
  sfx: UBER.map((_, i) => [1.2 + i * 0.4, 'tick', 0.6]),
  update(lt, d, r) { const b = P(lt, 0.1, 0.8, E.out5); S($('#ut', r), { y: (1 - b) * 40, op: b }); const kt = P(lt, 0.4, 1.1, E.out5); S($('#ub', r), { y: (1 - kt) * 60, op: kt }); S($('#un', r), { op: P(lt, 4, 5) });
    $$('.ur', r).forEach((el, i) => { const k = P(lt, 1.0 + i * 0.4, 1.5 + i * 0.4); S(el, { x: (1 - k) * -30, op: k }); $$('.mk', el).forEach((m, j) => S(m, { s: Math.max(0, P(lt, 1.2 + i * 0.4 + j * 0.1, 1.7 + i * 0.4 + j * 0.1, E.back)) })); }); } });

const STREAM = [['receipt', '15% on every trip'], ['pkg', 'Cholo Send deliveries'], ['brief', 'Business accounts'], ['tag', 'Partner promos'], ['trend', 'Surge share'], ['db', 'City insights']];
const MATH = [['Drivers', 1000], ['Trips / driver / day', 12], ['Average fare', 180], ['Commission', 0.15]];
scene({ id: 'biz-model', dur: 12.5, act: 7, label: F7,
  html: `${tb({ id: 't', num: '04', eyebrow: 'Business model', hl: 'Revenue|~from day one.', x: 150, y: 140, w: 760, sm: true })}
    <div class="abs" style="left:150px;top:420px;width:740px;display:grid;grid-template-columns:1fr 1fr;gap:14px">${STREAM.map(([i, n]) => `<div class="glass rs row" style="position:relative;gap:14px;padding:16px 18px;border-radius:20px;font-size:22px;font-weight:700">${icb(i, 26, '#FBBF2E', 2.2)}${n}</div>`).join('')}</div>
    <div class="glass" id="um" style="left:960px;top:130px;width:820px;padding:28px 36px">
      <div class="lbl">Just one city · a modest start</div>
      ${MATH.map(([n, v], i) => `<div class="mr row" style="justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.1);font-size:25px;font-weight:600"><span>${i ? '× ' : ''}${n}</span><span style="font-weight:900">${n === 'Average fare' ? '৳' + v : n === 'Commission' ? '15%' : inr(v)}</span></div>`).join('')}
      <div class="row" style="justify-content:space-between;margin-top:18px"><span style="font-size:22px;font-weight:700;color:rgba(255,255,255,.7)">Per day</span><span id="mday" style="font-size:40px;font-weight:900;font-variant-numeric:tabular-nums">৳0</span></div>
      <div class="row" style="justify-content:space-between;margin-top:6px"><span style="font-size:22px;font-weight:700;color:rgba(255,255,255,.7)">Per month</span><span id="mmon" class="goldt" style="font-size:66px;font-weight:900;font-variant-numeric:tabular-nums">৳0</span></div></div>
    ${chip('c1', 960, 800, 'On a ৳6,300-a-month stack', 'zap')}`,
  caps: [[0.4, 5.9, 'Revenue from day one: 15% on every trip, plus deliveries, business accounts and partner promos.'], [6.0, 12.8, 'Just 1,000 drivers doing 12 trips a day brings in about ৳97 lakh a month, on a ৳6,300 stack.']],
  sfx: [[7.6, 'coin'], [8.6, 'coin']],
  update(lt, d, r) { animTB($('#t', r), lt); panelIn($('#um', r), lt, 0.5);
    $$('.rs', r).forEach((el, i) => { const k = P(lt, 1.2 + i * 0.25, 1.8 + i * 0.25, E.back); S(el, { s: L(0.7, 1, Math.max(0, k)), op: clamp(k * 2) }); });
    $$('.mr', r).forEach((el, i) => { const k = P(lt, 3.0 + i * 0.6, 3.5 + i * 0.6); S(el, { x: (1 - k) * 30, op: k }); });
    $('#mday', r).textContent = `৳${inr(324000 * P(lt, 5.6, 7.6, E.out))}`;
    const km = P(lt, 7.6, 9.4, E.out); $('#mmon', r).textContent = km < 1 ? `৳${inr(9720000 * km)}` : '৳97 lakh';
    popChip($('#c1', r), lt, 9.6); } });

scene({ id: 'biz-pitch', dur: 8.5, act: 7, label: F7,
  html: `<div class="center" id="pt" style="top:170px;font-size:92px;font-weight:900;letter-spacing:-3px;line-height:1.05">The ride-hailing startup<br><span class="goldt">Bangladesh is waiting for.</span></div>
    <div class="abs row" style="left:0;right:0;top:520px;justify-content:center;gap:28px">${[['170M', 'people to move'], ['64', 'districts, one platform'], ['15%', 'fair commission'], ['1 day', 'to open a new city']].map(([v, l]) => `<div class="glass pn" style="position:relative;width:360px;padding:30px 28px;border-radius:28px;text-align:center"><div class="goldt" style="font-size:76px;font-weight:900;letter-spacing:-2px;line-height:1">${v}</div><div style="font-size:22px;font-weight:600;color:rgba(255,255,255,.7);margin-top:10px">${l}</div></div>`).join('')}</div>`,
  caps: [[0.4, 8.2, 'Ready to launch, cheap to run, built for Bangladesh. Cholo is the startup Dhaka is waiting for.']],
  sfx: [[0.2, 'whoosh'], [1.2, 'hit'], [1.5, 'hit'], [1.8, 'hit'], [2.1, 'hit']],
  update(lt, d, r) { const b = P(lt, 0.1, 0.9, E.out5); S($('#pt', r), { y: (1 - b) * 50, op: b, s: L(1.08, 1, b) });
    $$('.pn', r).forEach((el, i) => { const k = P(lt, 1.1 + i * 0.3, 1.7 + i * 0.3, E.back); S(el, { s: L(0.6, 1, Math.max(0, k)), op: clamp(k * 2), y: (1 - k) * 50 }); }); } });

// the outro stays last
SCENES.push(SCENES.splice(SCENES.findIndex((s) => s.id === 'outro'), 1)[0]);
