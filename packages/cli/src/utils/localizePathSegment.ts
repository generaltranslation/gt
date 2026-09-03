const SKIPPABLE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\.\/|\.\.\/)/i;

/**
 * Re-prefixes a path-like value with the target locale.
 *
 * Leaves external/relative/anchor values untouched, preserves surrounding
 * whitespace and any leading slash, swaps out an existing known-locale prefix,
 * and returns `null` when no change is needed.
 *
 * @param value - The raw path/URL value to localize.
 * @param targetLocale - The locale to prefix with.
 * @param knownLocales - Locales recognized as existing prefixes to replace.
 * @param options.trailingSlashWhenEmpty - When the localized body is empty,
 *   emit `"<locale>/"` (URLs) instead of `"<locale>"` (directories).
 */
export function localizePathSegment(
  value: string,
  targetLocale: string,
  knownLocales: Set<string>,
  options?: { trailingSlashWhenEmpty?: boolean }
): string | null {
  const trimmed = value.trim();
  if (!trimmed || SKIPPABLE_URL_REGEX.test(trimmed)) {
    return null;
  }

  const leadingWhitespace = value.match(/^\s*/)?.[0] ?? '';
  const trailingWhitespace = value.match(/\s*$/)?.[0] ?? '';
  const leadingSlash = trimmed.startsWith('/') ? '/' : '';
  const pathBody = trimmed.replace(/^\/+/, '');
  const [firstSegment, ...restSegments] = pathBody.split('/');

  if (firstSegment === targetLocale) {
    const normalized = `${leadingWhitespace}${leadingSlash}${pathBody}${trailingWhitespace}`;
    return normalized === value ? null : normalized;
  }

  const unprefixedPath = knownLocales.has(firstSegment)
    ? restSegments.join('/')
    : pathBody;
  const localizedPath = unprefixedPath
    ? `${targetLocale}/${unprefixedPath}`
    : options?.trailingSlashWhenEmpty
      ? `${targetLocale}/`
      : targetLocale;
  const normalized = `${leadingWhitespace}${leadingSlash}${localizedPath}${trailingWhitespace}`;

  return normalized === value ? null : normalized;
}
