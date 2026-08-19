import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getI18nConfig } from 'gt-i18n/internal';
import { useConditionStore } from '../condition-store';
import { useTranslationConditions } from '../utils';

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: vi.fn(),
}));

vi.mock('../condition-store', () => ({
  useConditionStore: vi.fn(),
  useEnableI18n: vi.fn(),
  useLocale: vi.fn(),
}));

describe('useTranslationConditions', () => {
  const getLocale = vi.fn();
  const getEnableI18n = vi.fn();
  const requiresTranslation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getLocale.mockReturnValue('fr');
    getEnableI18n.mockReturnValue(true);
    requiresTranslation.mockReturnValue(true);
    vi.mocked(useConditionStore).mockReturnValue({
      getLocale,
      getEnableI18n,
    });
    vi.mocked(getI18nConfig).mockReturnValue({
      requiresTranslation,
    } as ReturnType<typeof getI18nConfig>);
  });

  it('reads each condition once and derives whether translation is required', () => {
    expect(useTranslationConditions()).toEqual({
      locale: 'fr',
      shouldTranslate: true,
    });
    expect(getLocale).toHaveBeenCalledTimes(1);
    expect(getEnableI18n).toHaveBeenCalledTimes(1);
    expect(requiresTranslation).toHaveBeenCalledOnce();
    expect(requiresTranslation).toHaveBeenCalledWith('fr');
  });

  it('skips the translation check when i18n is disabled', () => {
    getEnableI18n.mockReturnValue(false);

    expect(useTranslationConditions()).toEqual({
      locale: 'fr',
      shouldTranslate: false,
    });
    expect(requiresTranslation).not.toHaveBeenCalled();
  });
});
