import { describe, expect, it } from 'vitest';
import { getLocaleProperties } from '@generaltranslation/format';
import {
  getConfiguredLocaleProperties,
  replaceLocalePlaceholders,
} from '../utils.js';

describe('getConfiguredLocaleProperties', () => {
  it('reports the locale exactly as configured, not the canonical tag', () => {
    expect(getLocaleProperties('fr-ca').code).toBe('fr-CA');
    expect(getConfiguredLocaleProperties('fr-ca').code).toBe('fr-ca');

    expect(getLocaleProperties('ja-jp').code).toBe('ja-JP');
    expect(getConfiguredLocaleProperties('ja-jp').code).toBe('ja-jp');
  });

  it('is a no-op for tags that are already canonical', () => {
    for (const locale of ['en', 'es', 'ja', 'fr-CA', 'zh-Hans']) {
      expect(getConfiguredLocaleProperties(locale)).toEqual(
        getLocaleProperties(locale)
      );
    }
  });

  it('leaves every other property canonical', () => {
    const props = getConfiguredLocaleProperties('fr-ca');

    expect(props.languageCode).toBe('fr');
    expect(props.regionCode).toBe('CA');
    expect(props.name).toBe(getLocaleProperties('fr-ca').name);
  });
});

describe('replaceLocalePlaceholders with configured locale properties', () => {
  it('substitutes {locale} with the configured tag', () => {
    const props = getConfiguredLocaleProperties('ja-jp');

    expect(replaceLocalePlaceholders('docs/{locale}/$1', props)).toBe(
      'docs/ja-jp/$1'
    );
    expect(replaceLocalePlaceholders('{localeCode}', props)).toBe('ja-jp');
  });

  it('still substitutes canonical values for explicitly-named properties', () => {
    const props = getConfiguredLocaleProperties('fr-ca');

    expect(
      replaceLocalePlaceholders('{languageCode}-{regionCode}', props)
    ).toBe('fr-CA');
  });
});
