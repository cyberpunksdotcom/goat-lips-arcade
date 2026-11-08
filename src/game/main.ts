import '@fontsource/permanent-marker';
import '../styles.css';
import goatUrl from '../assets/goat-waiter.placeholder.webp';
import {
  INPUT_MOVE_BASE,
  INPUT_PRESS_HERE,
  INPUT_RELEASE,
  LANES,
  PHASES,
  SIM_VERSION,
  TICK_MS,
} from '../sim/constants';
import { seedFor, type RunLog } from '../sim/replay';
import { createSim, multiplier, step, type SimState } from '../sim/sim';
import { weekLabel, weekOf, type Period } from '../period';
import { Sound } from './audio';
import { LOSS_LINES, OVER_LINES, OVER_TITLES, lipsLeftLine, pick } from './copy';
import { Renderer, computeLayout, laneAt, type Insets } from './render';
import { load, save } from './storage';

type Mode = 'title' | 'playing' | 'paused' | 'over';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('field');
const hud = $('hud');
const scoreEl = $('score');
const multEl = $('mult');
const phaseEl = $('phase-label');
const lipsEl = $('lips');
const banner = $('banner');
const screens = { title: $('screen-title'), pause: $('screen-pause'), over: $('screen-over') };
const soundBtn = $<HTMLButtonElement>('sound-btn');

const goatImg = new Image();
goatImg.src = goatUrl;
const renderer = new Renderer(canvas, goatImg);
const sound = new Sound();
sound.enabled = load('sound', false);

let mode: Mode = 'title';
let period: Period = weekOf(Date.now());
let sim: SimState = createSim(seedFor(period.id));
let log: number[] = [];
const queue: number[] = [];
let intendedLane = sim.goatLane;
let activePointer: number | null = null;
let acc = 0;
let last = performance.now();
let bannerTimer = 0;

// ---------- layout ----------

function safeInsets(): Insets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  probe.remove();
  return v;
}

function relayout(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.resize(computeLayout(w, h, dpr, safeInsets(), 52));
}

let resizeQueued = false;
function onResize(): void {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    relayout();
  });
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

// ---------- HUD ----------

const LIP_SVG =
  '<svg viewBox="0 0 30 20" aria-hidden="true"><path d="M2 10C6 4 10 3 13 6c1-1.5 3-1.5 4 0 3-3 7-2 11 4-6 .5-10 1-13 .5-3 .5-7 0-13-.5z" fill="#d11b1b" stroke="#6e0c0c" stroke-width="1"/><path d="M2 10c6 2 10 2.5 13 2 3 .5 7 0 13-2-3 6-8 8.5-13 8.5S5 16 2 10z" fill="#e8302a" stroke="#6e0c0c" stroke-width="1"/></svg>';

let shown = { score: -1, mult: -1, phase: -1, lips: -1 };
function updateHud(): void {
  if (sim.score !== shown.score) {
    scoreEl.textContent = sim.score.toLocaleString('en-US');
    shown.score = sim.score;
  }
  const m = multiplier(sim.streak);
  if (m !== shown.mult) {
    multEl.hidden = m < 2;
    multEl.textContent = `×${m}`;
    shown.mult = m;
  }
  if (sim.phase !== shown.phase) {
    phaseEl.textContent = PHASES[sim.phase];
    shown.phase = sim.phase;
  }
  if (sim.lips !== shown.lips) {
    lipsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      lipsEl.insertAdjacentHTML('beforeend', LIP_SVG);
      if (i >= sim.lips) lipsEl.lastElementChild?.classList.add('gone');
    }
    lipsEl.setAttribute('aria-label', `${sim.lips} lips left`);
    shown.lips = sim.lips;
  }
}

function showBanner(text: string, sub = '', bad = false, ms = 1400): void {
  banner.innerHTML = '';
  banner.append(text);
  if (sub) {
    const s = document.createElement('small');
    s.textContent = sub;
    banner.append(s);
  }
  banner.classList.toggle('bad', bad);
  banner.hidden = false;
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => (banner.hidden = true), ms);
}

function showScreen(name: keyof typeof screens | null): void {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  document.body.classList.toggle('playing', mode === 'playing' || mode === 'paused');
  document.body.classList.toggle('mode-title', mode === 'title');
  hud.hidden = mode === 'title';
}

// ---------- game flow ----------

function startGame(): void {
  period = weekOf(Date.now());
  sim = createSim(seedFor(period.id));
  log = [];
  queue.length = 0;
  intendedLane = sim.goatLane;
  activePointer = null;
  acc = 0;
  last = performance.now();
  shown = { score: -1, mult: -1, phase: -1, lips: -1 };
  renderer.reset(sim.goatLane);
  mode = 'playing';
  showScreen(null);
  banner.hidden = true;
  showBanner(PHASES[0], 'Lunch is mostly food. Food baskets don’t come back.', false, 2200);
}

function pause(): void {
  if (mode !== 'playing') return;
  queue.push(INPUT_RELEASE); // whatever was held is let go
  activePointer = null;
  mode = 'paused';
  showScreen('pause');
  updateSoundUi();
}

function resume(): void {
  if (mode !== 'paused') return;
  mode = 'playing';
  last = performance.now();
  acc = 0;
  showScreen(null);
}

function finish(): void {
  mode = 'over';
  const best = Math.max(load('best', 0), sim.score);
  save('best', best);
  const run: RunLog = { v: SIM_VERSION, period: period.id, inputs: log.slice(), endTick: sim.tick, score: sim.score };
  (window as unknown as { __lastRun?: RunLog }).__lastRun = run; // for automated checks
  const reason = sim.overReason ?? 'lips';
  $('over-title').textContent = OVER_TITLES[reason];
  $('over-line').textContent = pick(OVER_LINES[reason], sim.tick);
  $('final-score').textContent = sim.score.toLocaleString('en-US');
  $('stat-served').textContent = String(sim.served);
  $('stat-caught').textContent = String(sim.caught);
  $('stat-best').textContent = best.toLocaleString('en-US');
  sound.play('over');
  window.setTimeout(() => {
    if (mode === 'over') showScreen('over');
  }, 700);
}

