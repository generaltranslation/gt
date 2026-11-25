import { createCredentialsPlugin } from 'gt-i18n/internal/vite';
import type { Plugin } from 'vite';

/**
 * Exposes `GT_PROJECT_ID` to gt-react in client code, and `GT_API_KEY` too
 * while the dev server runs, so development translations hot-reload. Both are
 * read from the environment and Vite's `.env` files.
 *
 * @example
 * import { gtReact } from 'gt-react/vite';
 *
 * export default defineConfig({ plugins: [react(), gtReact()] });
 */
export function gtReact(): Plugin {
  return createCredentialsPlugin('gt-react', 'gtReact');
}
