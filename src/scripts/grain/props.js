// The things the grains land in: an enamel pot, a plate, a long table. Each is painted once onto a
// canvas and shown as a picture behind the grains (the pot's front lip goes over them). Both
// renderers use the same artwork.
import { potLayout, plateLayout, tableLayout } from './keyframes.js';

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** A prop: { key, layer, cx, cy, w, h, canvas } with cx, cy, w, h in world units. */
function prop(key, layer, cx, cy, w, h, s, draw, keyEnd = key, fadeIn = null) {
  const W = Math.min(2048, Math.max(2, Math.round(w * s)));
  const H = Math.min(2048, Math.max(2, Math.round(h * s)));
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const k = W / w; // px per world unit, after the cap
  // world → canvas: x right, y down
  const X = (x) => (x - cx + w / 2) * k;
  const Y = (y) => (cy + h / 2 - y) * k;
  draw(ctx, X, Y, k);
  return { key, keyEnd, fadeIn, layer, cx, cy, w, h, canvas };
}

function softShadow(ctx, x, y, rx, ry, alpha, k) {
  ctx.save();
  ctx.filter = `blur(${Math.max(1, rx * 0.12)}px)`;
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(55,28,10,${alpha})`); g.addColorStop(0.7, `rgba(55,28,10,${alpha * 0.6})`); g.addColorStop(1, 'rgba(55,28,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// A plate seen from above: an ivory disc with a rolled rim, lit from the top left.
function plate(ctx, x, y, r, k) {
  softShadow(ctx, x + r * 0.05, y + r * 0.08, r * 1.02, r * 0.98, 0.35, k);
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  body.addColorStop(0, '#f6f0e5'); body.addColorStop(0.72, '#ebe3d5'); body.addColorStop(0.8, '#e2d9c9'); body.addColorStop(0.97, '#efe8dc'); body.addColorStop(1, '#cfc6b6');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.97, 0, 0, Math.PI * 2); ctx.fill();
  // where the well meets the rim: a soft inner shadow, deeper on the lit side
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.78, r * 0.76, 0, 0, Math.PI * 2); ctx.clip();
  const well = ctx.createRadialGradient(x + r * 0.15, y + r * 0.15, r * 0.3, x, y, r * 0.8);
  well.addColorStop(0, 'rgba(0,0,0,0)'); well.addColorStop(1, 'rgba(70,50,30,0.16)');
  ctx.fillStyle = well; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, r * 0.012);
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.99, r * 0.96, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,70,45,0.12)'; ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.78, r * 0.76, 0, 0, Math.PI * 2); ctx.stroke();
}

// A roasted chicken leg, thigh end at (x, y), pointing along `angle`, `len` long: the drumstick
// sits half-sunk in the rice, so the few grains that lie over its edges are painted here too.
function chicken(ctx, x, y, len, angle, seed = 1) {
  let sd = seed * 7919;
  const R = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  const t = len * 0.25; // half-thickness at the thigh
  // the outline: an egg, blunt at the thigh and narrowing to the knee, with a few low bumps so no
  // two legs are the same. The meat runs from 0 to about 0.73 len; the bone shows beyond it.
  const b1 = 0.6 + R() * 0.8, b2 = R() * 6.28, b3 = R() * 6.28, lean = (R() - 0.5) * 0.12;
  const outline = [];
  const N = 80, ex = len * 0.365, ea = len * 0.365;
  for (let i = 0; i < N; i += 1) {
    const th = Math.PI + (i / N) * Math.PI * 2; // start at the thigh end, go round
    const c = Math.cos(th), sn = Math.sin(th);
    const egg = 1 - 0.42 * c; // narrower toward the knee
    const bump = 1 + 0.05 * Math.sin(th * 3 + b2) * b1 + 0.03 * Math.sin(th * 7 + b3);
    const px = ex + ea * c * (1 + 0.02 * Math.sin(th * 5 + b2));
    const py = t * sn * egg * bump * (sn < 0 ? 1.04 : 0.96) + (c + 1) * 0.5 * len * lean;
    outline.push([px, py]);
  }
  const meat = () => {
    ctx.beginPath();
    for (let i = 0; i < N; i += 1) {
      const a = outline[i], b = outline[(i + 1) % N], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(a[0], a[1], mx, my);
    }
    ctx.closePath();
  };
  // the bone, first: short, grey-tan, with a charred knuckle; the meat's loose skin laps over its root
  const bw = t * 0.46, bx = len * 0.62, bl = len * 0.28;
  ctx.save(); ctx.rotate(-0.06);
  ctx.save(); ctx.filter = `blur(${Math.max(1, len * 0.02)}px)`; ctx.fillStyle = 'rgba(60,25,5,0.4)';
  ctx.beginPath(); ctx.ellipse(bx + bl * 0.5, bw * 0.5, bl * 0.6, bw * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const bg = ctx.createLinearGradient(0, -bw, 0, bw);
  bg.addColorStop(0, '#d9c9ad'); bg.addColorStop(0.45, '#b7a386'); bg.addColorStop(1, '#6e5a44');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(bx, -bw * 0.5);
  ctx.quadraticCurveTo(bx + bl * 0.55, -bw * 0.4, bx + bl * 0.84, -bw * 0.66);
  ctx.quadraticCurveTo(bx + bl * 1.06, -bw * 0.45, bx + bl * 1.0, bw * 0.2);
  ctx.quadraticCurveTo(bx + bl * 0.92, bw * 0.68, bx + bl * 0.72, bw * 0.5);
  ctx.quadraticCurveTo(bx + bl * 0.5, bw * 0.38, bx, bw * 0.5); ctx.closePath(); ctx.fill();
  // the knuckle: cartilage gone brown and black where it caught the heat
  const kg = ctx.createRadialGradient(bx + bl * 0.88, -bw * 0.1, 0, bx + bl * 0.88, -bw * 0.1, bw * 0.75);
  kg.addColorStop(0, 'rgba(120,95,70,0.5)'); kg.addColorStop(0.7, 'rgba(90,65,45,0.35)'); kg.addColorStop(1, 'rgba(90,65,45,0)');
  ctx.fillStyle = kg; ctx.beginPath(); ctx.ellipse(bx + bl * 0.86, -bw * 0.1, bw * 0.7, bw * 0.6, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,24,14,0.7)'; ctx.beginPath(); ctx.ellipse(bx + bl * 1.0, -bw * 0.2, bw * 0.22, bw * 0.3, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,245,225,0.35)'; ctx.beginPath(); ctx.ellipse(bx + bl * 0.4, -bw * 0.28, bl * 0.28, bw * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,25,15,0.35)'; ctx.lineWidth = Math.max(1, bw * 0.08);
  ctx.beginPath(); ctx.moveTo(bx + bl * 0.1, bw * 0.1); ctx.quadraticCurveTo(bx + bl * 0.5, bw * 0.05, bx + bl * 0.85, bw * 0.2); ctx.stroke();
  ctx.restore();
  // its shadow on the rice: close under the meat, soft at the edges
  ctx.save(); ctx.filter = `blur(${Math.max(1, len * 0.035)}px)`; ctx.fillStyle = 'rgba(55,22,5,0.55)';
  ctx.beginPath(); ctx.ellipse(len * 0.36, t * 0.45, len * 0.42, t * 1.0, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // the meat: pale gold skin, lit from the top left, burnished amber on the underside
  meat();
  const g = ctx.createLinearGradient(len * 0.1, -t * 1.1, len * 0.4, t * 1.1);
  g.addColorStop(0, '#e9c070'); g.addColorStop(0.3, '#dca44f'); g.addColorStop(0.62, '#c27a2c'); g.addColorStop(0.85, '#9a4f18'); g.addColorStop(1, '#6b300c');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); meat(); ctx.clip();
  // the skin colours itself unevenly: patches that went deep amber, patches that stayed pale
  for (let i = 0; i < 16; i += 1) {
    const px = len * (0.05 + R() * 0.7), py = (R() - 0.5) * t * 1.7, pr = t * (0.25 + R() * 0.45);
    const dark = R() < 0.6;
    const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    pg.addColorStop(0, dark ? `rgba(140,50,12,${(0.3 + R() * 0.35).toFixed(2)})` : `rgba(250,225,160,${(0.25 + R() * 0.3).toFixed(2)})`); pg.addColorStop(1, dark ? 'rgba(140,50,12,0)' : 'rgba(250,225,160,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(px, py, pr, pr * (0.5 + R() * 0.5), R() * 3, 0, Math.PI * 2); ctx.fill();
  }
  // the burnished patch over the thigh where the skin took the most heat
  {
    const bpx = len * 0.3, bpy = -t * 0.1, bpr = t * 0.85;
    const bp = ctx.createRadialGradient(bpx, bpy, 0, bpx, bpy, bpr);
    bp.addColorStop(0, 'rgba(165,55,15,0.5)'); bp.addColorStop(0.55, 'rgba(165,55,15,0.25)'); bp.addColorStop(1, 'rgba(165,55,15,0)');
    ctx.fillStyle = bp; ctx.beginPath(); ctx.ellipse(bpx, bpy, bpr, bpr * 0.7, 0.35, 0, Math.PI * 2); ctx.fill();
  }
  // blisters and crisp bits, small and many; a few black-edged where the skin split
  for (let i = 0; i < 160; i += 1) {
    const px = len * (R() * 0.76), py = (R() - 0.5) * t * 1.8, pr = t * (0.015 + R() * 0.045);
    const v = R();
    ctx.fillStyle = v < 0.35 ? `rgba(255,225,170,${(0.15 + R() * 0.3).toFixed(2)})` : v < 0.8 ? `rgba(120,45,10,${(0.15 + R() * 0.3).toFixed(2)})` : `rgba(45,18,5,${(0.3 + R() * 0.35).toFixed(2)})`;
    ctx.beginPath(); ctx.ellipse(px, py, pr, pr * (0.5 + R() * 0.5), R() * 3, 0, Math.PI * 2); ctx.fill();
  }
  // the skin wrinkles and pulls toward the bone; loose folds near the knee
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i += 1) {
    const y0 = (R() - 0.5) * t * 1.5, x0 = len * (0.2 + R() * 0.3), x1 = len * (0.62 + R() * 0.16);
    ctx.strokeStyle = R() < 0.7 ? `rgba(90,35,8,${(0.12 + R() * 0.2).toFixed(2)})` : `rgba(255,235,190,${(0.05 + R() * 0.08).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, t * (0.02 + R() * 0.04));
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 * 0.6 + (R() - 0.5) * t * 0.3, x1, y0 * 0.35); ctx.stroke();
  }
  for (let i = 0; i < 5; i += 1) {
    const fx = len * (0.56 + R() * 0.2), fy = (R() - 0.5) * t * 1.2, fl = t * (0.3 + R() * 0.4);
    ctx.strokeStyle = `rgba(80,30,8,${(0.2 + R() * 0.25).toFixed(2)})`; ctx.lineWidth = Math.max(1, t * 0.035);
    ctx.beginPath(); ctx.moveTo(fx, fy - fl); ctx.quadraticCurveTo(fx + t * 0.15, fy, fx - t * 0.05, fy + fl); ctx.stroke();
  }
  // the underside sinks into shadow; the lit edge stays crisp
  const sh = ctx.createLinearGradient(0, -t * 0.2, 0, t * 1.1);
  sh.addColorStop(0, 'rgba(60,20,5,0)'); sh.addColorStop(1, 'rgba(60,20,5,0.45)');
  ctx.fillStyle = sh; ctx.fillRect(-t, -t * 1.5, len, t * 3);
  const sh2 = ctx.createLinearGradient(len * 0.55, 0, len * 0.8, 0);
  sh2.addColorStop(0, 'rgba(60,20,5,0)'); sh2.addColorStop(1, 'rgba(60,20,5,0.35)');
  ctx.fillStyle = sh2; ctx.fillRect(len * 0.5, -t * 1.5, len * 0.4, t * 3);
  // two small sheens where the fat rendered, not one big gloss
  for (const [hx, hy, hr] of [[len * 0.22, -t * 0.45, t * 0.5], [len * 0.46, -t * 0.25, t * 0.3]]) {
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    hg.addColorStop(0, 'rgba(255,240,205,0.5)'); hg.addColorStop(0.5, 'rgba(255,240,205,0.12)'); hg.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, hr, hr * 0.55, -0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // a soft edge, darker on the shaded side, instead of a drawn outline
  meat(); ctx.strokeStyle = 'rgba(70,28,6,0.28)'; ctx.lineWidth = Math.max(1, t * 0.03); ctx.stroke();
  // loose skin and sinew where the meat pulls back from the bone
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i += 1) {
    const sy = (R() - 0.5) * t * 0.9, sl = len * (0.03 + R() * 0.05);
    ctx.strokeStyle = R() < 0.5 ? 'rgba(120,55,25,0.6)' : 'rgba(200,140,90,0.55)'; ctx.lineWidth = Math.max(1, t * (0.04 + R() * 0.05));
    ctx.beginPath(); ctx.moveTo(len * 0.7, sy); ctx.quadraticCurveTo(len * 0.7 + sl * 0.6, sy + (R() - 0.5) * t * 0.2, len * 0.7 + sl, sy * 0.7); ctx.stroke();
  }
  // stew that has stained the skin where it touched the rice
  ctx.save(); meat(); ctx.clip();
  ctx.fillStyle = 'rgba(190,60,15,0.18)';
  for (let i = 0; i < 8; i += 1) { const px = len * (R() * 0.7), py = t * (0.5 + R() * 0.5); ctx.beginPath(); ctx.ellipse(px, py, t * (0.1 + R() * 0.2), t * 0.08, R(), 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // grains of rice lying over the lower edge, so the leg sits in the heap rather than on it
  const grain = len * 0.026;
  for (let i = 0; i < 26; i += 1) {
    const s = R(), onTop = R() < 0.35;
    const o = outline[Math.floor(onTop ? s * N * 0.45 : N * 0.52 + s * N * 0.44)];
    const gx = o[0] + (R() - 0.5) * grain * 2.5, gy = o[1] + (onTop ? -1 : 1) * grain * (R() * 0.6 - 0.2);
    const tone = R();
    const m = R(), sh = 0.8 + R() * 0.25; // between the stew's orange and its deep red, as the heap is
    ctx.fillStyle = tone > 0.93 ? '#4a2410' : `rgb(${((237 + (189 - 237) * m) * sh) | 0},${((120 + (71 - 120) * m) * sh) | 0},${((41 + (23 - 41) * m) * sh) | 0})`;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(R() * Math.PI);
    ctx.beginPath(); ctx.ellipse(0, 0, grain, grain * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,0.18)'; ctx.beginPath(); ctx.ellipse(-grain * 0.2, -grain * 0.1, grain * 0.5, grain * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// A side salad: shredded cabbage and carrot, tomato wedges, cucumber slices.
function salad(ctx, x, y, r, seed = 1) {
  let sd = seed * 104729;
  const R = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  ctx.save();
  ctx.save(); ctx.filter = `blur(${Math.max(1, r * 0.08)}px)`; ctx.fillStyle = 'rgba(60,40,10,0.3)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.08, y + r * 0.12, r * 0.95, r * 0.85, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.lineCap = 'round';
  const greens = ['#cfe3a8', '#b9d58a', '#e4efcc', '#a9c97a', '#f0f5e2'];
  for (let i = 0; i < 90; i += 1) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 0.9, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.9;
    const ang = R() * Math.PI, l = r * (0.25 + R() * 0.35);
    ctx.strokeStyle = R() < 0.15 ? '#f08a2a' : greens[Math.floor(R() * greens.length)]; // a few carrot shreds
    ctx.lineWidth = Math.max(1, r * (0.05 + R() * 0.05));
    ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * l / 2, py - Math.sin(ang) * l / 2);
    ctx.quadraticCurveTo(px + (R() - 0.5) * r * 0.3, py + (R() - 0.5) * r * 0.3, px + Math.cos(ang) * l / 2, py + Math.sin(ang) * l / 2); ctx.stroke();
  }
  // cucumber slices
  for (const [ox, oy] of [[-0.35, 0.3], [0.4, -0.25]]) {
    const cx = x + ox * r, cy = y + oy * r, cr = r * 0.3;
    ctx.fillStyle = '#5f8f3a'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 0.86);
    cg.addColorStop(0, '#e9f2d2'); cg.addColorStop(0.75, '#d3e6b3'); cg.addColorStop(1, '#b7d48e');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cr * 0.86, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(190,210,150,0.9)';
    for (let i = 0; i < 7; i += 1) { const a = (i / 7) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * cr * 0.4, cy + Math.sin(a) * cr * 0.4, cr * 0.1, cr * 0.18, a, 0, Math.PI * 2); ctx.fill(); }
  }
  // tomato wedges
  for (const [ox, oy, ang] of [[0.1, 0.45, 0.4], [-0.15, -0.4, -2.2]]) {
    const cx = x + ox * r, cy = y + oy * r, wr = r * 0.34;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = '#d4402a'; ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ee7a5c'; ctx.beginPath(); ctx.arc(0, 0, wr * 0.75, 0.15, Math.PI - 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6c288'; ctx.beginPath(); ctx.arc(0, 0, wr * 0.45, 0.3, Math.PI - 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-wr, -wr * 0.06, wr * 2, wr * 0.12);
    ctx.restore();
  }
  ctx.restore();
}

