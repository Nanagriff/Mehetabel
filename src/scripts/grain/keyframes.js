// Builds every keyframe of the grain story as flat arrays. Pure data: used by both renderers.
// Positions are in world units where the viewport is 2 units tall (y from -1 to 1) and 2*aspect wide.

export const K = 15;

// How particles travel INTO each keyframe: 0 tween, 1 pour from above, 2 lift and settle.
export const MODE = [0, 0, 1, 1, 2, 0, 0, 0, 2, 2, 2, 0, 0, 2, 0];
// How spread out the per-particle delay is for each arrival (0 = all at once, 1 = very staggered).
export const STAGGER = [0, 0, 0.75, 0.8, 0.6, 0.2, 0.2, 0.5, 0.6, 0.7, 0.5, 0.4, 0.4, 0.6, 0.3];
// Relative grain size per keyframe.
export const SIZE = [0, 0, 1, 1, 0.82, 0.85, 0.82, 0.8, 0.55, 0.95, 1.1, 1.2, 1.15, 1.1, 0];
// On a phone the word at 09 is small, so its grains shrink to keep the letters readable.
export const sizeFor = (mobile) => { const s = SIZE.slice(); if (mobile) s[9] = 0.5; return s; };

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The region of the screen the grain lives in: right of the text column on wide screens,
// above it on narrow ones.
export function layoutBox(aspect, mobile) {
  if (mobile) return { cx: 0, cy: 0.56, w: aspect * 1.7, h: 0.52 };
  return { cx: aspect * 0.56, cy: 0.02, w: aspect * 0.72, h: 1.2 };
}

// The pot, the plate and the table: shared by the keyframes and the painted props.
export function potLayout(box) {
  const w = box.w * 0.58, h = box.h * 0.74;
  const top = box.cy + h * 0.16;
  return { w, h, top, bottom: top - h * 0.6, rimRx: (w / 2) * 1.08, rimRy: w * 0.16, moundH: h * 0.15 };
}
// The fire under the pot: a quad whose bottom sits just under the pot's base.
export function fireLayout(box) {
  const L = potLayout(box);
  const base = L.bottom - L.rimRy * 0.9 - L.h * 0.07;
  const fh = L.h * 0.72;
  return { cx: box.cx, cy: base + fh / 2, w: L.w * 1.3, h: fh };
}
export function plateLayout(box) {
  return { r: Math.min(box.w, box.h) * 0.42 };
}
export function tableLayout(box, mobile) {
  const tw = box.w * 0.98, th = box.h * (mobile ? 0.5 : 0.42);
  const plates = mobile ? 4 : 6, rows = 2;
  const pr = Math.min(tw / (plates + 1) / 2.2, th / rows / 2.6);
  const places = [];
  for (let row = 0; row < rows; row += 1) for (let j = 0; j < plates; j += 1) places.push([box.cx - tw / 2 + (tw / plates) * (j + 0.5), box.cy - th / 2 + (th / rows) * (row + 0.5)]);
  return { tw, th, pr, places };
}

// Where the single rendered grain sits at keyframes 0, 1 and 14.
export function meshKeyframes(aspect, mobile, box) {
  const start = mobile ? [aspect * 0.55, -0.88, 0] : [box.cx - box.w * 0.25, -0.8, 0];
  return {
    0: { pos: start, scale: 0.075, opacity: 1 },
    1: { pos: [box.cx, box.cy, 0], scale: mobile ? 0.26 : 0.36, opacity: 1 },
    14: { pos: [box.cx, box.cy, 0], scale: mobile ? 0.12 : 0.15, opacity: 1 },
  };
}

