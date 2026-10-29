// Small motion: text fades, counters that count once, the handwriting that draws itself, skip controls.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initReveals() {
  const els = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach((el) => io.observe(el));
}

export function initCounters() {
  const nums = document.querySelectorAll('[data-count]');
  const fmt = new Intl.NumberFormat('en-GB');
  if (reduced || !('IntersectionObserver' in window)) return; // the full number is already in the HTML
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target;
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const dur = Math.min(2200, 700 + Math.log10(target + 1) * 350);
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e2 = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt.format(Math.round(target * e2)) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      el.textContent = '0' + suffix;
      requestAnimationFrame(step);
    }
  }, { threshold: 0.4 });
  nums.forEach((el) => io.observe(el));
}

// "love" draws itself stroke by stroke, then her paragraph rises beneath it.
export function initHandwriting() {
  const svg = document.querySelector('[data-handwriting]');
  const text = document.querySelector('[data-secret-text]');
  if (!svg) { text?.classList.add('in'); return; }
  const paths = [...svg.querySelectorAll('path')];
  if (reduced || !('IntersectionObserver' in window)) { text?.classList.add('in'); return; }
  let total = 0;
  const lens = paths.map((p) => { const l = p.getTotalLength(); total += l; return l; });
  paths.forEach((p, i) => { p.style.strokeDasharray = `${lens[i]} ${lens[i]}`; p.style.strokeDashoffset = lens[i]; });
  const speed = 0.28; // px per ms: slow enough to watch the pen, about five seconds for the word
  let done = false;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting) || done) return;
    done = true;
    io.disconnect();
    let delay = 300;
    paths.forEach((p, i) => {
      const dur = lens[i] / speed / 1000;
      p.style.transition = `stroke-dashoffset ${dur.toFixed(2)}s cubic-bezier(.45,.05,.55,.95) ${(delay / 1000).toFixed(2)}s`;
      delay += dur * 1000 + 120;
    });
    requestAnimationFrame(() => paths.forEach((p) => { p.style.strokeDashoffset = '0'; }));
    setTimeout(() => text?.classList.add('in'), Math.min(delay, 4500) - 300);
  }, { threshold: 0.6 });
  io.observe(svg.closest('.secret-pin') || svg);
}

// "Press any key to skip" on the hero, and smooth anchor scrolling that respects reduced motion.
export function initSkip() {
  const hero = document.getElementById('hello');
  const work = document.getElementById('work');
  const label = document.querySelector('[data-press-key]');
  if (!hero || !work) return;
  let heroVisible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { heroVisible = e[0].isIntersecting; }, { threshold: 0.3 }).observe(hero);
  }
  addEventListener('keydown', (e) => {
    if (!heroVisible || e.metaKey || e.ctrlKey || e.altKey) return;
    if (['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape'].includes(e.key)) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.tagName === 'A')) return;
    e.preventDefault();
    label?.classList.add('pressed');
    work.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    work.querySelector('h2')?.focus?.();
  });
  // anchor links: keep the browser's hash but scroll smoothly and move focus
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.pushState(null, '', `#${id}`);
    const h = el.querySelector('h1, h2, h3');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  });
}
