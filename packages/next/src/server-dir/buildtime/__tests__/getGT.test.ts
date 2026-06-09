import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  I18nCache,
  hashMessage,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';

const { mockGetRequestConditions, mockGetI18NConfig } = vi.hoisted(() => ({
  mockGetRequestConditions: vi.fn(),
  mockGetI18NConfig: vi.fn(),
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));
vi.mock('../../../config-dir/getI18NConfig', () => ({
  getI18NConfig: mockGetI18NConfig,
}));

import { getGT, useGT } from '../getGT';

function setup({
  locale = 'en',
  enableI18n = true,
  translations = {},
}: {
  locale?: string;
  enableI18n?: boolean;
  translations?: Record<string, string>;
} = {}) {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'es'] });
  setI18nCache(
    new I18nCache({
      loadTranslations: vi.fn().mockResolvedValue(translations),
    })
  );
  mockGetRequestConditions.mockResolvedValue({
    _locale: locale,
    _enableI18n: enableI18n,
  });
  mockGetI18NConfig.mockReturnValue({});
}

describe('getGT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the source message with interpolation for the default locale', async () => {
    setup();

    const gt = await getGT();

    expect(gt('Hello, {name}!', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  it('should resolve a cached translation when translation is required', async () => {
    setup({
      locale: 'es',
      translations: { [hashMessage('Hello', { $format: 'ICU' })]: 'Hola' },
    });

    const gt = await getGT();

    expect(gt('Hello')).toBe('Hola');
  });

  it('should render the source when no translation exists', async () => {
    setup({ locale: 'es' });

    const gt = await getGT();

    expect(gt('Hello')).toBe('Hello');
  });

  it('should render the source when i18n is disabled', async () => {
    setup({
      locale: 'es',
      enableI18n: false,
      translations: { [hashMessage('Hello', { $format: 'ICU' })]: 'Hola' },
    });

    const gt = await getGT();

    expect(gt('Hello')).toBe('Hello');
  });
});

describe('useGT', () => {
  it('should exist and be exportable', () => {
    expect(typeof useGT).toBe('function');
  });
});
