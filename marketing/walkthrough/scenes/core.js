const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const E = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  lin: (t) => t,
  in: (t) => t * t * t,
};
const P = (t, a, b, e = E.out) => e(clamp((t - a) / (b - a)));
const L = (a, b, k) => a + (b - a) * k;
function S(el, o = {}) {
  if (!el) return;
  const { x = 0, y = 0, s = 1, r = 0, op, rx = 0, ry = 0, sx, sy } = o;
  el.style.transform = `translate(${x}px,${y}px)` + (rx || ry ? ` perspective(1800px) rotateX(${rx}deg) rotateY(${ry}deg)` : '') + ` rotate(${r}deg) scale(${sx ?? s},${sy ?? s})`;
  if (op !== undefined) el.style.opacity = op;
}
const fmt = (v, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const tk = (v, d = 0) => `৳${fmt(v, d)}`;
let __seed = 7; const rnd = () => ((__seed = (__seed * 16807) % 2147483647) / 2147483647);
const srand = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };

const I = {
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  pkg: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  gift: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', nav: '<path d="M3 11 22 2l-9 19-2-8-8-2z"/>',
  headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  brief: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', id: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h5M14 14h3"/>',
  repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', trend: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  map: '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z"/><path d="M8 2v16M16 6v16"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5"/><circle cx="17" cy="14" r="1.4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>', chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  drop: '<path d="M12 2.7 6.3 8.3a8 8 0 1 0 11.4 0z"/>', train: '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M8 21l2-4M16 21l-2-4"/><circle cx="8.5" cy="14" r="1"/><circle cx="15.5" cy="14" r="1"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m9 22 2-7 3 3v6M7 13l2-5 4 1 3 4M11 15l-2-3"/>', bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l-3 11.5M5.5 17.5 9 10h7M9 10l-1-3H6"/>',
  rain: '<path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2"/>', signal: '<path d="M2 20h2v-4H2zM7 20h2v-8H7zM12 20h2V8h-2zM17 20h2V4h-2z"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>', fuel: '<path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M3 10h12M15 13h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-3-3"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 7-11 16-11 0 9-5 16-11 16zM4 21c3-5 6-8 10-10"/>', battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 10v4M10 10v4"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>', db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>', ac: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>', link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>', receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2l-1 1-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', a11y: '<circle cx="12" cy="4" r="2"/><path d="M4 8h16M12 8v6M9 22l3-8 3 8"/>',
  sparkle: '<path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>',
};
const ic = (n, st = '') => `<svg viewBox="0 0 24 24" class="ico" style="${st}">${I[n]}</svg>`;
const icb = (n, size = 24, color = 'currentColor', sw = 2) => `<svg viewBox="0 0 24 24" class="ico" style="width:${size}px;height:${size}px;stroke:${color};stroke-width:${sw}">${I[n]}</svg>`;

