// WebGL renderer for the grain, on OGL. Every keyframe lives in a float texture; the vertex shader does
// all the blending, so the CPU does nothing per particle per frame.
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Texture, Sphere, Plane } from 'ogl';
import { K, MODE, STAGGER, SIZE, KIND_PARAMS, KIND_ALPHA, buildKeyframes, meshAt, fireLayout } from './keyframes.js';
import { buildAtlas, COLS, ROWS } from './sprites.js';
import { buildProps, propOpacity } from './props.js';
import { grainState } from './state.js';
import { canvasSize } from './size.js';

const TEX_W = 256;

const VERT = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D uPos;
uniform sampler2D uCol;
uniform int uRows;
uniform float uProgress, uTime, uPointScale, uHeat, uCook, uGlow, uTop, uReduced, uSpriteScale;
uniform float uSize[${K}];
uniform float uMode[${K}];
uniform float uStagger[${K}];
uniform vec3 uOffset[${K}];
uniform vec4 uKind[9];
uniform float uKindAlpha[9];
in float aIndex;
in vec4 aRand;
out vec4 vCol;
out float vAngle;
out float vShade;
out float vSoft;
out float vElong;
out float vGloss;
out float vRice;
out float vFlat;
out vec3 vSprite; // atlas row for kind A and B (-1 = not a sprite), blend
out float vVariant;
out vec3 vTint;

float spriteRow(float k) { return (k > 0.5 && k < 5.5) ? k - 1.0 : -1.0; }

vec4 fetchPos(int k, int i) { return texelFetch(uPos, ivec2(i % ${TEX_W}, k * uRows + i / ${TEX_W}), 0); }
vec4 fetchCol(int k, int i) { return texelFetch(uCol, ivec2(i % ${TEX_W}, k * uRows + i / ${TEX_W}), 0); }
float kw(float c, float p) { return 1.0 - clamp(abs(p - c), 0.0, 1.0); }
float isRice(float k) { return (k < 0.5 || abs(k - 8.0) < 0.5) ? 1.0 : 0.0; }