export function buildProps({ box, mobile, pxPerUnit }) {
  const out = [];
  // ---- 06: the pot
  {
    const L = potLayout(box);
    const hw = L.rimRx * 0.985, handleW = L.w * 0.1;
    const pw = (L.rimRx + handleW) * 2 + L.w * 0.12;
    const ph = L.top + L.rimRy * 1.2 - (L.bottom - L.h * 0.34);
    const cx = box.cx, cy = (L.top + L.rimRy * 1.2 + L.bottom - L.h * 0.34) / 2;
    const rim = (ctx, X, Y, k, front) => {
      const g = ctx.createLinearGradient(X(cx - L.rimRx), Y(L.top + L.rimRy), X(cx + L.rimRx), Y(L.top - L.rimRy));
      g.addColorStop(0, '#9a938e'); g.addColorStop(0.5, '#7a736f'); g.addColorStop(1, '#4e4844');
      ctx.fillStyle = g;
      ctx.beginPath();
      const rx = L.rimRx * k, ry = L.rimRy * k, ix = rx * 0.87, iy = ry * 0.8;
      if (front) {
        ctx.ellipse(X(cx), Y(L.top), rx, ry, 0, 0, Math.PI);
        ctx.ellipse(X(cx), Y(L.top), ix, iy, 0, Math.PI, 0, true);
      } else {
        ctx.ellipse(X(cx), Y(L.top), rx, ry, 0, 0, Math.PI * 2);
        ctx.ellipse(X(cx), Y(L.top), ix, iy, 0, 0, Math.PI * 2, true);
      }
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, ry * 0.08);
      ctx.beginPath(); ctx.ellipse(X(cx), Y(L.top), rx * 0.995, ry * 0.99, 0, front ? 0 : 0, front ? Math.PI : Math.PI * 2); ctx.stroke();
    };
    out.push(prop(4, 'back', cx, cy, pw, ph, pxPerUnit, (ctx, X, Y, k) => {
      const top = Y(L.top), bot = Y(L.bottom), rb = L.rimRy * k * 0.9, cr = hw * k * 0.22;
      softShadow(ctx, X(cx + 0.03), bot + rb * 0.5, hw * k * 1.15, rb * 1.1, 0.5, k);
      // the body: a rounded cylinder
      ctx.beginPath();
      ctx.moveTo(X(cx - hw), top);
      ctx.lineTo(X(cx - hw * 0.965), bot - cr);
      ctx.quadraticCurveTo(X(cx - hw * 0.965), bot + rb, X(cx - hw * 0.55), bot + rb);
      ctx.lineTo(X(cx + hw * 0.55), bot + rb);
      ctx.quadraticCurveTo(X(cx + hw * 0.965), bot + rb, X(cx + hw * 0.965), bot - cr);
      ctx.lineTo(X(cx + hw), top);
      ctx.ellipse(X(cx), top, hw * k, L.rimRy * k * 0.95, 0, 0, Math.PI);
      ctx.closePath();
      const g = ctx.createLinearGradient(X(cx - hw), 0, X(cx + hw), 0);
      g.addColorStop(0, '#1c1715'); g.addColorStop(0.1, '#352e2b'); g.addColorStop(0.27, '#7a716c'); g.addColorStop(0.36, '#4a4240');
      g.addColorStop(0.55, '#2b2523'); g.addColorStop(0.72, '#262120'); g.addColorStop(0.86, '#4d4542'); g.addColorStop(1, '#181412');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      // darker towards the base, and a faint warm bounce from the table
      const v = ctx.createLinearGradient(0, top, 0, bot + rb);
      v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.12)'); v.addColorStop(0.9, 'rgba(0,0,0,0.42)'); v.addColorStop(1, 'rgba(90,50,20,0.25)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      // the sharp window reflection inside the broad highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(1, hw * k * 0.025); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X(cx - hw * 0.52), top + L.rimRy * k * 1.3); ctx.lineTo(X(cx - hw * 0.5), bot - cr * 1.5); ctx.stroke();
      // enamel speckle
      let sd = 17;
      const R = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 260; i += 1) { const px = X(cx - hw) + R() * hw * 2 * k, py = top + R() * (bot - top + rb); ctx.fillRect(px, py, 1.5, 1.5); }
      ctx.restore();
      // the handles
      for (const side of [-1, 1]) {
        // ear handles riveted to the body just under the rim
        const hy = L.top - L.h * 0.1;
        const w = (handleW + hw * 0.12) * k, h = L.h * 0.08 * k;
        const x = side < 0 ? X(cx - hw - handleW) : X(cx + hw - hw * 0.12);
        const hg = ctx.createLinearGradient(0, Y(hy) - h / 2, 0, Y(hy) + h / 2);
        hg.addColorStop(0, side < 0 ? '#7a7370' : '#5a5451'); hg.addColorStop(0.45, '#332d2b'); hg.addColorStop(1, '#15110f');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.roundRect(x, Y(hy) - h / 2, w, h, [h * 0.5, h * 0.5, h * 0.5, h * 0.5]); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.ellipse(side < 0 ? x + w * 0.35 : x + w * 0.65, Y(hy) - h * 0.1, h * 0.12, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      }
      // the rim and the dark inside of the pot
      rim(ctx, X, Y, k, false);
      const ix = L.rimRx * k * 0.87, iy = L.rimRy * k * 0.8;
      const inner = ctx.createLinearGradient(0, top - iy, 0, top + iy);
      inner.addColorStop(0, '#4a403a'); inner.addColorStop(0.35, '#241d1a'); inner.addColorStop(1, '#0f0b09');
      ctx.fillStyle = inner;
      ctx.beginPath(); ctx.ellipse(X(cx), top, ix, iy, 0, 0, Math.PI * 2); ctx.fill();
    }, 6, [3.3, 3.65]));
    out.push(prop(4, 'front', cx, cy, pw, ph, pxPerUnit, (ctx, X, Y, k) => rim(ctx, X, Y, k, true), 6, [3.3, 3.65]));
  }
  // ---- 07: the plate, from above
  {
    const r = plateLayout(box).r;
    const s = r * 1.25;
    out.push(prop(7, 'back', box.cx + r * 0.03, box.cy - r * 0.05, s * 2, s * 2, pxPerUnit, (ctx, X, Y, k) => plate(ctx, X(box.cx), Y(box.cy), r * k, k)));
    // chicken on the rice, salad at the side
    out.push(prop(7, 'front', box.cx + r * 0.03, box.cy - r * 0.05, s * 2, s * 2, pxPerUnit, (ctx, X, Y, k) => {
      chicken(ctx, X(box.cx - r * 0.2), Y(box.cy + r * 0.22), r * k * 0.76, -0.62, 3);
      salad(ctx, X(box.cx - r * 0.38), Y(box.cy - r * 0.36), r * k * 0.27, 5);
    }));
  }
  // ---- 08: the table, from above: boards, and a plate at each place
  {
    const L = tableLayout(box, mobile);
    const pw = L.tw * 1.06, ph = L.th * 1.3;
    out.push(prop(8, 'back', box.cx, box.cy, pw, ph, pxPerUnit, (ctx, X, Y, k) => {
      const x0 = X(box.cx - L.tw / 2), x1 = X(box.cx + L.tw / 2), y0 = Y(box.cy + L.th / 2 + L.th * 0.08), y1 = Y(box.cy - L.th / 2 - L.th * 0.08);
      softShadow(ctx, (x0 + x1) / 2, y1 + (y1 - y0) * 0.02, (x1 - x0) * 0.52, (y1 - y0) * 0.1, 0.35, k);
      const boards = 5, bh = (y1 - y0) / boards;
      const tones = ['#8e6541', '#97704b', '#86603d', '#9a7250', '#8a6440'];
      let sd = 5;
      const R = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
      for (let b = 0; b < boards; b += 1) {
        const by = y0 + b * bh;
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, tones[b]); g.addColorStop(0.5, tones[(b + 2) % 5]); g.addColorStop(1, tones[b]);
        ctx.fillStyle = g; ctx.fillRect(x0, by, x1 - x0, bh);
        // the grain of the wood
        ctx.strokeStyle = 'rgba(70,40,18,0.22)'; ctx.lineWidth = 1;
        for (let l = 0; l < 14; l += 1) {
          const ly = by + bh * (0.06 + 0.9 * R());
          ctx.beginPath(); ctx.moveTo(x0, ly);
          for (let x = x0; x <= x1; x += (x1 - x0) / 12) ctx.lineTo(x, ly + Math.sin(x * 0.012 + l) * bh * 0.03 + (R() - 0.5) * bh * 0.02);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40,22,8,0.45)'; ctx.fillRect(x0, by + bh - 1.5, x1 - x0, 1.5);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      for (const p of L.places) plate(ctx, X(p[0]), Y(p[1]), L.pr * k, k);
    }));
    out.push(prop(8, 'front', box.cx, box.cy, pw, ph, pxPerUnit, (ctx, X, Y, k) => {
      L.places.forEach((p, i) => {
        chicken(ctx, X(p[0] - L.pr * 0.3), Y(p[1] + L.pr * 0.28), L.pr * k * 0.66, -0.85 + (i % 3) * 0.25, i + 3);
        salad(ctx, X(p[0] - L.pr * 0.38), Y(p[1] - L.pr * 0.36), L.pr * k * 0.26, i + 5);
      });
    }));
  }
  return out;
}

/** How visible a prop is at story progress p: full between its keyframes, gone half a keyframe away. */
export function propOpacity(pr, p) {
  const key = typeof pr === 'number' ? pr : pr.key, keyEnd = typeof pr === 'number' ? pr : pr.keyEnd;
  if (pr.fadeIn && p < key) {
    // in place before the grains arrive (the pot is there for the pile to drop into)
    const u = Math.max(0, Math.min(1, (p - pr.fadeIn[0]) / (pr.fadeIn[1] - pr.fadeIn[0])));
    return u * u * (3 - 2 * u);
  }
  const d = p < key ? key - p : p > keyEnd ? p - keyEnd : 0;
  const t = Math.max(0, Math.min(1, (d - 0.25) / 0.5));
  return 1 - t * t * (3 - 2 * t);
}
