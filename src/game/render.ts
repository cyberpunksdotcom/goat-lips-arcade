// Canvas drawing for Slide 'Em. Reads sim state, never changes it.
// Visual-only randomness (shake, sparkle) lives here and does not affect scoring.

import { EDGE_TICKS, LANES, LANE_LEN, POUR_TICKS, TICK_MS } from '../sim/constants';
import type { Kind, SimEvent, SimState } from '../sim/sim';

export interface Insets {
  t: number;
  r: number;
  b: number;
  l: number;
}

export interface Layout {
  w: number;
  h: number;
  dpr: number;
  portrait: boolean;
  /** Lane thickness, perpendicular to travel. */
  lane: number;
  /** Where lane 0 starts on the cross axis (x in portrait, y in landscape). */
  laneStart: number;
  /** Travel-axis coordinate where orders leave and empties land (the goat's end of the bar). */
  bar: number;
  /** Travel-axis coordinate of the door. */
  door: number;
  /** Travel-axis coordinate of the goat's center. */
  goat: number;
  /** Size of the goat zone along the travel axis. */
  goatZone: number;
  item: number;
}

export function computeLayout(w: number, h: number, dpr: number, safe: Insets, hudH: number): Layout {
  const portrait = h >= w;
  if (portrait) {
    const left = safe.l + 6;
    const right = w - safe.r - 6;
    const top = safe.t + hudH + 2;
    const bottom = h - safe.b - 4;
    const lane = (right - left) / LANES;
    const goatZone = Math.min(150, Math.max(92, (bottom - top) * 0.19));
    return {
      w, h, dpr, portrait, lane,
      laneStart: left,
      bar: bottom - goatZone,
      door: top + 22,
      goat: bottom - goatZone / 2,
      goatZone,
      item: Math.min(lane * 0.44, 44),
    };
  }
  const top = safe.t + hudH;
  const bottom = h - safe.b - 4;
  const left = safe.l + 6;
  const right = w - safe.r - 6;
  const lane = (bottom - top) / LANES;
  const goatZone = Math.min(170, Math.max(104, (right - left) * 0.17));
  return {
    w, h, dpr, portrait, lane,
    laneStart: top,
    bar: right - goatZone,
    door: left + 26,
    goat: right - goatZone / 2,
    goatZone,
    item: Math.min(lane * 0.5, 44),
  };
}

export function laneAt(L: Layout, x: number, y: number): number {
  const c = L.portrait ? x : y;
  return Math.max(0, Math.min(LANES - 1, Math.floor((c - L.laneStart) / L.lane)));
}

function at(L: Layout, lane: number, pos: number): [number, number] {
  const along = L.bar + (L.door - L.bar) * (pos / LANE_LEN);
  const across = L.laneStart + L.lane * (lane + 0.5);
  return L.portrait ? [across, along] : [along, across];
}

const COATS = ['#aaa59f', '#efe5cf', '#8d5c3c', '#5c5652'];
const PHASE_LIGHT: [number, number, number, number][] = [
  [255, 236, 200, 0.05], // lunch: daylight
  [214, 140, 40, 0.13], // afternoon jazz: amber
  [150, 90, 170, 0.13], // open mic: amber going purple
  [95, 75, 210, 0.2], // band night: stage purple/blue
  [215, 90, 25, 0.17], // last call: firepit
];

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}
interface Leaver {
  lane: number;
  pos: number;
  look: number;
  born: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement = document.createElement('canvas');
  private L!: Layout;
  private popups: Popup[] = [];
  private leavers: Leaver[] = [];
  private flashUntil = 0;
  private shakeUntil = 0;
  private goatVisualLane = 1;
  private light = [...PHASE_LIGHT[0]];
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(
    private canvas: HTMLCanvasElement,
    private goatImg: HTMLImageElement,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    this.ctx = ctx;
  }

  get layout(): Layout {
    return this.L;
  }

  resize(L: Layout): void {
    this.L = L;
    const { w, h, dpr } = L;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const b = this.bg.getContext('2d')!;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(b, L);
  }

  reset(goatLane: number): void {
    this.popups = [];
    this.leavers = [];
    this.goatVisualLane = goatLane;
    this.flashUntil = 0;
    this.shakeUntil = 0;
  }

