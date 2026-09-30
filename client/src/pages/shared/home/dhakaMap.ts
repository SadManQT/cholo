// A stylised, tilted night map of a Dhaka-like city: street grid, arterials, river, lake, parks and
// low extruded blocks. Every feature simulation draws on top of it with its own camera.

export const GRID = 8;
const RADIUS = 120;
const DISTANCE = 150;

export interface Camera {
  anchorX: number;
  anchorY: number;
  focusX: number;
  focusY: number;
  yaw: number;
  pitch: number;
  zoom: number;
}

// Projection output, reused to avoid allocating on every call.
export const P = { x: 0, y: 0, k: 1 };

export function project(camera: Camera, x: number, y: number, height = 0): boolean {
  const dx = x - camera.focusX;
  const dy = y - camera.focusY;
  const cos = Math.cos(camera.yaw);
  const sin = Math.sin(camera.yaw);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  const sp = Math.sin(camera.pitch);
  const cp = Math.cos(camera.pitch);
  const depth = DISTANCE + ry * sp - height * cp;
  if (depth < 12) return false;
  const scale = (camera.zoom * DISTANCE) / depth;
  P.x = camera.anchorX + rx * scale;
  P.y = camera.anchorY - (ry * cp + height * sp) * scale;
  P.k = scale;
  return true;
}

function depthOf(camera: Camera, x: number, y: number) {
  const dx = x - camera.focusX;
  const dy = y - camera.focusY;
  return DISTANCE + (dx * Math.sin(camera.yaw) + dy * Math.cos(camera.yaw)) * Math.sin(camera.pitch);
}

export function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = [number, number];

interface Block {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  height: number;
  depth: number;
}

function inside(polygon: Point[], x: number, y: number) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result;
  }
  return result;
}

function build() {
  const next = random(20260930);
  const river: Point[] = [];
  for (let x = -RADIUS - 10; x <= RADIUS + 10; x += 5) river.push([x, -62 + 6 * Math.sin(x / 18) + 3 * Math.sin(x / 7)]);
  river.push([RADIUS + 10, -RADIUS - 20], [-RADIUS - 10, -RADIUS - 20]);

  const lake: Point[] = [];
  for (let step = 0; step < 36; step += 1) {
    const angle = (step / 36) * Math.PI * 2;
    const wobble = 1 + 0.18 * Math.sin(angle * 3) + 0.08 * Math.sin(angle * 7);
    const lx = Math.cos(angle) * 15 * wobble;
    const ly = Math.sin(angle) * 4.5 * wobble;
    lake.push([40 + lx * 0.87 - ly * 0.5, 22 + lx * 0.5 + ly * 0.87]);
  }
  const parks: Point[][] = [
    [[-36, 26], [-22, 27], [-21, 38], [-35, 39]],
    [[-12, -26], [2, -27], [3, -18], [-11, -17]],
  ];
  const water = [river, lake];
  const blocked = (x: number, y: number) => water.some((polygon) => inside(polygon, x, y));

  const minor: number[] = [];
  for (let line = -RADIUS; line <= RADIUS; line += GRID) {
    for (let start = -RADIUS; start < RADIUS; start += GRID) {
      const end = start + GRID;
      const middle = start + GRID / 2;
      if (next() < 0.74 && !blocked(line, middle)) minor.push(line, start, line, end);
      if (next() < 0.74 && !blocked(middle, line)) minor.push(start, line, end, line);
    }
  }

  const arterials: Point[][] = [];
  const along = (fn: (t: number) => Point) => {
    const points: Point[] = [];
    for (let t = -RADIUS; t <= RADIUS; t += 4) {
      const [x, y] = fn(t);
      if (!blocked(x, y)) points.push([x, y]);
      else if (points.length) {
        arterials.push(points.splice(0));
      }
    }
    if (points.length > 1) arterials.push(points);
  };
  along((t) => [4 + 9 * Math.sin(t / 34), t]);
  along((t) => [t, 12 + 7 * Math.sin(t / 28)]);
  along((t) => [t, -44 + (t + 88) * 0.53 + 6 * Math.sin(t / 20)]);
  along((t) => [t, -38 + 4 * Math.sin(t / 16)]);
  along((t) => [-44 + 6 * Math.sin(t / 22), t]);

  const blocks: Block[] = [];
  for (let gx = -64; gx < 64; gx += GRID) {
    for (let gy = -56; gy < 64; gy += GRID) {
      const cx = gx + GRID / 2;
      const cy = gy + GRID / 2;
      const distance = Math.hypot(cx, cy);
      if (distance > 64 || blocked(cx, cy) || parks.some((park) => inside(park, cx, cy)) || next() < 0.35) continue;
      const tall = Math.max(0, 1 - distance / 64);
      const split = next() < 0.4;
      const parts = split ? [[gx + 1.3, gx + 3.8], [gx + 4.3, gx + 6.7]] : [[gx + 1.3, gx + 6.7]];
      for (const [x0, x1] of parts) {
        blocks.push({
          x0,
          x1,
          y0: gy + 1.3 + next() * 0.8,
          y1: gy + 6.7 - next() * 0.8,
          height: 0.6 + next() * next() * 7 * tall + tall * 1.5,
          depth: 0,
        });
      }
    }
  }
  return { water, parks, minor, arterials, blocks };
}

