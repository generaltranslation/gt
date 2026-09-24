import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptLocale, promptLocaleList } from '../../console/logging.js';
import { OnboardingSession } from '../onboarding.js';
import { getDesiredLocales } from '../userInput.js';

vi.mock('../../console/logging.js', () => ({
  promptLocale: vi.fn(),
  promptLocaleList: vi.fn(),
}));

describe('getDesiredLocales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const headless = () =>
    new OnboardingSession('init', { nonInteractive: true });

  it('preserves configured locales without prompting', async () => {
    await expect(
      getDesiredLocales(headless(), {
        defaultLocale: 'es',
        locales: ['fr', 'de'],
      })
    ).resolves.toEqual({ defaultLocale: 'es', locales: ['fr', 'de'] });
    expect(promptLocale).not.toHaveBeenCalled();
    expect(promptLocaleList).not.toHaveBeenCalled();
  });

  it('lets explicit locales replace the configured ones', async () => {
    await expect(
      getDesiredLocales(
        headless(),
        { defaultLocale: 'es', locales: ['fr', 'de'] },
        { locales: ['ja'] }
      )
    ).resolves.toEqual({ defaultLocale: 'es', locales: ['ja'] });
  });

  it('accepts configured aliases and rejects invalid explicit locales', async () => {
    const session = headless();
    await getDesiredLocales(
      session,
      { customMapping: { french: { code: 'fr' } } },
      { defaultLocale: 'en', locales: ['french', 'not_a_locale'] }
    );
    expect(() => session.assertResolved()).toThrow(
      '"not_a_locale" is not a valid locale'
    );
  });

  it('lists missing locales instead of silently using a prompt default', async () => {
    const session = headless();
    await expect(getDesiredLocales(session, {})).resolves.toEqual({
      defaultLocale: undefined,
      locales: undefined,
    });
    expect(() => session.assertResolved()).toThrow(
      /--default-locale, --locales/
    );
    session.defaults = true;
    await expect(getDesiredLocales(session, {})).resolves.toMatchObject({
      defaultLocale: 'en',
      locales: undefined,
    });
  });
});
