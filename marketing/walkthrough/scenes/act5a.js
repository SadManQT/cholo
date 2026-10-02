const X5 = '05 · চলো Intelligence';
const MD = { dark: 1, cyan: 1 };
function panel(id, x, y, w, h, inner = '', cls = 'glassc', st = '') { return `<div class="${cls}" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;${st}">${inner}</div>`; }
function panelIn(el, lt, a = 0, from = 40) { const k = P(lt, a, a + 0.8, E.out5); S(el, { y: (1 - k) * from, s: L(0.96, 1, k), op: clamp(k * 1.6) }); }
function typeText(el, text, lt, a, cps = 22) { const n = Math.floor(clamp((lt - a) * cps, 0, text.length)); el.textContent = text.slice(0, n); return n >= text.length; }
const BN_PLACES = { 'Uttara': 'উত্তরা', 'Airport': 'বিমানবন্দর', 'Banani': 'বনানী', 'Gulshan 1': 'গুলশান ১', 'Gulshan 2': 'গুলশান ২', 'Baridhara': 'বারিধারা', 'Bashundhara': 'বসুন্ধরা', 'Badda': 'বাড্ডা', 'Rampura': 'রামপুরা', 'Mohakhali': 'মহাখালী', 'Tejgaon': 'তেজগাঁও', 'Farmgate': 'ফার্মগেট', 'Karwan Bazar': 'কারওয়ান বাজার', 'Dhanmondi': 'ধানমন্ডি', 'Mohammadpur': 'মোহাম্মদপুর', 'Shyamoli': 'শ্যামলী', 'Mirpur 10': 'মিরপুর ১০', 'Mirpur 1': 'মিরপুর ১', 'Agargaon': 'আগারগাঁও', 'Shahbagh': 'শাহবাগ', 'Motijheel': 'মতিঝিল', 'Kamalapur': 'কমলাপুর', 'Old Dhaka': 'পুরান ঢাকা', 'Pallabi': 'পল্লবী' };
function cnv(id, w, h, st = '') { return `<canvas id="${id}" width="${w}" height="${h}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;${st}"></canvas>`; }
function allPaths(c, k, w, h) { const p = proj(c, k, w, h); const D = window.DHAKA; return [...Object.values(D.arterials), ...D.minor].map((l) => l.map(([lng, lat]) => p(lat, lng))).filter((pts) => plen(pts) > 60); }

scene({ id: 'x-reveal', dur: 6, act: 5, chapter: 'চলো Intelligence', label: '', noWm: true, sweep: true, mood: { dark: 1, cyan: 0.6 },
  html: `<div class="center" id="r1" style="top:420px;font-size:64px;font-weight:800;letter-spacing:-1px;color:rgba(255,255,255,.92)">And this is just the beginning.</div>
    <div class="center" id="r2" style="top:350px"><div class="lbl" style="font-size:20px;letter-spacing:10px;color:#67E8F9">05 · The next generation</div>
    <div style="margin-top:18px;font-size:150px;font-weight:900;letter-spacing:-5px;line-height:1"><span class="bnd goldt" style="letter-spacing:0">চলো</span> <span class="cyant">Intelligence</span></div>
    <div style="margin-top:26px;font-size:28px;font-weight:600;letter-spacing:8px;color:rgba(255,255,255,.7)">AI · MAPS · SAFETY · BANGLADESH-FIRST</div></div>`,
  caps: [[2.6, 5.8, 'Everything you’ve seen is live. Now meet the intelligence behind চলো.']],
  sfx: [[0, 'riser2'], [2.4, 'impact'], [2.5, 'bells']],
  update(lt, d, r) { const a = P(lt, 0.1, 0.8) * (1 - P(lt, 1.9, 2.4)); S($('#r1', r), { op: a, s: L(0.96, 1.04, P(lt, 0, 2.4, E.lin)) }); const b = P(lt, 2.4, 3.4, E.out5); S($('#r2', r), { op: b, s: L(1.2, 1, b) }); $('#r2', r).style.filter = `blur(${(1 - b) * 16}px)`; } });

