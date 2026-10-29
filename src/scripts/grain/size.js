// The canvas is fixed to the large viewport (see GrainCanvas.astro), so its own box is the size to draw
// at. The inline sizes OGL writes on setSize are cleared first so they cannot feed back into the read.
export function canvasSize(canvas) {
  canvas.style.width = '';
  canvas.style.height = '';
  const r = canvas.getBoundingClientRect();
  return { W: Math.round(r.width) || window.innerWidth, H: Math.round(r.height) || window.innerHeight };
}
