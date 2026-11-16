import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrackedTranslationResolver } from '../external-store/useTrackedTranslationResolver';
import { useDefaultLocale } from '../i18n-config';
import { useTranslationConditions } from '../utils';
import { useGT } from '../useGT';

vi.mock('react', () => ({
  useCallback: <T extends (...args: unknown[]) => unknown>(callback: T) =>
    callback,
}));

vi.mock('../external-store/useTrackedTranslationResolver', () => ({
  useTrackedTranslationResolver: vi.fn(),
}));

vi.mock('../i18n-config', () => ({
  useDefaultLocale: vi.fn(),
}));

vi.mock('../utils', () => ({
  useTranslationConditions: vi.fn(),
}));

describe('useGT', () => {
  beforeEach(() => {
    vi.mocked(useDefaultLocale).mockReturnValue('en');
    vi.mocked(useTranslationConditions).mockReturnValue({
      locale: 'en',
      shouldTranslate: false,
    });
    vi.mocked(useTrackedTranslationResolver).mockReturnValue(vi.fn());
  });

  it('interpolates source strings when translation is not required', () => {
    const gt = useGT();

    expect(gt('hello, {name}', { name: 'brian' })).toBe('hello, brian');
  });

  it('reuses the resolved translation conditions in the tracked resolver', () => {
    const messages = [{ message: 'hello' }];
    vi.mocked(useTranslationConditions).mockReturnValue({
      locale: 'fr',
      shouldTranslate: true,
    });

    useGT(messages);

    expect(useTrackedTranslationResolver).toHaveBeenCalledWith(
      messages,
      'fr',
      true
    );
  });
});