const TW = { c: [23.785, 90.392], k: 9200, w: 1180, h: 780 };
const SCEN = [['Office rush', 1.0, [23.79, 90.41]], ['Friday prayers', 0.55, [23.73, 90.4]], ['Monsoon evening', 0.8, [23.76, 90.38]], ['Eid exodus', 1.2, [23.73, 90.425]], ['Cricket at Mirpur', 0.9, [23.807, 90.368]]];
scene({ id: 'x-twin', dur: 11, act: 5, label: X5, mood: MD,
  html: () => panel('pm', 60, 140, TW.w, TW.h, dmap({ w: TW.w, h: TW.h, center: TW.c, k: TW.k, theme: 'neon', bld: false }) + cnv('cv', TW.w, TW.h) +
      `<div class="abs" style="left:24px;top:20px" ><span class="tag" style="background:rgba(34,211,238,.18);color:#67E8F9">LIVE SIMULATION</span> <span class="tag" style="background:rgba(255,255,255,.1);color:#fff">DHAKA DIGITAL TWIN</span></div>`) +
    `<div class="abs" style="left:1280px;top:140px;width:580px">${tb({ id: 't', num: '01', eyebrow: 'Digital twin', hl: 'A virtual Dhaka|#that never sleeps.', x: 0, y: 0, w: 600, tint: 'cyan', sm: true })}</div>
    <div class="abs" id="scl" style="left:1280px;top:420px;width:580px">${SCEN.map(([n]) => `<div class="sc row" style="gap:12px;padding:10px 16px;margin-bottom:8px;border-radius:14px;border:1.5px solid rgba(103,232,249,.18);font-size:21px;font-weight:700"><span style="width:10px;height:10px;border-radius:50%;background:#67E8F9"></span>${n}</div>`).join('')}</div>
    <div class="glassc" id="ab" style="left:1280px;top:735px;width:580px;height:185px;padding:20px 24px">
      <div class="lbl" style="color:#67E8F9">Dispatch v1 vs v2 · same seed</div>
      <div class="row" style="gap:14px;margin-top:12px;font-size:18px;font-weight:700"><span style="width:44px">v1</span><div style="flex:1;height:14px;border-radius:7px;background:rgba(255,255,255,.1)"><div id="b1v" style="height:100%;width:0;border-radius:7px;background:#94A3B8"></div></div><span id="v1t" style="width:90px;text-align:right">6.8 min</span></div>
      <div class="row" style="gap:14px;margin-top:10px;font-size:18px;font-weight:700"><span style="width:44px">v2</span><div style="flex:1;height:14px;border-radius:7px;background:rgba(255,255,255,.1)"><div id="b2v" style="height:100%;width:0;border-radius:7px;background:linear-gradient(90deg,#22D3EE,#FBBF2E)"></div></div><span id="v2t" style="width:90px;text-align:right">5.3 min</span></div>
      <div class="row" style="justify-content:space-between;margin-top:12px"><span style="font-size:17px;color:rgba(255,255,255,.6);font-weight:600">Average pickup time</span><span id="gain" class="goldt" style="font-size:38px;font-weight:900">−0%</span></div></div>`,
  caps: [[0.4, 6, 'The Dhaka Digital Twin: 5,000 simulated drivers and riders on the real road network.'], [6.2, 11.7, 'Every algorithm is tested here first — the new dispatch cuts pickup time by 22%.']],
  update(lt, d, r) {
    panelIn($('#pm', r), lt); animTB($('#t', r), lt, 0.3);
    if (!r.__paths) { r.__paths = allPaths(TW.c, TW.k, TW.w, TW.h); const rr = srand(3); r.__cars = [...Array(900)].map(() => ({ p: Math.floor(rr() * r.__paths.length), o: rr(), v: 0.03 + rr() * 0.07, hot: rr() < 0.18 })); r.__hex = hexGrid(TW.w, TW.h, 34); }
    const si = clamp(Math.floor((lt - 1.2) / 1.8), 0, 4); const [, inten, hc] = SCEN[si]; const hp = proj(TW.c, TW.k, TW.w, TW.h)(hc[0], hc[1]);
    const cv = $('#cv', r), g = cv.getContext('2d'); g.clearRect(0, 0, TW.w, TW.h);
    const ka = P(lt, 0.6, 2.0);
    for (const [x, y] of r.__hex) { const dd = Math.hypot(x - hp[0], y - hp[1]); const v = Math.max(0, 1 - dd / 380) * inten * (0.75 + 0.25 * Math.sin(lt * 3 + x * 0.02)) * ka;
      if (v < 0.05) continue; g.beginPath(); const pth = new Path2D(hexPath(x, y, 32)); g.fillStyle = `rgba(${Math.round(L(34, 251, v))},${Math.round(L(211, 146, v))},${Math.round(L(238, 60, v))},${0.08 + v * 0.32})`; g.fill(pth); g.strokeStyle = `rgba(103,232,249,${0.08 + v * 0.25})`; g.stroke(pth); }
    const kc = P(lt, 0.3, 1.8);
    for (const c of r.__cars) { const pts = r.__paths[c.p]; const f = (c.o + lt * c.v * 3) % 1; const [x, y] = along(pts, f); g.fillStyle = c.hot ? 'rgba(255,229,138,.95)' : 'rgba(103,232,249,.85)'; g.beginPath(); g.arc(x, y, c.hot ? 2.6 : 1.9, 0, 7); g.fill(); if (c.hot) { g.fillStyle = 'rgba(251,191,46,.18)'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); } }
    cv.style.opacity = kc;
    $$('.sc', r).forEach((el, i) => { const k = P(lt, 0.9 + i * 0.1, 1.4 + i * 0.1); const on = i === si && lt > 1.2; el.style.opacity = k * (on ? 1 : 0.5); el.style.background = on ? 'rgba(34,211,238,.16)' : 'transparent'; el.style.borderColor = on ? 'rgba(103,232,249,.8)' : 'rgba(103,232,249,.18)'; });
    panelIn($('#ab', r), lt, 6.0); const kb = P(lt, 6.5, 8.5, E.inOut); $('#b1v', r).style.width = `${kb * 100}%`; $('#b2v', r).style.width = `${kb * 78}%`; $('#gain', r).textContent = `−${Math.round(22 * P(lt, 8.2, 9.8))}%`;
  } });

