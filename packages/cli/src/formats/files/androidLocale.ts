// Android resource directory qualifiers.
//
// Android parses the locale out of a `values-*` directory name and fails the
// build on a name it cannot parse.

/**
 * Returns the qualifier for a locale, without the `values-` prefix.
 *
 * `es` gives `es`, `fr-CA` gives `fr-rCA`, and `zh-Hans` gives `b+zh+Hans`.
 * A tag that does not parse is returned unchanged.
 */
export function androidLocaleQualifier(locale: string): string {
  try {
    new Intl.Locale(locale);
  } catch {
    return locale;
  }

  // Subtags come from the tag as written. `Intl.Locale` resolves CLDR aliases,
  // reading `tl` as `fil` and `cnr` as `sr-ME`, and Android matches those
  // directories to different devices. `getLocaleProperties` is also wrong here
  // because it maximizes, reporting script `Latn` and region `ES` for `es`.
  const [language, ...rest] = locale.split('-');
  const script = rest.find((part) => /^[A-Za-z]{4}$/.test(part));
  const region = rest.find(
    (part) => /^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part)
  );

  // A script subtag or a numeric region such as `es-419` has no other
  // spelling. The legacy forms below carry no API level requirement, so they
  // are used wherever they can express the tag.
  if (script !== undefined || (region !== undefined && /^\d/.test(region))) {
    return [
      'b',
      language.toLowerCase(),
      toScriptCase(script),
      region?.toUpperCase(),
    ]
      .filter((part) => part !== undefined && part !== '')
      .join('+');
  }

  return region === undefined
    ? language.toLowerCase()
    : `${language.toLowerCase()}-r${region.toUpperCase()}`;
}

/** Returns a script subtag in title case, so `hans` and `HANS` give `Hans`. */
function toScriptCase(script: string | undefined): string | undefined {
  return script === undefined
    ? undefined
    : script[0].toUpperCase() + script.slice(1).toLowerCase();
}
