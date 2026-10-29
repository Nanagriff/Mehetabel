// Builds the favicon set and the 1200x630 share image from the grain mark and the hero portrait.
// Run: npm run icons   (re-run after swapping in the real portrait)
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const content = JSON.parse(readFileSync('src/content/content.json', 'utf8'));
const name = content.owner.useBusinessName && content.owner.businessName ? content.owner.businessName : content.owner.name;

// The grain mark: a tilted translucent ellipsoid with its groove.
const grain = (size, bg = '#F6EFE3') => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${bg}"/>
  <defs>
    <radialGradient id="g" cx="38%" cy="32%" r="70%">
      <stop offset="0" stop-color="#FFFBF2"/><stop offset=".55" stop-color="#EEDFC6"/><stop offset="1" stop-color="#B99C72"/>
    </radialGradient>
  </defs>
  <g transform="rotate(-32 32 32)">
    <ellipse cx="32" cy="32" rx="22" ry="9.5" fill="url(#g)"/>
    <path d="M14 32 Q 32 29 50 32" stroke="#8F7352" stroke-opacity=".55" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="32" cy="32" rx="22" ry="9.5" fill="none" stroke="#8F7352" stroke-opacity=".35" stroke-width="1"/>
  </g>
</svg>`;

writeFileSync('public/favicon.svg', grain(64).trim());
await sharp(Buffer.from(grain(64))).resize(32, 32).png().toFile('public/favicon-32.png');
await sharp(Buffer.from(grain(64))).resize(180, 180).png().toFile('public/apple-touch-icon.png');
await sharp(Buffer.from(grain(64))).resize(512, 512).png().toFile('public/icon-512.png');
// favicon.ico: a 32px PNG inside an ICO container.
const png32 = await sharp(Buffer.from(grain(64))).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(6 + 16);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([ico, png32]));

// Share image: her portrait on the right, name on the left, the single grain between.
const portraitPath = content.hero.portrait.src.startsWith('/') ? `public${content.hero.portrait.src}` : `src/${content.hero.portrait.src}`;
const W = 1200, H = 630;
const portrait = existsSync(portraitPath)
  ? await sharp(portraitPath).resize(560, H, { fit: 'cover', position: 'attention' }).toBuffer()
  : await sharp({ create: { width: 560, height: H, channels: 3, background: '#A89C8E' } }).png().toBuffer();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Fit the name into the left column: shrink a little, then break onto two lines if it is still too long.
const COL = 540;
const estimate = (str, size) => str.length * size * 0.52;
let nameSize = 64;
let nameLines = [name];
if (estimate(name, nameSize) > COL) nameSize = 56;
if (estimate(name, nameSize) > COL) {
  const words = name.split(' ');
  let best = [name], bestWidth = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const w = Math.max(estimate(a, nameSize), estimate(b, nameSize));
    if (w < bestWidth) { bestWidth = w; best = [a, b]; }
  }
  nameLines = best;
  while (bestWidth > COL && nameSize > 40) { nameSize -= 4; bestWidth = Math.max(...nameLines.map((l) => estimate(l, nameSize))); }
}
const nameY = nameLines.length > 1 ? 215 : 250;
const below = nameY + (nameLines.length - 1) * nameSize * 1.08 + 20;
const text = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F6EFE3"/>
  ${nameLines.map((line, i) => `<text x="72" y="${nameY + i * nameSize * 1.08}" font-family="Georgia, 'Times New Roman', serif" font-size="${nameSize}" fill="#1F1B18">${esc(line)}</text>`).join('\n  ')}
  <text x="72" y="${below + 50}" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#B8321E">Chef.</text>
  <text x="72" y="${below + 102}" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#1F1B18" fill-opacity=".8">I also make sure the world hears about the food.</text>
  <g transform="translate(72 ${below + 170}) rotate(-28)">
    <ellipse cx="30" cy="0" rx="34" ry="14" fill="#EEDFC6" stroke="#8F7352" stroke-opacity=".5"/>
    <path d="M2 0 Q 30 -4 58 0" stroke="#8F7352" stroke-opacity=".6" stroke-width="2" fill="none"/>
  </g>
</svg>`;
await sharp(Buffer.from(text))
  .composite([{ input: portrait, left: W - 560, top: 0 }])
  .jpeg({ quality: 86 })
  .toFile('public/og.jpg');
console.log('icons and share image written to public/');