void main() {
  int i = int(aIndex);
  float p = clamp(uProgress, 0.0, float(${K - 1}));
  int k = int(floor(p));
  if (k > ${K - 2}) k = ${K - 2};
  float t = p - float(k);
  vec4 pa = fetchPos(k, i);
  vec4 pb = fetchPos(k + 1, i);
  vec4 ca = fetchCol(k, i);
  vec4 cb = fetchCol(k + 1, i);
  // pos.w carries order (0..1) + 2 * kind
  float kA = floor(pa.w * 0.5 + 0.001), kB = floor(pb.w * 0.5 + 0.001);
  float oA = pa.w - 2.0 * kA, oB = pb.w - 2.0 * kB;
  vec3 A = pa.xyz + uOffset[k];
  vec3 B = pb.xyz + uOffset[k + 1];
  float mode = uMode[k + 1];
  float d = aRand.x * uStagger[k + 1] * (1.0 - uReduced);
  float tt = clamp((t - d) / max(1.0 - d, 0.001), 0.0, 1.0);
  float e;
  vec3 pos;
  float tumble = 0.0;
  bool solidB = kB > 5.5; // surfaces and shadows fade in place rather than pour
  if (mode > 0.5 && mode < 1.5 && !solidB) {
    // pour: grains arrive from above and settle with weight
    if (ca.a < 0.01) A = vec3(B.x + (aRand.y - 0.5) * 0.35, uTop + aRand.z * 1.4, B.z);
    e = tt * tt;
    pos = mix(A, B, e);
    float land = clamp((tt - 0.82) / 0.18, 0.0, 1.0);
    pos.y += sin(land * 3.14159) * 0.03 * (1.0 - land);
    tumble = (1.0 - tt) * 8.0;
  } else if (mode > 1.5 && !solidB) {
    // lift: up and over, then down
    e = tt * tt * (3.0 - 2.0 * tt);
    pos = mix(A, B, e);
    pos.y += sin(e * 3.14159) * (0.2 + 0.3 * aRand.z) * (1.0 - uReduced);
    tumble = sin(e * 3.14159) * 4.0;
  } else {
    e = tt * tt * (3.0 - 2.0 * tt);
    pos = mix(A, B, e);
  }
  vec4 col = mix(ca, cb, e);
  float order = mix(oA, oB, e);
  float size = mix(uSize[k], uSize[k + 1], e);
  vec4 pr = mix(uKind[int(kA)], uKind[int(kB)], e);
  float alphaK = mix(uKindAlpha[int(kA)], uKindAlpha[int(kB)], e);
  float rice = mix(isRice(kA), isRice(kB), e);
  float loose = mix(kA > 5.5 ? 0.0 : 1.0, kB > 5.5 ? 0.0 : 1.0, e);

  float wFire = kw(4.0, p);
  float wGlow = kw(5.0, p);
  float wPot = kw(6.0, p);
  float wPile = clamp(kw(3.0, p) + kw(4.0, p) + kw(5.0, p) + wPot, 0.0, 1.0);

  // heat shimmer, strongest at the base of the pile
  float sh = uHeat * wFire * (1.0 - uReduced) * loose;
  float low = 1.0 - order;
  pos.x += sin(uTime * 6.0 + aRand.y * 40.0 + pos.y * 9.0) * 0.012 * sh * low;
  pos.y += sin(uTime * 7.3 + aRand.z * 40.0) * 0.01 * sh * low;
  // the whole pile breathes very slightly
  pos += vec3(sin(uTime * 0.8 + aRand.w * 6.28), cos(uTime * 0.7 + aRand.y * 6.28), 0.0) * 0.0025 * (1.0 - uReduced) * loose;

  // grains deep in a pile sit in the shade of the ones above
  col.rgb *= 1.0 - 0.3 * low * wPile * rice;
  // the base of the pile catches the fire; the rice in the pot turns jollof from the bottom up
  vec3 ember = vec3(0.9, 0.5, 0.2);
  // jollof orange; one grain in five keeps less stew, one in twenty is dark from the bottom of the pot
  vec3 jollof = mix(vec3(0.93, 0.47, 0.16), vec3(0.74, 0.28, 0.09), aRand.w);
  jollof = aRand.x < 0.12 ? jollof * 0.6 + vec3(0.38, 0.24, 0.1) : (aRand.x > 0.95 ? jollof * vec3(0.5, 0.45, 0.4) : jollof);
  col.rgb = mix(col.rgb, ember, sh * low * 0.45);
  // each grain takes the stew in its own time, the lowest a little sooner
  float th = 0.7 * aRand.z + 0.3 * order;
  float cook = smoothstep(th - 0.12, th + 0.12, uCook * 1.2) * wPot * rice;
  col.rgb = mix(col.rgb, jollof, cook);
  col.rgb += wGlow * uGlow * vec3(0.1, 0.06, 0.02) * loose;

  vCol = vec4(col.rgb, col.a * alphaK);
  // sprites keep their own colours; they only take the lighting changes (ember, glow) as a tint
  vTint = col.rgb / max(mix(ca, cb, e).rgb, vec3(0.05));
  vSprite = vec3(spriteRow(kA), spriteRow(kB), e);
  vVariant = floor(aRand.w * 3.999);
  vSoft = clamp(pr.y + wGlow * uGlow * 0.5 * loose, 0.0, 1.0);
  vElong = pr.x;
  vGloss = max(pr.w, cook * 0.55);
  vRice = rice;
  vFlat = 1.0 - loose; // surfaces and shadows are flat, not beads
  vAngle = aRand.y * 6.283 + tumble * aRand.z;
  vShade = aRand.w;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  // ingredient pieces keep their size whatever the grain count
  float spr = mix(vSprite.x < 0.0 ? 0.0 : 1.0, vSprite.y < 0.0 ? 0.0 : 1.0, e);
  gl_PointSize = size * pr.z * mix(1.0, uSpriteScale, spr) * (0.6 + 0.6 * aRand.z) * uPointScale / -mv.z;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec4 vCol;
in float vAngle;
in float vShade;
in float vSoft;
in float vElong;
in float vGloss;
in float vRice;
in float vFlat;
in vec3 vSprite;
in float vVariant;
in vec3 vTint;
uniform sampler2D uAtlas;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float s = sin(vAngle), co = cos(vAngle);
  vec2 q = vec2(co * c.x - s * c.y, s * c.x + co * c.y);
  // ingredient pieces: a tile from the atlas, premultiplied, turned with the particle
  float ws = mix(vSprite.x < 0.0 ? 0.0 : 1.0, vSprite.y < 0.0 ? 0.0 : 1.0, vSprite.z);
  vec4 sprite = vec4(0.0);
  if (ws > 0.001) {
    float row = vSprite.z < 0.5 ? vSprite.x : vSprite.y;
    if (row < 0.0) row = max(vSprite.x, vSprite.y);
    vec2 uv = q * 0.5 + 0.5;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec2 auv = vec2((vVariant + clamp(uv.x, 0.0, 1.0)) / ${COLS}.0, (row + clamp(uv.y, 0.0, 1.0)) / ${ROWS}.0);
    sprite = texture(uAtlas, auv) * inside * vCol.a;
    sprite.rgb *= vTint;
    if (ws > 0.999) { if (sprite.a < 0.005) discard; outColor = sprite; return; }
  }
  float a = 0.98, b = vElong;
  float r2 = (q.x * q.x) / (a * a) + (q.y * q.y) / (b * b);
  float edge = fwidth(r2) * 1.2 + 0.02;
  float hard = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r2);
  float soft = pow(max(0.0, 1.0 - r2), 1.6);
  float alpha = mix(hard, soft, vSoft);
  if (alpha < 0.01 && ws < 0.001) discard;
  float nz = sqrt(max(0.0, 1.0 - min(r2, 1.0)));
  vec3 n = normalize(vec3(q.x / a, q.y / b, nz * 1.5));
  float flat_ = max(vSoft, vFlat);
  n = normalize(mix(n, vec3(0.0, 0.0, 1.0), flat_)); // soft sprites and surfaces are flat, not beads
  vec3 L = normalize(vec3(-0.45, 0.7, 0.62));
  float diff = mix(0.5 + 0.5 * max(dot(n, L), 0.0), 1.0, vFlat); // surfaces carry their own baked shading
  float rimDark = pow(1.0 - nz, 2.5) * (1.0 - flat_);
  float core = smoothstep(1.0, 0.15, r2);
  vec3 col = vCol.rgb * diff;
  // raw rice is chalky in the middle and lets light through at the edges
  col = mix(col, col * 1.08 + vec3(0.04, 0.03, 0.02), core * vRice * 0.6 * (1.0 - vGloss));
  col *= 1.0 - 0.2 * rimDark * (1.0 - 0.6 * vGloss);
  // an oily coat catches the light in the middle of a cooked grain
  col = mix(col, col * 1.18 + vec3(0.05, 0.02, 0.0), core * vGloss * vRice * 0.5);
  col += vec3(1.0, 0.95, 0.85) * rimDark * 0.1 * vRice;
  // the faint crease along a grain
  col *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.07, abs(q.y - 0.06))) * step(abs(q.x), 0.6) * vRice * (1.0 - vSoft);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  col += vec3(1.0, 0.96, 0.9) * spec * (0.08 + 0.5 * vGloss) * (1.0 - flat_);
  col *= 0.9 + 0.2 * vShade * (1.0 - vFlat);
  float outA = alpha * vCol.a;
  outColor = mix(vec4(col * outA, outA), sprite, ws); // premultiplied
  if (outColor.a < 0.005) discard;
}
`;

const PROP_VERT = /* glsl */ `#version 300 es
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const PROP_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D tMap;
uniform float uOpacity;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(tMap, vUv) * uOpacity; } // premultiplied
`;

const FIRE_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform float uTime, uHeat, uOpacity;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return 0.5 * noise(p) + 0.25 * noise(p * 2.1 + 3.0) + 0.125 * noise(p * 4.3 + 7.0); }
void main() {
  vec2 uv = vUv;
  float x = uv.x * 2.0 - 1.0;
  float h = mix(0.22, 1.0, uHeat); // how high the flames reach
  float n = fbm(vec2(uv.x * 4.5, uv.y * 3.0 - uTime * 1.7));
  float n2 = fbm(vec2(uv.x * 10.0 + 5.0, uv.y * 6.0 - uTime * 2.6));
  float body = 1.0 - uv.y / h;
  float width = 1.0 - x * x * (1.15 - 0.3 * uHeat);
  float f = clamp(body, -1.0, 1.0) * width * (0.9 + 0.4 * uHeat) + (n - 0.5) * 0.95 + (n2 - 0.5) * 0.4;
  float foot = smoothstep(0.0, 0.14, uv.y); // nothing below the hearth
  float a = smoothstep(0.26, 0.62, f) * foot;
  float core = smoothstep(0.62, 1.0, f);
  vec3 col = mix(vec3(0.8, 0.16, 0.03), vec3(1.0, 0.58, 0.12), smoothstep(0.3, 0.75, f));
  col = mix(col, vec3(1.0, 0.94, 0.65), core);
  // the glow of the embers at the base, and the pot's underside catching it
  float glow = exp(-abs(uv.y - 0.16) * 6.0) * max(0.0, 1.0 - x * x) * (0.2 + 0.3 * uHeat) * foot;
  vec4 o = vec4(col * a + vec3(1.0, 0.45, 0.12) * glow, a + glow);
  outColor = o * uOpacity; // premultiplied
}
`;

