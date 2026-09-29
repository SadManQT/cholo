(() => {
  'use strict';

  const COLORS = { idle: '#22d3ee', pickup: '#fbbf24', trip: '#f472b6', rider: '#f87171', heat: [167, 139, 250] };
  const STATE_GROUP = { i: 'idle', a: 'idle', p: 'pickup', w: 'pickup', t: 'trip' };
  // Road class 0 (expressway) .. 5 (residential).
  const ROAD_STYLE = [
    { w: 2.4, c: 'rgba(167,139,250,0.65)' },
    { w: 2.0, c: 'rgba(140,165,215,0.60)' },
    { w: 1.5, c: 'rgba(118,142,192,0.55)' },
    { w: 1.2, c: 'rgba(100,124,172,0.50)' },
    { w: 0.9, c: 'rgba(88,108,152,0.45)' },
    { w: 0.6, c: 'rgba(76,94,134,0.40)' },
  ];

  const $ = (id) => document.getElementById(id);
  const canvas = $('map');
  const ctx = canvas.getContext('2d');
  const chart = $('chart');
  const chartCtx = chart.getContext('2d');

  let init = null;
  let K = 1;
  let view = { cx: 0, cy: 0, scale: 1 };
  let home = null;
  let dpr = 1;
  let W = 0;
  let H = 0;
  let roads = [];
  let cells = [];
  let heat = null;
  let roadsLayer = null;
  let heatLayer = null;
  let roadsDirty = true;
  let heatDirty = true;
  let prev = null;
  let curr = null;
  let arrival = 0;
  let interval = 1000;
  let dispLat = null;
  let dispLng = null;
  let series = [];
  let lastSampleT = -Infinity;
  let paused = false;
  let ws = null;

  const layers = { heat: true, roads: true, idle: true, labels: true };

  // ------------------------------------------------------------------ geometry
  function toScreenX(lng) { return (lng * K - view.cx) * view.scale + W / 2; }
  function toScreenY(lat) { return (view.cy - lat) * view.scale + H / 2; }

  function fitBounds(b) {
    const [south, west, north, east] = b;
    const spanX = (east - west) * K;
    const spanY = north - south;
    const scale = Math.min(W / spanX, H / spanY) * 0.92;
    return { cx: ((east + west) / 2) * K, cy: (north + south) / 2, scale };
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    roadsLayer = makeLayer();
    heatLayer = makeLayer();
    roadsDirty = heatDirty = true;
    if (init && !home) {
      home = fitBounds(init.bounds);
      view = { ...home };
    }
    const cw = chart.clientWidth;
    chart.width = Math.round(cw * dpr);
    chart.height = Math.round(120 * dpr);
    drawChart();
  }

  function makeLayer() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    return c;
  }

  // ------------------------------------------------------------------ layers
  function renderRoads() {
    const g = roadsLayer.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, roadsLayer.width, roadsLayer.height);
    if (!layers.roads) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const zoomedOut = view.scale < (home ? home.scale * 1.6 : 0);
    for (let cls = roads.length - 1; cls >= 0; cls--) {
      const lines = roads[cls];
      if (!lines) continue;
      if (cls === 5 && zoomedOut && lines.length > 20000) continue;
      const style = ROAD_STYLE[cls] || ROAD_STYLE[5];
      g.strokeStyle = style.c;
      g.lineWidth = Math.max(0.5, style.w * Math.min(2.2, Math.sqrt(view.scale / (home ? home.scale : view.scale))));
      g.beginPath();
      for (const pts of lines) {
        g.moveTo(toScreenX(pts[1]), toScreenY(pts[0]));
        for (let i = 2; i < pts.length; i += 2) g.lineTo(toScreenX(pts[i + 1]), toScreenY(pts[i]));
      }
      g.stroke();
    }
  }

  function renderHeat() {
    const g = heatLayer.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, heatLayer.width, heatLayer.height);
    if (!layers.heat || !heat) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let max = 0;
    for (const v of heat) if (v > max) max = v;
    if (max <= 0) return;
    const [r, gg, b] = COLORS.heat;
    for (let i = 0; i < cells.length; i++) {
      const v = heat[i];
      if (!v) continue;
      const a = Math.sqrt(v / max) * 0.42;
      if (a < 0.02) continue;
      const ring = cells[i];
      g.beginPath();
      g.moveTo(toScreenX(ring[1]), toScreenY(ring[0]));
      for (let j = 2; j < ring.length; j += 2) g.lineTo(toScreenX(ring[j + 1]), toScreenY(ring[j]));
      g.closePath();
      g.fillStyle = `rgba(${r},${gg},${b},${a.toFixed(3)})`;
      g.fill();
    }
  }

  // ------------------------------------------------------------------ render loop
  function render(now) {
    requestAnimationFrame(render);
    if (!init) return;
    if (roadsDirty) { renderRoads(); roadsDirty = false; }
    if (heatDirty) { renderHeat(); heatDirty = false; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(heatLayer, 0, 0);
    ctx.drawImage(roadsLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (layers.labels) drawPlaces();
    if (!curr) return;

    const alpha = paused ? 1 : Math.min(1, Math.max(0, (now - arrival) / interval));
    const n = curr.lat.length;
    const size = Math.max(2, Math.min(6, 2 + Math.log2(view.scale / (home ? home.scale : view.scale) + 1)));
    const half = size / 2;
    for (const group of ['idle', 'pickup', 'trip']) {
      if (group === 'idle' && !layers.idle) continue;
      ctx.fillStyle = COLORS[group];
      for (let i = 0; i < n; i++) {
        const s = curr.s[i];
        if (STATE_GROUP[s] !== group) continue;
        let lat = curr.lat[i];
        let lng = curr.lng[i];
        if (prev && prev.s[i] !== 'o') {
          lat = prev.lat[i] + (lat - prev.lat[i]) * alpha;
          lng = prev.lng[i] + (lng - prev.lng[i]) * alpha;
        }
        dispLat[i] = lat;
        dispLng[i] = lng;
        const x = toScreenX(lng / 1e5);
        const y = toScreenY(lat / 1e5);
        if (x < -5 || y < -5 || x > W + 5 || y > H + 5) continue;
        ctx.fillRect(x - half, y - half, size, size);
      }
    }
    // Waiting riders pulse.
    const w = curr.w || [];
    const pulse = 3 + 2 * (0.5 + 0.5 * Math.sin(now / 300));
    ctx.strokeStyle = 'rgba(248,113,113,0.55)';
    ctx.fillStyle = COLORS.rider;
    ctx.lineWidth = 1;
    for (let i = 0; i < w.length; i += 2) {
      const x = toScreenX(w[i + 1] / 1e5);
      const y = toScreenY(w[i] / 1e5);
      if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlaces() {
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const placed = [];
    for (const p of init.places) {
      const x = toScreenX(p.lng);
      const y = toScreenY(p.lat);
      if (x < 0 || y < 0 || x > W || y > H) continue;
      const text = shortName(p.name);
      const box = { x0: x - 3, y0: y - 8, x1: x + 8 + ctx.measureText(text).width, y1: y + 8 };
      // Skip labels that would collide with one already drawn.
      if (placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      placed.push(box);
      ctx.fillStyle = 'rgba(230,236,245,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(7,11,20,0.75)';
      ctx.fillRect(x + 4, y - 7, box.x1 - x - 6, 14);
      ctx.fillStyle = 'rgba(214,222,236,0.9)';
      ctx.fillText(text, x + 6, y);
    }
  }

  function shortName(name) {
    return name.replace('Hazrat Shahjalal International ', '').replace(' National Cricket Stadium', ' Stadium');
  }

  // ------------------------------------------------------------------ panel
  function fmt(n) { return n == null ? '–' : Number(n).toLocaleString('en-US'); }

  function updatePanel(f) {
    const k = f.kpi || {};
    $('clock').textContent = f.clock ? f.clock.slice(11, 16) : '--:--';
    if (f.clock) {
      const date = f.clock.slice(0, 10);
      const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${date}T00:00:00Z`).getUTCDay()];
      $('day').textContent = `${wd}, ${date} · Dhaka time`;
    }
    $('k-online').textContent = fmt(k.online);
    $('k-idle').textContent = fmt(k.idle);
    $('k-pickup').textContent = fmt(k.to_pickup);
    $('k-trip').textContent = fmt(k.on_trip);
    $('k-waiting').textContent = fmt(k.waiting_riders);
    $('k-demand').textContent = fmt(k.demand_per_hour);
    $('k-completed').textContent = fmt(k.completed);
    const unserved = (k.cancelled || 0) + (k.expired || 0) + (k.failed || 0);
    $('k-unserved').textContent = fmt(unserved);
    const done = (k.completed || 0) + unserved;
    if (done > 0) {
      const rate = (k.completed || 0) / done;
      $('k-rate').textContent = `${(rate * 100).toFixed(1)}%`;
      $('k-rate-bar').style.width = `${rate * 100}%`;
    }
    if (k.speed_factor != null) {
      $('k-traffic').textContent = `${Math.round(k.speed_factor * 100)}%`;
      $('k-traffic-bar').style.width = `${Math.min(100, k.speed_factor * 100)}%`;
    }
    const chips = $('events');
    const labels = [...new Set(k.labels || [])];
    chips.replaceChildren(...(labels.length ? labels : ['Normal conditions']).map((text) => {
      const el = document.createElement('span');
      el.className = labels.length ? 'chip' : 'chip quiet';
      el.textContent = text;
      return el;
    }));
    if (k.sim_s != null && k.sim_s - lastSampleT >= 60) {
      lastSampleT = k.sim_s;
      series.push({ online: k.online || 0, busy: k.busy || 0, waiting: k.waiting_riders || 0 });
      if (series.length > 600) series.shift();
      drawChart();
    }
    if (f.paused !== undefined && f.paused !== paused) {
      paused = f.paused;
      $('pause').textContent = paused ? 'Resume' : 'Pause';
    }
    if (f.ended) $('mode').textContent = 'Replay finished';
  }

  function drawChart() {
    const g = chartCtx;
    const cw = chart.width / dpr;
    const ch = chart.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    if (series.length < 2) return;
    let max = 1;
    for (const s of series) max = Math.max(max, s.online, s.waiting);
    const pad = 8;
    const x = (i) => pad + (i / (series.length - 1)) * (cw - 2 * pad);
    const y = (v) => ch - pad - (v / max) * (ch - 2 * pad);
    for (const [key, color] of [['online', '#93c5fd'], ['busy', '#f472b6'], ['waiting', '#f87171']]) {
      g.strokeStyle = color;
      g.lineWidth = 1.6;
      g.beginPath();
      series.forEach((s, i) => (i ? g.lineTo(x(i), y(s[key])) : g.moveTo(x(i), y(s[key]))));
      g.stroke();
    }
    g.fillStyle = '#8a97ad';
    g.font = '10px ui-sans-serif, system-ui, sans-serif';
    g.fillText(fmt(max), pad, pad + 4);
  }

  // ------------------------------------------------------------------ data
  function toArrays(f) {
    return { lat: Float64Array.from(f.lat), lng: Float64Array.from(f.lng), s: f.s, w: f.w };
  }

  function onFrame(f) {
    const now = performance.now();
    const next = toArrays(f);
    if (!curr) {
      prev = null;
      dispLat = Float64Array.from(next.lat);
      dispLng = Float64Array.from(next.lng);
    } else {
      prev = { lat: Float64Array.from(dispLat), lng: Float64Array.from(dispLng), s: curr.s };
      const gap = now - arrival;
      interval = Math.min(12000, Math.max(120, interval * 0.7 + gap * 0.3));
    }
    curr = next;
    arrival = now;
    if (f.heat) { heat = f.heat; heatDirty = true; }
    updatePanel(f);
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onmessage = (msg) => onFrame(JSON.parse(msg.data));
    ws.onclose = () => { $('mode').textContent = 'Disconnected, retrying…'; setTimeout(connect, 2000); };
    ws.onopen = () => { $('mode').textContent = modeLabel(); };
  }

  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

  function modeLabel() {
    if (!init) return '';
    const policy = init.backend && init.backend.policy ? ` · dispatch ${init.backend.policy}` : '';
    if (init.mode === 'live') return 'Live · Cholo API and sockets';
    if (init.mode === 'replay') return `Replay${policy}`;
    return `Simulation${policy}`;
  }

  async function boot() {
    const res = await fetch('/api/init');
    init = await res.json();
    const [south, , north] = init.bounds;
    K = Math.cos(((south + north) / 2) * Math.PI / 180);
    roads = [];
    for (const [cls, lines] of Object.entries(init.roads)) {
      roads[Number(cls)] = lines.map((flat) => {
        const out = new Float64Array(flat.length);
        for (let i = 0; i < flat.length; i++) out[i] = flat[i] / 1e5;
        return out;
      });
    }
    cells = init.cells.map((flat) => Float64Array.from(flat, (v) => v / 1e5));
    series = (init.series || []).map((p) => ({ online: p.online, busy: p.busy, waiting: p.waiting }));
    if (init.series && init.series.length) lastSampleT = init.series[init.series.length - 1].sim_s;
    const sc = init.scenario || {};
    $('scenario').textContent = `${sc.name || ''}${sc.description ? ' · ' + sc.description : ''}`;
    $('mode').textContent = modeLabel();
    const drivers = init.drivers ? init.drivers.length : 0;
    $('footer').textContent = `${drivers.toLocaleString('en-US')} drivers · road graph: ${init.label || 'Dhaka'} · seed ${sc.seed ?? '–'}`;
    const speedSel = $('speed');
    if (init.speed) {
      const v = String(init.speed);
      if (![...speedSel.options].some((o) => o.value === v)) speedSel.add(new Option(`${v}×`, v));
      speedSel.value = v;
    }
    speedSel.disabled = init.mode === 'live';
    home = null;
    resize();
    connect();
    requestAnimationFrame(render);
  }

  // ------------------------------------------------------------------ interaction
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view.cx = drag.cx - (e.clientX - drag.x) / view.scale;
    view.cy = drag.cy + (e.clientY - drag.y) / view.scale;
    roadsDirty = heatDirty = true;
  });
  const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - W / 2) / view.scale + view.cx;
    const wy = view.cy - (my - H / 2) / view.scale;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const min = home ? home.scale * 0.5 : 1;
    const max = home ? home.scale * 40 : 1e9;
    view.scale = Math.min(max, Math.max(min, view.scale * factor));
    view.cx = wx - (mx - W / 2) / view.scale;
    view.cy = wy + (my - H / 2) / view.scale;
    roadsDirty = heatDirty = true;
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (home) { view = { ...home }; roadsDirty = heatDirty = true; } });
  window.addEventListener('resize', resize);

  $('pause').addEventListener('click', () => {
    paused = !paused;
    $('pause').textContent = paused ? 'Resume' : 'Pause';
    send({ cmd: paused ? 'pause' : 'resume' });
  });
  $('speed').addEventListener('change', (e) => send({ cmd: 'speed', value: e.target.value }));
  for (const [id, key] of [['l-heat', 'heat'], ['l-roads', 'roads'], ['l-idle', 'idle'], ['l-labels', 'labels']]) {
    $(id).addEventListener('change', (e) => { layers[key] = e.target.checked; roadsDirty = heatDirty = true; });
  }

  boot().catch((err) => { $('mode').textContent = `Failed to load: ${err.message}`; });
})();