function tb({ id, num, eyebrow, hl, sub, bullets = [], x, y, w = 760, tint = '', sm = false, align = 'left' }) {
  const lines = hl.split('|').map((l) => {
    const m = l.match(/^([~^!@#])/); const cls = m ? { '~': 'goldt', '^': 'pinkt', '!': 'redt', '@': 'bluet', '#': 'cyant' }[m[1]] : '';
    const txt = m ? l.slice(1) : l;
    return `<span class="ln">${txt.split(' ').map((w2) => `<span class="wm"><span class="wi anim-w ${cls}">${w2}</span></span>`).join(' ')}</span>`;
  }).join('');
  return `<div class="tb ${tint ? 'tint-' + tint : ''}" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;text-align:${align}">
    ${eyebrow ? `<div class="eyebrow anim">${num ? `<span class="n">${num}</span>` : ''}${eyebrow}</div>` : ''}
    <h2 class="hl ${sm ? 'sm' : ''}">${lines}</h2>
    ${sub ? `<p class="sub anim">${sub}</p>` : ''}
    ${bullets.length ? `<ul class="bl">${bullets.map((b) => `<li class="anim"><span class="ck">${ic('check')}</span>${b}</li>`).join('')}</ul>` : ''}
  </div>`;
}
function animTB(root, lt, start = 0.2) {
  if (!root) return;
  let d = start;
  const eb = $('.eyebrow', root); if (eb) { const k0 = P(lt, d, d + 0.6); S(eb, { x: (1 - k0) * -30, op: k0 }); d += 0.15; }
  $$('.anim-w', root).forEach((w) => { const k = P(lt, d, d + 0.7, E.out5); w.style.transform = `translateY(${(1 - k) * 110}%)`; d += 0.06; });
  d += 0.1;
  $$('.sub.anim,.bl li.anim', root).forEach((el) => { const k = P(lt, d, d + 0.6); S(el, { y: (1 - k) * 26, op: k }); d += 0.13; });
}
const chip = (id, x, y, text, icon = 'check', cls = '') => `<div class="pill ${cls}" id="${id}" style="left:${x}px;top:${y}px;opacity:0">${icon ? ic(icon) : ''}${text}</div>`;
function popChip(el, lt, a, float = 6) { const k = P(lt, a, a + 0.55, E.back); S(el, { s: Math.max(0, k), op: k > 0 ? clamp(k * 2) : 0, y: Math.sin(lt * 2 + a) * float }); }
function sbar(kind = '') { return `<div class="sbar ${kind}"><span>9:41</span><span style="display:flex;gap:7px;align-items:center"><span style="font-size:12px;letter-spacing:1px">5G</span><i></i></span></div>`; }

const PH = { sw: 374, sh: 809 + 38 };
function phone(id, { x = 0, y = 0, scale = 0.9, clip = true, inner = '', bar = '', dark = false } = {}) {
  return `<div class="phone" id="${id}" style="left:${x}px;top:${y}px;transform:scale(${scale})">
    <div class="screen" style="width:${PH.sw}px;height:${PH.sh}px;${dark ? 'background:#0B1512;color:#EEF1E9' : ''}"><div class="island"></div>${sbar(bar || (dark ? 'dark' : ''))}
    ${clip ? `<img class="clipimg" data-clipimg style="top:38px;height:809px"><div class="ripples" style="top:38px"></div>` : ''}
    <div class="ov abs" style="inset:0">${inner}</div><div class="glare"></div></div></div>`;
}
const LP = { sw: 1280, sh: 800 };
function laptop(id, { x = 0, y = 0, scale = 1, url = 'cholo-cholo7.vercel.app/admin', inner = '' } = {}) {
  return `<div class="laptop" id="${id}" style="left:${x}px;top:${y}px;transform:scale(${scale});transform-origin:0 0">
    <div class="bchrome"><span class="d" style="background:#FF5F57"></span><span class="d" style="background:#FEBC2E"></span><span class="d" style="background:#28C840"></span>
      <div class="url">${icb('lock', 14, '#0C684F', 2.6)}<span class="urltxt">${url}</span></div></div>
    <div class="lscreen" style="width:${LP.sw}px;height:${LP.sh}px"><img class="clipimg" data-clipimg style="top:0;height:${LP.sh}px"><div class="ripples"></div>
      <svg class="cursor" viewBox="0 0 24 24" style="display:none"><path d="M4 2l16 9-7 2-3 7z" fill="#0E261F" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
      <div class="ov abs" style="inset:0">${inner}</div></div></div>`;
}

const PENDING = [];
function setClip(dev, id, lt, { start = 0, rate = 1, from = 0, hold = true } = {}) {
  const m = CLIPS[id]; if (!m) return 0;
  const img = $('[data-clipimg]', dev); if (!img) return 0;
  const ct = from + Math.max(0, lt - start) * rate;
  const k = clamp(Math.floor(ct * 30), 0, m.n - 1);
  const src = `clips/${id}/${String(k).padStart(5, '0')}.jpg`;
  if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; PENDING.push(img.decode().catch(() => {})); }
  const rip = $('.ripples', dev); if (rip) {
    const sc = (dev.classList.contains('laptop') ? LP.sw : PH.sw) / m.vw;
    const live = m.taps.filter((tp) => ct - tp.t >= 0 && ct - tp.t < 0.75);
    rip.innerHTML = live.map((tp) => { const a = (ct - tp.t) / 0.75; return `<div class="rip" style="left:${tp.x * sc}px;top:${tp.y * sc}px;transform:scale(${0.5 + a * 0.9});opacity:${1 - a}"></div>`; }).join('');
    const cur = $('.cursor', dev); if (cur && dev.classList.contains('laptop')) {
      const next = m.taps.find((tp) => tp.t >= ct - 0.4); const prev = [...m.taps].reverse().find((tp) => tp.t < ct);
      if (next || prev) { const a = prev ?? next, b = next ?? prev; const k2 = a === b ? 1 : E.inOut(clamp((ct - (a.t)) / Math.max(0.01, b.t - a.t - 0.1)));
        const cx = L(a.x, b.x, k2) * sc, cy = L(a.y, b.y, k2) * sc; cur.style.display = 'block'; cur.style.left = `${cx - 4}px`; cur.style.top = `${cy - 2}px`; }
    }
  }
  return ct;
}
const clipDur = (id, rate = 1) => (CLIPS[id]?.dur ?? 5) / rate;

function devIn(el, lt, { from = 'bottom', a = 0, dur = 1, ry = -8, rx = 3, base = 0.9 } = {}) {
  const k = P(lt, a, a + dur, E.out5);
  const off = { bottom: [0, 520], left: [-700, 0], right: [700, 0], top: [0, -500] }[from];
  el.style.transform = `translate(${off[0] * (1 - k)}px,${off[1] * (1 - k) + Math.sin(lt * 1.1) * 4}px) perspective(1800px) rotateY(${L(ry * 3, ry, k)}deg) rotateX(${L(rx * 3, rx, k)}deg) scale(${base})`;
  el.style.opacity = k > 0 ? clamp(k * 3) : 0;
}

function proj(center, k, w, h) { const ky = k * 1.086; return (lat, lng) => [w / 2 + (lng - center[1]) * k, h / 2 - (lat - center[0]) * ky]; }
const MAPTHEME = {
  light: { bg: '#F1EEE4', water: '#BFDDF0', park: '#D3E8CC', bld: '#E3DBC6', minor: '#FFFFFF', minorC: '#DDD6C6', major: '#FFF1B8', majorC: '#E8C766', rail: '#E11D48', label: '#6B7A72' },
  dark: { bg: '#0D1A16', water: '#0F2E3D', park: '#123324', bld: '#16251F', minor: '#24352F', minorC: '#16251F', major: '#4A3F1E', majorC: '#2E2714', rail: '#FB7185', label: '#8FA39A' },
  neon: { bg: '#050D12', water: '#07202C', park: '#0A1A16', bld: '#0B1820', minor: '#11303A', minorC: '#0A1A20', major: '#155E75', majorC: '#0A2A33', rail: '#F472B6', label: '#67E8F9' },
};
function dmap({ w, h, center = [23.785, 90.395], k = 9000, theme = 'light', minor = true, bld = true, labels = false, mrt = false, id = '' } = {}) {
  const c = MAPTHEME[theme]; const p = proj(center, k, w, h);
  const D = window.DHAKA; const pts = (arr) => arr.map(([lng, lat]) => p(lat, lng).map((v) => v.toFixed(1)).join(',')).join(' ');
  const poly = (ring, fill) => `<polygon points="${pts(ring)}" fill="${fill}"/>`;
  const mw = Math.max(0.6, k / 9000 * 2.2), Mw = Math.max(1.6, k / 9000 * 6);
  let s = `<svg ${id ? `id="${id}"` : ''} viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="position:absolute;inset:0;display:block"><rect width="${w}" height="${h}" fill="${c.bg}"/>`;
  s += D.airport.map((r) => poly(r, c.bld)).join('') + D.parks.map((r) => poly(r, c.park)).join('') + D.water.map((r) => poly(r, c.water)).join('');
  if (bld && k > 12000) s += `<g opacity=".9">${D.buildings.map((r) => poly(r, c.bld)).join('')}</g>`;
  if (minor) s += `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${c.minorC}" stroke-width="${mw + 1.4}">${D.minor.map((l) => `<polyline points="${pts(l)}"/>`).join('')}</g><g stroke="${c.minor}" stroke-width="${mw}">${D.minor.map((l) => `<polyline points="${pts(l)}"/>`).join('')}</g></g>`;
  if (mrt) s += `<polyline points="${pts(D.mrt.map(([, la, ln]) => [ln, la]))}" fill="none" stroke="${c.rail}" stroke-width="${Mw * 0.7}" stroke-dasharray="${Mw * 1.5} ${Mw}" opacity=".6"/>`;
  s += `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${c.majorC}" stroke-width="${Mw + 2.5}">${Object.values(D.arterials).map((l) => `<polyline points="${pts(l)}"/>`).join('')}</g><g stroke="${c.major}" stroke-width="${Mw}">${Object.values(D.arterials).map((l) => `<polyline points="${pts(l)}"/>`).join('')}</g></g>`;
  if (labels) s += Object.entries(D.places).map(([n, [la, ln]]) => { const [x, y] = p(la, ln); return x > 20 && x < w - 20 && y > 20 && y < h - 20 ? `<text x="${x}" y="${y}" fill="${c.label}" font-size="${labels === true ? 14 : labels}" font-weight="700" text-anchor="middle" font-family="Inter" letter-spacing="1">${n.toUpperCase()}</text>` : ''; }).join('');
  return s + '</svg>';
}
function road(name, center, k, w, h) { const p = proj(center, k, w, h); return window.DHAKA.arterials[name].map(([lng, lat]) => p(lat, lng)); }
function polyStr(pts) { return pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' '); }
function plen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
function along(pts, f) {
  const total = plen(pts); let d = clamp(f) * total;
  for (let i = 1; i < pts.length; i++) { const sl = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= sl || i === pts.length - 1) { const k = sl ? clamp(d / sl) : 0; return [L(pts[i - 1][0], pts[i][0], k), L(pts[i - 1][1], pts[i][1], k), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) * 180 / Math.PI]; }
    d -= sl; }
  return [...pts.at(-1), 0];
}
const carSVG = (color = '#0C684F', s = 1) => `<svg viewBox="0 0 40 22" style="width:${40 * s}px;height:${22 * s}px;overflow:visible;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))"><rect x="1" y="2" width="38" height="18" rx="7" fill="${color}"/><rect x="22" y="4.5" width="9" height="13" rx="3" fill="rgba(255,255,255,.78)"/><rect x="8" y="5" width="7" height="12" rx="2.5" fill="rgba(255,255,255,.5)"/></svg>`;
function placeCar(el, pts, f, dx = 20, dy = 11) { const [x, y, a] = along(pts, f); el.style.transform = `translate(${x - dx}px,${y - dy}px) rotate(${a}deg)`; el.style.transformOrigin = `${dx}px ${dy}px`; }
function hexPath(cx, cy, r) { let d = ''; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; } return d + 'Z'; }
function hexGrid(w, h, r) { const out = []; const dx = r * Math.sqrt(3), dy = r * 1.5; for (let j = 0, y = 0; y < h + r; j++, y += dy) for (let x = (j % 2) * dx / 2; x < w + r; x += dx) out.push([x, y]); return out; }

