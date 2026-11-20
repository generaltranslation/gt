import { createCredentialsPlugin } from 'gt-i18n/internal/vite';
import type { Plugin } from 'vite';

/**
 * Exposes `GT_PROJECT_ID` to gt-vue in client code, and `GT_API_KEY` too
 * while the dev server runs, so development translations hot-reload. Both are
 * read from the environment and Vite's `.env` files.
 *
 * @example
 * import { gtVue } from 'gt-vue/vite';
 *
 * export default defineConfig({ plugins: [vue(), gtVue()] });
 */
export function gtVue(): Plugin {
  return createCredentialsPlugin('gt-vue', 'gtVue');
}
