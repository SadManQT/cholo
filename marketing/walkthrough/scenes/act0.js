function actCard(id, num, title, sub, { label = '', mood } = {}) {
  scene({ id, dur: 3.0, act: num, chapter: title, label, sweep: true, noWm: true, mood,
    html: `<div class="center" style="top:330px"><div class="ac-num" style="font-size:210px;font-weight:900;letter-spacing:-8px;line-height:1;-webkit-text-stroke:3px rgba(251,191,46,.85);color:transparent">${num}</div>
      <div class="ac-t" style="margin-top:10px;font-size:92px;font-weight:900;letter-spacing:-3px">${title}</div>
      <div class="ac-s" style="margin-top:18px;font-size:28px;font-weight:600;letter-spacing:6px;color:rgba(255,255,255,.65);text-transform:uppercase">${sub}</div></div>
      <div class="abs ac-line" style="left:760px;top:300px;width:400px;height:3px;background:linear-gradient(90deg,transparent,#FBBF2E,transparent)"></div>`,
    update(lt, d, r) {
      const a = P(lt, 0.05, 0.8, E.out5); S($('.ac-num', r), { y: (1 - a) * 60, s: L(1.3, 1, a), op: a }); $('.ac-num', r).style.filter = `blur(${(1 - a) * 12}px)`;
      const b = P(lt, 0.3, 1.0, E.out5); S($('.ac-t', r), { y: (1 - b) * 40, op: b });
      const c = P(lt, 0.55, 1.2); S($('.ac-s', r), { op: c }); $('.ac-s', r).style.letterSpacing = `${L(16, 6, c)}px`;
      S($('.ac-line', r), { sx: P(lt, 0.2, 1.2, E.inOut), op: 1 });
    } });
}
const NIGHT = { c: [23.785, 90.392], k: 7600 };
scene({ id: 'cold', dur: 10.5, act: 0, label: '', noWm: true, fade: false,
  html: () => {
    const w = 2300, h = 1500; const roads = ['Airport Road', 'Pragati Sarani', 'Begum Rokeya Sarani', 'Mirpur Road', 'Gulshan Avenue', 'Kazi Nazrul Avenue', 'Bashundhara Road', 'Mirpur Link', 'Moghbazar Flyover'];
    const trails = roads.map((n, i) => `<polyline class="trail" data-i="${i}" points="${polyStr(road(n, NIGHT.c, NIGHT.k, w, h))}" fill="none" stroke="url(#tg)" stroke-width="5" stroke-linecap="round" filter="url(#glow)"/>`).join('');
    return `<div class="abs" id="cmap" style="left:-190px;top:-210px;width:${w}px;height:${h}px;transform-origin:50% 50%">${dmap({ w, h, center: NIGHT.c, k: NIGHT.k, theme: 'dark', bld: false })}
      <svg class="abs" viewBox="0 0 ${w} ${h}" style="inset:0;width:${w}px;height:${h}px"><defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="#FFE58A"/><stop offset="1" stop-color="#E88A12"/></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${trails}</svg>
      <div class="abs" id="ccar" style="left:0;top:0">${carSVG('#FBBF2E', 1.3)}</div></div>
      <div class="abs" id="cdim" style="inset:0;background:radial-gradient(ellipse at center,rgba(3,20,15,.2),rgba(3,20,15,.92) 75%)"></div>
      <div class="abs" id="clogo" style="left:560px;top:330px;width:800px;height:375px">
        <img src="logo-light.svg" style="width:800px;display:block;filter:drop-shadow(0 30px 60px rgba(0,0,0,.6))">
        <div id="cshine" class="abs" style="inset:0;-webkit-mask:url(logo-light.svg) center/100% 100% no-repeat;mask:url(logo-light.svg) center/100% 100% no-repeat;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.95) 50%,transparent 60%);background-size:300% 100%"></div></div>
      <div class="center" id="ct1" style="top:760px;font-size:32px;font-weight:600;letter-spacing:14px;color:rgba(255,255,255,.92)">BANGLADESH MOVES WITH <span class="bnd" style="letter-spacing:2px">চলো</span></div>
      <div class="center" id="ct2" style="top:822px;font-size:22px;font-weight:700;letter-spacing:9px;color:var(--gold)">RIDE &nbsp;·&nbsp; DRIVE &nbsp;·&nbsp; EARN</div>`;
  },
  caps: [[1.2, 5.0, 'Every evening, millions of journeys light up Dhaka.'], [5.4, 10.2, 'This is চলো — built for how Bangladesh really moves.']],
  sfx: [[0.2, 'riser6'], [5.0, 'impact'], [5.3, 'bells']],
  update(lt, d, r) {
    const z = L(1.0, 1.12, P(lt, 0, d, E.lin)); S($('#cmap', r), { s: z, r: L(-3, 0, P(lt, 0, d, E.lin)) });
    $$('.trail', r).forEach((pl) => { const i = +pl.dataset.i; const len = pl.getTotalLength(); const k = P(lt, 0.2 + i * 0.28, 2.4 + i * 0.28, E.inOut); pl.style.strokeDasharray = `${len}`; pl.style.strokeDashoffset = `${len * (1 - k)}`; pl.style.opacity = 0.9 - P(lt, 5, 7) * 0.5; });
    const pts = road('Airport Road', NIGHT.c, NIGHT.k, 2300, 1500); placeCar($('#ccar', r), pts, P(lt, 0.4, 5.2, E.inOut), 26, 14); $('#ccar', r).style.opacity = 1 - P(lt, 4.8, 5.4);
    $('#cdim', r).style.opacity = L(0.25, 1, P(lt, 3.6, 5.4));
    const kl = P(lt, 4.6, 6.2, E.out5); const lg = $('#clogo', r); lg.style.filter = `blur(${(1 - kl) * 20}px)`; S(lg, { s: L(1.25, 1, kl), op: kl });
    $('#cshine', r).style.backgroundPosition = `${L(120, -60, P(lt, 6.2, 7.6, E.inOut))}% 0`;
    const t1 = P(lt, 6.6, 7.6); S($('#ct1', r), { y: (1 - t1) * 26, op: t1 }); $('#ct1', r).style.letterSpacing = `${L(30, 14, t1)}px`;
    const t2 = P(lt, 7.2, 8.2); S($('#ct2', r), { y: (1 - t2) * 20, op: t2 });
    const out = P(lt, 9.6, 10.5, E.in); r.style.opacity = 1 - out; S(r, { s: 1 + out * 0.08 });
  } });