// What a particle is drawn as. Stored in pos.w as order + 2 * kind so both renderers can read it.
export const KIND = { RICE: 0, TOMATO: 1, ONION: 2, PEPPER: 3, SPICE: 4, STOCK: 5, SURFACE: 6, SHADOW: 7, COOKED: 8 };
// Per kind: [elongation (height/width), softness, size multiplier, gloss], and a base alpha.
export const KIND_PARAMS = [
  [0.46, 0, 1, 0.15], // raw rice
  // kinds 1..5 are drawn from the ingredient atlas (sprites.js); only the size multiplier matters
  // (sizes are for a 6000-grain pile; the renderers scale them by sqrt(n / 6000))
  [1, 0, 4.2, 0.75], // a chunk of tomato
  [1, 0, 4, 0.35], // a slice of onion
  [1, 0, 3.6, 0.7], // a piece of pepper
  [1, 0, 2.6, 0.2], // ginger, garlic, peppercorns, thyme
  [1, 0, 3.6, 0], // a pool of stock on the soaked grains
  [1, 0, 0.9, 0.05], // surface (pot, plate, table): small opaque discs that merge into one shape
  [0.65, 1, 4.5, 0], // contact shadow
  [0.42, 0, 1, 0.8], // cooked rice
];
export const KIND_ALPHA = [1, 1, 0.85, 1, 1, 0.5, 1, 1, 1];
export const isSpriteKind = (k) => k >= 1 && k <= 5;
const INGREDIENT_KINDS = [KIND.TOMATO, KIND.ONION, KIND.PEPPER, KIND.SPICE, KIND.STOCK];

const GRAIN = [0.95, 0.9, 0.78];
const GRAIN_DARK = [0.84, 0.76, 0.6];
const RED = [0.93, 0.47, 0.16]; // jollof: tomato and palm-oil orange, as on the plate
const RED_DEEP = [0.74, 0.28, 0.09];
const IVORY = [0.96, 0.94, 0.88];
const IVORY_SHADE = [0.84, 0.8, 0.72];
const ENAMEL = [0.21, 0.18, 0.17];
const WOOD = [0.56, 0.4, 0.26];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Samples `count` points from text rasterised into a box. Returns [[x, y], ...] in box space.
function textPoints(text, count, box, rng, fontFamily) {
  const W = 420;
  const H = 180;
  let cv;
  try {
    cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : document.createElement('canvas');
  } catch {
    cv = document.createElement('canvas');
  }
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const out = [];
  if (!ctx) return out;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let px = 150;
  ctx.font = `800 ${px}px ${fontFamily}`;
  const tw = ctx.measureText(text).width;
  if (tw > W * 0.92) {
    px = Math.floor((px * W * 0.92) / tw);
    ctx.font = `800 ${px}px ${fontFamily}`;
  }
  ctx.fillText(text, W / 2, H / 2 + px * 0.05);
  const data = ctx.getImageData(0, 0, W, H).data;
  const cand = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * 4 + 3] > 120) cand.push(x, y);
    }
  }
  if (cand.length === 0) return out;
  // measure bounds so the glyphs fill the box
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let i = 0; i < cand.length; i += 2) {
    const x = cand[i], y = cand[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  const scale = Math.min(box.w / bw, box.h / bh) * 0.92;
  const m = cand.length / 2;
  for (let i = 0; i < count; i += 1) {
    const j = Math.floor(rng() * m) * 2;
    const x = (cand[j] + rng() - minX - bw / 2) * scale + box.cx;
    const y = -(cand[j + 1] + rng() - minY - bh / 2) * scale + box.cy;
    out.push([x, y]);
  }
  return out;
}

function mound(count, box, rng, widthF = 0.8, heightF = 0.55) {
  const out = [];
  const w = box.w * widthF, h = box.h * heightF;
  const base = box.cy - box.h * 0.45;
  for (let i = 0; i < count; i += 1) {
    const u = rng() * 2 - 1;
    const x = u * w * 0.5;
    const hx = h * Math.pow(Math.max(0, 1 - u * u), 0.85);
    const y = hx * Math.pow(rng(), 0.75);
    out.push([box.cx + x, base + y, (rng() - 0.5) * 0.08]);
  }
  return out;
}

function disc(count, cx, cy, r, rng, ring = 0) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2;
    let rr = Math.sqrt(rng());
    if (ring > 0) rr = ring + (1 - ring) * rr;
    out.push([cx + Math.cos(a) * r * rr, cy + Math.sin(a) * r * rr * 0.96]);
  }
  return out;
}

function rectFill(count, cx, cy, w, h, rng) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push([cx + (rng() - 0.5) * w, cy + (rng() - 0.5) * h]);
  return out;
}

