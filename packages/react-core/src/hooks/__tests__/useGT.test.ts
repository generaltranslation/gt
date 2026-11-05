import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashIcuMessage } from 'gt-i18n/internal';
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

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('precomputes $_hash for compiler-injected ICU messages that need indexing', () => {
    const message = 'Hello {_gt_, select, other {World}}';
    vi.mocked(useTranslationConditions).mockReturnValue({
      locale: 'fr',
      shouldTranslate: true,
    });

    useGT([{ message }]);

    expect(useTrackedTranslationResolver).toHaveBeenCalledWith(
      [{ message, $_hash: hashIcuMessage(message, { $format: 'ICU' }) }],
      'fr',
      true
    );
  });

  it('passes compiler messages through unchanged in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const messages = [{ message: 'Hello {_gt_, select, other {World}}' }];
    vi.mocked(useTranslationConditions).mockReturnValue({
      locale: 'fr',
      shouldTranslate: true,
    });

    useGT(messages);

    expect(
      vi.mocked(useTrackedTranslationResolver).mock.calls.at(-1)?.[0]
    ).toBe(messages);
  });
});
