// Draws the ingredient artwork into one atlas: four variants each of tomato chunks, onion slices,
// pepper pieces, spice bits and a pool of stock. Both renderers draw particles of those kinds with
// these tiles instead of a shaded disc.
export const TILE = 128;
export const COLS = 4;
export const ROWS = 5; // row = kind - 1: tomato, onion, pepper, spice, stock

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Small seeded generator so the artwork is the same on every visit.
function rng(seed) {
  let s = seed | 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// An irregular rounded blob: `points` around a circle, radius jittered, drawn with smooth curves.
function blob(ctx, cx, cy, r, points, jitter, R, squash = 1) {
  const pts = [];
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 - jitter + R() * jitter * 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
  }
  ctx.beginPath();
  for (let i = 0; i < points; i += 1) {
    const p = pts[i], n = pts[(i + 1) % points];
    const mx = (p[0] + n[0]) / 2, my = (p[1] + n[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    const nn = pts[(i + 2) % points];
    ctx.quadraticCurveTo(n[0], n[1], (n[0] + nn[0]) / 2, (n[1] + nn[1]) / 2);
  }
  ctx.closePath();
}

function highlight(ctx, x, y, rx, ry, alpha, rot = -0.6) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function tomato(ctx, R) {
  const c = TILE / 2, r = TILE * 0.36;
  // a chunk cut from a ripe tomato: skin on one side, flesh and a seed pocket on the cut face
  blob(ctx, c, c, r, 9, 0.16, R, 0.9);
  const g = ctx.createRadialGradient(c - r * 0.25, c - r * 0.3, r * 0.1, c, c, r * 1.15);
  g.addColorStop(0, '#ea4f2f'); g.addColorStop(0.55, '#cf2d19'); g.addColorStop(1, '#8e180f');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // paler flesh on the cut face
  ctx.fillStyle = 'rgba(241,120,88,0.55)';
  blob(ctx, c + r * 0.1, c + r * 0.05, r * 0.62, 8, 0.2, R, 0.85); ctx.fill();
  // seed pocket: gel with seeds
  ctx.fillStyle = 'rgba(248,170,120,0.75)';
  blob(ctx, c + r * 0.12, c + r * 0.08, r * 0.38, 7, 0.25, R, 0.7); ctx.fill();
  const seeds = 4 + Math.floor(R() * 3);
  for (let i = 0; i < seeds; i += 1) {
    const a = R() * Math.PI * 2, d = R() * r * 0.3;
    ctx.save(); ctx.translate(c + r * 0.12 + Math.cos(a) * d, c + r * 0.08 + Math.sin(a) * d * 0.7); ctx.rotate(R() * Math.PI);
    ctx.fillStyle = '#f2dc9c'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.085, r * 0.055, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,100,40,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  // skin: a darker, glossy rim on the far side
  ctx.lineWidth = r * 0.16; ctx.strokeStyle = 'rgba(120,16,10,0.55)';
  ctx.beginPath(); ctx.arc(c, c, r * 0.95, Math.PI * 0.75, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
  highlight(ctx, c - r * 0.35, c - r * 0.38, r * 0.45, r * 0.22, 0.55);
  highlight(ctx, c + r * 0.3, c - r * 0.1, r * 0.12, r * 0.08, 0.5);
}

function onion(ctx, R) {
  const c = TILE / 2, r = TILE * 0.36;
  // a half-moon slice: translucent concentric rings, a faint violet edge
  const start = Math.PI * (0.95 + R() * 0.1), span = Math.PI * (0.95 + R() * 0.15);
  ctx.lineCap = 'round';
  const rings = 6;
  for (let i = rings; i >= 1; i -= 1) {
    const rr = (i / rings) * r;
    ctx.beginPath(); ctx.arc(c, c + r * 0.25, rr, start, start + span);
    ctx.lineWidth = r / rings * 0.78;
    ctx.strokeStyle = i % 2 ? 'rgba(246,239,229,0.82)' : 'rgba(228,214,200,0.7)';
    ctx.stroke();
    // the membrane between layers
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(190,160,150,0.55)'; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(c, c + r * 0.25, r * 0.98, start, start + span);
  ctx.lineWidth = r * 0.08; ctx.strokeStyle = 'rgba(170,120,150,0.6)'; ctx.stroke();
  highlight(ctx, c - r * 0.3, c - r * 0.35, r * 0.5, r * 0.18, 0.45, -0.4);
}

function pepper(ctx, R, variant) {
  const c = TILE / 2, r = TILE * 0.34;
  // a scotch bonnet, or a piece of one: lobed, wrinkled, orange-red, waxy
  blob(ctx, c, c + r * 0.05, r, 5, 0.3, R, 0.8);
  const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r * 1.1);
  g.addColorStop(0, '#ff7a30'); g.addColorStop(0.5, '#e8481c'); g.addColorStop(1, '#9c2410');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // the folds between the lobes
  ctx.strokeStyle = 'rgba(110,20,8,0.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i += 1) {
    const a = -1.2 + i * 0.75 + R() * 0.3;
    ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r * 0.15, c + Math.sin(a) * r * 0.15);
    ctx.quadraticCurveTo(c + Math.cos(a + 0.2) * r * 0.6, c + Math.sin(a + 0.2) * r * 0.6, c + Math.cos(a) * r * 1.05, c + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  ctx.restore();
  if (variant % 2 === 0) {
    // the stem
    ctx.save(); ctx.translate(c - r * 0.1, c - r * 0.75); ctx.rotate(-0.4);
    ctx.fillStyle = '#5f7a2e'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.22, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a6122'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.1, -r * 0.45); ctx.stroke();
    ctx.restore();
  }
  highlight(ctx, c - r * 0.35, c - r * 0.3, r * 0.5, r * 0.22, 0.6, -0.5);
  highlight(ctx, c + r * 0.35, c + r * 0.25, r * 0.18, r * 0.1, 0.35, -0.5);
}

function spice(ctx, R, variant) {
  const c = TILE / 2;
  if (variant === 0) {
    // ginger slice: fibrous yellow flesh with a brown skin
    const r = TILE * 0.34;
    blob(ctx, c, c, r, 8, 0.12, R, 0.8);
    ctx.fillStyle = '#e9c76b'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(190,140,50,0.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i += 1) { const y = c - r * 0.7 + i * r * 0.17; ctx.beginPath(); ctx.moveTo(c - r, y + R() * 4); ctx.bezierCurveTo(c - r * 0.3, y - 3, c + r * 0.3, y + 3, c + r, y + R() * 4); ctx.stroke(); }
    ctx.lineWidth = r * 0.14; ctx.strokeStyle = 'rgba(150,100,45,0.8)';
    ctx.beginPath(); ctx.arc(c, c, r * 0.95, Math.PI * 0.7, Math.PI * 1.5); ctx.stroke();
    ctx.restore();
    highlight(ctx, c - r * 0.3, c - r * 0.3, r * 0.4, r * 0.2, 0.35);
  } else if (variant === 1) {
    // garlic clove: a cream teardrop with a papery sheen
    ctx.save(); ctx.translate(c, c); ctx.rotate(-0.5);
    ctx.beginPath(); ctx.moveTo(0, -TILE * 0.36);
    ctx.bezierCurveTo(TILE * 0.3, -TILE * 0.1, TILE * 0.28, TILE * 0.3, 0, TILE * 0.34);
    ctx.bezierCurveTo(-TILE * 0.28, TILE * 0.3, -TILE * 0.3, -TILE * 0.1, 0, -TILE * 0.36);
    const g = ctx.createLinearGradient(-TILE * 0.3, 0, TILE * 0.3, 0);
    g.addColorStop(0, '#fbf5e8'); g.addColorStop(0.5, '#efe3cc'); g.addColorStop(1, '#cdb795');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(160,130,90,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(-TILE * 0.08, -TILE * 0.25); ctx.quadraticCurveTo(-TILE * 0.16, 0, -TILE * 0.06, TILE * 0.22); ctx.stroke();
    ctx.restore();
  } else if (variant === 2) {
    // peppercorns and a cardamom-sized seed
    for (let i = 0; i < 3; i += 1) {
      const x = c + (R() - 0.5) * TILE * 0.5, y = c + (R() - 0.5) * TILE * 0.5, r = TILE * (0.1 + R() * 0.05);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#6b4a2e'); g.addColorStop(1, '#241408');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      highlight(ctx, x - r * 0.3, y - r * 0.35, r * 0.5, r * 0.3, 0.45);
    }
  } else {
    // a sprig of thyme and a curry leaf
    ctx.strokeStyle = '#5c5a2e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c - TILE * 0.3, c + TILE * 0.3); ctx.quadraticCurveTo(c, c, c + TILE * 0.28, c - TILE * 0.32); ctx.stroke();
    ctx.fillStyle = '#6e7d3a';
    for (let i = 0; i < 7; i += 1) {
      const t = 0.15 + i * 0.12, x = c - TILE * 0.3 + t * TILE * 0.58, y = c + TILE * 0.3 - t * TILE * 0.62 + (i % 2 ? 6 : -6);
      ctx.beginPath(); ctx.ellipse(x, y, 5, 2.6, -0.8 + (i % 2) * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#4f6a2f';
    ctx.beginPath(); ctx.ellipse(c + TILE * 0.18, c + TILE * 0.2, TILE * 0.18, TILE * 0.07, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,160,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c + TILE * 0.05, c + TILE * 0.3); ctx.lineTo(c + TILE * 0.31, c + TILE * 0.1); ctx.stroke();
  }
}

function stock(ctx, R) {
  const c = TILE / 2, r = TILE * 0.42;
  // a pool of golden stock soaking in: translucent, glossy, a few bubbles
  blob(ctx, c, c, r, 10, 0.12, R, 0.78);
  const g = ctx.createRadialGradient(c, c, r * 0.1, c, c, r);
  g.addColorStop(0, 'rgba(226,170,70,0.85)'); g.addColorStop(0.7, 'rgba(205,140,45,0.7)'); g.addColorStop(1, 'rgba(160,100,30,0.15)');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 5; i += 1) {
    const x = c + (R() - 0.5) * r * 1.2, y = c + (R() - 0.5) * r * 0.9, br = 2 + R() * 4;
    ctx.strokeStyle = 'rgba(255,240,200,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, br, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  highlight(ctx, c - r * 0.3, c - r * 0.25, r * 0.6, r * 0.2, 0.5, -0.3);
}

const DRAW = [tomato, onion, pepper, spice, stock];

/** Builds the atlas canvas. Tile (col, row) = (variant, kind - 1). */
export function buildAtlas() {
  const cv = makeCanvas(TILE * COLS, TILE * ROWS);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const R = rng(7919 * (row + 1) + 104729 * (col + 1));
      ctx.save();
      ctx.translate(col * TILE, row * TILE);
      ctx.beginPath(); ctx.rect(0, 0, TILE, TILE); ctx.clip();
      // a soft contact shadow so each piece sits on the rice
      ctx.save(); ctx.translate(3, 5); ctx.globalAlpha = 0.28; ctx.fillStyle = '#2a160a';
      ctx.filter = 'blur(3px)';
      ctx.beginPath(); ctx.ellipse(TILE / 2, TILE / 2 + 4, TILE * 0.34, TILE * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      DRAW[row](ctx, R, col);
      ctx.restore();
    }
  }
  return cv;
}
