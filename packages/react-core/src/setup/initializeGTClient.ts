import type { ReactInitializeGTClientParams } from './initializeGTSRA';
import { SnapshotStore } from 'gt-i18n/internal/snapshot-store';
import { LazyRuntimeTranslationResolver } from '../i18n-cache/LazyRuntimeTranslationResolver';
import { setReactI18nCacheInstance } from '../i18n-cache/singleton-operations';
import { initializeI18nConfig } from './i18nConfig';
import { HydratedI18nCache } from '../i18n-cache/HydratedI18nCache';

/**
 * Initialize a server-rendered client from hydrated translation snapshots.
 * Runtime misses are only available through a development-only resolver.
 */
export function internalInitializeGTClient(
  config: ReactInitializeGTClientParams
): void {
  const i18nConfig = initializeI18nConfig(config, 'server-render');
  const snapshots = new SnapshotStore(config.dictionary);
  const missingTranslationResolver =
    process.env.NODE_ENV !== 'production' && i18nConfig.isDevHotReloadEnabled()
      ? new LazyRuntimeTranslationResolver(snapshots, config)
      : undefined;

  const cache = new HydratedI18nCache(
    config,
    snapshots,
    missingTranslationResolver
  );
  setReactI18nCacheInstance(cache);
}