  /** React to what just happened in the sim (popups, flashes). */
  onEvents(events: readonly SimEvent[], now: number): void {
    for (const e of events) {
      if (e.t === 'serve') {
        const [x, y] = at(this.L, e.lane, e.pos);
        this.popups.push({ x, y, text: `+${e.points}`, color: '#f4b223', born: now });
        this.leavers.push({ lane: e.lane, pos: e.pos, look: e.look, born: now });
      } else if (e.t === 'catch') {
        const [x, y] = at(this.L, e.lane, 0);
        this.popups.push({ x, y, text: `+${e.points}`, color: '#f5edd9', born: now });
      } else if (e.t === 'loss') {
        this.flashUntil = now + 450;
        if (!this.reduceMotion) this.shakeUntil = now + 320;
      }
    }
  }

  draw(s: SimState, alpha: number, now: number): void {
    const { ctx, L } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 320;
      ctx.translate((Math.random() - 0.5) * 10 * k, (Math.random() - 0.5) * 10 * k);
    }

    const lerp = (a: number, b: number) => a + (b - a) * alpha;

    // Highlight the goat's lane.
    this.goatVisualLane += (s.goatLane - this.goatVisualLane) * 0.45;
    if (Math.abs(s.goatLane - this.goatVisualLane) < 0.01) this.goatVisualLane = s.goatLane;
    this.laneGlow(s.goatLane);

    // Patrons leaving after being served.
    this.leavers = this.leavers.filter((v) => now - v.born < 450);
    for (const v of this.leavers) {
      const k = (now - v.born) / 450;
      const [x, y] = at(L, v.lane, v.pos + k * 9000);
      ctx.globalAlpha = 1 - k;
      drawPatron(ctx, x, y, L.item * 0.62, v.look, null);
      ctx.globalAlpha = 1;
    }

    for (const p of s.patrons) {
      const [x, y] = at(L, p.lane, lerp(p.prev, p.pos));
      drawPatron(ctx, x, y, L.item * 0.62, p.look, p.wants);
    }
    for (const o of s.orders) {
      const [x, y] = at(L, o.lane, lerp(o.prev, o.pos));
      drawOrder(ctx, x, y, L.item * 0.8, o.kind, false, 0);
    }
    for (const e of s.empties) {
      const [x, y] = at(L, e.lane, lerp(e.prev, e.pos));
      const tilt = e.edge > 0 ? Math.sin(now / 55) * (0.18 + (0.5 * e.edge) / EDGE_TICKS) : 0;
      drawOrder(ctx, x, y, L.item * 0.8, e.kind, true, tilt, e.edge / EDGE_TICKS);
    }

    this.drawGoat(s, now);

    // Phase lighting.
    const target = PHASE_LIGHT[s.phase] ?? PHASE_LIGHT[0];
    for (let i = 0; i < 4; i++) this.light[i] += (target[i] - this.light[i]) * 0.02;
    ctx.fillStyle = `rgba(${this.light[0] | 0},${this.light[1] | 0},${this.light[2] | 0},${this.light[3].toFixed(3)})`;
    ctx.fillRect(-20, -20, L.w + 40, L.h + 40);

