import { txInternal } from 'gt-i18n/internal';
import { resolveLocale } from './config';

/** Options for {@link tx}. */
export type TxOptions = Parameters<typeof txInternal>[0]['options'] & {
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
export function tx(message: string, options: TxOptions): Promise<string> {
  const $locale = resolveLocale(options.$locale);
  return txInternal({
    locale: $locale,
    enableI18n: true,
    content: message,
    options: { ...options, $locale },
  });
}
