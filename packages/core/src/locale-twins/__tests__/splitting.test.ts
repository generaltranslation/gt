import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSLATION_SPLITTING,
  isLocaleTwinsSplitting,
  resolveTranslationSplitting,
  resolveTranslationSplittingValue,
} from '../../internal';
import type { GTConfig } from '../../types';

describe('resolveTranslationSplitting', () => {
  it('defaults to locale splitting', () => {
    expect(DEFAULT_TRANSLATION_SPLITTING).toBe('locale');
    expect(resolveTranslationSplitting(undefined)).toBe('locale');
    expect(resolveTranslationSplitting({})).toBe('locale');
    expect(
      resolveTranslationSplitting({ files: { gt: { output: 'x' } } })
    ).toBe('locale');
  });

  it('reads files.gt.splitting from gt.config.json', () => {
    const config: GTConfig = { files: { gt: { splitting: 'locale-twins' } } };
    expect(resolveTranslationSplitting(config)).toBe('locale-twins');
    expect(
      resolveTranslationSplitting({ files: { gt: { splitting: 'locale' } } })
    ).toBe('locale');
  });

  it('throws a diagnostic for unknown strategies', () => {
    expect(() =>
      resolveTranslationSplitting({
        files: { gt: { splitting: 'module' as 'locale' } },
      })
    ).toThrow(
      /^generaltranslation Error: .*files\.gt\.splitting.*"module".*locale-twins/
    );
  });
});

describe('resolveTranslationSplittingValue', () => {
  it('resolves a raw option value with the default', () => {
    expect(resolveTranslationSplittingValue(undefined)).toBe('locale');
    expect(resolveTranslationSplittingValue('locale-twins')).toBe(
      'locale-twins'
    );
  });

  it('names the setting and owner in the diagnostic for unknown values', () => {
    expect(() =>
      resolveTranslationSplittingValue('module', {
        setting: 'The splitting option',
        source: '@generaltranslation/compiler',
      })
    ).toThrow(
      /^@generaltranslation\/compiler Error: The splitting option is set to "module".*locale-twins/
    );
  });
});

describe('isLocaleTwinsSplitting', () => {
  it('is true only for the locale twins strategy', () => {
    expect(isLocaleTwinsSplitting('locale-twins')).toBe(true);
    expect(isLocaleTwinsSplitting('locale')).toBe(false);
    expect(isLocaleTwinsSplitting(undefined)).toBe(false);
  });
});
