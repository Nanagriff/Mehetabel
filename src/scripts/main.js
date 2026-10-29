import { initReveals, initCounters, initHandwriting, initSkip } from './motion.js';
import { initGrainTurn, initIngredients, initHeat, initCook, initPlates, initCompare, initCards, initSkills, initRecord, initContact } from './interactions.js';
import { initGame } from './game.js';
import { initRecipe } from './recipe.js';
import content from '../content/content.json';

initReveals();
initCounters();
initHandwriting();
initSkip();
initIngredients();
initPlates();
initCompare();
initRecord();
initContact();
initGame();
initRecipe();
initSkills();
initHeat();

// The grain loads last and separately, so the page is interactive before Three.js arrives.
const main = document.getElementById('main');
const number = String(main?.dataset.keyNumber || '1000');
const ingredients = content.ingredients.map((i) => ({ colour: i.colour }));

const whenIdle = (fn) => {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
};
new Promise((resolve) => whenIdle(resolve))
  .then(() => import('./grain/index.js'))
  .then((m) => m.startGrain({ number, ingredients }))
  .then((grain) => {
    initGrainTurn(grain);
    initCook(grain);
    initCards(grain);
  })
  .catch((err) => {
    console.warn('grain canvas did not start', err);
    initGrainTurn(null);
    initCook(null);
    initCards(null);
  });
