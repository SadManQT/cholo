// One small simulation per Cholo feature, drawn over the shared Dhaka map.
// framing: 0 = tight shot framed in the portal window, 1 = wide background shot. The two are
// continuous, so a portal that grows to fill the screen hands over to the background seamlessly.
import { t } from '../../../i18n';
import { GRID, P, drawMap, project, random } from './dhakaMap';
import type { Camera } from './dhakaMap';

type Point = [number, number];

export interface PortalFrame {
  x: number;
  y: number;
  width: number;
}

const GOLD = '#FBBF2E';
const GREEN = '#3DDC97';
const RED = '#FF5A4A';
const WATER = '#3AA8E0';
const FONT = '600 12px Inter, "Noto Sans Bengali", sans-serif';

const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);

const sprites = new Map<string, HTMLCanvasElement>();
function glow(color: string) {
  let sprite = sprites.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const context = sprite.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, `${color}66`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  sprites.set(color, sprite);
  return sprite;
}

class Route {
  readonly points: Point[];
  readonly lengths: number[] = [0];
  readonly total: number;

  constructor(points: Point[]) {
    this.points = points;
    for (let index = 1; index < points.length; index += 1) {
      const [ax, ay] = points[index - 1];
      const [bx, by] = points[index];
      this.lengths.push(this.lengths[index - 1] + Math.hypot(bx - ax, by - ay));
    }
    this.total = this.lengths[this.lengths.length - 1];
  }

  at(distance: number): [number, number, number] {
    const d = Math.min(this.total, Math.max(0, distance));
    let index = 1;
    while (index < this.lengths.length - 1 && this.lengths[index] < d) index += 1;
    const [ax, ay] = this.points[index - 1];
    const [bx, by] = this.points[index];
    const span = this.lengths[index] - this.lengths[index - 1] || 1;
    const amount = (d - this.lengths[index - 1]) / span;
    return [lerp(ax, bx, amount), lerp(ay, by, amount), Math.atan2(by - ay, bx - ax)];
  }

  trace(context: CanvasRenderingContext2D, camera: Camera, from: number, to: number, height = 0) {
    if (to <= from) return;
    context.beginPath();
    const [sx, sy] = this.at(from);
    project(camera, sx, sy, height);
    context.moveTo(P.x, P.y);
    for (let index = 1; index < this.points.length; index += 1) {
      if (this.lengths[index] <= from) continue;
      if (this.lengths[index] >= to) break;
      project(camera, this.points[index][0], this.points[index][1], height);
      context.lineTo(P.x, P.y);
    }
    const [ex, ey] = this.at(to);
    project(camera, ex, ey, height);
    context.lineTo(P.x, P.y);
  }

  stroke(context: CanvasRenderingContext2D, camera: Camera, from: number, to: number, color: string, width: number, alpha = 1) {
    context.globalAlpha = alpha * 0.28;
    context.strokeStyle = color;
    context.lineWidth = width * 3.2;
    this.trace(context, camera, from, to);
    context.stroke();
    context.globalAlpha = alpha;
    context.lineWidth = width;
    this.trace(context, camera, from, to);
    context.stroke();
    context.globalAlpha = 1;
  }
}

class Agent {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  toNode = GRID;
  private readonly next: () => number;
  private readonly bound: number;
  private readonly centerX: number;
  private readonly centerY: number;

  constructor(next: () => number, bound: number, centerX = 0, centerY = 0) {
    this.next = next;
    this.bound = bound;
    this.centerX = centerX;
    this.centerY = centerY;
    this.x = centerX + Math.round((next() * 2 - 1) * (bound / GRID)) * GRID;
    this.y = centerY + Math.round((next() * 2 - 1) * (bound / GRID)) * GRID;
    const horizontal = next() < 0.5;
    const sign = next() < 0.5 ? -1 : 1;
    this.dx = horizontal ? sign : 0;
    this.dy = horizontal ? 0 : sign;
    this.speed = 4 + next() * 7;
  }

  step(dt: number) {
    let travel = this.speed * dt;
    while (travel > 0) {
      const move = Math.min(travel, this.toNode);
      this.x += this.dx * move;
      this.y += this.dy * move;
      this.toNode -= move;
      travel -= move;
      if (this.toNode <= 0) {
        this.toNode = GRID;
        this.turn();
      }
    }
  }

