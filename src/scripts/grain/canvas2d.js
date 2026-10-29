// 2D canvas fallback: the same story with fewer grains, for devices without WebGL2 or that cannot keep up.
import { K, MODE, STAGGER, SIZE, sizeFor, KIND_PARAMS, KIND_ALPHA, isSpriteKind, buildKeyframes, meshAt, fireLayout } from './keyframes.js';
import { buildAtlas, TILE } from './sprites.js';
import { buildProps, propOpacity } from './props.js';
import { grainState } from './state.js';
import { canvasSize } from './size.js';

export function create(canvas, { n, reduced, number, ingredients, fontFamily }) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const atlas = buildAtlas();
  let spriteScale = 1; // pieces keep their size whatever the grain count
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let kf, props = [], aspect = 1, mobile = false, W = 1, H = 1, sizes = SIZE;
  const rnd = new Float32Array(n * 4);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < n * 4; i += 1) rnd[i] = r();
  const dist = 1 / Math.tan((20 * Math.PI) / 180);
  let pointScale = 10;

  let building = 0, dead = false;
  async function rebuild() {
    const size = canvasSize(canvas);
    if (size.W === W && size.H === H) return;
    W = size.W;
    H = size.H;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    aspect = W / H;
    mobile = W < 960;
    sizes = sizeFor(mobile);
    pointScale = H * 0.03 * Math.sqrt(6000 / n) * (mobile ? 0.85 : 1) * 0.5;
    spriteScale = Math.sqrt(n / 6000) * (mobile ? 0.62 : 1);
    const ticket = ++building;
    const next = await buildKeyframes({ n, aspect, mobile, number, ingredients, fontFamily });
    if (ticket === building) { kf = next; props = buildProps({ box: kf.box, mobile, pxPerUnit: (W * dpr) / (2 * aspect) }); }
  }
  const ready = rebuild();

  const sx = (x) => ((x / aspect + 1) / 2) * W;
  const sy = (y) => ((1 - y) / 2) * H;
  const kw = (c, p) => 1 - Math.min(1, Math.abs(p - c));

  let spinY = 0;
  function render(time) {
    const st = grainState;
    if (dead || !kf) return;
    const p = Math.max(0, Math.min(K - 1, st.progress));
    let k = Math.floor(p); if (k > K - 2) k = K - 2;
    const t = p - k;
    const mode = MODE[k + 1], stag = STAGGER[k + 1] * (reduced ? 0 : 1);
    const tm = time / 1000;
    const wFire = kw(4, p), wGlow = kw(5, p), wPot = kw(6, p);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { pos, col } = kf;
    const off = st.focus;
    const drawProps = (layer) => {
      for (const pr of props) {
        if (pr.layer !== layer) continue;
        const o = propOpacity(pr, p);
        if (o < 0.004) continue;
        const pw = (pr.w / aspect) * W * 0.5, ph = (pr.h / 2) * H;
        ctx.globalAlpha = o;
        ctx.drawImage(pr.canvas, sx(pr.cx) - pw / 2, sy(pr.cy) - ph / 2, pw, ph);
      }
      ctx.globalAlpha = 1;
    };
    drawProps('back');
    // the fire under the pot
    const lit = Math.max(0, Math.min(1, (p - 3.65) / 0.3)) * propOpacity({ key: 4, keyEnd: 6 }, p);
    if (lit > 0.004) {
      const F = fireLayout(kf.box);
      const heat = Math.max(0, Math.min(1, (p - 3.8) / 0.3)) * (0.28 + 0.72 * st.heat);
      const fw = (F.w / aspect) * W * 0.5, fh = (F.h / 2) * H, fx = sx(F.cx), fy = sy(F.cy) + fh / 2;
      const tt = reduced ? 1.7 : tm;
      ctx.globalAlpha = lit;
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, fw * 0.5);
      glow.addColorStop(0, `rgba(255,120,30,${(0.2 + 0.25 * heat).toFixed(2)})`); glow.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(fx, fy - fh * 0.05, fw * 0.42, fh * 0.14, 0, 0, 6.283); ctx.fill();
      const tongues = 9;
      for (let j = 0; j < tongues; j += 1) {
        const u = (j + 0.5) / tongues, x = fx + (u - 0.5) * fw * 0.8;
        const flick = 0.7 + 0.3 * Math.sin(tt * 6.3 + j * 1.9) * Math.cos(tt * 4.1 + j);
        const th = fh * (0.18 + 0.6 * heat) * (1 - Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.6) * flick;
        const tw = fw * 0.09;
        const g = ctx.createLinearGradient(0, fy, 0, fy - th);
        g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(0.35, 'rgba(255,150,30,0.9)'); g.addColorStop(0.8, 'rgba(210,45,10,0.6)'); g.addColorStop(1, 'rgba(180,30,5,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - tw, fy);
        ctx.quadraticCurveTo(x - tw * 0.6 + Math.sin(tt * 5 + j) * tw * 0.4, fy - th * 0.6, x + Math.sin(tt * 3 + j * 2) * tw * 0.3, fy - th);
        ctx.quadraticCurveTo(x + tw * 0.6, fy - th * 0.6, x + tw, fy);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < (p > 1.02 ? n : 0); i += 1) {
      const a = (k * n + i) * 4, b = ((k + 1) * n + i) * 4;
      const ra = rnd[i * 4], ry = rnd[i * 4 + 1], rz = rnd[i * 4 + 2], rw = rnd[i * 4 + 3];
      const d = ra * stag;
      const tt = Math.max(0, Math.min(1, (t - d) / Math.max(1 - d, 0.001)));
      let e, x, y, lift = 0;
      let ax = pos[a], ay = pos[a + 1];
      const bx = pos[b] + (k + 1 === 10 ? off[0] : 0), by = pos[b + 1] + (k + 1 === 10 ? off[1] : 0);
      if (k === 10) { ax += off[0]; ay += off[1]; }
      if (mode === 1) {
        if (col[a + 3] < 0.01) { ax = bx + (ry - 0.5) * 0.35; ay = 1.15 + rz * 1.4; }
        e = tt * tt;
      } else {
        e = tt * tt * (3 - 2 * tt);
        if (mode === 2 && !reduced) lift = Math.sin(e * Math.PI) * (0.2 + 0.3 * rz);
      }
      const alpha = col[a + 3] + (col[b + 3] - col[a + 3]) * e;
      if (alpha < 0.02) continue;
      // pos.w carries order (0..1) + 2 * kind
      const kA = Math.floor(pos[a + 3] * 0.5 + 0.001), kB = Math.floor(pos[b + 3] * 0.5 + 0.001);
      const oA = pos[a + 3] - 2 * kA, oB = pos[b + 3] - 2 * kB;
      const pA = KIND_PARAMS[kA], pB = KIND_PARAMS[kB];
      const elong = pA[0] + (pB[0] - pA[0]) * e, soft = pA[1] + (pB[1] - pA[1]) * e, sizeMul = pA[2] + (pB[2] - pA[2]) * e, gloss = pA[3] + (pB[3] - pA[3]) * e;
      const alphaK = KIND_ALPHA[kA] + (KIND_ALPHA[kB] - KIND_ALPHA[kA]) * e;
      const riceA = kA === 0 || kA === 8 ? 1 : 0, riceB = kB === 0 || kB === 8 ? 1 : 0;
      const rice = riceA + (riceB - riceA) * e;
      const loose = (kA > 5 ? 0 : 1) + ((kB > 5 ? 0 : 1) - (kA > 5 ? 0 : 1)) * e;
      x = ax + (bx - ax) * e; y = ay + (by - ay) * e + lift * loose;
      const order = oA + (oB - oA) * e;
      const low = 1 - order;
      const sh = st.heat * wFire * (reduced ? 0 : 1) * loose;
      if (sh > 0) { x += Math.sin(tm * 6 + ry * 40 + y * 9) * 0.012 * sh * low; y += Math.sin(tm * 7.3 + rz * 40) * 0.01 * sh * low; }
      let cr = col[a] + (col[b] - col[a]) * e, cg = col[a + 1] + (col[b + 1] - col[a + 1]) * e, cb = col[a + 2] + (col[b + 2] - col[a + 2]) * e;
      const wPile = Math.min(1, kw(3, p) + kw(4, p) + kw(5, p) + wPot);
      const ao = 1 - 0.3 * low * wPile * rice;
      cr *= ao; cg *= ao; cb *= ao;
      const emberMix = sh * low * 0.45;
      cr += (0.9 - cr) * emberMix; cg += (0.5 - cg) * emberMix; cb += (0.2 - cb) * emberMix;
      const th = 0.7 * rz + 0.3 * order, ct = Math.max(0, Math.min(1, (st.cook * 1.2 - th + 0.12) / 0.24));
      const cook = ct * ct * (3 - 2 * ct) * wPot * rice;
      let jr = 0.93 + (0.74 - 0.93) * rw, jg = 0.47 + (0.28 - 0.47) * rw, jb = 0.16 + (0.09 - 0.16) * rw;
      if (ra < 0.12) { jr = jr * 0.6 + 0.38; jg = jg * 0.6 + 0.24; jb = jb * 0.6 + 0.1; } else if (ra > 0.95) { jr *= 0.5; jg *= 0.45; jb *= 0.4; }
      cr += (jr - cr) * cook; cg += (jg - cg) * cook; cb += (jb - cb) * cook;
      const glow = wGlow * st.glow * loose;
      cr += 0.1 * glow; cg += 0.06 * glow; cb += 0.02 * glow;
      const wS = (isSpriteKind(kA) ? 1 : 0) + ((isSpriteKind(kB) ? 1 : 0) - (isSpriteKind(kA) ? 1 : 0)) * e;
      const size = (sizes[k] + (sizes[k + 1] - sizes[k]) * e) * sizeMul * (1 + (spriteScale - 1) * wS) * (0.6 + 0.6 * rz) * pointScale;
      if (size < 0.4) continue;
      const shade = 0.88 + 0.2 * rw;
      const R = (cr * shade * 255) | 0, G = (cg * shade * 255) | 0, Bc = (cb * shade * 255) | 0;
      const px = sx(x), py = sy(y);
      const fa = alpha * alphaK;
      const spriteK = e < 0.5 ? kA : kB;
      if (isSpriteKind(spriteK)) {
        // an ingredient piece from the atlas, turned with the particle
        ctx.save();
        ctx.translate(px, py); ctx.rotate(ry * 6.283);
        ctx.globalAlpha = fa * wS;
        ctx.drawImage(atlas, Math.floor(rw * 3.999) * TILE, (spriteK - 1) * TILE, TILE, TILE, -size, -size, size * 2, size * 2);
        ctx.restore();
      } else if (kA > 5 && kB > 5) {
        // surfaces: solid discs that overlap into one shape; shadows: one faint, larger disc
        const shadow = kA === 7;
        ctx.fillStyle = `rgba(${R},${G},${Bc},${(shadow ? fa * 0.5 : fa).toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(px, py, size * (shadow ? 0.6 : 1), size * elong * (shadow ? 0.6 : 1), 0, 0, 6.283); ctx.fill();
      } else if (soft > 0.5) {
        // soft sprite: two stacked discs fading outwards
        for (let ring = 0; ring < 2; ring += 1) {
          const rr = size * (1 - ring * 0.4);
          ctx.fillStyle = `rgba(${R},${G},${Bc},${(fa * 0.45).toFixed(2)})`;
          ctx.beginPath(); ctx.ellipse(px, py, rr, rr * elong, 0, 0, 6.283); ctx.fill();
        }
      } else {
        const rot = ry * 6.283;
        ctx.fillStyle = `rgba(${R},${G},${Bc},${fa.toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(px, py, size, size * elong, rot, 0, 6.283); ctx.fill();
        // a highlight towards the light, stronger when glossy
        const hx = px - size * 0.25, hy = py - size * elong * 0.3;
        ctx.fillStyle = `rgba(255,250,240,${(fa * (0.18 + 0.35 * Math.max(gloss, cook * 0.85))).toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(hx, hy, size * 0.45, size * elong * 0.4, rot, 0, 6.283); ctx.fill();
      }
    }

    drawProps('front');

    // the single grain
    const m = meshAt(p, kf.meshK);
    if (m.opacity > 0.01) {
      if (!reduced) { spinY += 0.01 + st.spinVel[1] * 2; st.spinVel[1] *= 0.94; st.spinVel[0] *= 0.94; }
      const cx = sx(m.pos[0]), cy = sy(m.pos[1]);
      const len = (m.scale / aspect) * W * 0.5;
      const squash = 0.6 + 0.4 * Math.abs(Math.cos(spinY + st.spin[1]));
      const rx = len, ryy = len * 0.44 * (0.7 + 0.3 * squash);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.5 + st.spin[0] * 0.3);
      ctx.globalAlpha = m.opacity;
      const g = ctx.createRadialGradient(-rx * 0.3, -ryy * 0.4, 0, 0, 0, rx);
      g.addColorStop(0, '#fff8e8'); g.addColorStop(0.6, '#ecdcc0'); g.addColorStop(1, '#b89b73');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ryy, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(143,115,82,0.55)'; ctx.lineWidth = Math.max(1, rx * 0.025);
      ctx.beginPath(); ctx.moveTo(-rx * 0.75, -ryy * 0.15); ctx.quadraticCurveTo(0, -ryy * 0.35, rx * 0.75, -ryy * 0.15); ctx.stroke();
      ctx.restore();
    }
  }

  function destroy() { dead = true; ctx.clearRect(0, 0, W, H); }
  function toScreen(x, y) { return [sx(x), sy(y)]; }
  function toWorld(px, py) { return [((px / W) * 2 - 1) * aspect, 1 - (py / H) * 2]; }
  return { kind: '2d', n, ready, render, rebuild, destroy, toScreen, toWorld, get box() { return kf?.box; }, get meshK() { return kf?.meshK; } };
}
