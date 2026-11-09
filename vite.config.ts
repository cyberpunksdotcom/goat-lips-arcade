import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Absolute site URL for link previews (og:image must be absolute). On Vercel this is the
// production domain: the vercel.app address now, play.goatlips.com once it's connected.
const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const SITE_URL = prod ? `https://${prod}` : (process.env.SITE_URL ?? '');

const siteUrl = (): Plugin => ({
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
});

// `npm run build` → normal multi-file build for Vercel.
// `npm run build:single` → one self-contained HTML file, handy for quick phone tests.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [siteUrl(), viteSingleFile()] : [siteUrl()],
  build: {
    target: 'es2020',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
}));
