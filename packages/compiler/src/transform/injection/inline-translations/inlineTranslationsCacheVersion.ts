import crypto from 'node:crypto';
import fs from 'node:fs';
import type { GTOutputFileConfig } from 'generaltranslation';
import type { InlineTranslationsModules } from './inlineTranslationsModules';
import { getInlineTranslationsFiles } from './loadInlineTranslations';

type BundlerCacheOptions = {
  cache?: unknown;
  experiments?: { cache?: unknown };
};

/**
 * Add the embedded translations settings and locale files to webpack's and
 * rspack's persistent cache version. Those caches do not see gt.config.json,
 * so they would reuse modules transformed for other settings, and they keep
 * modules built before a locale file existed.
 */
export function addInlineTranslationsCacheVersion(
  options: BundlerCacheOptions,
  gtFiles: GTOutputFileConfig | undefined,
  modules: InlineTranslationsModules | undefined
): void {
  const hash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        gtFiles?.output,
        gtFiles?.inlineTranslations ?? null,
        modules ?? null,
      ])
    );
  for (const file of getInlineTranslationsFiles(gtFiles)) {
    hash
      .update(`\0${file}\0`)
      .update(fs.existsSync(file) ? fs.readFileSync(file) : '\0missing');
  }
  const key = hash.digest('hex').slice(0, 16);
  for (const cache of [options.cache, options.experiments?.cache]) {
    if (cache == null || typeof cache !== 'object' || !('type' in cache)) {
      continue;
    }
    if (cache.type !== 'filesystem' && cache.type !== 'persistent') continue;
    const versioned = cache as { version?: string };
    versioned.version = `${versioned.version ?? ''}|gt-inline-translations:${key}`;
  }
}
