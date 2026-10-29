// Generates labelled warm-grey placeholder images. Run: node scripts/make-placeholders.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const out = 'public/placeholders';
mkdirSync(out, { recursive: true });

const items = [
  ['portrait', 1600, 2000, 'Hero portrait'],
  ['at-work-1', 2400, 1600, 'Her at work (the fire)'],
  ['at-work-2', 2400, 1600, 'Her at work (the pot)'],
  ['table', 2400, 1600, 'A table she served'],
  ['before', 1600, 1000, 'Before the launch'],
  ['after', 1600, 1000, 'After the launch'],
  ['project-menu', 1600, 1000, 'Project: menu'],
  ['project-event', 1600, 1000, 'Project: event'],
  ['project-launch', 1600, 1000, 'Project: launch'],
  ['project-campaign', 1600, 1000, 'Project: campaign'],
  ...[1, 2, 3, 4, 5, 6].map((n) => [`dish-${n}`, 1600, 1600, `Plated dish ${n}, from above`]),
];

for (const [name, w, h, label] of items) {
  const fs = Math.round(Math.min(w, h) / 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Placeholder: ${label}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B8ADA0"/><stop offset="1" stop-color="#9C9185"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<rect x="${fs}" y="${fs}" width="${w - fs * 2}" height="${h - fs * 2}" fill="none" stroke="#F6EFE3" stroke-opacity=".35" stroke-width="${Math.max(2, fs / 10)}" stroke-dasharray="${fs / 2} ${fs / 2}"/>
<text x="50%" y="50%" text-anchor="middle" font-family="Georgia, serif" font-size="${fs}" fill="#F6EFE3" fill-opacity=".92">[TODO] ${label}</text>
<text x="50%" y="${h / 2 + fs * 1.5}" text-anchor="middle" font-family="Georgia, serif" font-size="${fs * 0.6}" fill="#F6EFE3" fill-opacity=".7">${w} × ${h} · warm directional light</text>
</svg>`;
  writeFileSync(`${out}/${name}.svg`, svg);
}
console.log(`wrote ${items.length} placeholders to ${out}`);
