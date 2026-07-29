import { describe, expect, test } from 'vitest';
import { resolveTargetLocales } from '../locales';

describe('resolveTargetLocales', () => {
  test('passes through a clean target list', () => {
    const { targets, redundant } = resolveTargetLocales('en-US', [
      'de-DE',
      'es-ES',
    ]);
    expect(targets).toEqual(['de-DE', 'es-ES']);
    expect(redundant).toEqual([]);
  });

  test('drops the source locale from the targets', () => {
    // The gt.config.json shape: `locales` lists every locale, source included.
    const { targets, redundant } = resolveTargetLocales('en-US', [
      'de-DE',
      'en-US',
      'es-ES',
    ]);
    expect(targets).toEqual(['de-DE', 'es-ES']);
    expect(redundant).toEqual(['en-US']);
  });

  test('drops repeated targets and keeps first-seen order', () => {
    const { targets, redundant } = resolveTargetLocales('en-US', [
      'fr-FR',
      'de-DE',
      'fr-FR',
    ]);
    expect(targets).toEqual(['fr-FR', 'de-DE']);
    expect(redundant).toEqual(['fr-FR']);
  });

  test('never yields a language list with duplicates', () => {
    const { targets } = resolveTargetLocales('en-US', [
      'de-DE',
      'en-US',
      'es-ES',
      'fr-FR',
      'ja-JP',
      'ko-KR',
      'en-GB',
      'de-DE',
    ]);
    const supportedLanguages = ['en-US', ...targets];
    expect(supportedLanguages).toEqual([...new Set(supportedLanguages)]);
  });

  test('tolerates an empty or missing locales list', () => {
    expect(resolveTargetLocales('en-US', [])).toEqual({
      targets: [],
      redundant: [],
    });
    expect(resolveTargetLocales('en-US', undefined)).toEqual({
      targets: [],
      redundant: [],
    });
  });
});
