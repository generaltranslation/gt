import { describe, expect, test } from 'vitest';
import { gtPlugin } from '../index';
import { pluginConfig } from '../adapter/core';
import { allowsNonDefaultSourceLocales } from '../utils/translationSource';

const configure = (options: Partial<Parameters<typeof gtPlugin>[0]> = {}) =>
  gtPlugin({
    locales: ['fr'],
    sourceLocale: 'en',
    showDocumentInternationalization: false,
    ...options,
  });

describe('allowNonDefaultSourceLocales', () => {
  test('is off by default', () => {
    configure();
    expect(pluginConfig.getAllowNonDefaultSourceLocales()).toBe(false);
    expect(allowsNonDefaultSourceLocales()).toBe(false);
  });

  test('is on only when set to true', () => {
    configure({ allowNonDefaultSourceLocales: true });
    expect(allowsNonDefaultSourceLocales()).toBe(true);

    configure({ allowNonDefaultSourceLocales: false });
    expect(allowsNonDefaultSourceLocales()).toBe(false);
  });
});
