import {
  createLookupOptions,
  getI18nCache,
  getI18nConfig,
} from 'gt-i18n/internal';
import { interpolateMessage } from 'gt-i18n/internal/string';
import type { GTTranslationOptions } from 'gt-i18n/internal/string';
import type { StringFormat } from '@generaltranslation/format';
import { resolveLocale } from './config';

/** Options for {@link tx}. */
export type TxOptions = GTTranslationOptions & {
  /** The locale to translate into, resolved to a supported locale. */
  $locale: string;
};

/**
 * Translates a string at runtime, for server code such as SvelteKit `load`
 * functions and endpoints. It uses translations loaded for the locale, and
 * otherwise asks General Translation, which needs a project ID and an API key
 * on the server (`GT_PROJECT_ID` and `GT_API_KEY`).
 *
 * @example
 * ```ts
 * // src/routes/[lang]/+page.server.ts
 * import '$lib/gt';
 * import { tx } from 'gt-svelte';
 *
 * export const load = async ({ params }) => ({
 *   status: await tx('Your order has shipped', { $locale: params.lang }),
 * });
 * ```
 */
export async function tx(message: string, options: TxOptions): Promise<string> {
  const lookupOptions = createLookupOptions<StringFormat>(
    resolveLocale(options.$locale),
    options,
    'STRING'
  );
  const translation = await getI18nCache().lookupTranslationWithFallback(
    lookupOptions.$locale,
    message,
    lookupOptions
  );
  return interpolateMessage({
    source: message,
    target: translation,
    options: lookupOptions,
    sourceLocale: getI18nConfig().getDefaultLocale(),
  });
}