const MESH_VERT = /* glsl */ `#version 300 es
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;
out vec3 vN; out vec3 vP; out vec3 vObj;
void main() {
  vObj = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
const MESH_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform float uOpacity;
uniform vec3 uColor;
in vec3 vN; in vec3 vP; in vec3 vObj;
out vec4 outColor;
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(-vP);
  vec3 L = normalize(vec3(-0.55, 0.8, 0.75));
  vec3 Lback = normalize(vec3(0.7, 0.3, -0.6));
  float diff = max(dot(n, L), 0.0);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.0);
  // the groove runs the length of the grain, on the face that starts towards the viewer
  float around = atan(vObj.y, vObj.z);
  float groove = 1.0 - 0.42 * smoothstep(0.22, 0.0, abs(around - 0.35)) * (1.0 - smoothstep(0.72, 0.96, abs(vObj.x)));
  // the tips are a touch denser and darker
  float tips = 1.0 - 0.12 * smoothstep(0.75, 1.0, abs(vObj.x));
  vec3 shadow = vec3(0.62, 0.5, 0.36);
  vec3 col = mix(shadow, uColor, 0.35 + 0.65 * diff) * groove * tips;
  // light passing through the edges, like a grain held up to a window
  float through = pow(max(dot(n, Lback), 0.0), 2.0) * 0.35 + fres * 0.55;
  col += vec3(1.0, 0.94, 0.82) * through;
  col += vec3(1.0, 0.92, 0.75) * pow(max(dot(reflect(-L, n), V), 0.0), 36.0) * 0.35;
  float outA = uOpacity * (0.88 + 0.12 * fres);
  outColor = vec4(col * outA, outA); // premultiplied
}
`;

