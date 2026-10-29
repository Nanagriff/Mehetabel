import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

const content = JSON.parse(readFileSync(new URL('./src/content/content.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: content.site.url,
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always' },
  vite: {
    build: {
      sourcemap: true,
    },
  },
});