function handleEvents(now: number): void {
  if (sim.events.length === 0) return;
  renderer.onEvents(sim.events, now);
  for (const e of sim.events) {
    switch (e.t) {
      case 'launch':
        sound.play('launch');
        break;
      case 'serve':
        sound.play('serve');
        break;
      case 'catch':
        sound.play('catch');
        break;
      case 'loss':
        sound.play('loss');
        navigator.vibrate?.(90);
        if (e.lipsLeft > 0) showBanner(pick(LOSS_LINES[e.reason], sim.tick), lipsLeftLine(e.lipsLeft), true, 1350);
        else showBanner(pick(LOSS_LINES[e.reason], sim.tick), '', true, 900);
        break;
      case 'phase':
        sound.play('phase');
        phaseEl.classList.remove('pulse');
        void phaseEl.offsetWidth; // restart the animation
        phaseEl.classList.add('pulse');
        break;
    }
  }
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(250, now - last);
  last = now;
  if (mode === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= TICK_MS && steps < 10) {
      const t = sim.tick + 1;
      const codes = queue.splice(0, queue.length);
      for (const c of codes) log.push(t, c);
      step(sim, codes);
      handleEvents(now);
      acc -= TICK_MS;
      steps++;
      if (sim.over) {
        finish();
        break;
      }
    }
    if (steps >= 10) acc = 0; // fell far behind (slow device or tab hiccup): don't fast-forward
    if (queue.length === 0) intendedLane = sim.goatLane;
  }
  renderer.draw(sim, mode === 'playing' ? acc / TICK_MS : 0, now);
  if (mode !== 'title') updateHud();
}

// ---------- input ----------

canvas.addEventListener('pointerdown', (ev) => {
  if (mode !== 'playing') return;
  ev.preventDefault();
  const lane = laneAt(renderer.layout, ev.clientX, ev.clientY);
  activePointer = ev.pointerId;
  try {
    canvas.setPointerCapture(ev.pointerId);
  } catch {
    /* ignore */
  }
  queue.push(lane);
  intendedLane = lane;
});
const pointerUp = (ev: PointerEvent) => {
  if (ev.pointerId !== activePointer) return;
  activePointer = null;
  if (mode === 'playing') queue.push(INPUT_RELEASE);
};
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

const LEFT = new Set(['ArrowLeft', 'ArrowUp', 'a', 'A', 'w', 'W']);
const RIGHT = new Set(['ArrowRight', 'ArrowDown', 'd', 'D', 's', 'S']);
window.addEventListener('keydown', (ev) => {
  const k = ev.key;
  if (mode === 'paused' && (k === 'p' || k === 'P' || k === 'Escape')) {
    resume();
    return;
  }
  if (mode !== 'playing') return;
  if (k === 'p' || k === 'P' || k === 'Escape') {
    pause();
    return;
  }
  let target = -1;
  if (LEFT.has(k)) target = Math.max(0, intendedLane - 1);
  else if (RIGHT.has(k)) target = Math.min(LANES - 1, intendedLane + 1);
  else if (k >= '1' && k <= String(LANES)) target = Number(k) - 1;
  if (target >= 0) {
    ev.preventDefault();
    if (!ev.repeat) {
      queue.push(INPUT_MOVE_BASE + target);
      intendedLane = target;
    }
    return;
  }
  if (k === ' ' || k === 'Enter') {
    ev.preventDefault();
    if (!ev.repeat) queue.push(INPUT_PRESS_HERE);
  }
});
window.addEventListener('keyup', (ev) => {
  if (mode === 'playing' && (ev.key === ' ' || ev.key === 'Enter')) {
    ev.preventDefault();
    queue.push(INPUT_RELEASE);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', () => pause());

// ---------- buttons ----------

function updateSoundUi(): void {
  soundBtn.setAttribute('aria-pressed', String(sound.enabled));
  soundBtn.setAttribute('aria-label', sound.enabled ? 'Sound on' : 'Sound off');
  const t = $('sound-toggle');
  if (t) t.textContent = sound.enabled ? 'Sound: on' : 'Sound: off';
}
function toggleSound(): void {
  sound.unlock();
  sound.enabled = !sound.enabled;
  save('sound', sound.enabled);
  updateSoundUi();
}

$('play-btn').addEventListener('click', () => {
  sound.unlock();
  startGame();
});
$('again-btn').addEventListener('click', () => {
  sound.unlock();
  startGame();
});
$('pause-btn').addEventListener('click', pause);
$('resume-btn').addEventListener('click', resume);
$('quit-btn').addEventListener('click', () => {
  mode = 'title';
  showScreen('title');
});
soundBtn.addEventListener('click', toggleSound);
const pauseCard = screens.pause.querySelector('.card');
if (pauseCard) {
  const b = document.createElement('button');
  b.id = 'sound-toggle';
  b.type = 'button';
  b.className = 'btn btn-quiet';
  b.addEventListener('click', toggleSound);
  pauseCard.insertBefore(b, $('quit-btn'));
}

// ---------- boot ----------

$('week-line').textContent = `This week's shift: ${weekLabel(period)}. Same rush for everybody.`;
updateSoundUi();
relayout();
showScreen('title');
requestAnimationFrame((t) => {
  last = t;
  frame(t);
});