function rectEdge(count, cx, cy, w, h, thick, rng) {
  const out = [];
  const per = 2 * (w + h);
  for (let i = 0; i < count; i += 1) {
    let s = rng() * per;
    const t = (rng() - 0.5) * thick;
    let x, y;
    if (s < w) { x = cx - w / 2 + s; y = cy - h / 2 + t; }
    else if ((s -= w) < h) { x = cx + w / 2 + t; y = cy - h / 2 + s; }
    else if ((s -= h) < w) { x = cx + w / 2 - s; y = cy + h / 2 + t; }
    else { s -= w; x = cx - w / 2 + t; y = cy + h / 2 - s; }
    out.push([x, y]);
  }
  return out;
}

function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * @param {object} o
 * @param {number} o.n particle count
 * @param {number} o.aspect viewport width / height
 * @param {boolean} o.mobile narrow layout
 * @param {string} o.number the key number for section 02
 * @param {Array} o.ingredients [{colour}] from content
 * @param {string} o.fontFamily
 * @returns {{pos: Float32Array, col: Float32Array, box: object}} pos = K*n*4 (x,y,z,order), col = K*n*4 (r,g,b,alpha)
 */
const yieldToMain = () => new Promise((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 0)));

export async function buildKeyframes({ n, aspect, mobile, number, ingredients = [], fontFamily = 'Georgia, serif' }) {
  const rng = mulberry32(1337);
  const box = layoutBox(aspect, mobile);
  const pos = new Float32Array(K * n * 4);
  const col = new Float32Array(K * n * 4);
  const meshK = meshKeyframes(aspect, mobile, box);

  const set = (k, i, x, y, z, order, r, g, b, a, kind = 0) => {
    const o = (k * n + i) * 4;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = Math.min(1, Math.max(0, order)) + 2 * kind;
    col[o] = r; col[o + 1] = g; col[o + 2] = b; col[o + 3] = a;
  };
  // The first few percent of particles are a soft contact shadow under whatever the grains form.
  const shadowN = Math.floor(n * 0.04);
  const shadowAt = (k, i, cx, cy, rx, ry) => {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng());
    set(k, i, cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr, -0.1, 1, 0.32, 0.22, 0.14, 0.16 * (1 - rr * rr * 0.7), KIND.SHADOW);
  };
  const hide = (k, i) => set(k, i, 0, 0, 0, 1, 0, 0, 0, 0, KIND.SHADOW);
  const grainCol = (i) => {
    const t = (i * 0.618033) % 1;
    return [
      GRAIN[0] + (GRAIN_DARK[0] - GRAIN[0]) * t * 0.6,
      GRAIN[1] + (GRAIN_DARK[1] - GRAIN[1]) * t * 0.6,
      GRAIN[2] + (GRAIN_DARK[2] - GRAIN[2]) * t * 0.6,
    ];
  };
  const redCol = (i) => {
    const t = (i * 0.618033) % 1;
    const u = (i * 0.381966) % 1;
    const c = [RED[0] + (RED_DEEP[0] - RED[0]) * t, RED[1] + (RED_DEEP[1] - RED[1]) * t, RED[2] + (RED_DEEP[2] - RED[2]) * t];
    // some grains carry more of the stew, a few from the bottom of the pot are smoky-dark
    if (u < 0.12) return [c[0] * 0.6 + 0.38, c[1] * 0.6 + 0.24, c[2] * 0.6 + 0.1];
    if (u > 0.95) return [c[0] * 0.5, c[1] * 0.45, c[2] * 0.4];
    return c;
  };

  // Ingredient pieces: a handful per ingredient, the very last particles so they draw on top of the rice.
  const spriteN = mobile ? 8 : 11;
  const spriteStart = n - spriteN * ingredients.length;
  const ingOf = (i) => (i >= spriteStart ? Math.floor((i - spriteStart) / spriteN) : -1);
  const ingColours = ingredients.map((g) => hexToRgb(g.colour || '#C9412B'));
  const ingKind = (j) => INGREDIENT_KINDS[Math.min(INGREDIENT_KINDS.length - 1, j)];
  const STOCK_WET = [0.72, 0.48, 0.16];
  const wetCol = new Array(n), ingSpot = new Int8Array(n).fill(-1);

  // 00, 01: hidden at the single grain.
  for (let i = 0; i < n; i += 1) {
    const c = grainCol(i);
    set(0, i, meshK[0].pos[0], meshK[0].pos[1], 0, 0, c[0], c[1], c[2], 0);
    set(1, i, meshK[1].pos[0] + (rng() - 0.5) * 0.3, meshK[1].pos[1] + (rng() - 0.5) * 0.15, 0, 0, c[0], c[1], c[2], 0);
  }

  await yieldToMain();
  // 02: the key number.
  {
    const pts = textPoints(number, n, { cx: box.cx, cy: box.cy, w: box.w, h: box.h * 0.6 }, rng, fontFamily);
    const fallback = mound(n, box, rng);
    for (let i = 0; i < n; i += 1) {
      if (i < shadowN) { hide(2, i); continue; }
      const p = pts[i] || fallback[i];
      const c = grainCol(i);
      set(2, i, p[0], p[1], (rng() - 0.5) * 0.05, 0, c[0], c[1], c[2], 1);
    }
  }

  await yieldToMain();
  // 03: the pile with ingredients landing in it. 04, 05: the same pile, ingredients folded in.
  {
    const pile = mound(n, box, rng);
    const base = box.cy - box.h * 0.45;
    const hMax = box.h * 0.55;
    const spots = ingredients.map((_, j) => {
      const a = (j / Math.max(1, ingredients.length)) * Math.PI;
      return [box.cx + Math.cos(a) * box.w * 0.3, base + hMax * (0.45 + 0.35 * Math.sin(a))];
    });
    const stockIdx = Math.min(ingredients.length - 1, INGREDIENT_KINDS.indexOf(KIND.STOCK));
    const stockSpot = ingredients.length > INGREDIENT_KINDS.indexOf(KIND.STOCK) ? spots[stockIdx] : null;
    for (let i = 0; i < n; i += 1) {
      if (i < shadowN) {
        for (const k of [3, 4, 5]) shadowAt(k, i, box.cx, base - box.h * 0.02, box.w * 0.46, box.h * 0.06);
        continue;
      }
      const p = pile[i];
      const order = Math.min(1, (p[1] - base) / hMax);
      const g = ingOf(i);
      let c = grainCol(i);
      if (g >= 0) {
        ingSpot[i] = g;
        const s = spots[g];
        const ic = ingColours[g];
        const kind = ingKind(g);
        // pieces overlap into one small heap; the stock pools tighter
        const r = (kind === KIND.STOCK ? 0.05 : 0.075) * box.w * Math.sqrt(rng());
        const a = rng() * Math.PI * 2;
        set(3, i, s[0] + Math.cos(a) * r, s[1] + Math.sin(a) * r * 0.7, 0.05, order, ic[0], ic[1], ic[2], 1, kind);
      } else {
        // the stock soaks in: grains around its spot turn wet, gold and glossy
        let kind = KIND.RICE;
        if (stockSpot) {
          const dx = (p[0] - stockSpot[0]) / (box.w * 0.14), dy = (p[1] - stockSpot[1]) / (box.h * 0.13);
          const wet = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
          if (wet > 0.05) {
            const m = Math.pow(wet, 0.45) * (0.8 + rng() * 0.2);
            c = [c[0] + (STOCK_WET[0] - c[0]) * m, c[1] + (STOCK_WET[1] - c[1]) * m, c[2] + (STOCK_WET[2] - c[2]) * m];
            kind = KIND.COOKED;
            wetCol[i] = c;
          }
        }
        set(3, i, p[0], p[1], p[2], order, c[0], c[1], c[2], 1, kind);
      }
    }
  }

  await yieldToMain();
  // 04, 05, 06: the pot (painted, see props.js). At 04 the pile is lifted and dropped in and the fire
  // is lit; at 05 it sits on a low flame; at 06 the stew colours the rice grain by grain and the
  // pieces fold in. Rice is drawn between the pot's back and its front lip.
  {
    const { top, rimRx, rimRy, moundH } = potLayout(box);
    const spotsIn = ingredients.map((_, j) => {
      const a = (j / Math.max(1, ingredients.length)) * Math.PI;
      return [box.cx + Math.cos(a) * rimRx * 0.55, top + Math.sin(a) * rimRy * 0.3 + moundH * 0.75];
    });
    for (let i = 0; i < n; i += 1) {
      if (i < shadowN) { hide(4, i); hide(5, i); hide(6, i); continue; }
      const g = ingSpot[i];
      if (g >= 0) {
        // the pieces sit on top of the raw rice, then sink into the stew as it cooks
        const sp = spotsIn[g];
        const kind = ingKind(g);
        const r = (kind === KIND.STOCK ? 0.04 : 0.07) * box.w * Math.sqrt(rng());
        const a = rng() * Math.PI * 2;
        const ic = ingColours[g];
        set(4, i, sp[0] + Math.cos(a) * r, sp[1] + Math.sin(a) * r * 0.5, 0.05, 1, ic[0], ic[1], ic[2], 1, kind);
        set(5, i, sp[0] + Math.cos(a) * r, sp[1] + Math.sin(a) * r * 0.5, 0.05, 1, ic[0], ic[1], ic[2], 1, kind);
        set(6, i, sp[0] + Math.cos(a) * r * 1.6, sp[1] - moundH * 0.5 + Math.sin(a) * r * 0.5, 0.02, 1, ic[0], ic[1], ic[2], 0, kind);
        continue;
      }
      const ang = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.95;
      const u = Math.cos(ang) * rr, v = Math.sin(ang) * rr;
      // a low, uneven heap that fills the opening; most grains sit at its surface
      const bump = 0.85 + 0.15 * Math.sin(u * 23 + v * 17) * Math.cos(u * 11 - v * 29);
      const hgt = moundH * Math.pow(Math.max(0, 1 - rr * rr), 0.4) * bump * (0.75 + 0.25 * Math.pow(rng(), 0.3));
      const c = wetCol[i] || grainCol(i);
      const kind = wetCol[i] ? KIND.COOKED : KIND.RICE;
      const x = box.cx + u * rimRx * 0.86, y = top + v * rimRy * 0.8 + hgt;
      set(4, i, x, y, 0.04, hgt / moundH, c[0], c[1], c[2], 1, kind);
      set(5, i, x, y, 0.04, hgt / moundH, c[0], c[1], c[2], 1, kind);
      set(6, i, x, y, 0.04, hgt / moundH, c[0], c[1], c[2], 1, kind);
    }
  }

  await yieldToMain();
  // 07: the plate (painted), jollof heaped in the middle.
  {
    const { r } = plateLayout(box);
    for (let i = 0; i < n; i += 1) {
      if (i < shadowN) { hide(7, i); continue; }
      const ang = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 0.64;
      const c = redCol(i);
      const edge = 1 - 0.22 * Math.pow(rr / 0.64, 3); // the heap is lighter in the middle
      set(7, i, box.cx + Math.cos(ang) * r * rr, box.cy + Math.sin(ang) * r * rr * 0.96, (rng() - 0.5) * 0.03, 1, c[0] * edge, c[1] * edge, c[2] * edge, 1, KIND.COOKED);
    }
  }

  await yieldToMain();
  // 08: the long table (painted) with jollof on every plate. Half the grains take part.
  {
    const { pr, places } = tableLayout(box, mobile);
    const riceEnd = shadowN + Math.floor(n * 0.5);
    for (let i = 0; i < n; i += 1) {
      if (i < shadowN || i >= riceEnd) { hide(8, i); continue; }
      const p = places[Math.floor(rng() * places.length)];
      const ang = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 0.6;
      const c = redCol(i);
      set(8, i, p[0] + Math.cos(ang) * pr * rr, p[1] + Math.sin(ang) * pr * rr, 0, 1, c[0], c[1], c[2], 1, KIND.COOKED);
    }
  }

  await yieldToMain();
  // 09: the story. The grains spell a word and stack into a small feed of posts.
  {
    const wordN = Math.floor(n * 0.62);
    // on the phone the word takes the whole width of the stage so the letters stay readable
    const word = mobile
      ? textPoints('shared', wordN, { cx: box.cx, cy: box.cy + box.h * 0.14, w: aspect * 2 * 0.94, h: box.h * 0.56 }, rng, fontFamily)
      : textPoints('shared', wordN, { cx: box.cx, cy: box.cy + box.h * 0.18, w: box.w, h: box.h * 0.42 }, rng, fontFamily);
    const posts = 3;
    const pw = box.w * 0.26, ph = box.h * 0.2;
    for (let i = 0; i < n; i += 1) {
      if (i < shadowN) { hide(9, i); continue; }
      let p, c, kind = KIND.RICE;
      if (i < wordN && word[i]) {
        p = word[i];
        c = redCol(i);
        kind = KIND.COOKED;
      } else {
        const j = i % posts;
        const px = box.cx - box.w * 0.34 + j * box.w * 0.34;
        const py = box.cy - box.h * (mobile ? 0.36 : 0.3);
        const inner = rng() < 0.75;
        p = inner ? rectFill(1, px, py + ph * 0.1, pw * 0.88, ph * 0.55, rng)[0] : rectEdge(1, px, py, pw, ph, 0.02, rng)[0];
        c = inner ? [0.9, 0.82, 0.7] : grainCol(i);
      }
      set(9, i, p[0], p[1], 0, 1, c[0], c[1], c[2], 1, kind);
    }
  }

  await yieldToMain();
  // 10: a soft cluster that follows the active project card (offset applied live).
  {
    const vis = Math.floor(n * 0.5);
    for (let i = 0; i < n; i += 1) {
      const c = grainCol(i);
      const x = gauss(rng) * 0.16, y = gauss(rng) * 0.1;
      set(10, i, x, y, 0, 1, c[0], c[1], c[2], i >= shadowN && i < vis ? 0.9 : 0);
    }
  }

  await yieldToMain();
  // 11: a few grains on the shelf. 12: grains marking the timeline. 13: scattered game pieces.
  {
    const shelfN = 60, lineN = 56, playN = 160;
    for (let i = 0; i < n; i += 1) {
      if (i < shadowN) { hide(11, i); hide(12, i); hide(13, i); continue; }
      const c = grainCol(i);
      const j = i - shadowN;
      // shelf: a short horizontal row
      const sx = box.cx - box.w * 0.35 + (j / shelfN) * box.w * 0.7 + (rng() - 0.5) * 0.02;
      const sy = box.cy - box.h * 0.1 + (rng() - 0.5) * 0.02;
      set(11, i, sx, sy, 0, 1, c[0], c[1], c[2], j < shelfN ? 1 : 0);
      // timeline: vertical
      const tx = box.cx + (rng() - 0.5) * 0.02;
      const ty = box.cy + box.h * 0.45 - (j / lineN) * box.h * 0.9 + (rng() - 0.5) * 0.01;
      set(12, i, tx, ty, 0, 1, c[0], c[1], c[2], j < lineN ? 1 : 0);
      // play: loose scatter
      const px = box.cx + (rng() - 0.5) * box.w * 0.9;
      const py = box.cy + (rng() - 0.5) * box.h * 0.8;
      set(13, i, px, py, 0, 1, c[0], c[1], c[2], j < playN ? 1 : 0);
    }
  }

  await yieldToMain();
  // 14: back to one grain.
  for (let i = 0; i < n; i += 1) {
    const c = grainCol(i);
    set(14, i, meshK[14].pos[0] + (rng() - 0.5) * 0.2, meshK[14].pos[1] + (rng() - 0.5) * 0.1, 0, 0, c[0], c[1], c[2], 0);
  }

  await yieldToMain();
  // Hidden particles inherit the position they last had, so nothing flies across the screen unseen.
  for (let k = 2; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      const o = (k * n + i) * 4;
      const prev = ((k - 1) * n + i) * 4;
      if (col[o + 3] === 0 && col[prev + 3] > 0 && k !== 14) {
        pos[o] = pos[prev]; pos[o + 1] = pos[prev + 1]; pos[o + 2] = pos[prev + 2]; pos[o + 3] = pos[prev + 3];
      }
    }
  }

  return { pos, col, box, meshK };
}

// Linear interpolation of the mesh grain's transform along the story.
export function meshAt(p, meshK) {
  // visible in 0..1, fades out across 1..1.35, back in across 13.6..14
  const lerp = (a, b, t) => a + (b - a) * t;
  if (p <= 1) {
    const t = p;
    const e = t * t * (3 - 2 * t);
    return {
      pos: [lerp(meshK[0].pos[0], meshK[1].pos[0], e), lerp(meshK[0].pos[1], meshK[1].pos[1], e), 0],
      scale: lerp(meshK[0].scale, meshK[1].scale, e),
      opacity: 1,
    };
  }
  if (p < 1.4) {
    const t = (p - 1) / 0.4;
    return { pos: meshK[1].pos, scale: meshK[1].scale * (1 + t * 0.25), opacity: 1 - t };
  }
  if (p > 13.55) {
    const t = Math.min(1, (p - 13.55) / 0.45);
    return { pos: meshK[14].pos, scale: meshK[14].scale, opacity: t };
  }
  return { pos: meshK[1].pos, scale: 0, opacity: 0 };
}