  private turn() {
    const outX = Math.abs(this.x - this.centerX) >= this.bound;
    const outY = Math.abs(this.y - this.centerY) >= this.bound;
    if (outX) { this.dx = this.x > this.centerX ? -1 : 1; this.dy = 0; return; }
    if (outY) { this.dy = this.y > this.centerY ? -1 : 1; this.dx = 0; return; }
    const roll = this.next();
    if (roll < 0.22) { [this.dx, this.dy] = [-this.dy, this.dx]; }
    else if (roll < 0.44) { [this.dx, this.dy] = [this.dy, -this.dx]; }
  }
}

// Marker size follows the zoom at the last projected point.
function markerScale() {
  return Math.min(1.5, Math.max(0.75, P.k / 9));
}

function drawRing(context: CanvasRenderingContext2D, camera: Camera, x: number, y: number, color = GOLD) {
  if (!project(camera, x, y)) return;
  const size = 7 * markerScale();
  context.fillStyle = color;
  context.beginPath();
  context.arc(P.x, P.y, size, 0, Math.PI * 2);
  context.arc(P.x, P.y, size * 0.44, 0, Math.PI * 2, true);
  context.fill();
}

function drawPin(context: CanvasRenderingContext2D, camera: Camera, x: number, y: number, color = GOLD, drop = 1) {
  if (!project(camera, x, y)) return;
  const size = 9 * markerScale();
  const lift = (1 - drop) * 30;
  const tipX = P.x;
  const tipY = P.y - lift;
  context.globalAlpha = drop;
  context.drawImage(glow(color), P.x - size * 1.6, P.y - size * 0.8, size * 3.2, size * 1.6);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(tipX, tipY);
  context.bezierCurveTo(tipX - size * 0.25, tipY - size * 0.6, tipX - size, tipY - size * 1.2, tipX - size, tipY - size * 2);
  context.arc(tipX, tipY - size * 2, size, Math.PI, 0);
  context.bezierCurveTo(tipX + size, tipY - size * 1.2, tipX + size * 0.25, tipY - size * 0.6, tipX, tipY);
  context.fill();
  context.fillStyle = '#0a0f0d';
  context.beginPath();
  context.arc(tipX, tipY - size * 2, size * 0.38, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawCar(context: CanvasRenderingContext2D, camera: Camera, x: number, y: number, angle: number, color = '#ffffff', alpha = 1) {
  if (!project(camera, x + Math.cos(angle), y + Math.sin(angle))) return;
  const aheadX = P.x;
  const aheadY = P.y;
  if (!project(camera, x, y)) return;
  const heading = Math.atan2(aheadY - P.y, aheadX - P.x);
  const size = 6 * markerScale();
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(glow(color), P.x - size * 3, P.y - size * 3, size * 6, size * 6);
  context.translate(P.x, P.y);
  context.rotate(heading);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(size * 1.3, 0);
  context.lineTo(-size * 0.9, size * 0.85);
  context.lineTo(-size * 0.45, 0);
  context.lineTo(-size * 0.9, -size * 0.85);
  context.closePath();
  context.fill();
  context.restore();
}

function drawDot(context: CanvasRenderingContext2D, camera: Camera, x: number, y: number, color: string, radius = 2.4) {
  if (!project(camera, x, y)) return;
  context.fillStyle = color;
  context.beginPath();
  context.arc(P.x, P.y, radius, 0, Math.PI * 2);
  context.fill();
}

function pulse(context: CanvasRenderingContext2D, camera: Camera, x: number, y: number, radius: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  context.strokeStyle = color;
  context.globalAlpha = alpha;
  context.lineWidth = 1.5;
  context.beginPath();
  for (let step = 0; step <= 40; step += 1) {
    const angle = (step / 40) * Math.PI * 2;
    if (!project(camera, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) continue;
    if (step === 0) context.moveTo(P.x, P.y);
    else context.lineTo(P.x, P.y);
  }
  context.stroke();
  context.globalAlpha = 1;
}

function label(context: CanvasRenderingContext2D, camera: Camera, x: number, y: number, text: string, options: { color?: string; offset?: number; alpha?: number } = {}) {
  if (!project(camera, x, y)) return;
  const { color = '#ffffff', offset = 26, alpha = 1 } = options;
  context.globalAlpha = alpha;
  context.font = FONT;
  const width = context.measureText(text).width + 16;
  const left = P.x - width / 2;
  const top = P.y - offset - 22;
  context.fillStyle = 'rgba(8,12,11,0.82)';
  context.strokeStyle = 'rgba(255,255,255,0.14)';
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(left, top, width, 22, 11);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, P.x, top + 11.5);
  context.globalAlpha = 1;
}

function arc(context: CanvasRenderingContext2D, camera: Camera, from: Point, to: Point, lift: number, color: string, width: number, progress = 1) {
  if (!project(camera, from[0], from[1])) return;
  const ax = P.x;
  const ay = P.y;
  if (!project(camera, to[0], to[1])) return;
  const bx = P.x;
  const by = P.y;
  const cx = (ax + bx) / 2;
  const cy = Math.min(ay, by) - lift;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(ax, ay);
  for (let step = 1; step <= 24; step += 1) {
    const u = (step / 24) * progress;
    context.lineTo((1 - u) ** 2 * ax + 2 * (1 - u) * u * cx + u * u * bx, (1 - u) ** 2 * ay + 2 * (1 - u) * u * cy + u * u * by);
  }
  context.stroke();
  return (u: number): [number, number] => [(1 - u) ** 2 * ax + 2 * (1 - u) * u * cx + u * u * bx, (1 - u) ** 2 * ay + 2 * (1 - u) * u * cy + u * u * by];
}

abstract class FeatureScene {
  time = 0;
  protected abstract readonly focus: Point;
  protected yaw = 0.35;
  protected pitch = 0.95;
  protected tightUnits = 26;
  protected wideZoom = 1;

  update(dtMs: number) {
    const dt = dtMs / 1000;
    this.time += dt;
    this.tick(dt);
  }

  protected tick(dt: number) {
    void dt;
  }

  draw(context: CanvasRenderingContext2D, width: number, height: number, framing: number, portal: PortalFrame) {
    const wide = width > 900;
    const anchorX = wide ? width * 0.72 : width * 0.5;
    const anchorY = wide ? height * 0.44 : height * 0.52;
    const camera: Camera = {
      anchorX: lerp(portal.x, anchorX, framing),
      anchorY: lerp(portal.y, anchorY, framing),
      focusX: this.focus[0],
      focusY: this.focus[1],
      yaw: this.yaw + 0.22 * Math.sin(this.time * 0.05),
      pitch: this.pitch,
      zoom: lerp(portal.width / this.tightUnits, (Math.min(width, height) / 88) * this.wideZoom, framing),
    };
    drawMap(context, camera, width, height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    this.overlay(context, camera, width, height);
  }

  protected abstract overlay(context: CanvasRenderingContext2D, camera: Camera, width: number, height: number): void;
}

// One trip carried through the ride steps: the rider waits at PICKUP and is going to DEST (Banani).
const PICKUP: Point = [-24, -16];
const DEST: Point = [32, 32];
const TRIP: Point[] = [[-24, -16], [-24, 0], [0, 0], [0, 16], [16, 16], [16, 32], [32, 32]];
const APPROACH: Point[] = [[-56, -40], [-56, -24], [-40, -24], [-40, -16], [-24, -16]];
const PINK = '#F472B6';

class BookScene extends FeatureScene {
  protected readonly focus: Point = [4, 8];
  private readonly route = new Route(TRIP);
  private readonly phrase = 'বনানী নিয়ে চলো';

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const local = this.time % 11;
    const [rx, ry] = PICKUP;
    if (local < 2.8 && project(camera, rx, ry)) {
      const cx = P.x;
      const cy = P.y;
      context.strokeStyle = GOLD;
      context.lineWidth = 2;
      context.globalAlpha = 0.85 * (local < 2.4 ? 1 : 1 - (local - 2.4) / 0.4);
      context.beginPath();
      for (let bar = 0; bar < 36; bar += 1) {
        const angle = (bar / 36) * Math.PI * 2;
        const level = 0.3 + 0.7 * Math.abs(Math.sin(this.time * 9 + bar * 1.7) * Math.sin(this.time * 3.1 + bar * 0.6));
        context.moveTo(cx + Math.cos(angle) * 20, cy + Math.sin(angle) * 20);
        context.lineTo(cx + Math.cos(angle) * (20 + level * 16), cy + Math.sin(angle) * (20 + level * 16));
      }
      context.stroke();
      context.globalAlpha = 1;
    }
    const typed = this.phrase.slice(0, Math.floor(clamp01((local - 0.2) / 2) * this.phrase.length));
    if (typed && local < 4.4) label(context, camera, rx, ry, `“${typed}”`, { offset: 44, alpha: local > 3.8 ? 1 - (local - 3.8) / 0.6 : 1 });
    drawRing(context, camera, rx, ry);

    const draw = clamp01((local - 3) / 1.4) * this.route.total;
    this.route.stroke(context, camera, 0, draw, GOLD, 3.5);
    const [dx, dy] = DEST;
    if (local > 2.6) {
      drawPin(context, camera, dx, dy, GOLD, clamp01((local - 2.6) / 0.4));
      label(context, camera, dx, dy, t('Banani'), { offset: 44, alpha: clamp01((local - 2.8) / 0.4) });
    }
    const fares: Array<[string, number]> = [[t('Bike'), 95], [t('CNG'), 130], [t('Car'), 205]];
    const [mx, my] = this.route.at(this.route.total * 0.45);
    fares.forEach(([name, fare], index) => {
      const appear = clamp01((local - 4.6 - index * 0.3) / 0.4);
      const chosen = index === 0 && local > 7;
      if (appear <= 0) return;
      label(context, camera, mx, my, `${name}  ৳${fare}${chosen ? '  ✓' : ''}`, {
        offset: 24 + index * 28,
        color: chosen ? GOLD : '#ffffff',
        alpha: appear * (local > 7 && !chosen ? 0.35 : 1) * (local > 10.4 ? 1 - (local - 10.4) / 0.6 : 1),
      });
    });
  }
}

class MatchScene extends FeatureScene {
  protected readonly focus: Point = PICKUP;
  protected yaw = -0.4;
  private readonly next = random(7);
  private readonly drivers: Array<Agent & { female: boolean }> = [];
  private chosen = -1;
  private path: Route | null = null;
  private cycle = -1;
  private readonly womenOnly: boolean;

  constructor(womenOnly: boolean) {
    super();
    this.womenOnly = womenOnly;
    if (womenOnly) this.yaw = 0.5;
    for (let index = 0; index < 16; index += 1) {
      this.drivers.push(Object.assign(new Agent(this.next, 40, PICKUP[0], PICKUP[1]), { female: index % 3 === 0 }));
    }
  }

  private eligible(index: number) {
    return !this.womenOnly || this.drivers[index].female;
  }

  protected tick(dt: number) {
    const cycle = Math.floor(this.time / 8);
    if (cycle !== this.cycle) {
      this.cycle = cycle;
      this.chosen = -1;
      this.path = null;
    }
    const local = this.time % 8;
    if (local > 2.8 && this.chosen < 0) {
      let best = Infinity;
      this.drivers.forEach((driver, index) => {
        if (!this.eligible(index)) return;
        const distance = Math.abs(driver.x - PICKUP[0]) + Math.abs(driver.y - PICKUP[1]);
        if (distance < best) { best = distance; this.chosen = index; }
      });
      const driver = this.drivers[this.chosen];
      const start: Point = [Math.round(driver.x / GRID) * GRID, Math.round(driver.y / GRID) * GRID];
      this.path = new Route([[driver.x, driver.y], start, [PICKUP[0], start[1]], PICKUP]);
    }
    this.drivers.forEach((driver, index) => { if (index !== this.chosen) driver.step(dt); });
  }

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const local = this.time % 8;
    const [rx, ry] = PICKUP;
    const accent = this.womenOnly ? PINK : GOLD;
    if (local < 1.6) {
      for (let ring = 0; ring < 3; ring += 1) {
        const phase = clamp01(local / 1.6 - ring * 0.2);
        pulse(context, camera, rx, ry, phase * 30, accent, (1 - phase) * 0.8);
      }
    }
    const offers = clamp01((local - 1.4) / 1.2);
    const fade = local > 2.8 ? clamp01(1 - (local - 2.8) / 0.6) : 1;
    this.drivers.forEach((driver, index) => {
      if (index === this.chosen) return;
      const inRange = Math.hypot(driver.x - rx, driver.y - ry) < 30 && this.eligible(index);
      if (offers > 0 && inRange) {
        context.globalAlpha = 0.55 * fade;
        context.strokeStyle = this.womenOnly ? PINK : '#ffffff';
        context.lineWidth = 1;
        context.beginPath();
        project(camera, rx, ry);
        context.moveTo(P.x, P.y);
        project(camera, lerp(rx, driver.x, offers), lerp(ry, driver.y, offers));
        context.lineTo(P.x, P.y);
        context.stroke();
        context.globalAlpha = 1;
      }
      const color = this.womenOnly && driver.female ? PINK : '#ffffff';
      const alpha = this.womenOnly && !driver.female ? 0.22 : inRange && offers > 0 ? 1 : 0.55;
      drawCar(context, camera, driver.x, driver.y, Math.atan2(driver.dy, driver.dx), color, alpha);
    });
    if (this.path && this.chosen >= 0) {
      const distance = ease(clamp01((local - 3.2) / 3.6)) * this.path.total;
      this.path.stroke(context, camera, distance, this.path.total, accent, 3.5);
      const [x, y, angle] = this.path.at(distance);
      drawCar(context, camera, x, y, angle, accent);
      if (local > 3 && local < 5.2) {
        label(context, camera, x, y, this.womenOnly ? t('A woman driver accepted') : t('Offer accepted'), { color: accent });
      }
    }
    drawPin(context, camera, rx, ry, accent);
    if (this.womenOnly) label(context, camera, rx, ry, t('Women-only ride'), { color: PINK, offset: 40 });
  }
}

class ArriveScene extends FeatureScene {
  protected readonly focus: Point = [-38, -24];
  protected yaw = 0.2;
  private readonly route = new Route(APPROACH);

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const drive = this.route.total / 9;
    const local = this.time % (drive + 3);
    const travelled = Math.min(this.route.total, local * 9);
    const [px, py] = PICKUP;
    const [x, y, angle] = this.route.at(travelled);
    const inside = Math.hypot(x - px, y - py) <= 6;
    context.setLineDash([4, 5]);
    pulse(context, camera, px, py, 6, inside ? GREEN : '#ffffff', inside ? 0.9 : 0.5);
    context.setLineDash([]);
    label(context, camera, px - 6, py, t('300 m'), { offset: 6, alpha: 0.8 });
    this.route.stroke(context, camera, travelled, this.route.total, GREEN, 3);
    drawPin(context, camera, px, py);
    drawCar(context, camera, x, y, angle, GREEN);
    const minutes = Math.max(1, Math.ceil((this.route.total - travelled) / 14));
    label(context, camera, x, y, inside ? t('Your driver has arrived') : t('{0} min away', minutes), { color: GREEN });
  }
}

