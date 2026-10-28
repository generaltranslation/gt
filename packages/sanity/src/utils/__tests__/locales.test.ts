import { describe, expect, test } from 'vitest';
import {
  getLocaleRestriction,
  getSelectedLocaleIds,
  resolveTargetLocales,
  setLocaleSelected,
  toggleAllLocales,
} from '../locales';
import type { TranslationLocale } from '../../types';

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

function locale(localeId: string, enabled?: boolean): TranslationLocale {
  return { localeId, description: localeId, enabled };
}

describe('getSelectedLocaleIds', () => {
  test('treats a locale without an explicit flag as selected', () => {
    expect(
      getSelectedLocaleIds([
        locale('en-GB'),
        locale('fr-FR', true),
        locale('de-DE', false),
      ])
    ).toEqual(['en-GB', 'fr-FR']);
  });
});

describe('getLocaleRestriction', () => {
  test('is null when every locale is selected', () => {
    expect(
      getLocaleRestriction([locale('en-GB'), locale('fr-FR', true)])
    ).toBeNull();
  });

  test('lists the selected locales when some are deselected', () => {
    expect(
      getLocaleRestriction([
        locale('en-GB', true),
        locale('fr-FR', false),
        locale('de-DE', false),
      ])
    ).toEqual(['en-GB']);
  });

  test('is an empty list when nothing is selected', () => {
    expect(getLocaleRestriction([locale('en-GB', false)])).toEqual([]);
  });
});

describe('setLocaleSelected', () => {
  test('changes only the named locale', () => {
    const locales = [locale('en-GB', true), locale('fr-FR', true)];
    expect(setLocaleSelected(locales, 'fr-FR', false)).toEqual([
      locale('en-GB', true),
      locale('fr-FR', false),
    ]);
    expect(locales[1].enabled).toBe(true);
  });
});

describe('toggleAllLocales', () => {
  test('clears every target when all are selected', () => {
    expect(
      toggleAllLocales([locale('en-GB'), locale('fr-FR', true)], 'en-US')
    ).toEqual([locale('en-GB', false), locale('fr-FR', false)]);
  });

  test('selects every target when any is deselected', () => {
    expect(
      toggleAllLocales([locale('en-GB', true), locale('fr-FR', false)], 'en-US')
    ).toEqual([locale('en-GB', true), locale('fr-FR', true)]);
  });

  test('leaves the source locale untouched', () => {
    expect(
      toggleAllLocales([locale('en-US'), locale('en-GB', false)], 'en-US')
    ).toEqual([locale('en-US'), locale('en-GB', true)]);
  });
});
