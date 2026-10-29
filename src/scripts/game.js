// The jollof timer: ninety seconds, one pot. Everything runs in the browser.
const STEPS = ['oil', 'onions', 'pepper', 'stock', 'rice', 'cover'];
const WINDOWS = { oil: [0, 8], onions: [6, 18], pepper: [16, 32], stock: [32, 48], rice: [44, 58], cover: [54, 68] };
const LIFT_WINDOW = [78, 90];
const NAMES = { oil: 'Oil', onions: 'Onions', pepper: 'Pepper base', stock: 'Stock', rice: 'Rice', cover: 'Lid' };
const PROMPTS = {
  oil: 'Cold pan. Start with the oil, then bring the heat up.',
  onions: 'Oil is shimmering. Onions when it is hot but not smoking.',
  pepper: 'Onions soft. The pepper base goes in now, and it needs to fry hard.',
  stock: 'The base is darkening and the oil is separating. Stock when it smells sweet, not raw.',
  rice: 'Stock is bubbling. Rice goes in, stir once, then leave it.',
  cover: 'Cover it tight and drop the heat low. Do not peek.',
  lift: 'It is steaming under the lid. A short burst of heat at the end gives the smoky bottom. Lift when you believe in it.',
};
const DURATION = 90;

// The heat band that counts as right, by stage.
function band(stage) {
  if (stage < 2) return [55, 82]; // frying oil and onions
  if (stage < 5) return [45, 70]; // pepper base, stock, rice
  return [18, 42]; // under the lid
}