class BoardScene extends FeatureScene {
  protected readonly focus: Point = [-24, -8];
  protected yaw = -0.3;
  private readonly route = new Route(TRIP);
  private readonly walk = new Route([[-32, -22], [-26, -18], PICKUP]);

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const local = this.time % 9.5;
    const departed = local > 5 ? ease(clamp01((local - 5) / 4)) * 32 : 0;
    this.route.stroke(context, camera, departed, this.route.total, GOLD, 3, 0.45);
    drawPin(context, camera, ...DEST);
    const walked = clamp01(local / 1.8);
    if (walked < 1) {
      const [wx, wy] = this.walk.at(walked * this.walk.total);
      drawDot(context, camera, wx, wy, GOLD, 4);
    }
    const [x, y, angle] = this.route.at(departed);
    drawCar(context, camera, x, y, angle, walked >= 1 ? GOLD : GREEN);
    const steps: Array<[number, string, string]> = [
      [2, t('Driver taps “Start trip”'), '#ffffff'],
      [3, t('You confirm you’re in the car ✓'), GREEN],
      [4.2, t('Trip started'), GOLD],
    ];
    steps.forEach(([at, text, color], index) => {
      if (local < at || local > 8.8) return;
      label(context, camera, x, y, text, { color, offset: 24 + index * 28, alpha: clamp01((local - at) / 0.3) });
    });
  }
}

