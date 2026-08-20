import { describe, expect, test } from 'vitest';
import { resolveTargetLocales } from '../locales';

describe('resolveTargetLocales', () => {
  test('passes through a clean target list', () => {
    expect(resolveTargetLocales('en-US', ['de-DE', 'es-ES'])).toEqual([
      'de-DE',
      'es-ES',
    ]);
  });

  test('drops the source locale from the targets', () => {
    // The gt.config.json shape: `locales` lists every locale, source included.
    expect(resolveTargetLocales('en-US', ['de-DE', 'en-US', 'es-ES'])).toEqual([
      'de-DE',
      'es-ES',
    ]);
  });

  test('drops repeated targets and keeps first-seen order', () => {
    expect(resolveTargetLocales('en-US', ['fr-FR', 'de-DE', 'fr-FR'])).toEqual([
      'fr-FR',
      'de-DE',
    ]);
  });

  test('never yields a language list with duplicates', () => {
    const supportedLanguages = [
      'en-US',
      ...resolveTargetLocales('en-US', [
        'de-DE',
        'en-US',
        'es-ES',
        'fr-FR',
        'ja-JP',
        'ko-KR',
        'en-GB',
        'de-DE',
      ]),
    ];
    expect(supportedLanguages).toEqual([...new Set(supportedLanguages)]);
  });

  test('tolerates an empty or missing locales list', () => {
    expect(resolveTargetLocales('en-US', [])).toEqual([]);
    expect(resolveTargetLocales('en-US', undefined)).toEqual([]);
  });
});
