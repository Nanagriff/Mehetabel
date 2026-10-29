// Bootstraps the grain canvas: picks a renderer, maps scroll to story progress, tints the page as the
// dish cooks, and watches the frame rate so slow devices get the lighter version.
import { grainState } from './state.js';
import { K } from './keyframes.js';

const LIGHT = ['#f6efe3', '#f6efe3', '#f6efe3', '#f6efe3', '#f5e6d6', '#fbf2df', '#f3dcc9', '#f1d3ba', '#f3dcc9', '#f3dcc9', '#f6efe3', '#f6efe3', '#f6efe3', '#f6efe3', '#f6efe3'];
const DARK = ['#16110e', '#16110e', '#16110e', '#16110e', '#20160f', '#2f2217', '#2d1a13', '#361d12', '#2d1a13', '#2d1a13', '#16110e', '#16110e', '#16110e', '#16110e', '#16110e'];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export async function startGrain({ number, ingredients }) {
  let canvas = document.getElementById('grain-canvas');
  if (!canvas) return null;
  // ?grain=webgl|2d|off forces a renderer (for testing); ?grain=off hides the canvas entirely.
  const forced = new URLSearchParams(location.search).get('grain');
  if (forced === 'off') { canvas.remove(); return null; }
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const phoneMq = matchMedia('(max-width: 59.99rem)'); // the same break as the stylesheet's stage layout
  let reduced = reducedMq.matches;
  grainState.reduced = reduced;

  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let n = lowEnd ? 3000 : 6000;
  performance.mark('grain:start');
  try { await document.fonts.ready; } catch { /* no font API */ }
  performance.mark('grain:fonts');
  const fontFamily = "'Fraunces', Georgia, serif";
  const opts = () => ({ n, reduced, number, ingredients, fontFamily });

  let renderer = null, swapping = false;
  async function makeRenderer(kind) {
    swapping = true;
    if (renderer) {
      renderer.destroy();
      // a canvas keeps its first context type for life, so a renderer change needs a fresh element
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
    if (kind === 'webgl') {
      try {
        const m = await import('./webgl.js');
        renderer = m.create(canvas, opts());
        await renderer.ready;
        swapping = false;
        return;
      } catch (err) {
        console.warn('grain: WebGL unavailable, using 2D', err);
      }
    }
    const m = await import('./canvas2d.js');
    n = Math.min(n, 1500);
    renderer = m.create(canvas, opts());
    await renderer.ready;
    swapping = false;
  }
  // Creating the WebGL2 context is the capability test: if it fails, the 2D version takes over.
  await makeRenderer(forced === '2d' ? '2d' : 'webgl');
  await renderer.ready;
  performance.mark('grain:ready');
  performance.measure('grain:bootstrap', 'grain:start', 'grain:ready');
  grainState.focus = [renderer.box.cx, renderer.box.cy, 0];
  const watch = !forced;
  document.documentElement.dataset.grain = renderer.kind;

  // ---- scroll → progress
  const sections = [...document.querySelectorAll('[data-key]')].sort((a, b) => +a.dataset.key - +b.dataset.key);
  let tops = [];
  // Section positions are read once per layout change, after the browser has painted, so the read
  // never forces a synchronous layout of this very tall page.
  let measurePending = 0;
  function measure() {
    if (measurePending) return;
    measurePending = requestAnimationFrame(() => setTimeout(() => {
      measurePending = 0;
      const y = window.scrollY;
      tops = sections.map((el) => el.getBoundingClientRect().top + y);
    }, 0));
  }
  function targetProgress() {
    if (!tops.length) return 0;
    const vh = window.innerHeight;
    // On a phone the text of a beat starts under the stage, so the grain forms earlier and faster: it is
    // in place by the time the headline has scrolled into view.
    const phone = phoneMq.matches;
    const y = window.scrollY + vh * (phone ? 0.78 : 0.42);
    let k = 0;
    for (let i = 0; i < tops.length; i += 1) if (y >= tops[i]) k = i;
    // keyframe k forms as section k arrives: progress runs from k-1 to k over the first 80vh of the section
    const span = Math.min(vh * (phone ? 0.5 : 0.8), k + 1 < tops.length ? tops[k + 1] - tops[k] : vh);
    const t = Math.max(0, Math.min(1, (y - tops[k]) / Math.max(1, span)));
    return Math.max(0, k - 1 + (reduced ? (t > 0.5 ? 1 : 0) : t));
  }

  // ---- colour journey
  const root = document.documentElement;
  let lastBg = '';
  function tint(p) {
    const pal = darkMq.matches ? DARK : LIGHT;
    const k = Math.min(K - 2, Math.floor(p));
    const t = p - k;
    const a = hex(pal[k]), b = hex(pal[k + 1]);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const bg = `rgb(${c[0]},${c[1]},${c[2]})`;
    if (bg !== lastBg) { root.style.setProperty('--bg', bg); lastBg = bg; }
  }

  // ---- the loop, with a watchdog. Frames are drawn when something moves; at rest the scene
  // breathes at a lower cadence so the main thread stays free.
  let raf = 0, running = true, last = performance.now(), ema = 16, slowFor = 0, startedAt = performance.now(), swapped = 0;
  let lastP = -1, lastDrawn = 0, lastScrollAt = performance.now(), stageOn = false, stageDone = false;
  addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true });
  function frame(now) {
    if (!running) return;
    const dt = Math.min(100, now - last); last = now;
    const target = targetProgress();
    const p = grainState.progress;
    const next = reduced ? target : p + (target - p) * Math.min(1, dt / 90);
    grainState.progress = Math.abs(next - target) < 0.0005 ? target : next;
    if (!grainState.cookUser) {
      // the pot colours by itself as the visitor scrolls through section 06, until they take the slider
      const local = Math.max(0, Math.min(1, (grainState.progress - 5.5) / 1.2));
      if (local !== grainState.cook) { grainState.cook = local; cookListeners.forEach((fn) => fn(local)); }
    }
    tint(grainState.progress);
    const s = grainState;
    // the phone's stage strip is up through the story beats (01 to 09) and gone for the reference sections
    const stage = phoneMq.matches && s.progress > 0.8 && s.progress < 9.85;
    if (stage !== stageOn) { stageOn = stage; root.classList.toggle('stage-on', stage); }
    // past the story there is no room beside the text on a phone, so the grain bows out until scrolled back
    const done = phoneMq.matches && s.progress >= 9.85;
    if (done !== stageDone) { stageDone = done; root.classList.toggle('stage-done', done); }
    const moving = Math.abs(s.progress - lastP) > 1e-4 || s.heat > 0.01 || Math.abs(s.spinVel[0]) + Math.abs(s.spinVel[1]) > 1e-4 || now - lastScrollAt < 300;
    lastP = s.progress;
    const alive = !reduced; // idle breathing, the slow turn of the single grain
    const idleEvery = 1000 / 24;
    const due = moving || (alive && now - lastDrawn >= idleEvery) || lastDrawn === 0;
    if (due && !swapping && !stageDone) {
      const t0 = performance.now();
      try { renderer.render(now); } catch (err) { console.warn('grain: frame failed', err); }
      stats.frames += 1; stats.renderMs += performance.now() - t0; stats.maxMs = Math.max(stats.maxMs, performance.now() - t0);
      lastDrawn = now;
      // watchdog: if we cannot hold roughly 40 fps while moving, lighten the load
      if (watch && moving && now - startedAt > 3000 && document.visibilityState === 'visible') {
        ema = ema * 0.9 + dt * 0.1;
        slowFor = ema > 26 ? slowFor + dt : 0;
        if (slowFor > 2000 && swapped < 2) {
          swapped += 1; slowFor = 0; ema = 16; startedAt = now;
          if (renderer.kind === 'webgl' && n > 3000) { n = 3000; makeRenderer('webgl').then(measure); }
          else { makeRenderer('2d').then(measure); }
        }
      }
    }
    raf = requestAnimationFrame(frame);
  }

  const cookListeners = new Set();
  const stats = { frames: 0, renderMs: 0, maxMs: 0 };
  function onResize() { renderer.rebuild().then(() => { measure(); if (!grainState.focusCard) grainState.focus = [renderer.box.cx, renderer.box.cy, 0]; }); }
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(onResize, 150); });
  if ('ResizeObserver' in window) {
    let ro;
    new ResizeObserver(() => { clearTimeout(ro); ro = setTimeout(measure, 120); }).observe(document.body);
  }
  addEventListener('load', measure, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; last = performance.now(); startedAt = last; raf = requestAnimationFrame(frame); }
  });
  reducedMq.addEventListener?.('change', (e) => { reduced = e.matches; grainState.reduced = reduced; makeRenderer(renderer.kind).then(measure); });
  darkMq.addEventListener?.('change', () => { lastBg = ''; });

  const y0 = window.scrollY;
  tops = sections.map((el) => el.getBoundingClientRect().top + y0); // one read, right after the bootstrap's own layout
  grainState.progress = targetProgress();
  raf = requestAnimationFrame(frame);

  const api = {
    get renderer() { return renderer; },
    stats,
    onCook(fn) { cookListeners.add(fn); },
    measure,
    toScreen: (x, y) => renderer.toScreen(x, y),
    toWorld: (x, y) => renderer.toWorld(x, y),
  };
  if (forced) window.__grain = api; // test hook, only with ?grain=
  return api;
}