const MAP = build();

function fillPolygon(context: CanvasRenderingContext2D, camera: Camera, polygon: Point[]) {
  context.beginPath();
  let started = false;
  for (const [x, y] of polygon) {
    if (!project(camera, x, y)) continue;
    if (started) context.lineTo(P.x, P.y);
    else context.moveTo(P.x, P.y);
    started = true;
  }
  context.closePath();
  context.fill();
}

const corners = new Float64Array(16);

export function drawMap(context: CanvasRenderingContext2D, camera: Camera, width: number, height: number) {
  context.fillStyle = '#060a09';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#0a2029';
  for (const polygon of MAP.water) fillPolygon(context, camera, polygon);
  context.fillStyle = '#0b1c16';
  for (const polygon of MAP.parks) fillPolygon(context, camera, polygon);

  const roadScale = Math.min(1.6, Math.max(0.6, camera.zoom / 10));
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(150,185,170,0.13)';
  context.lineWidth = roadScale;
  context.beginPath();
  const minor = MAP.minor;
  for (let index = 0; index < minor.length; index += 4) {
    if (!project(camera, minor[index], minor[index + 1])) continue;
    const x = P.x;
    const y = P.y;
    if (!project(camera, minor[index + 2], minor[index + 3])) continue;
    context.moveTo(x, y);
    context.lineTo(P.x, P.y);
  }
  context.stroke();

  context.strokeStyle = 'rgba(170,205,190,0.24)';
  context.lineWidth = roadScale * 2.4;
  context.beginPath();
  for (const line of MAP.arterials) {
    let started = false;
    for (const [x, y] of line) {
      if (!project(camera, x, y)) continue;
      if (started) context.lineTo(P.x, P.y);
      else context.moveTo(P.x, P.y);
      started = true;
    }
  }
  context.stroke();

  drawBlocks(context, camera);

  // Fade the far edge of the map into the night.
  const fog = context.createLinearGradient(0, 0, 0, height * 0.42);
  fog.addColorStop(0, 'rgba(6,10,9,0.96)');
  fog.addColorStop(1, 'rgba(6,10,9,0)');
  context.fillStyle = fog;
  context.fillRect(0, 0, width, height * 0.42);
}

function drawBlocks(context: CanvasRenderingContext2D, camera: Camera) {
  const blocks = MAP.blocks;
  for (const block of blocks) block.depth = depthOf(camera, (block.x0 + block.x1) / 2, (block.y0 + block.y1) / 2);
  blocks.sort((a, b) => b.depth - a.depth);
  const light = [0.13, 0.1, 0.075, 0.09];
  for (const block of blocks) {
    const xs = [block.x0, block.x1, block.x1, block.x0];
    const ys = [block.y0, block.y0, block.y1, block.y1];
    let visible = true;
    for (let corner = 0; corner < 4 && visible; corner += 1) {
      visible = project(camera, xs[corner], ys[corner]);
      corners[corner * 2] = P.x;
      corners[corner * 2 + 1] = P.y;
      visible = visible && project(camera, xs[corner], ys[corner], block.height);
      corners[8 + corner * 2] = P.x;
      corners[8 + corner * 2 + 1] = P.y;
    }
    if (!visible) continue;
    for (let side = 0; side < 4; side += 1) {
      const a = side * 2;
      const b = ((side + 1) % 4) * 2;
      const area = (corners[b] - corners[a]) * (corners[8 + b + 1] - corners[a + 1]) - (corners[8 + b] - corners[a]) * (corners[b + 1] - corners[a + 1]);
      if (area >= 0) continue;
      context.fillStyle = `rgba(120,160,145,${light[side]})`;
      context.beginPath();
      context.moveTo(corners[a], corners[a + 1]);
      context.lineTo(corners[b], corners[b + 1]);
      context.lineTo(corners[8 + b], corners[8 + b + 1]);
      context.lineTo(corners[8 + a], corners[8 + a + 1]);
      context.closePath();
      context.fill();
    }
    context.fillStyle = 'rgba(140,180,165,0.16)';
    context.beginPath();
    context.moveTo(corners[8], corners[9]);
    context.lineTo(corners[10], corners[11]);
    context.lineTo(corners[12], corners[13]);
    context.lineTo(corners[14], corners[15]);
    context.closePath();
    context.fill();
  }
}
