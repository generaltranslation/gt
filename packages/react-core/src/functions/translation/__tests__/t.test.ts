import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '../../../setup/i18nConfig';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { setReadonlyConditionStore } from '../../../condition-store/singleton-operations';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { t } from '../t';

const lookupTranslation = vi.fn();

function setup() {
  initializeI18nConfig(
    {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    },
    'SPA'
  );
  setReactI18nCache({
    lookupTranslation,
  } as unknown as ReactI18nCache);
  setReadonlyConditionStore({
    getLocale: () => 'fr',
    getEnableI18n: () => true,
  } as unknown as ReadonlyConditionStoreInterface);
}

describe('t (tagged template)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  // Regression: the interpolated "derived message" lookup must use the ICU
  // data format so its hash matches the ICU-registered entry (compiler + the
  // gt-i18n sibling both register these as ICU). Using 'STRING' silently
  // misses and falls through to the less-specific uninterpolated message.
  it('looks up the interpolated derived message with the ICU format', () => {
    const name = 'Alice';
    lookupTranslation.mockReturnValue('Bonjour Alice !');

    expect(t`Hello ${name}!`).toBe('Bonjour Alice !');
    expect(lookupTranslation).toHaveBeenCalledWith('fr', 'Hello Alice!', {
      $format: 'ICU',
    });
  });
});
