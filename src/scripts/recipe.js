// The hidden recipe. Six ingredients hide around the page; find them all and the card unlocks.
// Progress stays in this browser only (localStorage), nothing leaves the device.
const KEY = 'jollof-recipe-found';

export function initRecipe() {
  const root = document.querySelector('[data-recipe]');
  if (!root) return;
  const slots = [...root.querySelectorAll('[data-recipe-slot]')];
  const count = root.querySelector('[data-recipe-count]');
  const printBtn = root.querySelector('[data-recipe-print]');
  const resetBtn = root.querySelector('[data-recipe-reset]');
  const card = document.querySelector('[data-recipe-card]');
  const closeBtn = card?.querySelector('[data-recipe-close]');
  const ids = slots.map((s) => s.dataset.recipeSlot);
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]').filter((id) => ids.includes(id))); } catch { /* storage blocked */ }

  function save() { try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch { /* ignore */ } }
  function paint() {
    slots.forEach((s) => s.classList.toggle('found', found.has(s.dataset.recipeSlot)));
    if (count) count.textContent = String(found.size);
    const all = found.size === ids.length;
    if (printBtn) printBtn.disabled = !all;
    if (resetBtn) resetBtn.hidden = found.size === 0;
    document.querySelectorAll('[data-find]').forEach((b) => {
      const got = found.has(b.dataset.find);
      if (got) { b.setAttribute('data-found', ''); if (!b.matches('.grain-find')) b.textContent = 'Taken. Count it in the recipe below.'; }
    });
  }
  function collect(id, fromEl) {
    if (!ids.includes(id) || found.has(id)) return;
    found.add(id); save(); paint();
    const slot = slots.find((s) => s.dataset.recipeSlot === id);
    const label = slot?.querySelector('.slot-label')?.textContent || id;
    announce(`Found: ${label}. ${found.size} of ${ids.length}.`);
    fromEl?.setAttribute('aria-disabled', 'true');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-find]');
    if (b) collect(b.dataset.find, b);
  });
  printBtn?.addEventListener('click', () => {
    if (!card) return;
    card.hidden = false;
    closeBtn?.focus();
    setTimeout(() => window.print(), 250);
  });
  closeBtn?.addEventListener('click', () => { card.hidden = true; printBtn?.focus(); });
  card?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { card.hidden = true; printBtn?.focus(); } });
  resetBtn?.addEventListener('click', () => {
    found.clear(); save(); paint();
    document.querySelectorAll('[data-find]').forEach((b) => { b.removeAttribute('data-found'); b.removeAttribute('aria-disabled'); });
    announce('Hidden again.');
  });

  let live = document.getElementById('recipe-live');
  if (!live) {
    live = document.createElement('p');
    live.id = 'recipe-live'; live.className = 'visually-hidden'; live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }
  function announce(msg) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 50); }
  paint();
  return { collect };
}
