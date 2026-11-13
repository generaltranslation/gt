import { beforeEach, describe, expect, it, vi } from 'vitest';
import { msg } from 'gt-i18n/unstable';
import { useEnableI18n } from '../../hooks/condition-store';
import { useTrackedTranslationResolver } from '../../hooks/external-store/useTrackedTranslationResolver';
import { useTranslationConditions } from '../../hooks/utils';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import { useMessages } from '../useMessages';

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T): T => factory(),
}));

vi.mock('../../hooks/external-store/useTrackedTranslationResolver', () => ({
  useTrackedTranslationResolver: vi.fn(),
}));

vi.mock('../../hooks/condition-store', () => ({
  useEnableI18n: vi.fn(),
}));

vi.mock('../../hooks/utils', () => ({
  useTranslationConditions: vi.fn(),
}));

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const name = 'Ada';
const resolveTranslation = vi.fn();

describe('react-core/unstable useMessages', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    vi.mocked(useTranslationConditions).mockReturnValue({
      locale: 'fr',
      shouldTranslate: true,
    });
    vi.mocked(useEnableI18n).mockReturnValue(true);
    resolveTranslation.mockReset();
    vi.mocked(useTrackedTranslationResolver).mockReturnValue(
      resolveTranslation
    );
  });

  it('renders msg() messages through the tracked resolver, like useGT', () => {
    resolveTranslation.mockReturnValue(['Bonjour, ', ['name'], ' !']);

    const greeting = msg({ context: 'greeting' })`Hello, ${{ name }}!`;
    expect(useMessages()(greeting)).toBe('Bonjour, Ada !');
    expect(useTrackedTranslationResolver).toHaveBeenCalledWith(
      undefined,
      'fr',
      true
    );
    expect(resolveTranslation).toHaveBeenCalledWith({
      locale: 'fr',
      content: ['Hello, ', ['name'], '!'],
      options: expect.objectContaining({
        $format: 'MESSAGE_TREE',
        $locale: 'fr',
        $context: 'greeting',
      }),
    });
  });

  it("passes the page's shouldTranslate to the tracked resolver", () => {
    vi.mocked(useTranslationConditions).mockReturnValue({
      locale: 'en',
      shouldTranslate: false,
    });

    expect(useMessages()(msg('Save'))).toBe('Save');
    expect(useTrackedTranslationResolver).toHaveBeenCalledWith(
      undefined,
      'en',
      false
    );
  });

  it('skips lookups when i18n is disabled', () => {
    vi.mocked(useEnableI18n).mockReturnValue(false);

    expect(useMessages()(msg('Save'))).toBe('Save');
    expect(resolveTranslation).not.toHaveBeenCalled();
  });
});
