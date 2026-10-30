import type { LocaleMatcher } from '../localeConfig';

/** A canonicalized locale tag prepared for matching. */
export type MatchLocale = {
  tag: string;
  language: string;
  /** The maximized script subtag, or '' when none can be derived. */
  script: string;
};

/** The requested locale that produced a match, and the available locale it matched. */
export type LocaleMatch<R extends MatchLocale, A extends MatchLocale> = {
  requested: R;
  available: A;
};

/** RFC 4647 §3.4 truncation: drop the last subtag, plus a single-character subtag left trailing. */
function truncateTag(tag: string): string | undefined {
  const subtags = tag.split('-');
  subtags.pop();
  if (subtags.length > 1 && subtags[subtags.length - 1].length === 1) {
    subtags.pop();
  }
  return subtags.length ? subtags.join('-') : undefined;
}

/** RFC 4647 §3.4 Lookup. Tags are canonicalized by the caller, so equality is case-exact. */
function lookupLocale<R extends MatchLocale, A extends MatchLocale>(
  requested: readonly R[],
  available: readonly A[]
): LocaleMatch<R, A> | undefined {
  for (const requestedLocale of requested) {
    for (
      let range: string | undefined = requestedLocale.tag;
      range;
      range = truncateTag(range)
    ) {
      const match = available.find((locale) => locale.tag === range);
      if (match) return { requested: requestedLocale, available: match };
    }
  }
  return undefined;
}

/**
 * Picks the configured locale that best matches the requested locales, in
 * the user's priority order. `lookup` is RFC 4647 Lookup; `best fit` runs
 * Lookup per requested language, then accepts a same-language locale with
 * the same maximized script (UTS #35: a region difference is acceptable, a
 * script difference is not).
 * @internal
 */
export function _determineLocale<R extends MatchLocale, A extends MatchLocale>(
  requested: readonly R[],
  available: readonly A[],
  localeMatcher: LocaleMatcher
): LocaleMatch<R, A> | undefined {
  if (localeMatcher === 'lookup') return lookupLocale(requested, available);
  const languages = Array.from(
    new Set(requested.map(({ language }) => language))
  );
  for (const language of languages) {
    const requestedLanguage = requested.filter(
      (locale) => locale.language === language
    );
    const availableLanguage = available.filter(
      (locale) => locale.language === language
    );
    const match = lookupLocale(requestedLanguage, availableLanguage);
    if (match) return match;
    for (const requestedLocale of requestedLanguage) {
      const scriptMatch = availableLanguage.find(
        (locale) => locale.script === requestedLocale.script
      );
      if (scriptMatch) {
        return { requested: requestedLocale, available: scriptMatch };
      }
    }
  }
  return undefined;
}