class RideScene extends FeatureScene {
  protected readonly focus: Point = [4, 8];
  protected yaw = -0.15;
  private readonly route = new Route(TRIP);
  private readonly family: Point = [-36, 24];
  private readonly team: Point = [30, 0];

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const cycle = this.route.total / 10;
    const travelled = (this.time * 10) % this.route.total;
    context.globalAlpha = 0.12;
    context.strokeStyle = GREEN;
    context.lineWidth = Math.max(8, camera.zoom * 2.2);
    this.route.trace(context, camera, 0, this.route.total);
    context.stroke();
    context.globalAlpha = 1;
    this.route.stroke(context, camera, travelled, this.route.total, GREEN, 2.5, 0.85);
    drawPin(context, camera, ...DEST, GREEN);
    const [x, y, angle] = this.route.at(travelled);

    const share = arc(context, camera, [x, y], this.family, 60, 'rgba(255,255,255,0.35)', 1.2);
    if (share) {
      const [px, py] = share((this.time * 0.8) % 1);
      context.drawImage(glow('#ffffff'), px - 6, py - 6, 12, 12);
    }
    drawDot(context, camera, ...this.family, '#ffffff', 4);
    label(context, camera, ...this.family, t('Family, following live'), { offset: 14 });

    const sos = (this.time % cycle) / cycle;
    const alerting = sos > 0.45 && sos < 0.75;
    drawDot(context, camera, ...this.team, alerting ? RED : 'rgba(255,255,255,0.6)', 4);
    label(context, camera, ...this.team, t('Cholo safety team'), { offset: 14, color: alerting ? RED : '#ffffff' });
    if (alerting) {
      const local = (sos - 0.45) / 0.3;
      for (let ring = 0; ring < 3; ring += 1) {
        const phase = (local * 2 + ring / 3) % 1;
        pulse(context, camera, x, y, phase * 9, RED, 1 - phase);
      }
      arc(context, camera, [x, y], this.team, 80, RED, 2, clamp01(local * 2.5));
      label(context, camera, x, y, 'SOS', { color: RED });
    }
    drawCar(context, camera, x, y, angle, alerting ? RED : GREEN);
  }
}

