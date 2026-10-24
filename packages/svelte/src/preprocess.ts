import { transformSvelteSource } from '@generaltranslation/svelte-extractor';
import type { SvelteExtractionError } from '@generaltranslation/svelte-extractor';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { PreprocessorGroup } from 'svelte/compiler';
import { parse } from 'svelte/compiler';
import {
  getCodeFrame,
  getOriginalSource,
  type PreprocessLocation,
} from './preprocess/locations.js';

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
export function gtPreprocess(): PreprocessorGroup {
  return {
    name: 'gt-svelte',
    markup({ content, filename }) {
      const result = transformSvelteSource(content, {
        parse,
        filename,
      });
      if (!result) return;
      if (result.errors.length > 0) {
        throw createPreprocessError(result.errors, content, filename);
      }
      return { code: result.code, map: result.map };
    },
  };
}

/** The fields Vite and Svelte tooling read from Svelte's compiler errors. */
type PreprocessError = Error & {
  filename?: string;
  start: PreprocessLocation;
  end: PreprocessLocation;
  frame: string;
};

/**
 * Reports every problem, located in the file as written even when earlier
 * preprocessors changed it. The error points at the first problem, so Vite
 * shows its code frame.
 */
function createPreprocessError(
  errors: SvelteExtractionError[],
  content: string,
  filename: string | undefined
): PreprocessError {
  const original = getOriginalSource(content, filename);
  const locations = errors.map((error) =>
    original.locate(error.location.offset)
  );
  const message = errors
    .map((error, index) =>
      createDiagnosticMessage({
        source: 'gt-svelte (preprocess)',
        severity: 'Error',
        whatHappened: error.whatHappened,
        fix: error.fix,
        details: `${filename ?? '<unknown>'}:${locations[index].line}:${locations[index].column + 1}`,
      })
    )
    .join('\n');
  const [start] = locations;
  return Object.assign(new Error(message), {
    ...(filename !== undefined && { filename }),
    start,
    end: start,
    frame: getCodeFrame(original.source, start),
  });
}
