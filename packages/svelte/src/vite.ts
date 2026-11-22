import { createCredentialsPlugin } from 'gt-i18n/internal/vite';
import type { Plugin } from 'vite';

/**
 * Exposes `GT_PROJECT_ID` to gt-svelte in browser code, and `GT_API_KEY` too
 * while the dev server runs, so development translations hot-reload. Both are
 * read from the environment and Vite's `.env` files.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { sveltekit } from '@sveltejs/kit/vite';
 * import { gtSvelte } from 'gt-svelte/vite';
 *
 * export default defineConfig({ plugins: [sveltekit(), gtSvelte()] });
 * ```
 */
export function gtSvelte(): Plugin {
  return createCredentialsPlugin('gt-svelte', 'gtSvelte');
}