class DetourScene extends FeatureScene {
  protected readonly focus: Point = [4, 8];
  protected yaw = 0.25;
  private readonly oldRoute = new Route(TRIP);
  private readonly newRoute = new Route([[-24, -16], [-24, 0], [0, 0], [16, 0], [16, 16], [16, 32], [32, 32]]);
  private readonly puddles: Array<[number, number, number]> = [[0, 8, 5.5], [8, 16, 4.5]];
  private readonly drops: Array<[number, number, number]> = [];

  constructor() {
    super();
    const next = random(9);
    for (let index = 0; index < 130; index += 1) this.drops.push([next(), next(), 0.7 + next() * 0.6]);
  }

  protected overlay(context: CanvasRenderingContext2D, camera: Camera, width: number, height: number) {
    const local = this.time % 12;
    const rise = clamp01(local / 2);
    for (const [px, py, size] of this.puddles) {
      context.fillStyle = 'rgba(58,168,224,0.36)';
      context.beginPath();
      for (let step = 0; step < 24; step += 1) {
        const angle = (step / 24) * Math.PI * 2;
        const wobble = 1 + 0.15 * Math.sin(angle * 3 + px);
        project(camera, px + Math.cos(angle) * size * rise * wobble * 1.1, py + Math.sin(angle) * size * rise * wobble);
        if (step === 0) context.moveTo(P.x, P.y);
        else context.lineTo(P.x, P.y);
      }
      context.closePath();
      context.fill();
      const ripple = (this.time * 0.7 + px) % 1;
      pulse(context, camera, px, py, size * rise * (0.4 + ripple * 0.8), WATER, (1 - ripple) * 0.6 * rise);
    }
    if (rise > 0.6) label(context, camera, this.puddles[0][0], this.puddles[0][1], t('Waterlogged'), { color: WATER, alpha: clamp01((rise - 0.6) / 0.3) });

    if (local > 2 && local < 5) {
      context.setLineDash([6, 6]);
      this.oldRoute.stroke(context, camera, 40, 72, RED, 2.5, 0.55 + 0.35 * Math.sin(this.time * 10));
      context.setLineDash([]);
    }
    const reroute = clamp01((local - 3.5) / 1.5) * this.newRoute.total;
    this.newRoute.stroke(context, camera, 0, reroute, GOLD, 3.5);
    drawRing(context, camera, ...PICKUP);
    drawPin(context, camera, ...DEST);
    if (local > 5) {
      const [x, y, angle] = this.newRoute.at(ease(clamp01((local - 5) / 6)) * this.newRoute.total);
      drawCar(context, camera, x, y, angle, GREEN);
      if (local < 7.5) label(context, camera, x, y, t('Rerouted around flooding'), { color: GOLD });
    }

    context.strokeStyle = 'rgba(190,220,235,0.22)';
    context.lineWidth = 1;
    context.beginPath();
    for (const drop of this.drops) {
      const y = ((drop[1] + this.time * drop[2]) % 1.1) * height;
      const x = drop[0] * width;
      context.moveTo(x, y);
      context.lineTo(x - 4, y + 16);
    }
    context.stroke();
  }
}