function appScreen(inner, { tab = 0, title = '', dark = false } = {}) {
  const tabs = [['home', 'Book'], ['receipt', 'Trips'], ['wallet', 'Wallet'], ['bell', 'Inbox'], ['user', 'Account']];
  return `<div class="app" style="${dark ? 'background:#0B1512;color:#EEF1E9' : ''}"><div class="apphdr" style="${dark ? 'background:#0E1714' : ''}"><img src="${dark ? 'logo-light.svg' : 'logo.svg'}"></div>
    <div class="abs" style="left:0;right:0;top:94px;bottom:64px;overflow:hidden">${inner}</div>
    <div class="apptabs" style="${dark ? 'background:#0E1714;border-color:#1E3530' : ''}">${tabs.map(([i, n], k) => `<div class="${k === tab ? 'on' : ''}">${icb(i, 20)}${n}</div>`).join('')}</div></div>`;
}

const ACTS = {};
const SCENES = [];
function scene(def) { SCENES.push(def); }
const CUE = [];
let CLIPS = {};
let TL = null;

function build() {
  const root = $('#scenes'); let t = 0; const caps = []; const chapters = [];
  for (const s of SCENES) {
    if (typeof s.dur === 'function') s.dur = s.dur();
    s.a = t; s.b = t + s.dur; t = s.b;
    const el = document.createElement('section'); el.className = 'scene'; el.id = 'sc-' + s.id; el.innerHTML = typeof s.html === 'function' ? s.html() : s.html; root.appendChild(el); s.el = el;
    (s.play ?? []).forEach((pl) => { if (pl.fit) { const m = CLIPS[pl.clip]; if (m) pl.rate = Math.max(0.6, (m.dur - (pl.from ?? 0)) / Math.max(1, (pl.end ?? s.dur) - (pl.start ?? 0) - 0.35)); } });
    (s.play ?? []).forEach((pl) => { if ((pl.rate ?? 1) < 1.6) return; const dev = $('#' + pl.el, el); if (!dev) return; pl.ff = true;
      if (!$('.ffb', dev)) dev.insertAdjacentHTML('beforeend', `<div class="ffb"><svg viewBox="0 0 24 24"><path d="M3 5l9 7-9 7zM12 5l9 7-9 7z"/></svg><span></span></div>`);
      $('.ffb span', dev).textContent = `${Math.max(2, Math.round(pl.rate))}×`; });
    (s.caps ?? []).forEach(([c0, c1, text]) => { if (c0 < s.dur - 0.3) caps.push({ a: s.a + c0, b: s.a + Math.min(c1, s.dur - 0.15), text }); });
    (s.sfx ?? []).forEach(([c, name, gain = 1]) => { if (c < s.dur) CUE.push({ t: +(s.a + c).toFixed(3), name, gain }); });
    (s.play ?? []).forEach((pl) => { const m = CLIPS[pl.clip]; if (!m) return; const rate = pl.rate ?? 1, st = pl.start ?? 0, from = pl.from ?? 0, end = pl.end ?? s.dur;
      m.taps.forEach((tp) => { const tt = st + (tp.t - from) / rate; if (tt >= st && tt <= end) CUE.push({ t: +(s.a + tt).toFixed(3), name: 'tick', gain: 0.8 }); }); });
    if (s.chapter) chapters.push({ t: s.a, title: s.chapter });
  }
  TL = { total: t, caps, chapters, cues: CUE.sort((a, b) => a.t - b.t), scenes: SCENES.map((s) => ({ id: s.id, a: s.a, b: s.b, act: s.act, label: s.label })) };
  const st = $('#streaks'); window.__stk = [...Array(9)].map(() => ({ y: rnd() * 1080, w: 200 + rnd() * 380, sp: 500 + rnd() * 900, off: rnd() * 4000, o: 0.22 + rnd() * 0.45 }));
  window.__stk.forEach(() => { const d = document.createElement('div'); d.className = 'streak'; st.appendChild(d); });
  window.TIMELINE = TL;
}
function mood(t) {
  const out = { pink: 0, red: 0, cyan: 0, blue: 0, dark: 0 };
  for (const s of SCENES) { if (!s.mood) continue; const k = P(t, s.a - 0.2, s.a + 0.6) * (1 - P(t, s.b - 0.5, s.b + 0.3)); for (const [m, v] of Object.entries(s.mood)) out[m] = Math.max(out[m], k * v); }
  return out;
}
async function render(t) {
  PENDING.length = 0;
  const m = mood(t);
  S($('#b1'), { x: -200 + Math.sin(t * 0.25) * 260, y: -250 + Math.cos(t * 0.2) * 160, op: 0.42 * (1 - m.dark * 0.7) });
  S($('#b2'), { x: 1250 + Math.cos(t * 0.22) * 240, y: 450 + Math.sin(t * 0.3) * 160, op: 0.13 * (1 - Math.max(m.pink, m.red, m.dark)) });
  S($('#b3'), { x: 1000 + Math.sin(t * 0.3) * 120, y: 150, op: m.pink * 0.36 });
  S($('#b4'), { x: -100 + Math.sin(t * 0.8) * 80, y: 100, op: m.red * (0.42 + 0.14 * Math.sin(t * 6)) });
  S($('#b5'), { x: 900 + Math.sin(t * 0.35) * 220, y: -200 + Math.cos(t * 0.3) * 120, op: m.cyan * 0.22 });
  S($('#b6'), { x: 200 + Math.cos(t * 0.3) * 200, y: 300, op: m.blue * 0.35 });
  $('#bgdark').style.opacity = m.dark;
  $('#grid').style.opacity = m.dark * 0.9; $('#grid').style.transform = `translate(${-(t * 14) % 80}px,${-(t * 8) % 80}px)`;
  $('#dots').style.opacity = 1 - m.dark * 0.7;
  $('#dots').style.transform = `translate(${-(t * 18) % 46}px,${-(t * 9) % 46}px)`;
  [...$('#streaks').children].forEach((el, i) => { const s = window.__stk[i]; const x = ((t * s.sp + s.off) % (1920 + s.w * 2)) - s.w; el.style.width = s.w + 'px'; S(el, { x, y: s.y + Math.sin(t * 0.5 + i) * 20, r: -8, op: s.o * (1 - m.dark * 0.6) }); });
  let sw = -1; for (const s of SCENES) if (s.sweep && t > s.a - 0.35 && t < s.a + 0.35) sw = (t - (s.a - 0.35)) / 0.7;
  $('#sweep').style.display = sw >= 0 ? 'block' : 'none'; if (sw >= 0) S($('#sweep'), { x: L(-500, 2200, E.inOut(sw)), r: 18 });
  let cur = null;
  for (const s of SCENES) {
    const on = t >= s.a && t < s.b; s.el.style.display = on ? 'block' : 'none'; if (!on) continue; cur = s;
    const lt = t - s.a, d = s.dur;
    if (s.fade !== false) { const ki = P(lt, 0, 0.4), ko = P(lt, d - 0.4, d, E.in); s.el.style.opacity = ki * (1 - ko); S(s.el, { s: L(1.03, 1, P(lt, 0, 0.7)) * (1 - ko * 0.035) }); }
    $$('.ffb', s.el).forEach((b) => { b.style.opacity = 0; });
    (s.play ?? []).forEach((pl) => { const dev = $('#' + pl.el, s.el); if (!dev) return;
      if (pl.ff && lt >= (pl.start ?? 0) + 0.3 && lt <= (pl.end ?? d) - 0.2) { const b = $('.ffb', dev); b.style.opacity = 0.75 + 0.25 * Math.abs(Math.sin(lt * 3)); } if (lt < (pl.start ?? 0) - 0.05 && pl.hideBefore) return; if (pl.end !== undefined && lt > pl.end) return; setClip(dev, pl.clip, lt, pl); });
    s.update?.(lt, d, s.el);
  }
  const showWm = cur && !cur.noWm;
  $('#wm').style.opacity = showWm ? 0.95 : 0; $('#chap').style.opacity = showWm ? 1 : 0;
  $('#chap').textContent = cur?.label ?? '';
  const cap = TL.caps.find((c) => t >= c.a && t < c.b); const capEl = $('#cap span');
  if (cap) { capEl.textContent = cap.text; capEl.parentElement.style.opacity = Math.min(P(t, cap.a, cap.a + 0.25), 1 - P(t, cap.b - 0.25, cap.b)); } else capEl.parentElement.style.opacity = 0;
  $('#black').style.opacity = Math.max(1 - P(t, 0, 0.8, E.lin), P(t, TL.total - 1.6, TL.total, E.lin));
  await Promise.all(PENDING);
}
window.render = render;
