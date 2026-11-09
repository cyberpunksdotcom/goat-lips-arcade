// Canvas drawing for Slide 'Em. Reads sim state, never changes it.
// Visual-only randomness (shake) lives here and does not affect scoring.

import { BEER_TICKS, EDGE_TICKS, LANES, LANE_LEN } from '../sim/constants';
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
    const goatZone = Math.min(160, Math.max(100, (bottom - top) * 0.2));
    return {
      w, h, dpr, portrait, lane,
      laneStart: left,
      bar: bottom - goatZone,
      door: top + 22,
      goat: bottom - goatZone / 2,
      goatZone,
      item: Math.min(lane * 0.46, 46),
    };
  }
  const top = safe.t + hudH;
  const bottom = h - safe.b - 4;
  const left = safe.l + 6;
  const right = w - safe.r - 6;
  const lane = (bottom - top) / LANES;
  const goatZone = Math.min(170, Math.max(110, (right - left) * 0.17));
  return {
    w, h, dpr, portrait, lane,
    laneStart: top,
    bar: right - goatZone,
    door: left + 26,
    goat: right - goatZone / 2,
    goatZone,
    item: Math.min(lane * 0.52, 46),
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
  size: number;
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
  private tossAt = -1e9;
  private slideAt = -1e9;
  private hurtAt = -1e9;
  private cheerAt = -1e9;
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
    this.flashUntil = this.shakeUntil = 0;
    this.tossAt = this.slideAt = this.hurtAt = this.cheerAt = -1e9;
  }

  /** React to what just happened in the sim (popups, flashes, goat animation). */
  onEvents(events: readonly SimEvent[], now: number): void {
    const L = this.L;
    for (const e of events) {
      if (e.t === 'launch') {
        if (e.kind === 0) this.tossAt = now;
        else this.slideAt = now;
      } else if (e.t === 'serve') {
        const [x, y] = at(L, e.lane, e.pos);
        this.popups.push({ x, y, text: `+${e.points}`, color: '#f4b223', born: now, size: 0.55 });
        this.leavers.push({ lane: e.lane, pos: e.pos, look: e.look, born: now });
        if (e.mult > 1 && e.mult !== this.lastMult) this.cheerAt = now;
        this.lastMult = e.mult;
      } else if (e.t === 'refuse') {
        const [x, y] = at(L, e.lane, e.pos);
        const text = e.wanted === 0 ? 'Sandwich, please!' : 'Beer, please!';
        this.popups.push({ x, y, text, color: '#ff8a7a', born: now, size: 0.4 });
        this.lastMult = 1;
      } else if (e.t === 'catch') {
        const [x, y] = at(L, e.lane, 0);
        this.popups.push({ x, y, text: `+${e.points}`, color: '#f5edd9', born: now, size: 0.5 });
      } else if (e.t === 'loss') {
        this.flashUntil = now + 450;
        this.hurtAt = now;
        this.lastMult = 1;
        if (!this.reduceMotion) this.shakeUntil = now + 320;
      }
    }
  }
  private lastMult = 1;

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
      drawOrder(ctx, x, y, L.item * 0.82, o.kind, false, 0);
    }
    for (const e of s.empties) {
      const [x, y] = at(L, e.lane, lerp(e.prev, e.pos));
      const tilt = e.edge > 0 ? Math.sin(now / 55) * (0.18 + (0.5 * e.edge) / EDGE_TICKS) : 0;
      drawOrder(ctx, x, y, L.item * 0.82, e.kind, true, tilt, e.edge / EDGE_TICKS);
    }

    this.drawGoat(s, now);
    this.drawPour(s);

    // Phase lighting.
    const target = PHASE_LIGHT[s.phase] ?? PHASE_LIGHT[0];
    for (let i = 0; i < 4; i++) this.light[i] += (target[i] - this.light[i]) * 0.02;
    ctx.fillStyle = `rgba(${this.light[0] | 0},${this.light[1] | 0},${this.light[2] | 0},${this.light[3].toFixed(3)})`;
    ctx.fillRect(-20, -20, L.w + 40, L.h + 40);

    // Popups.
    this.popups = this.popups.filter((p) => now - p.born < 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const k = (now - p.born) / 800;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `${Math.round(L.item * p.size)}px "Permanent Marker", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      const dy = -26 * k - L.item * 0.65;
      const x = Math.max(60, Math.min(L.w - 60, p.x));
      ctx.strokeText(p.text, x, p.y + dy);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, p.y + dy);
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

  /** Beer pour meter at the end of the goat's bar: a ring plus a mug filling up. */
  private drawPour(s: SimState): void {
    if (!s.holding) return;
    const { ctx, L } = this;
    // A little way up the bar, so the goat's tray never covers it.
    const [x, y] = at(L, s.goatLane, LANE_LEN * (L.portrait ? 0.09 : 0.06));
    const fill = Math.min(1, s.held / BEER_TICKS);
    const r = L.item * 0.62;
    ctx.fillStyle = 'rgba(20,10,4,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#f4b223';
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
    ctx.stroke();
    drawMugFilling(ctx, x, y, r * 1.1, fill);
  }

  private drawGoat(s: SimState, now: number): void {
    const { ctx, L } = this;
    const img = this.goatImg;
    const aspect = img.naturalWidth ? img.naturalWidth / img.naturalHeight : 0.9;
    const across = L.laneStart + L.lane * (this.goatVisualLane + 0.5);
    let hgt: number;
    let footX: number;
    let footY: number;
    if (L.portrait) {
      hgt = Math.min(L.goatZone * 1.12, L.lane * 1.9);
      footX = across;
      footY = L.bar + L.goatZone - 2;
      const half = (hgt * aspect) / 2;
      footX = Math.max(half + 2, Math.min(L.w - half - 2, footX));
    } else {
      hgt = Math.min(L.lane * 1.75, L.goatZone * 1.25);
      footX = L.goat;
      footY = across + hgt / 2;
      footY = Math.max(hgt + 2, Math.min(L.h - 2, footY));
    }
    const wid = hgt * aspect;

    // Animation: idle bob, lean while pouring, a quick shove on a toss, a shake when hurt.
    let lean = 0;
    let push = 0;
    let shake = 0;
    let squash = 1 + Math.sin(now / 420) * 0.012;
    const toss = (now - this.tossAt) / 200;
    if (toss >= 0 && toss < 1) {
      push += Math.sin(toss * Math.PI) * hgt * 0.1;
      lean -= Math.sin(toss * Math.PI) * 0.14;
    }
    const slide = (now - this.slideAt) / 220;
    if (slide >= 0 && slide < 1) push += Math.sin(slide * Math.PI) * hgt * 0.06;
    if (s.holding) lean -= 0.06 + Math.sin(now / 45) * 0.012;
    const hurt = (now - this.hurtAt) / 450;
    if (hurt >= 0 && hurt < 1 && !this.reduceMotion) shake = Math.sin(now / 22) * 6 * (1 - hurt);
    const cheer = (now - this.cheerAt) / 380;
    if (cheer >= 0 && cheer < 1) squash += Math.sin(cheer * Math.PI) * 0.08;

    ctx.save();
    if (L.portrait) ctx.translate(footX + shake, footY - push);
    else ctx.translate(footX - push, footY + shake);

    // Shadow under the hooves.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, -2, wid * 0.32, Math.max(4, wid * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(lean * (L.portrait ? 1 : -1) * 0.6);
    ctx.scale(1 / squash, squash);
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, -wid / 2, -hgt, wid, hgt);
    } else {
      ctx.fillStyle = '#aaa59f';
      ctx.beginPath();
      ctx.arc(0, -hgt / 2, hgt / 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- static scene ----------

function paintBackground(c: CanvasRenderingContext2D, L: Layout): void {
  const { w, h } = L;
  c.fillStyle = '#24160d';
  c.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const plank = 26;
  for (let i = 0; i * plank < (L.portrait ? w : h) + plank; i++) {
    const shade = 28 + Math.floor(rnd() * 14);
    c.fillStyle = `rgb(${shade + 10},${shade - 2},${shade - 12})`;
    if (L.portrait) c.fillRect(i * plank, 0, plank - 2, h);
    else c.fillRect(0, i * plank, w, plank - 2);
  }

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

// ---------- sprites (drawn) ----------

function drawPatron(c: CanvasRenderingContext2D, x: number, y: number, r: number, look: number, wants: Kind | null): void {
  const coat = COATS[look % COATS.length];
  c.strokeStyle = '#6b4a2b';
  c.lineCap = 'round';
  c.lineWidth = r * 0.24;
  c.beginPath();
  c.moveTo(x - r * 0.35, y - r * 0.7);
  c.quadraticCurveTo(x - r * 0.75, y - r * 1.45, x - r * 1.05, y - r * 1.15);
  c.moveTo(x + r * 0.35, y - r * 0.7);
  c.quadraticCurveTo(x + r * 0.75, y - r * 1.45, x + r * 1.05, y - r * 1.15);
  c.stroke();
  c.fillStyle = coat;
  c.strokeStyle = '#2e2e2e';
  c.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + s * r * 1.0, y - r * 0.2, r * 0.48, r * 0.2, s * 0.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.beginPath();
  c.ellipse(x, y, r * 0.78, r * 0.92, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = look === 2 || look === 3 ? '#c9a58c' : '#f2d9cf';
  c.beginPath();
  c.ellipse(x, y + r * 0.45, r * 0.45, r * 0.33, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1b1b1b';
  c.beginPath();
  c.arc(x - r * 0.3, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
  c.arc(x + r * 0.3, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
  c.fill();
  // What they want, in a bubble: red ring = sandwich basket (tap), gold ring = beer (hold).
  if (wants !== null) {
    const bx = x + r * 1.0;
    const by = y + r * 0.85;
    const br = r * 0.68;
    c.fillStyle = '#f5edd9';
    c.beginPath();
    c.arc(bx, by, br, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = Math.max(2, r * 0.12);
    c.strokeStyle = wants === 0 ? '#d11b1b' : '#c67a11';
    c.stroke();
    drawOrder(c, bx, by + (wants === 0 ? r * 0.08 : 0), r * 0.98, wants, false, 0);
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
  c.strokeStyle = empty ? `rgb(245,${Math.round(237 - 180 * danger)},${Math.round(217 - 190 * danger)})` : '#2e2e2e';
  if (kind === 1) {
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
    // Red basket with a sandwich on top
    const bw = s * 0.84;
    const bh = s * 0.38;
    c.fillStyle = '#d9a35a';
    c.beginPath();
    c.ellipse(0, -bh * 0.25, bw * 0.38, s * 0.24, 0, Math.PI, 0);
    c.fill();
    c.stroke();
    c.fillStyle = '#6aa84f';
    c.fillRect(-bw * 0.36, -bh * 0.3, bw * 0.72, s * 0.06);
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
    for (let i = -1; i <= 1; i += 2) c.fillRect(i * bw * 0.16 - s * 0.05, -bh * 0.1, s * 0.1, s * 0.1);
  }
  c.restore();
}

function drawMugFilling(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: number): void {
  const bw = s * 0.5;
  const bh = s * 0.62;
  c.save();
  c.translate(x - s * 0.06, y);
  c.lineWidth = 2;
  c.strokeStyle = '#f5edd9';
  c.beginPath();
  c.arc(bw / 2, 0, s * 0.16, -Math.PI / 2, Math.PI / 2);
  c.stroke();
  c.save();
  roundRect(c, -bw / 2, -bh / 2, bw, bh, s * 0.06);
  c.clip();
  c.fillStyle = '#f4b223';
  c.fillRect(-bw / 2, bh / 2 - bh * fill, bw, bh * fill);
  if (fill > 0.15) {
    c.fillStyle = '#fff8e6';
    c.fillRect(-bw / 2, bh / 2 - bh * fill, bw, Math.min(bh * 0.18, bh * fill));
  }
  c.restore();
  roundRect(c, -bw / 2, -bh / 2, bw, bh, s * 0.06);
  c.stroke();
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