const CITIES = ['DHAKA', 'CHATTOGRAM', 'SYLHET', 'KHULNA', 'RAJSHAHI', 'BARISHAL', 'RANGPUR', 'MYMENSINGH', 'CUMILLA', 'GAZIPUR'];
scene({ id: 'kinetic', dur: 5.4, act: 0, noWm: true,
  html: `<div class="abs" style="left:170px;top:210px">${['One app.', 'Every ride.', '~Every city.'].map((w) => `<div class="k1 ${w[0] === '~' ? 'goldt' : ''}" style="font-size:168px;font-weight:900;letter-spacing:-6px;line-height:1.04;transform-origin:0 60%">${w.replace('~', '')}</div>`).join('')}</div>
    <div class="abs" id="ktick" style="left:0;top:850px;white-space:nowrap;font-size:30px;font-weight:700;letter-spacing:10px;color:rgba(255,255,255,.35)">${(CITIES.join('  ·  ') + '  ·  ').repeat(3)}</div>`,
  sfx: [[0.1, 'hit'], [1.4, 'hit'], [2.7, 'hit']],
  update(lt, d, r) {
    $$('.k1', r).forEach((el, i) => { const a = 0.1 + i * 1.3; const k = P(lt, a, a + 0.55, E.out5); const dim = i < 2 ? P(lt, a + 1.3, a + 1.7) : 0; S(el, { x: (1 - k) * -80, s: L(1.25, 1, k), op: k * (1 - dim * 0.6) }); el.style.filter = `blur(${(1 - k) * 14}px)`; });
    S($('#ktick', r), { x: -lt * 170, op: P(lt, 0.3, 1) });
  } });
const CHAPTERS = [['01', 'Welcome', 'The real home page'], ['02', 'Ride', 'Book, ride, pay'], ['03', 'Drive & Earn', 'The driver app'], ['04', 'Operations', 'The admin centre'], ['05', 'চলো Intelligence', 'AI, maps & safety'], ['06', 'Why চলো', 'And so much more']];
scene({ id: 'contents', dur: 5.8, act: 0, noWm: true,
  html: `<div class="abs" style="left:150px;top:150px"><div class="eyebrow" id="cw-e"><span class="n">${ic('sparkle', 'width:20px;height:20px;stroke:#FBBF2E')}</span>The complete walkthrough</div>
    <div id="cw-t" style="margin-top:20px;font-size:84px;font-weight:900;letter-spacing:-3px;line-height:1.02">Everything <span class="bnd goldt" style="letter-spacing:0">চলো</span> does.<br><span style="color:rgba(255,255,255,.55)">In ten minutes.</span></div></div>
    <div class="abs" style="left:150px;top:520px;width:1620px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px">${CHAPTERS.map(([n, t, s]) => `<div class="glass cw-i" style="position:relative;padding:24px 28px;border-radius:24px"><div style="font-size:18px;font-weight:800;color:var(--gold);letter-spacing:3px">${n}</div><div style="font-size:34px;font-weight:800;margin-top:6px">${t}</div><div style="font-size:20px;color:rgba(255,255,255,.6);margin-top:4px;font-weight:500">${s}</div></div>`).join('')}</div>`,
  caps: [[0.6, 5.5, 'A walkthrough of the whole platform — the real app first, then the next generation.']],
  update(lt, d, r) {
    const a = P(lt, 0.1, 0.6); S($('#cw-e', r), { x: (1 - a) * -30, op: a }); const b = P(lt, 0.2, 1.0, E.out5); S($('#cw-t', r), { y: (1 - b) * 40, op: b });
    $$('.cw-i', r).forEach((el, i) => { const k = P(lt, 0.8 + i * 0.16, 1.4 + i * 0.16, E.back); S(el, { y: (1 - k) * 50, s: L(0.9, 1, k), op: clamp(k * 2) }); });
  } });
