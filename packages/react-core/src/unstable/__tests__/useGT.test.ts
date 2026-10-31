import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnableI18n } from '../../hooks/condition-store';
import { useTrackedTranslationResolver } from '../../hooks/external-store/useTrackedTranslationResolver';
import { useTranslationConditions } from '../../hooks/utils';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import { useGT } from '../useGT';

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
const hello = ['Hello, ', ['name'], '!'];
const resolveTranslation = vi.fn();

describe('react-core/unstable useGT', () => {
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

  it('resolves trees through the tracked resolver, like the legacy useGT', () => {
    resolveTranslation.mockReturnValue(['Bonjour, ', ['name'], ' !']);

    expect(useGT()({ context: 'greeting' })`Hello, ${{ name }}!`).toBe(
      'Bonjour, Ada !'
    );
    expect(useTrackedTranslationResolver).toHaveBeenCalledWith(
      undefined,
      'fr',
      true
    );
    expect(resolveTranslation).toHaveBeenCalledWith({
      locale: 'fr',
      message: hello,
      options: expect.objectContaining({
        $format: 'ICU_TREE',
        $locale: 'fr',
        $context: 'greeting',
      }),
    });
  });

  it('looks up a locale override in that locale', () => {
    vi.mocked(useTranslationConditions).mockReturnValue({
      locale: 'en',
      shouldTranslate: false,
    });
    resolveTranslation.mockImplementation(({ locale }) =>
      locale === 'fr' ? ['Bonjour, ', ['name'], ' !'] : undefined
    );

    expect(useGT()({ locale: 'fr' })`Hello, ${{ name }}!`).toBe(
      'Bonjour, Ada !'
    );
    // The override needs translation though the page does not, so its misses
    // stay eligible for dev hot reload.
    expect(useTrackedTranslationResolver).toHaveBeenCalledWith(
      undefined,
      'en',
      true
    );
  });

  it('renders the source, validated, when the resolver returns no tree', () => {
    resolveTranslation.mockReturnValue('not a tree');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(useGT()`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
    warn.mockRestore();
  });

  it('skips lookups when i18n is disabled', () => {
    vi.mocked(useEnableI18n).mockReturnValue(false);

    expect(useGT()({ locale: 'fr' })`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(resolveTranslation).not.toHaveBeenCalled();
  });
});
