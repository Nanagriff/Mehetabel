// Resolves an image path from content.json. Paths starting with "/" are served from public/ as-is
// (placeholders). Anything else is looked up in src/photos so Astro can build AVIF/WebP/JPEG variants.
const photos = import.meta.glob('/src/photos/**/*.{jpg,jpeg,png,webp,avif}', { eager: true });

export function resolvePhoto(src = '') {
  if (!src || src.startsWith('/') || src.startsWith('http')) return null;
  const key = '/src/' + src.replace(/^\/?src\//, '').replace(/^\//, '');
  return photos[key]?.default ?? null;
}