    // Score popups.
    this.popups = this.popups.filter((p) => now - p.born < 750);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const k = (now - p.born) / 750;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `${Math.round(L.item * 0.55)}px "Permanent Marker", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      const dy = -26 * k - L.item * 0.6;
      ctx.strokeText(p.text, p.x, p.y + dy);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y + dy);
    }
    ctx.globalAlpha = 1;

    if (now < this.flashUntil) {
      const k = (this.flashUntil - now) / 450;
      ctx.fillStyle = `rgba(209,27,27,${(0.35 * k).toFixed(3)})`;
      ctx.fillRect(-20, -20, L.w + 40, L.h + 40);
    }
    if (s.stun > 0) {
      ctx.fillStyle = 'rgba(15,8,4,0.35)';
      ctx.fillRect(-20, -20, L.w + 40, L.h + 40);
    }
  }

  private laneGlow(lane: number): void {
    const { ctx, L } = this;
    const a = L.laneStart + L.lane * lane + 3;
    ctx.fillStyle = 'rgba(244,178,35,0.10)';
    if (L.portrait) ctx.fillRect(a, L.door - 20, L.lane - 6, L.bar - L.door + 20);
    else ctx.fillRect(L.door - 20, a, L.bar - L.door + 20, L.lane - 6);
  }

  private drawGoat(s: SimState, now: number): void {
    const { ctx, L } = this;
    const img = this.goatImg;
    const across = L.laneStart + L.lane * (this.goatVisualLane + 0.5);
    const hgt = L.portrait ? Math.min(L.goatZone * 0.92, L.lane * 1.25) : Math.min(L.lane * 1.12, L.goatZone * 0.9);
    const wid = img.naturalWidth ? (hgt * img.naturalWidth) / img.naturalHeight : hgt;
    const bob = s.pouring ? Math.sin(now / 70) * 2 : 0;
    let [cx, cy] = L.portrait ? [across, L.goat + bob] : [L.goat, across + bob];
    if (L.portrait) cx = Math.max(wid / 2 + 2, Math.min(L.w - wid / 2 - 2, cx));
    else cy = Math.max(hgt / 2 + 2, Math.min(L.h - hgt / 2 - 2, cy));
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, cx - wid / 2, cy - hgt / 2, wid, hgt);
    } else {
      ctx.fillStyle = '#aaa59f';
      ctx.beginPath();
      ctx.arc(cx, cy, hgt / 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pour meter: a ring at the end of the bar in the goat's lane.
    if (s.pouring) {
      const [rx, ry] = at(L, s.goatLane, 0);
      const fill = Math.min(1, (s.pour + 1) / POUR_TICKS);
      const r = L.item * 0.55;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#f4b223';
      ctx.beginPath();
      ctx.arc(rx, ry, r, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ---------- static scene ----------

function paintBackground(c: CanvasRenderingContext2D, L: Layout): void {
  const { w, h } = L;
  // Floor: dark planks running along the bars.
  c.fillStyle = '#24160d';
  c.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const plank = 26;
  for (let i = 0; i * plank < (L.portrait ? w : h) + plank; i++) {
    const shade = 28 + Math.floor(rnd() * 14);
    c.fillStyle = `rgb(${shade + 10},${shade - 2},${shade - 12})`;
    if (L.portrait) c.fillRect(i * plank, 0, plank - 2, h);
    else c.fillRect(0, i * plank, w, plank - 2);
  }

  // Bars: lighter wood tops with grain, a brass rail at the goat's end.
  for (let lane = 0; lane < LANES; lane++) {
    const a = L.laneStart + L.lane * lane;
    const inset = Math.max(5, L.lane * 0.12);
    const x0 = L.portrait ? a + inset : L.door - 14;
    const y0 = L.portrait ? L.door - 14 : a + inset;
    const bw = L.portrait ? L.lane - inset * 2 : L.bar - L.door + 14;
    const bh = L.portrait ? L.bar - L.door + 14 : L.lane - inset * 2;
    const grad = L.portrait ? c.createLinearGradient(x0, 0, x0 + bw, 0) : c.createLinearGradient(0, y0, 0, y0 + bh);
    grad.addColorStop(0, '#6e4527');
    grad.addColorStop(0.5, '#9a6537');
    grad.addColorStop(1, '#6a4124');
    c.fillStyle = grad;
    roundRect(c, x0, y0, bw, bh, 6);
    c.fill();
    c.strokeStyle = 'rgba(40,22,10,0.35)';
    c.lineWidth = 1;
    for (let g = 0; g < 5; g++) {
      const off = (g + 0.5) / 5;
      c.beginPath();
      if (L.portrait) {
        const x = x0 + bw * off + (rnd() - 0.5) * 4;
        c.moveTo(x, y0 + 6);
        c.bezierCurveTo(x + 3, y0 + bh * 0.3, x - 3, y0 + bh * 0.7, x + 1, y0 + bh - 6);
      } else {
        const y = y0 + bh * off + (rnd() - 0.5) * 4;
        c.moveTo(x0 + 6, y);
        c.bezierCurveTo(x0 + bw * 0.3, y + 3, x0 + bw * 0.7, y - 3, x0 + bw - 6, y + 1);
      }
      c.stroke();
    }
  }

  // Back bar behind the goat.
  c.fillStyle = 'rgba(12,6,2,0.55)';
  if (L.portrait) c.fillRect(0, L.bar + 10, w, h - L.bar);
  else c.fillRect(L.bar + 10, 0, w - L.bar, h);
  c.strokeStyle = '#c67a11';
  c.lineWidth = 4;
  c.beginPath();
  if (L.portrait) {
    c.moveTo(L.laneStart, L.bar + 8);
    c.lineTo(L.laneStart + L.lane * LANES, L.bar + 8);
  } else {
    c.moveTo(L.bar + 8, L.laneStart);
    c.lineTo(L.bar + 8, L.laneStart + L.lane * LANES);
  }
  c.stroke();

  // String lights over the door.
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = L.portrait ? L.laneStart + L.lane * LANES * t : L.door - 22 + Math.sin(t * Math.PI * 3) * 3;
    const y = L.portrait ? L.door - 22 + Math.sin(t * Math.PI * 3) * 3 : L.laneStart + L.lane * LANES * t;
    const glow = c.createRadialGradient(x, y, 0, x, y, 14);
    glow.addColorStop(0, 'rgba(255,214,140,0.9)');
    glow.addColorStop(0.3, 'rgba(244,178,35,0.35)');
    glow.addColorStop(1, 'rgba(244,178,35,0)');
    c.fillStyle = glow;
    c.fillRect(x - 14, y - 14, 28, 28);
    c.fillStyle = '#fff1cc';
    c.beginPath();
    c.arc(x, y, 2.4, 0, Math.PI * 2);
    c.fill();
  }
}

// ---------- sprites (drawn, placeholder style) ----------

function drawPatron(c: CanvasRenderingContext2D, x: number, y: number, r: number, look: number, wants: Kind | null): void {
  const coat = COATS[look % COATS.length];
  // Horns
  c.strokeStyle = '#6b4a2b';
  c.lineCap = 'round';
  c.lineWidth = r * 0.24;
  c.beginPath();
  c.moveTo(x - r * 0.35, y - r * 0.7);
  c.quadraticCurveTo(x - r * 0.75, y - r * 1.45, x - r * 1.05, y - r * 1.15);
  c.moveTo(x + r * 0.35, y - r * 0.7);
  c.quadraticCurveTo(x + r * 0.75, y - r * 1.45, x + r * 1.05, y - r * 1.15);
  c.stroke();
  // Ears
  c.fillStyle = coat;
  c.strokeStyle = '#2e2e2e';
  c.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + s * r * 1.0, y - r * 0.2, r * 0.48, r * 0.2, s * 0.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  // Head
  c.beginPath();
  c.ellipse(x, y, r * 0.78, r * 0.92, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Snout
  c.fillStyle = look === 2 || look === 3 ? '#c9a58c' : '#f2d9cf';
  c.beginPath();
  c.ellipse(x, y + r * 0.45, r * 0.45, r * 0.33, 0, 0, Math.PI * 2);
  c.fill();
  // Eyes
  c.fillStyle = '#1b1b1b';
  c.beginPath();
  c.arc(x - r * 0.3, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
  c.arc(x + r * 0.3, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
  c.fill();
  // Order bubble
  if (wants !== null) {
    const bx = x + r * 1.05;
    const by = y + r * 0.75;
    c.fillStyle = '#f5edd9';
    c.strokeStyle = '#2e2e2e';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(bx, by, r * 0.55, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    drawOrder(c, bx, by, r * 0.8, wants, false, 0);
  }
}

function drawOrder(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  kind: Kind,
  empty: boolean,
  tilt: number,
  danger = 0,
): void {
  c.save();
  c.translate(x, y);
  if (tilt) c.rotate(tilt);
  c.lineWidth = Math.max(1.5, s * 0.06);
  c.strokeStyle = empty ? `rgb(${245},${Math.round(237 - 180 * danger)},${Math.round(217 - 190 * danger)})` : '#2e2e2e';
  if (kind === 1) {
    // Mug
    const bw = s * 0.56;
    const bh = s * 0.7;
    const top = -bh / 2;
    c.beginPath();
    c.arc(bw / 2, 0, s * 0.18, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    roundRect(c, -bw / 2, top, bw, bh, s * 0.08);
    if (!empty) {
      c.fillStyle = '#f4b223';
      c.fill();
    }
    c.stroke();
    if (!empty) {
      c.fillStyle = '#fff8e6';
      c.beginPath();
      c.arc(-bw * 0.25, top, s * 0.16, 0, Math.PI * 2);
      c.arc(bw * 0.05, top - s * 0.04, s * 0.19, 0, Math.PI * 2);
      c.arc(bw * 0.32, top, s * 0.14, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    // Basket with a sandwich
    const bw = s * 0.8;
    const bh = s * 0.38;
    c.fillStyle = empty ? 'transparent' : '#d9a35a';
    c.beginPath();
    c.ellipse(0, -bh * 0.25, bw * 0.38, s * 0.24, 0, Math.PI, 0);
    if (!empty) c.fill();
    c.stroke();
    c.fillStyle = '#d11b1b';
    c.beginPath();
    c.moveTo(-bw / 2, -bh * 0.2);
    c.lineTo(bw / 2, -bh * 0.2);
    c.lineTo(bw * 0.38, bh * 0.8);
    c.lineTo(-bw * 0.38, bh * 0.8);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#f5edd9';
    for (let i = -1; i <= 1; i += 2) {
      c.fillRect(i * bw * 0.16 - s * 0.05, -bh * 0.1, s * 0.1, s * 0.1);
    }
  }
  c.restore();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

export const FRAME_MS = TICK_MS;