export function initGame() {
  const root = document.querySelector('[data-game]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  const rules = q('[data-game-rules]'), board = q('[data-game-board]'), result = q('[data-game-result]');
  const clock = q('[data-game-clock]'), phase = q('[data-game-phase]'), log = q('[data-game-log]');
  const heat = q('[data-game-heat]'), heatLabel = q('[data-game-heat-label]'), bandEl = q('[data-game-band]');
  const flames = q('[data-game-flames]'), contents = q('[data-game-contents]'), floor = q('[data-game-floor]'), lid = q('[data-game-lid]');
  const stepBtns = STEPS.map((id) => q(`[data-game-step="${id}"]`));
  const lift = q('[data-game-lift]');
  const scoreEl = q('[data-game-score]'), verdict = q('[data-game-verdict]'), breakdown = q('[data-game-breakdown]');

  let timer = 0, t = 0, stage = 0, done = {}, inBand = 0, cooking = 0, burn = 0, smoky = 0, overLid = 0, lidAt = -1, finished = false;

  function reset() {
    t = 0; stage = 0; done = {}; inBand = 0; cooking = 0; burn = 0; smoky = 0; overLid = 0; lidAt = -1; finished = false;
    heat.value = '45';
    stepBtns.forEach((b) => { b.disabled = true; b.removeAttribute('data-done'); b.removeAttribute('data-next'); });
    lift.disabled = true;
    log.textContent = '';
    paint();
  }
  function start() {
    reset();
    rules.hidden = true; result.hidden = true; board.hidden = false;
    nextStep();
    heat.focus();
    clearInterval(timer);
    timer = setInterval(tick, 100);
  }
  function nextStep() {
    stepBtns.forEach((b) => { b.disabled = true; b.removeAttribute('data-next'); });
    if (stage < STEPS.length) {
      stepBtns[stage].disabled = false;
      stepBtns[stage].setAttribute('data-next', '');
      phase.textContent = PROMPTS[STEPS[stage]];
    } else {
      phase.textContent = PROMPTS.lift;
      lift.disabled = false;
    }
    const [lo, hi] = band(stage);
    bandEl.style.left = `${lo}%`; bandEl.style.width = `${hi - lo}%`;
  }
  function addStep(id) {
    if (STEPS[stage] !== id || finished) return;
    done[id] = t;
    stepBtns[stage].setAttribute('data-done', '');
    const [lo, hi] = WINDOWS[id];
    const early = t < lo, late = t > hi;
    log.textContent = early ? `${NAMES[id]} in a little early at ${t.toFixed(0)} s.` : late ? `${NAMES[id]} in late at ${t.toFixed(0)} s.` : `${NAMES[id]} in at ${t.toFixed(0)} s. Good.`;
    if (id === 'cover') lidAt = t;
    stage += 1;
    nextStep();
  }
  function tick() {
    if (finished) return;
    t += 0.1;
    const h = +heat.value;
    const [lo, hi] = band(stage);
    if (stage >= 3) { cooking += 0.1; if (h >= lo && h <= hi) inBand += 0.1; }
    if (h > 85) burn += 0.1 * (stage >= 2 ? 1 : 0.4);
    if (lidAt >= 0) {
      if (h >= 60 && h <= 78) smoky += 0.1;
      if (h > 85) overLid += 0.1;
    }
    paint();
    if (t >= DURATION) finish(false);
  }
  function paint() {
    clock.textContent = String(Math.max(0, Math.ceil(DURATION - t)));
    const h = +heat.value;
    heatLabel.textContent = h < 20 ? '(barely on)' : h < 45 ? '(low)' : h < 70 ? '(medium)' : h < 85 ? '(high)' : '(too hot)';
    [...flames.children].forEach((f, i) => { f.style.opacity = String(0.15 + (h / 100) * 0.85); f.style.transform = `scaleY(${0.4 + (h / 100) * (0.9 + i * 0.1)})`; });
    const colour = Math.min(1, cooking > 0 ? (inBand / Math.max(cooking, 1)) * Math.min(1, cooking / 25) : 0);
    const stageTint = stage >= 3 ? colour : stage >= 2 ? 0.25 : 0;
    const burnt = Math.min(1, burn / 8);
    const r = Math.round(230 + (184 - 230) * stageTint + (60 - 184) * burnt * stageTint);
    const g = Math.round(213 + (50 - 213) * stageTint);
    const b = Math.round(184 + (30 - 184) * stageTint);
    contents.setAttribute('fill', `rgb(${r},${g},${b})`);
    contents.setAttribute('y', String(stage === 0 ? 118 : stage < 4 ? 100 : 64));
    floor.setAttribute('opacity', String(Math.min(1, smoky / 7)));
    lid.setAttribute('opacity', lidAt >= 0 ? '1' : '0');
  }
  function finish(lifted) {
    finished = true;
    clearInterval(timer);
    const liftT = lifted ? t : DURATION;
    // timing: each step scored against its window
    let timing = 0;
    for (const id of STEPS) {
      if (done[id] == null) continue;
      const [lo, hi] = WINDOWS[id];
      const off = done[id] < lo ? lo - done[id] : done[id] > hi ? done[id] - hi : 0;
      timing += Math.max(0, 1 - off / 10);
    }
    let liftScore = 0;
    if (lidAt >= 0) {
      const off = liftT < LIFT_WINDOW[0] ? LIFT_WINDOW[0] - liftT : 0;
      liftScore = Math.max(0, 1 - off / 12);
    }
    const texture = Math.round(((timing + liftScore) / (STEPS.length + 1)) * 40);
    // colour: time in band after the base went in, minus burn
    const colourFrac = cooking > 0 ? inBand / cooking : 0;
    let colour = Math.round(colourFrac * 40 * Math.min(1, cooking / 30));
    const burnt = burn > 3 || overLid > 2;
    if (burnt) colour = Math.max(0, colour - Math.round(Math.min(30, (burn + overLid) * 4)));
    const pale = colourFrac < 0.35;
    // smoky bottom: a short spell of real heat under the lid, not a long one
    let bonus = 0;
    if (lidAt >= 0 && !burnt) {
      if (smoky >= 4 && smoky <= 9) bonus = 20;
      else if (smoky > 9 && smoky <= 13) bonus = 10;
      else if (smoky > 1.5) bonus = Math.round((smoky / 4) * 12);
    }
    const total = Math.max(0, Math.min(100, texture + colour + bonus));
    const lines = [];
    if (lidAt < 0) lines.push('The lid never went on, so nothing steamed through.');
    if (burnt) lines.push('Too hot for too long: the bottom went past smoky into bitter.');
    else if (pale && lidAt >= 0) lines.push('Too timid on the heat: the rice came out pale.');
    if (bonus === 20) lines.push('That is the smoky bottom. Guests will fight over it.');
    const v = total >= 85 ? 'Party jollof.' : total >= 65 ? 'Good jollof.' : total >= 40 ? 'Edible, with notes.' : 'Back to the pot.';
    scoreEl.textContent = String(total);
    verdict.textContent = `${v} ${lines.join(' ')}`.trim();
    breakdown.innerHTML = '';
    for (const [k, val, max] of [['Colour', colour, 40], ['Texture and timing', texture, 40], ['Smoky bottom', bonus, 20]]) {
      const li = document.createElement('li');
      li.textContent = `${k}: ${val} of ${max}`;
      breakdown.appendChild(li);
    }
    board.hidden = true;
    result.hidden = false;
    q('[data-game-again]')?.focus();
  }

  q('[data-game-start]')?.addEventListener('click', start);
  q('[data-game-notnow]')?.addEventListener('click', () => { document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); });
  q('[data-game-again]')?.addEventListener('click', start);
  stepBtns.forEach((b) => b?.addEventListener('click', () => addStep(b.dataset.gameStep)));
  lift?.addEventListener('click', () => finish(true));
  heat.addEventListener('input', paint);
  addEventListener('pagehide', () => clearInterval(timer));
  reset();
}