class PayScene extends FeatureScene {
  protected readonly focus: Point = [18, 22];
  protected yaw = 0.7;
  private readonly route = new Route([[0, 16], [16, 16], [16, 32], [32, 32]]);

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const driveTime = this.route.total / 12;
    const local = this.time % (driveTime + 4.5);
    const travelled = Math.min(this.route.total, local * 12);
    const fare = Math.round(56 + travelled * 0.8);
    this.route.stroke(context, camera, travelled, this.route.total, GOLD, 3.5);
    const [ex, ey] = DEST;
    drawPin(context, camera, ex, ey);
    const [x, y, angle] = this.route.at(travelled);
    drawCar(context, camera, x, y, angle, '#ffffff');
    if (local < driveTime) {
      label(context, camera, x, y, `৳ ${fare}`, { color: GOLD });
      return;
    }
    const after = local - driveTime;
    const options = [t('Cash'), t('Wallet'), t('bKash')];
    options.forEach((option, index) => {
      const appear = clamp01((after - index * 0.25) / 0.4);
      const selected = index === 1 && after > 1.8;
      label(context, camera, ex + (index - 1) * 7, ey, selected ? `${option} ✓` : option, {
        color: selected ? GOLD : '#ffffff',
        offset: 40 + appear * 8,
        alpha: appear * (after > 1.8 && !selected ? 0.35 : 1),
      });
    });
    if (after > 2.2) label(context, camera, ex, ey, t('Paid ৳{0}', fare), { color: GREEN, offset: 78, alpha: clamp01((after - 2.2) / 0.4) });
  }
}