export function create(canvas, { n, reduced, number, ingredients, fontFamily }) {
  performance.mark('grain:create');
  const dprCap = n <= 3000 ? 1.5 : 2;
  const renderer = new Renderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance', dpr: Math.min(window.devicePixelRatio || 1, dprCap), webgl: 2, depth: true });
  const gl = renderer.gl;
  if (!gl || !renderer.isWebgl2) throw new Error('WebGL2 unavailable');
  gl.clearColor(0, 0, 0, 0);
  performance.mark('grain:context');

  const scene = new Transform();
  const dist = 1 / Math.tan((20 * Math.PI) / 180);
  const camera = new Camera(gl, { fov: 40, near: 0.1, far: 20, aspect: 1 });
  camera.position.z = dist;

  const rows = Math.ceil(n / TEX_W);
  const texOpts = { width: TEX_W, height: rows * K, type: gl.FLOAT, format: gl.RGBA, internalFormat: gl.RGBA32F, generateMipmaps: false, minFilter: gl.NEAREST, magFilter: gl.NEAREST, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, flipY: false };
  const posData = new Float32Array(TEX_W * rows * K * 4);
  const colData = new Float32Array(TEX_W * rows * K * 4);
  const posTex = new Texture(gl, { ...texOpts, image: posData });
  const colTex = new Texture(gl, { ...texOpts, image: colData });
  const atlasTex = new Texture(gl, { image: buildAtlas(), generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, flipY: false, premultiplyAlpha: true });

  const idx = new Float32Array(n);
  const rnd = new Float32Array(n * 4);
  const seedRng = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  for (let i = 0; i < n; i += 1) {
    idx[i] = i;
    rnd[i * 4] = seedRng(); rnd[i * 4 + 1] = seedRng(); rnd[i * 4 + 2] = seedRng(); rnd[i * 4 + 3] = seedRng();
  }
  const geometry = new Geometry(gl, {
    position: { size: 3, data: new Float32Array(n * 3) },
    aIndex: { size: 1, data: idx },
    aRand: { size: 4, data: rnd },
  });
  const uniforms = {
    uPos: { value: posTex }, uCol: { value: colTex }, uRows: { value: rows },
    uProgress: { value: 0 }, uTime: { value: 0 }, uPointScale: { value: 10 },
    uHeat: { value: 0 }, uCook: { value: 0 }, uGlow: { value: 1 }, uTop: { value: 1.15 }, uReduced: { value: reduced ? 1 : 0 }, uSpriteScale: { value: Math.sqrt(n / 6000) },
    uSize: { value: SIZE.slice() }, uMode: { value: MODE.slice() }, uStagger: { value: STAGGER.slice() },
    uOffset: { value: new Array(K * 3).fill(0) },
    uKind: { value: KIND_PARAMS.flat() }, uKindAlpha: { value: KIND_ALPHA.slice() },
    uAtlas: { value: atlasTex },
  };
  const program = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false });
  performance.mark('grain:program');
  const points = new Mesh(gl, { mode: gl.POINTS, geometry, program, frustumCulled: false });
  points.renderOrder = 1;
  points.setParent(scene);

  // The single grain: a real ellipsoid you can turn.
  const meshGeo = new Sphere(gl, { radius: 1, widthSegments: 64, heightSegments: 40 });
  const meshProgram = new Program(gl, {
    vertex: MESH_VERT, fragment: MESH_FRAG, transparent: true, depthTest: true, depthWrite: true,
    uniforms: { uOpacity: { value: 1 }, uColor: { value: [0.96, 0.9, 0.78] } },
  });
  const mesh = new Mesh(gl, { geometry: meshGeo, program: meshProgram, frustumCulled: false });
  mesh.renderOrder = 1;
  mesh.setParent(scene);

  // The fire under the pot: a procedural flame on a quad behind the pot.
  const fireProgram = new Program(gl, { vertex: PROP_VERT, fragment: FIRE_FRAG, uniforms: { uTime: { value: 0 }, uHeat: { value: 0 }, uOpacity: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false });
  let fire = null;
  function setFire(layout) {
    if (fire) { fire.geometry.remove(); fire.setParent(null); }
    fire = new Mesh(gl, { geometry: new Plane(gl, { width: layout.w, height: layout.h }), program: fireProgram, frustumCulled: false });
    fire.position.set(layout.cx, layout.cy, -0.02);
    fire.renderOrder = 0; // over the pot's body, under the rice
    fire.setParent(scene);
  }

  // The painted props: pictures on planes, behind the grains or (the pot's front lip) over them.
  let propMeshes = [];
  function setProps(props) {
    for (const m of propMeshes) { m.program.remove(); m.geometry.remove(); gl.deleteTexture(m.program.uniforms.tMap.value.texture); m.setParent(null); }
    propMeshes = props.map((pr) => {
      const tex = new Texture(gl, { image: pr.canvas, generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, flipY: true, premultiplyAlpha: true });
      const program = new Program(gl, { vertex: PROP_VERT, fragment: PROP_FRAG, uniforms: { tMap: { value: tex }, uOpacity: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false });
      const m = new Mesh(gl, { geometry: new Plane(gl, { width: pr.w, height: pr.h }), program, frustumCulled: false });
      m.position.set(pr.cx, pr.cy, pr.layer === 'front' ? 0.08 : -0.05);
      m.renderOrder = pr.layer === 'front' ? 2 : -1;
      m.prop = pr;
      m.setParent(scene);
      return m;
    });
  }

  let box, meshK, aspect = 1, mobile = false, building = 0, W = 1, H = 1, dead = false;
  async function rebuild() {
    const size = canvasSize(canvas);
    if (size.W === W && size.H === H) return; // a phone's address bar came and went; nothing to redo
    W = size.W;
    H = size.H;
    aspect = W / H;
    mobile = W < 960;
    renderer.setSize(W, H);
    canvas.style.width = ''; canvas.style.height = ''; // let the stylesheet keep it at 100%
    camera.perspective({ aspect });
    uniforms.uPointScale.value = H * 0.03 * renderer.dpr * Math.sqrt(6000 / n) * dist * (mobile ? 0.85 : 1);
    uniforms.uSpriteScale.value = Math.sqrt(n / 6000) * (mobile ? 0.62 : 1); // the phone's pile is wide and low
    const ticket = ++building;
    const kf = await buildKeyframes({ n, aspect, mobile, number, ingredients, fontFamily });
    if (ticket !== building) return; // a newer rebuild superseded this one
    box = kf.box; meshK = kf.meshK;
    // copy into texture layout (particle rows per keyframe are padded to TEX_W)
    for (let k = 0; k < K; k += 1) {
      const src = k * n * 4, dst = k * rows * TEX_W * 4;
      posData.set(kf.pos.subarray(src, src + n * 4), dst);
      colData.set(kf.col.subarray(src, src + n * 4), dst);
    }
    posTex.needsUpdate = true; colTex.needsUpdate = true;
    setProps(buildProps({ box, mobile, pxPerUnit: (W * renderer.dpr) / (2 * aspect) }));
    setFire(fireLayout(box));
  }
  performance.mark('grain:mesh');
  const ready = rebuild().then(() => performance.mark('grain:keyframes'));

  let spinX = 0, spinY = 0;
  function render(time) {
    const s = grainState;
    if (dead || !meshK) return; // torn down, or keyframes still building
    points.visible = s.progress > 1.02; // nothing but the single grain before that
    uniforms.uProgress.value = s.progress;
    uniforms.uTime.value = time / 1000;
    uniforms.uHeat.value = s.heat;
    uniforms.uCook.value = s.cook;
    uniforms.uGlow.value = s.glow;
    const off = uniforms.uOffset.value;
    off[30] = s.focus[0]; off[31] = s.focus[1]; off[32] = s.focus[2];

    for (const pm of propMeshes) { const o = propOpacity(pm.prop, s.progress); pm.visible = o > 0.004; pm.program.uniforms.uOpacity.value = o; }
    if (fire) {
      // lit as the pile lands in the pot (04), kept low through 05 and 06
      const lit = Math.max(0, Math.min(1, (s.progress - 3.65) / 0.3)) * propOpacity({ key: 4, keyEnd: 6 }, s.progress);
      const heat = Math.max(0, Math.min(1, (s.progress - 3.8) / 0.3)) * (0.28 + 0.72 * s.heat);
      fire.visible = lit > 0.004;
      fireProgram.uniforms.uOpacity.value = lit;
      fireProgram.uniforms.uHeat.value = heat;
      fireProgram.uniforms.uTime.value = reduced ? 1.7 : time / 1000;
    }
    const m = meshAt(s.progress, meshK);
    mesh.visible = m.opacity > 0.01;
    if (mesh.visible) {
      mesh.position.set(m.pos[0], m.pos[1], m.pos[2]);
      mesh.scale.set(m.scale, m.scale * 0.37, m.scale * 0.33);
      meshProgram.uniforms.uOpacity.value = m.opacity;
      if (!reduced) {
        spinY += 0.003 + s.spinVel[1];
        spinX += s.spinVel[0];
        s.spinVel[0] *= 0.94; s.spinVel[1] *= 0.94;
      }
      mesh.rotation.set(0.15 + spinX + s.spin[0], spinY + s.spin[1], -0.45);
    }
    renderer.render({ scene, camera });
  }

  function destroy() {
    dead = true;
    setProps([]);
    if (fire) { fire.geometry.remove(); fire.setParent(null); } fireProgram.remove();
    geometry.remove(); program.remove(); meshGeo.remove(); meshProgram.remove();
    gl.deleteTexture(posTex.texture); gl.deleteTexture(colTex.texture); gl.deleteTexture(atlasTex.texture);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // Screen position (CSS px) of a world point, for aligning HTML to the grain.
  function toScreen(x, y) { return [((x / aspect + 1) / 2) * W, ((1 - y) / 2) * H]; }
  function toWorld(px, py) { return [((px / W) * 2 - 1) * aspect, 1 - (py / H) * 2]; }

  return { kind: 'webgl', n, ready, render, rebuild, destroy, toScreen, toWorld, get box() { return box; }, get meshK() { return meshK; } };
}
