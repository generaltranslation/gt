import type { GTConfig } from 'generaltranslation/types';
import {
  getLocaleTwinCacheParams,
  initializeLocaleTwins,
} from 'gt-i18n/internal/experimental';
import { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import type { ReactInitializeGTParams } from '../../setup/initializeGTSRA';

export type LocaleTwinsInitializeGTParams = ReactInitializeGTParams &
  Pick<GTConfig, 'experimental'>;

/**
 * `internalInitializeGTSRA()` with locale twins: records
 * `experimental.splitting`, and a locale twin client's cache loads nothing
 * (its translations come from the twins). Servers keep loading whole locales.
 */
export function internalInitializeGTSRA(
  config: LocaleTwinsInitializeGTParams
): void {
  initializeI18nConfig(config, 'server-render');
  initializeLocaleTwins(config);
  setReactI18nCache(new ReactI18nCache(getLocaleTwinCacheParams(config)));
}
