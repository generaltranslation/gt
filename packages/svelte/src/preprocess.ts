import { transformSvelteSource } from '@generaltranslation/svelte-extractor';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { PreprocessorGroup } from 'svelte/compiler';
import { parse } from 'svelte/compiler';

export type GTPreprocessOptions = {
  /**
   * Emit `<T>` source content so missing translations can be requested at
   * runtime. Defaults to `process.env.NODE_ENV !== 'production'`.
   */
  dev?: boolean;
};

/**
 * Prepares `<T>` components for translation. Add it last in `preprocess` so
 * it sees the final Svelte markup.
 *
 * @example
 * ```js
 * // svelte.config.js
 * import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
 * import { gtPreprocess } from 'gt-svelte/preprocess';
 *
 * export default {
 *   preprocess: [vitePreprocess(), gtPreprocess()],
 * };
 * ```
 */
export function gtPreprocess(
  options: GTPreprocessOptions = {}
): PreprocessorGroup {
  const dev = options.dev ?? process.env.NODE_ENV !== 'production';
  return {
    name: 'gt-svelte',
    markup({ content, filename }) {
      const result = transformSvelteSource(content, {
        parse,
        filename,
        dev,
      });
      if (!result) return;
      if (result.errors.length > 0) {
        throw new Error(
          result.errors
            .map((error) =>
              createDiagnosticMessage({
                source: 'gt-svelte (preprocess)',
                severity: 'Error',
                whatHappened: error.whatHappened,
                fix: error.fix,
                details: `${filename ?? '<unknown>'}:${error.location.line}:${error.location.column + 1}`,
              })
            )
            .join('\n')
        );
      }
      return { code: result.code, map: result.map };
    },
  };
}