class RateScene extends FeatureScene {
  protected readonly focus: Point = [4, 8];
  protected yaw = 0.45;
  private readonly route = new Route(TRIP);

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const local = this.time % 8;
    this.route.stroke(context, camera, 0, this.route.total, GOLD, 2.5, 0.4);
    drawRing(context, camera, ...PICKUP);
    drawPin(context, camera, ...DEST);
    const [dx, dy] = DEST;
    const [, , angle] = this.route.at(this.route.total);
    drawCar(context, camera, dx - 3, dy, angle, '#ffffff');
    const stars = (start: number) => '★'.repeat(Math.min(5, Math.max(0, Math.floor((local - start) / 0.22)))).padEnd(5, '☆');
    if (local > 0.3) label(context, camera, dx, dy, `${t('You rated your driver')}  ${stars(0.5)}`, { color: GOLD, offset: 44, alpha: clamp01((local - 0.3) / 0.3) });
    if (local > 2.2) label(context, camera, dx, dy, `${t('Your driver rated you')}  ${stars(2.5)}`, { color: GOLD, offset: 72, alpha: clamp01((local - 2.2) / 0.3) });
    if (local > 4.6) label(context, camera, dx, dy, t('Thanks for riding with Cholo'), { color: GREEN, offset: 100, alpha: clamp01((local - 4.6) / 0.4) * (local > 7.4 ? 1 - (local - 7.4) / 0.6 : 1) });
  }
}

class MetroScene extends FeatureScene {
  protected readonly focus: Point = [0, 4];
  protected yaw = -0.55;
  protected pitch = 1;
  protected wideZoom = 0.72;
  private readonly line: Route;
  private readonly stations: number[] = [];
  private readonly bike: Route;
  private readonly walk: Route;
  private readonly ride: [number, number];

  constructor() {
    super();
    const points: Point[] = [];
    for (let y = -72; y <= 72; y += 4) points.push([4 + 9 * Math.sin(y / 34), y]);
    this.line = new Route(points);
    for (let d = 8; d < this.line.total; d += 22) this.stations.push(d);
    const board = this.stations[2];
    const alight = this.stations[4];
    const [bx, by] = this.line.at(board);
    const [ax, ay] = this.line.at(alight);
    this.bike = new Route([[-16, -32], [-16, Math.round(by / GRID) * GRID], [bx, by]]);
    this.walk = new Route([[ax, ay], [ax + 12, ay], [ax + 12, ay + 10]]);
    this.ride = [board, alight];
  }

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    const lift = 3;
    for (let d = 0; d < this.line.total; d += 11) {
      const [x, y] = this.line.at(d);
      if (!project(camera, x, y)) continue;
      const baseX = P.x;
      const baseY = P.y;
      project(camera, x, y, lift);
      context.strokeStyle = 'rgba(200,220,210,0.18)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(baseX, baseY);
      context.lineTo(P.x, P.y);
      context.stroke();
    }
    context.strokeStyle = 'rgba(220,235,228,0.55)';
    context.lineWidth = 3;
    this.line.trace(context, camera, 0, this.line.total, lift);
    context.stroke();
    for (const d of this.stations) {
      const [x, y] = this.line.at(d);
      if (!project(camera, x, y, lift)) continue;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(P.x, P.y, 3.2, 0, Math.PI * 2);
      context.fill();
    }
    const trainAt = (this.time * 18) % this.line.total;
    for (let car = 0; car < 5; car += 1) {
      const [x, y] = this.line.at(trainAt - car * 1.6);
      if (!project(camera, x, y, lift)) continue;
      context.drawImage(glow('#9fe8ff'), P.x - 7, P.y - 7, 14, 14);
    }

