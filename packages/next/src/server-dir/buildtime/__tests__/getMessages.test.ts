import { describe, it, expect, vi, beforeEach } from 'vitest';
import { msg } from 'gt-i18n';
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

import { getMessages, useMessages } from '../getMessages';

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

describe('getMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve a registered message', async () => {
    setup();

    const m = await getMessages();

    expect(m(msg('Hello, {name}!', { name: 'Alice' }))).toBe('Hello, Alice!');
  });

  it('should resolve a translation for a registered message', async () => {
    setup({
      locale: 'es',
      translations: { [hashMessage('Hello', { $format: 'ICU' })]: 'Hola' },
    });

    const m = await getMessages();

    expect(m(msg('Hello'))).toBe('Hola');
  });

  it('should pass through null and undefined', async () => {
    setup();

    const m = await getMessages();

    expect(m(null)).toBeNull();
    expect(m(undefined)).toBeUndefined();
  });

  it('should fall back to plain messages', async () => {
    setup();

    const m = await getMessages();

    expect(m('Hello, {name}!', { name: 'Alice' })).toBe('Hello, Alice!');
  });
});

describe('useMessages', () => {
  it('should exist and be exportable', () => {
    expect(typeof useMessages).toBe('function');
  });
});