const CM = { c: [23.79, 90.402], k: 26000, w: 1240, h: 820 };
scene({ id: 'x-maps', dur: 9.5, act: 5, label: X5, mood: MD,
  html: () => { const p = proj(CM.c, CM.k, CM.w, CM.h); const lab = Object.entries(window.DHAKA.places).map(([n, [la, ln]]) => { const [x, y] = p(la, ln); return x > 40 && x < CM.w - 40 && y > 40 && y < CM.h - 40 ? `<div class="abs bn" style="left:${x - 80}px;top:${y - 14}px;width:160px;text-align:center;font-size:21px;font-weight:700;color:#0E261F;text-shadow:0 0 6px #fff,0 0 3px #fff">${BN_PLACES[n] ?? n}</div>` : ''; }).join('');
    const night = dmap({ w: CM.w, h: CM.h, center: CM.c, k: CM.k, theme: 'dark', bld: true });
    return `<div class="abs" id="mw" style="left:40px;top:150px;width:${CM.w}px;height:${CM.h}px;perspective:1500px">
      <div id="mt" style="position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 60%;border-radius:30px;overflow:visible">
        <div class="abs" style="inset:0;border-radius:30px;overflow:hidden">${dmap({ w: CM.w, h: CM.h, center: CM.c, k: CM.k, theme: 'light', bld: true })}<div class="abs" id="night" style="inset:0;opacity:0">${night}</div></div>
        ${[6, 12, 18].map((z, i) => `<div class="abs bl3" style="inset:0;transform:translateZ(${z}px);opacity:${0.35 + i * 0.2};pointer-events:none"><svg viewBox="0 0 ${CM.w} ${CM.h}" width="${CM.w}" height="${CM.h}">${window.DHAKA.buildings.filter((_, j) => j % 2 === 0).map((rg) => `<polygon points="${polyStr(rg.map(([ln, la]) => p(la, ln)))}" fill="${i === 2 ? '#F6F1E4' : '#D9CFB8'}"/>`).join('')}</svg></div>`).join('')}
        <svg class="abs" id="trf" viewBox="0 0 ${CM.w} ${CM.h}" width="${CM.w}" height="${CM.h}" style="inset:0;transform:translateZ(2px)">${Object.entries(window.DHAKA.arterials).map(([n, l], i) => `<polyline class="tl" data-i="${i}" points="${polyStr(l.map(([ln, la]) => p(la, ln)))}" fill="none" stroke-width="9" stroke-linecap="round" opacity="0"/>`).join('')}</svg>
        ${cnv('pg', CM.w, CM.h, 'transform:translateZ(3px)')}
        <div class="abs" id="lbls" style="inset:0;transform:translateZ(24px)">${lab}</div></div></div>
      ${tb({ id: 't', num: '02', eyebrow: 'Cholo Maps', hl: 'Our own map.|#Our own traffic.', bullets: ['Bangla-first labels and 3D buildings', 'Night style switches at sunset', 'Live traffic from every driver’s GPS'], x: 1320, y: 210, w: 560, tint: 'cyan', sm: true })}
      <div class="abs row" id="leg" style="left:1320px;top:760px;gap:18px;font-size:18px;font-weight:700"><span class="row" style="gap:8px"><i style="width:28px;height:8px;border-radius:4px;background:#22C55E"></i>Free</span><span class="row" style="gap:8px"><i style="width:28px;height:8px;border-radius:4px;background:#FBBF2E"></i>Busy</span><span class="row" style="gap:8px"><i style="width:28px;height:8px;border-radius:4px;background:#EF4444"></i>Jam</span></div>`; },
  caps: [[0.4, 5, 'Cholo Maps: our own vector map, with Bangla labels and 3D buildings.'], [5.2, 9.7, 'Every driver’s GPS becomes a traffic probe — the Cholo Traffic Layer, live.']],
  update(lt, d, r) {
    const k = P(lt, 0.2, 2.2, E.inOut); $('#mt', r).style.transform = `translateY(${L(0, -70, k)}px) rotateX(${L(0, 42, k)}deg) rotateZ(${L(0, -9, k)}deg) scale(${L(0.92, 0.9, k)})`; S($('#mw', r), { op: P(lt, 0, 0.6) });
    $$('.bl3', r).forEach((el, i) => { el.style.transform = `translateZ(${L(0, 6 + i * 6, P(lt, 1.6, 2.8, E.out))}px)`; });
    $('#night', r).style.opacity = P(lt, 3.2, 4.4);
    $$('#lbls div', r).forEach((el) => { el.style.color = lt > 3.8 ? '#E8F7F2' : '#0E261F'; el.style.textShadow = lt > 3.8 ? '0 0 6px #000' : '0 0 6px #fff,0 0 3px #fff'; });
    const kt = P(lt, 5.0, 6.2); $$('.tl', r).forEach((pl) => { const i = +pl.dataset.i; const c = ['#22C55E', '#FBBF2E', '#EF4444', '#22C55E', '#22C55E', '#FBBF2E', '#EF4444'][i % 7]; pl.setAttribute('stroke', c); pl.style.opacity = kt * 0.9; });
    const cv = $('#pg', r), g = cv.getContext('2d'); g.clearRect(0, 0, CM.w, CM.h);
    if (lt > 4.8) { if (!r.__ap) r.__ap = Object.values(window.DHAKA.arterials).map((l) => l.map(([ln, la]) => proj(CM.c, CM.k, CM.w, CM.h)(la, ln)));
      r.__ap.forEach((pts, i) => { for (let j = 0; j < 6; j++) { const [x, y] = along(pts, (j / 6 + lt * 0.08 * (1 + (i % 3) * 0.3)) % 1); g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.fillStyle = 'rgba(103,232,249,.35)'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); } }); }
    animTB($('#t', r), lt, 0.4); S($('#leg', r), { op: kt });
  } });