    const [board, alight] = this.ride;
    const legs = [this.bike.total / 10, (alight - board) / 22, this.walk.total / 4];
    const total = legs[0] + legs[1] + legs[2] + 2;
    const local = this.time % total;
    this.bike.stroke(context, camera, 0, this.bike.total, GOLD, 3);
    context.strokeStyle = GOLD;
    context.lineWidth = 5;
    context.globalAlpha = 0.9;
    this.line.trace(context, camera, board, alight, lift);
    context.stroke();
    context.globalAlpha = 1;
    context.setLineDash([2, 6]);
    this.walk.stroke(context, camera, 0, this.walk.total, '#ffffff', 2);
    context.setLineDash([]);
    drawRing(context, camera, ...this.bike.points[0]);
    drawPin(context, camera, ...this.walk.points[this.walk.points.length - 1]);

    let point: [number, number, number];
    let height = 0;
    let text = t('Bike to the station');
    if (local < legs[0]) point = this.bike.at((local / legs[0]) * this.bike.total);
    else if (local < legs[0] + legs[1]) {
      point = this.line.at(board + ((local - legs[0]) / legs[1]) * (alight - board));
      height = lift;
      text = t('MRT Line 6');
    } else {
      point = this.walk.at(((local - legs[0] - legs[1]) / legs[2]) * this.walk.total);
      text = t('Short walk');
    }
    if (project(camera, point[0], point[1], height)) {
      context.drawImage(glow(GOLD), P.x - 14, P.y - 14, 28, 28);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(P.x, P.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    label(context, camera, point[0], point[1], text, { color: GOLD, offset: height ? 34 : 22 });
  }
}

class TwinScene extends FeatureScene {
  protected readonly focus: Point = [0, 0];
  protected yaw = 0.1;
  protected pitch = 0.9;
  protected tightUnits = 44;
  protected wideZoom = 0.62;
  private readonly agents: Agent[] = [];
  private readonly counts = new Map<string, number>();
  private binned = 0;

  constructor() {
    super();
    const next = random(42);
    for (let index = 0; index < 420; index += 1) this.agents.push(new Agent(next, 56));
  }

  protected tick(dt: number) {
    for (const agent of this.agents) agent.step(dt);
    this.binned -= dt;
    if (this.binned > 0) return;
    this.binned = 0.5;
    this.counts.clear();
    for (const agent of this.agents) {
      const key = hexKey(agent.x, agent.y);
      this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    }
  }

  protected overlay(context: CanvasRenderingContext2D, camera: Camera) {
    for (const [key, count] of this.counts) {
      const [q, r] = key.split(',').map(Number);
      const [cx, cy] = hexCenter(q, r);
      context.fillStyle = `rgba(251,191,46,${Math.min(0.42, count * 0.045)})`;
      context.beginPath();
      for (let corner = 0; corner < 6; corner += 1) {
        const angle = (Math.PI / 3) * corner + Math.PI / 6;
        project(camera, cx + Math.cos(angle) * HEX * 0.94, cy + Math.sin(angle) * HEX * 0.94);
        if (corner === 0) context.moveTo(P.x, P.y);
        else context.lineTo(P.x, P.y);
      }
      context.closePath();
      context.fill();
    }
    context.globalCompositeOperation = 'lighter';
    this.agents.forEach((agent, index) => {
      if (!project(camera, agent.x, agent.y)) return;
      context.fillStyle = index % 5 < 3 ? GREEN : GOLD;
      context.fillRect(P.x - 1.2, P.y - 1.2, 2.4, 2.4);
    });
    context.globalCompositeOperation = 'source-over';
    label(context, camera, 0, 0, t('{0} simulated riders and drivers', this.agents.length), { offset: 60 });
  }
}

const HEX = 7;
function hexKey(x: number, y: number) {
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / HEX;
  const r = ((2 / 3) * y) / HEX;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return `${rq},${rr}`;
}
function hexCenter(q: number, r: number): Point {
  return [HEX * Math.sqrt(3) * (q + r / 2), HEX * 1.5 * r];
}

export type SceneKey = 'book' | 'match' | 'women' | 'arrive' | 'board' | 'ride' | 'detour' | 'pay' | 'rate' | 'metro' | 'twin';

export function createScene(key: SceneKey): FeatureScene {
  switch (key) {
    case 'book': return new BookScene();
    case 'match': return new MatchScene(false);
    case 'women': return new MatchScene(true);
    case 'arrive': return new ArriveScene();
    case 'board': return new BoardScene();
    case 'ride': return new RideScene();
    case 'detour': return new DetourScene();
    case 'pay': return new PayScene();
    case 'rate': return new RateScene();
    case 'metro': return new MetroScene();
    case 'twin': return new TwinScene();
  }
}

export type { FeatureScene };
