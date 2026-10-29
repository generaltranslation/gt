import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSLATION_SPLITTING,
  resolveTranslationSplitting,
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
