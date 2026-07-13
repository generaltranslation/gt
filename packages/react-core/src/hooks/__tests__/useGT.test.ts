import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocale } from '../condition-store';
import { useTrackedTranslationResolver } from '../external-store/useTrackedTranslationResolver';
import { useDefaultLocale } from '../i18n-config';
import { useShouldTranslate } from '../utils';
import { useGT } from '../useGT';

vi.mock('react', () => ({
  useCallback: <T extends (...args: unknown[]) => unknown>(callback: T) =>
    callback,
}));

vi.mock('../condition-store', () => ({
  useLocale: vi.fn(),
}));

vi.mock('../external-store/useTrackedTranslationResolver', () => ({
  useTrackedTranslationResolver: vi.fn(),
}));

vi.mock('../i18n-config', () => ({
  useDefaultLocale: vi.fn(),
}));

vi.mock('../utils', () => ({
  useShouldTranslate: vi.fn(),
}));

describe('useGT', () => {
  beforeEach(() => {
    vi.mocked(useLocale).mockReturnValue('en');
    vi.mocked(useDefaultLocale).mockReturnValue('en');
    vi.mocked(useShouldTranslate).mockReturnValue(false);
    vi.mocked(useTrackedTranslationResolver).mockReturnValue(vi.fn());
  });

  it('interpolates source strings when translation is not required', () => {
    const gt = useGT();

    expect(gt('hello, {name}', { name: 'brian' })).toBe('hello, brian');
  });
});
