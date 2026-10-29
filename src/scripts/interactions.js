// Every small interaction on the page. Each one degrades to plain HTML without JavaScript.
import { grainState } from './grain/state.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 01 · drag to turn the grain; Enter on the handle looks inside.
export function initGrainTurn(grain) {
  const section = document.getElementById('one-grain');
  const handle = document.querySelector('[data-grain-handle]');
  const inside = document.querySelector('[data-grain-inside]');
  if (!section) return;
  let down = null, moved = false;
  section.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input')) return;
    down = [e.clientX, e.clientY]; moved = false;
    section.setPointerCapture?.(e.pointerId);
  });
  section.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down[0], dy = e.clientY - down[1];
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    grainState.spinVel[1] = dx * 0.0025;
    grainState.spinVel[0] = dy * 0.0015;
    down = [e.clientX, e.clientY];
  });
  const up = () => {
    if (down && !moved && inside) reveal();
    down = null;
  };
  section.addEventListener('pointerup', up);
  section.addEventListener('pointercancel', () => { down = null; });
  function reveal() {
    if (!inside || !inside.hidden) return;
    inside.hidden = false;
    inside.focus();
  }
  handle?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { grainState.spin[1] -= 0.25; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { grainState.spin[1] += 0.25; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { grainState.spin[0] -= 0.2; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { grainState.spin[0] += 0.2; e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
  });
  handle?.addEventListener('click', () => { grainState.spinVel[1] += 0.08; });
}

// 03 · ingredient notes.
export function initIngredients() {
  const list = document.querySelector('[data-ingredients]');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.ing');
    if (!btn) return;
    const open = btn.getAttribute('aria-expanded') === 'true';
    list.querySelectorAll('.ing').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      document.getElementById(b.getAttribute('aria-controls'))?.classList.remove('open');
    });
    if (!open) {
      btn.setAttribute('aria-expanded', 'true');
      document.getElementById(btn.getAttribute('aria-controls'))?.classList.add('open');
    }
  });
}

// 04 · raise the heat. Hover or touch raises it over time; the slider does the same with a keyboard.
export function initHeat(onHot) {
  const zone = document.getElementById('fire');
  const range = document.querySelector('[data-heat]');
  const status = document.querySelector('[data-heat-status]');
  const find = document.querySelector('[data-find-fire]');
  if (!zone || !range) return;
  let hover = false, userRange = false, hotSince = 0, lastT = performance.now(), raf = 0;
  const words = (h) => (h < 0.1 ? 'Cold pan.' : h < 0.4 ? 'Warming through.' : h < 0.7 ? 'The base starts to colour.' : h < 0.92 ? 'Deep red, smoky edges.' : 'Any longer and it burns.');
  function tick(now) {
    const dt = Math.min(100, now - lastT); lastT = now;
    if (!userRange) {
      const target = hover ? 1 : 0;
      grainState.heat += (target - grainState.heat) * Math.min(1, dt / (hover ? 900 : 500));
      range.value = String(Math.round(grainState.heat * 100));
    }
    if (status) { const w = words(grainState.heat); if (status.textContent !== w) status.textContent = w; }
    // held at full heat for 2.5 s of real time, however slow the frames are
    if (grainState.heat > 0.9) { if (!hotSince) hotSince = now; } else hotSince = 0;
    if (hotSince && now - hotSince > 2500 && find && find.hidden) { find.hidden = false; onHot?.(); }
    if (grainState.heat > 0.002 || hover) raf = requestAnimationFrame(tick); else { raf = 0; grainState.heat = 0; }
  }
  const start = () => { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } };
  zone.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { hover = true; userRange = false; start(); } });
  zone.addEventListener('pointerleave', () => { hover = false; userRange = false; start(); });
  zone.addEventListener('touchstart', () => { hover = true; userRange = false; start(); }, { passive: true });
  zone.addEventListener('touchend', () => { hover = false; start(); }, { passive: true });
  range.addEventListener('input', () => { userRange = true; hover = false; grainState.heat = +range.value / 100; start(); });
  range.addEventListener('blur', () => { userRange = false; start(); });
}

// 06 · scrub the pot.
export function initCook(grain) {
  const range = document.querySelector('[data-cook]');
  if (!range) return;
  const labels = ['Raw', 'Steaming', 'Turning', 'Ready'];
  const say = (v) => range.setAttribute('aria-valuetext', labels[Math.min(3, Math.floor(v * 3.99))]);
  range.addEventListener('input', () => { grainState.cookUser = true; grainState.cook = +range.value / 100; say(grainState.cook); });
  grain?.onCook((v) => { if (!grainState.cookUser) { range.value = String(Math.round(v * 100)); say(v); } });
}

// 07 · turn the plate.
export function initPlates() {
  document.querySelectorAll('[data-plate-turn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fig = btn.closest('.plate');
      const turned = fig.classList.toggle('turned');
      btn.setAttribute('aria-pressed', String(turned));
    });
  });
}

