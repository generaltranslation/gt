import crypto from 'node:crypto';
import type { GTOutputFileConfig } from 'generaltranslation';
import type { InlineTranslationsModules } from './inlineTranslationsModules';

type BundlerCacheOptions = {
  cache?: unknown;
  experiments?: { cache?: unknown };
};

/**
 * Add the embedded translations settings to webpack's and rspack's persistent
 * cache version. Those caches do not see gt.config.json, so they would reuse
 * modules transformed for other settings.
 * Translation file edits need no key: transforms add them as watch files.
 */
export function addInlineTranslationsCacheVersion(
  options: BundlerCacheOptions,
  gtFiles: GTOutputFileConfig | undefined,
  modules: InlineTranslationsModules | undefined
): void {
  const key = crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        gtFiles?.output,
        gtFiles?.inlineTranslations ?? null,
        modules ?? null,
      ])
    )
    .digest('hex')
    .slice(0, 16);
  for (const cache of [options.cache, options.experiments?.cache]) {
    if (cache == null || typeof cache !== 'object' || !('type' in cache)) {
      continue;
    }
    if (cache.type !== 'filesystem' && cache.type !== 'persistent') continue;
    const versioned = cache as { version?: string };
    versioned.version = `${versioned.version ?? ''}|gt-inline-translations:${key}`;
  }
}
