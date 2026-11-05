import { createLookupOptions, interpolateMessage } from 'gt-i18n/internal';
import { resolveLocaleTwinLookup } from 'gt-i18n/internal/experimental';
import type { GTTranslationOptions } from 'gt-i18n/types';
import {
  getReadonlyConditionStore,
  isReadonlyConditionStoreInitialized,
} from '../../condition-store/singleton-operations';
import { t as regularT } from '../../functions/translation/t';
import { getShouldTranslate } from '../../hooks/utils/getShouldTranslate';
import { getI18nConfig } from '../../setup/i18nConfig';

/**
 * `t()` with locale twins: compiled entries render from the registered twin
 * (source locale included, since client code is stripped), content no twin
 * carries (a tagged template the compiler left in place, a call without a
 * compile-time hash) renders its source text on the client and the server
 * alike, and everything else translates like the regular `t()`, which this
 * wraps.
 */
export const t: typeof regularT = ((
  messageOrStrings: string | TemplateStringsArray,
  ...values: unknown[]
) => {
  // Module-level calls in server-rendered apps: the regular t() reports them
  if (!isReadonlyConditionStoreInitialized()) {
    return callRegularT(messageOrStrings, values);
  }
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const locale = getReadonlyConditionStore().getLocale();

  if (typeof messageOrStrings === 'string') {
    const options = (values[0] ?? {}) as GTTranslationOptions;
    const targetLocale = options.$locale ?? locale;
    // Without translation (i18n disabled) the page has the default locale's
    // twins
    const twinLocale = getShouldTranslate() ? targetLocale : defaultLocale;
    const lookupOptions = createLookupOptions(targetLocale, options, 'ICU');
    const twin = resolveLocaleTwinLookup<string>(
      twinLocale,
      lookupOptions,
      options.$_hash
    );
    if (twin.entry !== undefined) {
      // A source fallback is formatted in the source locale, like a miss
      return interpolateMessage({
        source: messageOrStrings,
        target: twin.entry,
        options: createLookupOptions(
          twin.sourceFallback ? defaultLocale : twinLocale,
          options,
          'ICU'
        ),
        sourceLocale: defaultLocale,
      });
    }
    if (twin.rendersSource) {
      return interpolateMessage({
        options: lookupOptions,
        source: messageOrStrings,
        sourceLocale: defaultLocale,
      });
    }
    return callRegularT(messageOrStrings, values);
  }

  // t`Hello, ${name}`: no compile-time hash. When locale twins render it as
  // source, the server must not translate it either (the twin client cannot)
  if (resolveLocaleTwinLookup(locale, {}, undefined).rendersSource) {
    const { message, variables } = extractInterpolatableValues(
      messageOrStrings,
      values
    );
    return interpolateMessage({
      source: message,
      options: createLookupOptions(locale, variables, 'ICU'),
      sourceLocale: defaultLocale,
    });
  }
  return callRegularT(messageOrStrings, values);
}) as typeof regularT;

function callRegularT(
  messageOrStrings: string | TemplateStringsArray,
  values: unknown[]
): string {
  return (regularT as (...args: unknown[]) => string)(
    messageOrStrings,
    ...values
  );
}

/**
 * The message and variables of a tagged template, as the regular `t()`
 * builds them: one `{i}` variable per substitution.
 */
function extractInterpolatableValues(
  strings: TemplateStringsArray,
  values: unknown[]
): { message: string; variables: Record<string, unknown> } {
  const parts: string[] = [];
  const variables: Record<string, unknown> = {};
  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i]);
    if (i < values.length) {
      parts.push(`{${i}}`);
      variables[String(i)] = values[i];
    }
  }
  return { message: parts.join(''), variables };
}