// 09 · before and after.
export function initCompare() {
  document.querySelectorAll('[data-compare]').forEach((box) => {
    const range = box.querySelector('[data-compare-range]');
    const set = (v) => box.style.setProperty('--pos', `${v}%`);
    range?.addEventListener('input', () => set(range.value));
    set(range?.value ?? 50);
  });
}

// 10 · project cards open; the grain cluster drifts behind the open card.
export function initCards(grain) {
  const list = document.querySelector('[data-cards]');
  if (!list) return;
  const cards = [...list.querySelectorAll('.card')];
  let active = null;
  function focusOn(card) {
    active = card;
    grainState.focusCard = !!card;
    if (!grain) return;
    if (!card) { const b = grain.renderer.box; grainState.focus = [b.cx, b.cy, 0]; return; }
    const r = card.getBoundingClientRect();
    const [x, y] = grain.toWorld(r.left + r.width * 0.5, r.top + r.height * 0.5);
    grainState.focus = [x, y, 0];
  }
  addEventListener('scroll', () => { if (active && grainState.progress > 9 && grainState.progress < 11.5) focusOn(active); }, { passive: true });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-toggle');
    if (!btn) return;
    const card = btn.closest('.card');
    const open = !card.classList.contains('open');
    cards.forEach((c) => { c.classList.remove('open'); c.querySelector('.card-toggle')?.setAttribute('aria-expanded', 'false'); });
    if (open) {
      card.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => focusOn(card));
      // light up the skills this card used
      const used = (card.dataset.skills || '').split(' ');
      document.querySelectorAll('[data-skill]').forEach((chip) => chip.classList.toggle('used', used.includes(chip.dataset.skill)));
    } else {
      focusOn(card);
      document.querySelectorAll('[data-skill]').forEach((chip) => chip.classList.remove('used'));
    }
    grain?.measure();
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis && !list.querySelector('.card.open')) focusOn(vis.target);
    }, { threshold: [0.3, 0.6, 0.9] });
    cards.forEach((c) => io.observe(c));
  }
}

// 11 · tap a skill to highlight the projects that used it.
export function initSkills(onSecret) {
  const root = document.querySelector('[data-shelves]');
  const status = document.querySelector('[data-skills-status]');
  if (!root) return;
  const cards = [...document.querySelectorAll('[data-card]')];
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-skill]');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') !== 'true';
    root.querySelectorAll('[data-skill]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    root.querySelectorAll('[data-skill-secret]').forEach((b) => { b.hidden = true; });
    if (!on) {
      cards.forEach((c) => c.classList.remove('dim', 'lit'));
      if (status) status.textContent = '';
      return;
    }
    chip.setAttribute('aria-pressed', 'true');
    const id = chip.dataset.skill;
    const lit = cards.filter((c) => (c.dataset.skills || '').split(' ').includes(id));
    cards.forEach((c) => { c.classList.toggle('lit', lit.includes(c)); c.classList.toggle('dim', !lit.includes(c)); });
    if (status) status.textContent = lit.length ? `${chip.textContent.trim()}: used in ${lit.map((c) => c.querySelector('h3')?.textContent.trim()).join(', ')}. The cards above are highlighted.` : `${chip.textContent.trim()}: not tied to a project yet.`;
    const secret = root.querySelector(`[data-skill-secret="${id}"]`);
    if (secret) { secret.hidden = false; onSecret?.(); }
  });
}

// 12 · the whole list, and flip cards.
export function initRecord() {
  const btn = document.querySelector('[data-timeline-toggle]');
  const list = document.querySelector('[data-timeline]');
  btn?.addEventListener('click', () => {
    const all = list.classList.toggle('show-all');
    btn.setAttribute('aria-expanded', String(all));
    btn.textContent = all ? btn.dataset.less : btn.dataset.more;
  });
  document.querySelectorAll('.flip').forEach((f) => {
    f.addEventListener('click', () => f.setAttribute('aria-pressed', f.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  });
}

// 14 · copy the email; the form opens the visitor's own mail app.
export function initContact() {
  const btn = document.querySelector('[data-copy-email]');
  const email = document.querySelector('[data-email]');
  btn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email.textContent.trim());
      const was = btn.textContent;
      btn.textContent = btn.dataset.copied || 'Copied';
      setTimeout(() => { btn.textContent = was; }, 1800);
    } catch {
      email.focus();
    }
  });
  const form = document.querySelector('[data-enquiry]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const to = email?.textContent.trim() || form.action.replace('mailto:', '');
    const subject = encodeURIComponent(`Enquiry: ${d.get('about') || ''}`.trim());
    const body = encodeURIComponent(`${d.get('message')}\n\n${d.get('name')}\n${d.get('email')}`);
    location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}