const SP = { c: [23.7509, 90.3905], k: 150000, w: 720, h: 560 };
scene({ id: 'x-pickup', dur: 8, act: 5, label: X5, mood: MD,
  html: () => { const p = proj(SP.c, SP.k, SP.w, SP.h); const rr = srand(5); const dots = [...Array(60)].map(() => { const a = rr() * 6.28, d0 = rr() * rr() * 40; return [SP.w / 2 + 60 + Math.cos(a) * d0, SP.h / 2 + 118 + Math.sin(a) * d0 * 0.6]; });
    const tr = srand(9); const trace = [...Array(140)].map((_, i) => { const f = i / 140; return [80 + f * 560 + (tr() - 0.5) * 18, 420 - f * 260 + Math.sin(f * 6) * 20 + (tr() - 0.5) * 18]; });
    return panel('pa', 80, 220, 860, 640, `<div class="abs" style="left:70px;top:40px;width:${SP.w}px;height:${SP.h}px;border-radius:22px;overflow:hidden">${dmap({ w: SP.w, h: SP.h, center: SP.c, k: SP.k, theme: 'light' })}
        <div class="abs" style="left:${SP.w / 2 - 110}px;top:${SP.h / 2 - 90}px;width:220px;height:170px;background:#E9DEC6;border:2px solid #D4C4A0;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7A6A48;font-size:16px">Bashundhara City</div>
        <svg class="abs" viewBox="0 0 ${SP.w} ${SP.h}" style="inset:0">${dots.map(([x, y]) => `<circle class="pdot" cx="${x}" cy="${y}" r="4" fill="#0C684F" opacity="0"/>`).join('')}</svg>
        <div class="abs" id="spin" style="left:0;top:0">${icb('pin', 46, '#DC2626', 2.4)}</div>
        <div class="card" id="spc" style="left:${SP.w / 2 - 30}px;top:${SP.h / 2 + 150}px;width:330px;padding:12px 16px;border-radius:16px;opacity:0"><div style="font-weight:800;font-size:16px">Gate 2, Bashundhara City</div><div style="font-size:13px;color:#5E6C65">Riders usually meet here · 1 min walk</div></div></div>
        <div class="abs lbl" style="left:70px;top:610px;color:#67E8F9">Smart pickup points</div>`) +
      panel('pb', 980, 220, 860, 640, `<div class="abs" style="left:70px;top:40px;width:720px;height:560px;border-radius:22px;overflow:hidden">${dmap({ w: 720, h: 560, center: [23.83, 90.43], k: 30000, theme: 'neon', bld: false })}
        <svg class="abs" viewBox="0 0 720 560" style="inset:0">${trace.map(([x, y], i) => `<circle class="gt" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#FBBF2E" opacity="0"/>`).join('')}
        <path id="nr" d="M80 420 C 230 330, 360 300, 640 160" fill="none" stroke="#22D3EE" stroke-width="10" stroke-linecap="round" stroke-dasharray="1000" stroke-dashoffset="1000"/></svg>
        <div class="card" id="nrc" style="left:330px;top:400px;width:340px;padding:12px 16px;border-radius:16px;opacity:0"><div class="row" style="gap:8px;font-weight:800;font-size:16px">${icb('check', 18, '#0C684F', 3)}New road found · added to Cholo Maps</div><div style="font-size:13px;color:#5E6C65">From 1,284 driver GPS traces</div></div></div>
        <div class="abs lbl" style="left:70px;top:610px;color:#67E8F9">Map self-healing</div>`) +
      `<div class="abs" style="left:80px;top:90px"><span class="eyebrow" style="color:#67E8F9"><span class="n" style="border-color:rgba(103,232,249,.5)">03</span>Smarter maps</span><div style="font-size:54px;font-weight:900;letter-spacing:-2px;margin-top:8px">Pickups that make sense. <span class="cyant">Maps that fix themselves.</span></div></div>`; },
  caps: [[0.4, 4.2, 'Drop a pin inside a building and Cholo moves it to the gate riders actually use.'], [4.3, 7.7, 'Driver GPS traces reveal roads the map is missing — and Cholo adds them.']],
  update(lt, d, r) {
    panelIn($('#pa', r), lt, 0.1); panelIn($('#pb', r), lt, 0.3);
    $$('.pdot', r).forEach((c, i) => { c.setAttribute('opacity', P(lt, 0.8 + i * 0.012, 1.2 + i * 0.012) * 0.45); });
    const k1 = P(lt, 1.0, 1.5, E.back), k2 = P(lt, 2.2, 3.0, E.inOut); const sx = L(SP.w / 2 - 23, SP.w / 2 + 37, k2), sy = L(SP.h / 2 - 46 - (1 - k1) * 60, SP.h / 2 + 75, k2); S($('#spin', r), { x: sx, y: sy, op: k1 > 0 ? 1 : 0 });
    const kc = P(lt, 3.0, 3.5, E.back); S($('#spc', r), { s: Math.max(0, kc), op: clamp(kc * 2) });
    $$('.gt', r).forEach((c) => { const i = +c.dataset.i; c.setAttribute('opacity', P(lt, 1.0 + i * 0.012, 1.3 + i * 0.012) * 0.7); });
    $('#nr', r).style.strokeDashoffset = 1000 * (1 - P(lt, 4.2, 5.6, E.inOut)); const kn = P(lt, 5.6, 6.1, E.back); S($('#nrc', r), { s: Math.max(0, kn), op: clamp(kn * 2) });
  } });

scene({ id: 'x-ar', dur: 8, act: 5, label: X5, mood: MD,
  html: `${phone('pa', { x: 300, y: 115, clip: false, bar: 'clear', inner: `<div class="abs" style="inset:0;background:linear-gradient(180deg,#1B2A35 0%,#2D3B44 45%,#3A3A35 46%,#22201C 100%)">
      <div class="abs" style="left:-40px;right:-40px;top:400px;height:500px;background:linear-gradient(180deg,#3A3833,#1A1916);clip-path:polygon(40% 0,60% 0,100% 100%,0 100%)"></div>
      <div class="abs" style="left:0;top:180px;width:120px;height:240px;background:linear-gradient(180deg,#2B3A44,#1B252C)"></div><div class="abs" style="right:0;top:150px;width:140px;height:270px;background:linear-gradient(180deg,#33424C,#1E2A31)"></div>
      <div class="abs" id="arv" style="left:107px;top:430px;width:160px;height:150px;transform-origin:50% 100%"><svg viewBox="0 0 160 150" width="160" height="150"><path d="M20 30 Q20 10 40 10 H120 Q140 10 140 30 V120 H20Z" fill="#16A34A"/><rect x="30" y="22" width="100" height="45" rx="10" fill="#BBF7D0" opacity=".85"/><rect x="18" y="112" width="124" height="18" rx="6" fill="#0E261F"/><rect id="plate" x="48" y="88" width="64" height="20" rx="3" fill="#F8FAFC"/><circle cx="34" cy="132" r="12" fill="#111"/><circle cx="126" cy="132" r="12" fill="#111"/></svg></div>
      <div class="abs" id="ocr" style="left:140px;top:505px;width:96px;height:32px;border:3px solid #22D3EE;border-radius:6px;box-shadow:0 0 18px rgba(34,211,238,.7);opacity:0"><div id="scan" class="abs" style="left:0;right:0;height:2px;background:#67E8F9"></div></div>
      <div class="abs" id="ocrt" style="left:52px;top:440px;width:270px;text-align:center;opacity:0"><span class="bn" style="background:rgba(3,20,15,.85);color:#67E8F9;padding:6px 12px;border-radius:10px;font-size:17px;font-weight:700">ঢাকা মেট্রো-থ ১১-২৩৪৫</span></div>
      ${[0, 1, 2].map((i) => `<div class="abs arw" style="left:157px;top:${700 - i * 46}px;width:60px;height:40px"><svg viewBox="0 0 60 40" width="60" height="40"><path d="M6 34 L30 10 L54 34" fill="none" stroke="#FBBF2E" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`).join('')}
      <div class="abs" style="left:18px;top:60px;right:18px;padding:12px 16px;border-radius:16px;background:rgba(3,20,15,.72);color:#fff"><div style="font-size:13px;color:#67E8F9;font-weight:800;letter-spacing:2px">FIND MY RIDE · AR</div><div style="font-size:18px;font-weight:800">Rahim is 40 m ahead</div></div>
      <div class="abs" id="arok" style="left:18px;right:18px;bottom:30px;padding:16px;border-radius:18px;background:#0C684F;color:#fff;opacity:0"><div class="row" style="gap:12px">${icb('check', 30, '#fff', 3)}<div><div style="font-weight:900;font-size:19px">This is your car</div><div style="font-size:14px;opacity:.85">Green CNG · plate matches · Rahim ★4.9</div></div></div></div></div>` })}
    ${tb({ id: 't', num: '04', eyebrow: 'AR find my ride', hl: 'Raise your phone.|#Find your car.', sub: 'Arrows guide you to the right CNG, and the camera reads the Bangla number plate to confirm it’s yours.', x: 870, y: 280, w: 950, tint: 'cyan' })}`,
  caps: [[0.4, 7.7, 'At a crowded pickup, AR arrows lead you to your CNG — and the camera reads its Bangla plate.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt);
    const ka = P(lt, 0.5, 4, E.out); S($('#arv', r), { s: L(0.55, 1.15, ka), y: L(-60, 30, ka) });
    $$('.arw', r).forEach((el, i) => { const c = ((lt * 1.4 + i / 3) % 1); S(el, { y: -c * 40, op: (1 - c) * (lt < 5.4 ? 1 : 0) }); });
    const ko = P(lt, 3.6, 4.0); S($('#ocr', r), { op: ko * (1 - P(lt, 6.3, 6.6)) }); $('#scan', r).style.top = `${((lt * 2) % 1) * 28}px`; S($('#ocrt', r), { op: P(lt, 4.6, 5.0), y: (1 - P(lt, 4.6, 5.0)) * 10 });
    const kk = P(lt, 5.4, 5.9, E.back); S($('#arok', r), { y: (1 - kk) * 80, op: clamp(kk * 2) }); } });

scene({ id: 'x-search', dur: 9, act: 5, label: X5, mood: MD,
  html: `${phone('pa', { x: 1220, y: 115, clip: false, inner: appScreen(`<div style="padding:16px">
      <div class="ucard row" style="gap:10px;padding:12px 14px;border:2px solid #0C684F">${icb('search', 20, '#0C684F', 2.4)}<span id="q" style="font-size:16px;font-weight:600;min-height:22px"></span><span id="qc" style="width:2px;height:20px;background:#0C684F"></span></div>
      <div class="row" id="chips" style="gap:6px;flex-wrap:wrap;margin-top:12px">${[['AREA', 'Mirpur 10', '#EAF4EE', '#0C684F'], ['NEAR', 'Golchottor', '#FFF6DC', '#9A6A0E'], ['LANDMARK', 'Shwapno', '#E0F2FE', '#0369A1'], ['WHERE', 'In front of', '#FCE7F3', '#9D174D']].map(([a, b, bg, fg]) => `<span class="chip pc" style="background:${bg};color:${fg};opacity:0"><b style="font-size:10px;letter-spacing:1px;opacity:.7">${a}</b>${b}</span>`).join('')}</div>
      <div id="res" style="margin-top:14px;border-radius:16px;overflow:hidden;position:relative;height:300px;opacity:0">${dmap({ w: 342, h: 300, center: [23.807, 90.368], k: 70000, theme: 'light' }).replace('position:absolute', 'position:absolute')}
        <div id="ring" class="abs" style="left:141px;top:120px;width:60px;height:60px;border-radius:50%;border:3px solid #0C684F;background:rgba(12,104,79,.15)"></div><div class="abs" style="left:156px;top:118px">${icb('pin', 30, '#DC2626', 2.6)}</div></div>
      <div id="rc" class="ucard" style="margin-top:12px;padding:12px 14px;opacity:0"><div class="row" style="justify-content:space-between"><b style="font-size:15px">Shwapno, Mirpur 10 Circle</b><span class="tag" style="background:#EAF4EE;color:#0C684F">98% match</span></div><div style="font-size:12px;color:#5E6C65;margin-top:3px">In front of the store · beside the roundabout</div></div></div>`) })}
    ${tb({ id: 't', num: '05', eyebrow: 'AI address search', hl: 'Type it the way|#you say it.', sub: 'Landmarks, Banglish, typos — Cholo understands how Dhaka gives directions.', x: 150, y: 220, w: 950, tint: 'cyan' })}
    <div class="glassc" id="bl" style="left:150px;top:620px;width:900px;height:150px;padding:22px 28px">
      <div class="lbl" style="color:#67E8F9">Banglish & typo-tolerant</div>
      <div class="row" style="gap:14px;margin-top:16px;font-size:26px;font-weight:700">${['gulshan', 'gulsan', '<span class="bn">গুলশান</span>', 'gulshun'].map((w) => `<span class="bw" style="padding:6px 14px;border-radius:12px;background:rgba(255,255,255,.08)">${w}</span>`).join('')}${icb('arrow', 30, '#FBBF2E', 2.6)}<span class="goldt" id="bres" style="font-size:30px;font-weight:900;opacity:0">Gulshan</span></div></div>`,
  caps: [[0.4, 5.6, '“Mirpur 10 golchottor er pashe, Shopno er samne” — Cholo finds exactly that spot.'], [5.8, 9.2, 'Gulshan, gulsan, গুলশান or gulshun — every spelling lands in the same place.']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'right' }); animTB($('#t', r), lt);
    const done = typeText($('#q', r), 'Mirpur 10 golchottor er pashe, Shopno er samne', lt, 0.9, 20); $('#qc', r).style.opacity = !done && Math.floor(lt * 3) % 2 ? 1 : 0;
    $$('.pc', r).forEach((el, i) => { const k = P(lt, 3.3 + i * 0.18, 3.7 + i * 0.18, E.back); S(el, { s: Math.max(0, k), op: clamp(k * 2) }); });
    const kr = P(lt, 4.2, 4.8); S($('#res', r), { op: kr, y: (1 - kr) * 20 }); const c = (lt * 1.1) % 1; S($('#ring', r), { s: 0.6 + c * 1.2, op: (1 - c) * kr }); S($('#rc', r), { op: P(lt, 4.8, 5.3) });
    panelIn($('#bl', r), lt, 5.6); $$('.bw', r).forEach((el, i) => { const k = P(lt, 6.0 + i * 0.25, 6.4 + i * 0.25); S(el, { op: k, y: (1 - k) * 14 }); }); const kb = P(lt, 7.3, 7.8, E.back); S($('#bres', r), { s: Math.max(0, kb), op: clamp(kb * 2) }); } });

scene({ id: 'x-trio', dur: 8, act: 5, label: X5, mood: MD,
  html: `<div class="abs" style="left:110px;top:90px"><span class="eyebrow" style="color:#67E8F9"><span class="n" style="border-color:rgba(103,232,249,.5)">06</span>It already knows</span><div style="font-size:56px;font-weight:900;letter-spacing:-2px;margin-top:8px">Ask for anything. <span class="cyant">Or don’t even ask.</span></div></div>
    ${panel('c1', 110, 290, 540, 600, `<div style="padding:26px"><div class="lbl" style="color:#67E8F9">Intent search</div><div class="ucard row" style="gap:10px;margin-top:14px;padding:12px 14px">${icb('search', 18, '#0C684F', 2.4)}<span id="iq" style="font-size:16px;font-weight:600"></span></div>
      ${[['Square Hospital', '1.2 km · Emergency 24/7', '8 min'], ['Ibn Sina, Dhanmondi', '2.0 km · Emergency open', '11 min'], ['Popular Medical', '2.6 km · Emergency open', '13 min']].map(([n, s, e]) => `<div class="ucard ir row" style="gap:12px;margin-top:10px;padding:12px 14px;opacity:0"><div style="width:38px;height:38px;border-radius:12px;background:#FEE2E2;display:flex;align-items:center;justify-content:center">${icb('plus' in I ? 'plus' : 'alert', 20, '#DC2626', 2.4)}</div><div style="flex:1"><b style="font-size:15px">${n}</b><div style="font-size:12px;color:#5E6C65">${s}</div></div><span class="tag" style="background:#DCFCE7;color:#166534">OPEN · ${e}</span></div>`).join('')}</div>`)}
    ${panel('c2', 690, 290, 540, 600, `<div style="padding:26px"><div class="lbl" style="color:#67E8F9">Predictive destinations</div>
      <div style="margin-top:16px;height:470px;border-radius:24px;background:linear-gradient(180deg,#0E3B30,#0A231C);padding:24px;position:relative;overflow:hidden"><div style="font-size:64px;font-weight:200;letter-spacing:-2px">8:45</div><div style="font-size:17px;opacity:.7">Tuesday · Dhanmondi</div>
      <div id="pd" class="ucard" style="margin-top:30px;padding:16px;opacity:0"><div class="row" style="gap:10px"><img src="logo.svg" style="height:22px"><span style="font-size:13px;color:#5E6C65;font-weight:700">SUGGESTED FOR YOU</span></div><div style="font-size:22px;font-weight:900;margin-top:8px">Office · Gulshan 2</div><div class="row" style="justify-content:space-between;margin-top:6px;font-size:15px;font-weight:700"><span>24 min · CNG</span><span style="color:#0C684F">৳180</span></div><div class="btn" style="margin-top:12px">Book in one tap</div></div>
      <div id="pd2" class="ucard" style="margin-top:12px;padding:12px 16px;opacity:0;font-size:14px;font-weight:700">Friday 1:00 PM → Baitul Mukarram Mosque</div></div></div>`)}
    ${panel('c3', 1270, 290, 540, 600, `<div style="padding:26px"><div class="lbl" style="color:#67E8F9">Cholo Codes</div><div style="margin-top:14px;font-size:44px;font-weight:900;letter-spacing:4px" class="goldt">CHL-7K2P</div>
      <div id="cg" style="margin-top:12px;height:200px;border-radius:18px;background:linear-gradient(180deg,#9CC3E6,#D9E8F2 55%,#B8A98C 56%,#8E7F63);position:relative;overflow:hidden;opacity:0"><div class="abs" style="left:150px;top:40px;width:190px;height:130px;background:#2563EB;border:6px solid #1E3A8A;border-radius:8px 8px 0 0"></div><div class="abs" style="left:236px;top:40px;width:6px;height:130px;background:#1E3A8A"></div><span class="tag abs" style="left:12px;top:12px;background:rgba(0,0,0,.6);color:#fff">GATE PHOTO</span></div>
      <div id="cv2" class="ucard row" style="gap:12px;margin-top:12px;padding:12px 14px;opacity:0"><div style="width:40px;height:40px;border-radius:50%;background:#0C684F;display:flex;align-items:center;justify-content:center">${icb('mic', 20, '#fff', 2.4)}</div><div style="flex:1"><div class="row" style="gap:3px;height:26px">${[...Array(26)].map((_, i) => `<i class="vw" style="width:4px;border-radius:2px;background:#0C684F;height:${6 + Math.abs(Math.sin(i * 1.7)) * 20}px"></i>`).join('')}</div><div style="font-size:13px;color:#5E6C65;margin-top:2px">“Blue gate, ring twice.”</div></div></div>
      <div id="cp" class="ucard row" style="gap:10px;margin-top:10px;padding:12px 14px;opacity:0">${icb('pin', 20, '#DC2626', 2.4)}<b style="font-size:15px">Exact gate pin · Road 7, Banani</b></div></div>`)}`,
  caps: [[0.4, 3.0, '“Hospital with emergency open now” — results ranked by what’s open.'], [3.1, 5.6, 'At 8:45 on a weekday, Office is already waiting, priced and one tap away.'], [5.7, 8.2, 'Cholo Codes: a short code with the gate photo, exact pin and a voice note for the driver.']],
  update(lt, d, r) { panelIn($('#c1', r), lt, 0.2); panelIn($('#c2', r), lt, 0.35); panelIn($('#c3', r), lt, 0.5);
    typeText($('#iq', r), 'Hospital with emergency open now', lt, 0.8, 26); $$('.ir', r).forEach((el, i) => { const k = P(lt, 2.0 + i * 0.2, 2.4 + i * 0.2); S(el, { op: k, x: (1 - k) * 20 }); });
    const kp = P(lt, 3.2, 3.7, E.back); S($('#pd', r), { y: (1 - kp) * 40, op: clamp(kp * 2) }); S($('#pd2', r), { op: P(lt, 4.2, 4.6) });
    S($('#cg', r), { op: P(lt, 5.7, 6.1) }); S($('#cv2', r), { op: P(lt, 6.2, 6.6) }); S($('#cp', r), { op: P(lt, 6.7, 7.1) }); $$('.vw', r).forEach((el, i) => { el.style.transform = `scaleY(${0.4 + 0.6 * Math.abs(Math.sin(lt * 7 + i * 0.6))})`; }); } });

scene({ id: 'x-voice', dur: 9.5, act: 5, label: X5, mood: MD,
  html: `${phone('pa', { x: 300, y: 115, clip: false, inner: appScreen(`<div style="padding:18px;display:flex;flex-direction:column;height:100%">
      <div class="lbl" style="color:#0C684F;font-size:12px">Cholo assistant · বাংলা</div>
      <div id="u1" class="bn" style="align-self:flex-end;margin-top:12px;max-width:85%;background:#0C684F;color:#fff;padding:10px 14px;border-radius:16px 16px 4px 16px;font-size:17px;font-weight:600;min-height:20px"></div>
      <div id="a1" class="ucard bn" style="margin-top:10px;max-width:90%;padding:10px 14px;border-radius:16px 16px 16px 4px;font-size:15px;opacity:0">সবচেয়ে সস্তা <b>বাইক — ৳৯৫</b>, ৬ মিনিট দূরে। বুক করব?<div style="font-size:12px;color:#5E6C65;margin-top:4px;font-family:Inter">Bike is cheapest — ৳95, 6 min away. Book it?</div></div>
      <div id="u2" class="bn" style="align-self:flex-end;margin-top:10px;background:#0C684F;color:#fff;padding:10px 14px;border-radius:16px 16px 4px 16px;font-size:17px;font-weight:600;opacity:0">হ্যাঁ, বুক করো</div>
      <div id="a2" class="ucard row" style="margin-top:10px;gap:10px;padding:12px 14px;border-color:#0C684F;opacity:0">${icb('check', 22, '#0C684F', 3)}<div><b style="font-size:15px">Booked · Bike to Banani</b><div style="font-size:12px;color:#5E6C65">Karim U. · 6 min away · ৳95</div></div></div>
      <div id="sug" class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px;opacity:0">${['+ Add a stop', 'Share with Ammu', 'Where is my driver?'].map((x) => `<span class="chip" style="background:#EAF4EE;color:#0C684F">${x}</span>`).join('')}</div>
      <div style="flex:1"></div>
      <div class="row" style="justify-content:center;gap:4px;height:60px" id="wave">${[...Array(30)].map(() => '<i style="width:5px;border-radius:3px;background:#0C684F;height:40px"></i>').join('')}</div>
      <div class="row" style="justify-content:center;margin-top:8px"><div id="mic" style="width:74px;height:74px;border-radius:50%;background:#0C684F;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 10px rgba(12,104,79,.15)">${icb('mic', 34, '#fff', 2.4)}</div></div></div>`) })}
    ${tb({ id: 't', num: '07', eyebrow: 'Voice booking agent', hl: 'Just say it.|#In Bangla.', sub: 'Book, change or cancel a ride by voice. The agent always reads back the fare before it spends your money.', x: 870, y: 260, w: 950, tint: 'cyan' })}
    ${chip('k1', 870, 660, 'Understands Bangla, Banglish and English', 'mic')}${chip('k2', 870, 740, 'Confirms the fare before booking', 'shield')}`,
  caps: [[0.4, 5.0, '“আমাকে এখন বনানী নিয়ে যাও, সস্তা দেখে” — take me to Banani now, the cheap option.'], [5.1, 10.2, 'The agent finds the cheapest ride, reads back the fare, and books it when you say yes.']],
  sfx: [[0.6, 'tick'], [5.6, 'tick'], [7.0, 'ding']],
  update(lt, d, r) { devIn($('#pa', r), lt, { from: 'left', ry: 8 }); animTB($('#t', r), lt);
    typeText($('#u1', r), 'আমাকে এখন বনানী নিয়ে যাও, সস্তা দেখে', lt, 1.0, 14);
    const listen = (lt > 0.8 && lt < 3.8) || (lt > 5.4 && lt < 6.4); $$('#wave i', r).forEach((el, i) => { el.style.transform = `scaleY(${listen ? 0.25 + 0.75 * Math.abs(Math.sin(lt * 9 + i * 0.7)) : 0.12})`; el.style.opacity = listen ? 1 : 0.4; });
    S($('#mic', r), { s: listen ? 1 + 0.06 * Math.sin(lt * 10) : 1 });
    S($('#a1', r), { op: P(lt, 4.2, 4.6), y: (1 - P(lt, 4.2, 4.6)) * 12 }); S($('#u2', r), { op: P(lt, 6.2, 6.5) }); const k = P(lt, 7.0, 7.4, E.back); S($('#a2', r), { op: clamp(k * 2), s: Math.max(0, k) }); S($('#sug', r), { op: P(lt, 8.0, 8.4) });
    popChip($('#k1', r), lt, 2.0); popChip($('#k2', r), lt, 4.6); } });

scene({ id: 'x-anywhere', dur: 8.5, act: 5, label: X5, mood: MD,
  html: `<div class="abs" style="left:110px;top:90px"><span class="eyebrow" style="color:#67E8F9"><span class="n" style="border-color:rgba(103,232,249,.5)">08</span>Book from anywhere</span><div style="font-size:56px;font-weight:900;letter-spacing:-2px;margin-top:8px">No app? No data? <span class="cyant">No problem.</span></div></div>
    ${[['WhatsApp', '#075E54', '#DCF8C6', 'Cholo, ride to Banani at 6 pm', 'Booked ✓ Bike · ৳95 · pickup 6:00 PM'], ['Messenger', '#0866FF', '#E7F0FF', 'Need a CNG from Farmgate now', 'CNG booked ✓ ৳120 · Rahim, 3 min'], ['SMS', '#334155', '#F1F5F9', 'RIDE Mirpur10 TO Motijheel', 'CHOLO: CNG booked, ৳210. Driver Sumon 4 min. Reply STOP to cancel.']].map(([n, c, bub, q, a], i) => panel('m' + i, 110 + i * 430, 290, 400, 600, `<div style="height:64px;background:${c};display:flex;align-items:center;padding:0 20px;font-weight:800;font-size:20px">${n}</div><div style="padding:18px;background:#ECE5DD10;height:536px">
      <div class="mq" style="margin-left:auto;max-width:85%;background:${bub};color:#111;padding:10px 14px;border-radius:14px 14px 4px 14px;font-size:16px;font-weight:600;opacity:0">${q}</div>
      <div class="ma" style="margin-top:12px;max-width:88%;background:#fff;color:#111;padding:10px 14px;border-radius:14px 14px 14px 4px;font-size:15px;opacity:0"><div class="row" style="gap:6px;margin-bottom:4px"><img src="logo.svg" style="height:16px"><b style="font-size:12px;color:#0C684F">Cholo</b></div>${a}</div></div>`)).join('')}
    ${panel('m3', 1400, 290, 410, 600, `<div style="padding:26px;display:flex;flex-direction:column;align-items:center"><div class="lbl" style="color:#67E8F9">Any basic phone · USSD</div>
      <div style="margin-top:16px;width:230px;height:470px;border-radius:40px;background:linear-gradient(180deg,#3F4B52,#1F262A);padding:22px 18px;box-shadow:inset 0 0 0 3px #59666E">
        <div style="height:190px;border-radius:10px;background:#B7D8A0;color:#1A2E12;font-family:monospace;font-size:15px;padding:12px;line-height:1.45"><div id="ud" style="font-weight:700"></div><div id="um" style="opacity:0">CHOLO<br>1. Book a ride<br>2. My trips<br>3. Wallet<br>4. SOS</div></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => `<div class="key" data-k="${k}" style="height:42px;border-radius:12px;background:#2A3439;display:flex;align-items:center;justify-content:center;font-weight:800;color:#E2E8F0">${k}</div>`).join('')}</div></div></div>`)}`,
  caps: [[0.4, 8.7, 'Book on WhatsApp, Messenger or SMS — or dial *CHOLO# on any basic phone, no internet needed.']],
  update(lt, d, r) { [0, 1, 2, 3].forEach((i) => panelIn($('#m' + i, r), lt, 0.2 + i * 0.12)); $$('.mq', r).forEach((el, i) => S(el, { op: P(lt, 1.0 + i * 0.5, 1.4 + i * 0.5) })); $$('.ma', r).forEach((el, i) => { const k = P(lt, 2.4 + i * 0.5, 2.8 + i * 0.5, E.back); S(el, { op: clamp(k * 2), s: Math.max(0, k) }); });
    const n = typeText($('#ud', r), '*CHOLO#', lt, 1.4, 5); const typed = $('#ud', r).textContent; $$('.key', r).forEach((el) => { const hit = typed.length && typed.at(-1) === el.dataset.k && lt < 3.0; el.style.background = hit ? '#FBBF2E' : '#2A3439'; });
    S($('#um', r), { op: P(lt, 3.4, 3.8) }); } });
