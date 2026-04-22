import { libraryDefaultLocale } from 'generaltranslation/internal';

export function testLocalePolyfill(locale = libraryDefaultLocale) {
  const problems = [];

  // 1. basic presence
  if (!global.Intl) problems.push('Intl missing entirely');
  const apis = [
    'Locale',
    'NumberFormat',
    'DateTimeFormat',
    'PluralRules',
    'RelativeTimeFormat',
    'ListFormat',
    'DisplayNames',
  ];
  apis.forEach((a) => {
    // @ts-ignore
    if (!Intl[a]) problems.push(`Intl.${a} missing`);
  });

  // 2. locale actually supported (no silent fallback)
  const checks: [
    string,
    { supportedLocalesOf(locales: string[]): string[] },
  ][] = [
    ['DateTimeFormat', Intl.DateTimeFormat],
    ['NumberFormat', Intl.NumberFormat],
    ['PluralRules', Intl.PluralRules],
    ['RelativeTimeFormat', Intl.RelativeTimeFormat],
    ['ListFormat', Intl.ListFormat],
    ['DisplayNames', Intl.DisplayNames],
  ];

  for (const [name, api] of checks) {
    try {
      const supported = api.supportedLocalesOf([locale]);
      if (supported.length === 0) {
        problems.push(`${locale} not supported by ${name}`);
      }
    } catch (e) {
      problems.push(
        `${name}.supportedLocalesOf threw: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // 3. numeric separators sanity
  let group, decimal;
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
    group = parts.find((p) => p.type === 'group')?.value;
    decimal = parts.find((p) => p.type === 'decimal')?.value;
    if (!group || !decimal)
      problems.push('formatToParts missing group/decimal separators');
  } catch (e) {
    problems.push(
      `NumberFormat threw: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // 4. plural rules sanity
  try {
    const pr = new Intl.PluralRules(locale);
    const sample = pr.select(5);
    if (!sample) problems.push('PluralRules returned undefined');
  } catch (e) {
    problems.push(
      `PluralRules threw: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // 5. relative time format sanity
  try {
    const rtf = new Intl.RelativeTimeFormat(locale);
    const sample = rtf.format(-1, 'day');
    if (!sample) problems.push('RelativeTimeFormat returned undefined');
  } catch (e) {
    problems.push(
      `RelativeTimeFormat threw: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // 6. list format sanity
  try {
    const lf = new Intl.ListFormat(locale);
    const sample = lf.format(['apple', 'orange', 'banana']);
    if (!sample) problems.push('ListFormat returned undefined');
  } catch (e) {
    problems.push(
      `ListFormat threw: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // 7. display names sanity
  try {
    const dn = new Intl.DisplayNames(locale, { type: 'language' });
    const sample = dn.of('en');
    if (!sample) problems.push('DisplayNames returned undefined');
  } catch (e) {
    problems.push(
      `DisplayNames threw: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // 8. locale sanity
  try {
    const loc = new Intl.Locale(locale);
    if (!loc.language) problems.push('Locale missing language property');
  } catch (e) {
    problems.push(
      `Locale threw: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // 9. show example formatted values
  const example: Record<string, string> = {};

  try {
    example.number = new Intl.NumberFormat(locale).format(1234.5);
  } catch (e) {
    example.number = 'ERROR';
  }

  try {
    example.date = new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
    }).format(new Date('2020-01-02'));
  } catch (e) {
    example.date = 'ERROR';
  }

  try {
    example.weekday = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
    }).format(new Date('2020-01-02'));
  } catch (e) {
    example.weekday = 'ERROR';
  }

  try {
    example.pluralRule = new Intl.PluralRules(locale).select(5);
  } catch (e) {
    example.pluralRule = 'ERROR';
  }

  try {
    example.relativeTime = new Intl.RelativeTimeFormat(locale).format(
      -1,
      'day'
    );
  } catch (e) {
    example.relativeTime = 'ERROR';
  }

  try {
    example.list = new Intl.ListFormat(locale).format([
      'apple',
      'orange',
      'banana',
    ]);
  } catch (e) {
    example.list = 'ERROR';
  }

  try {
    example.displayName =
      new Intl.DisplayNames(locale, { type: 'language' }).of('en') ||
      'UNDEFINED';
  } catch (e) {
    example.displayName = 'ERROR';
  }

  try {
    example.locale = new Intl.Locale(locale).language;
  } catch (e) {
    example.locale = 'ERROR';
  }

  const result = {
    ok: problems.length === 0,
    problems,
    group,
    decimal,
    example,
  };

  if (result.ok) {
    console.log(`✅ Locale polyfill looks OK for ${locale}`, example);
  } else {
    console.warn(
      `❌ Locale polyfill check failed for ${locale}:`,
      problems,
      example
    );
  }
  return result;
}
