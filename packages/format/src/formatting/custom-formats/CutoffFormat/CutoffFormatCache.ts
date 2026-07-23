import { libraryDefaultLocale } from '../../../settings/settings';
import { CutoffFormatConstructor } from './CutoffFormat';
import type { CutoffFormatOptions } from './types';

class CutoffFormatCache {
  private cache = new Map<string, CutoffFormatConstructor>();

  get(
    locales: Intl.LocalesArgument = libraryDefaultLocale,
    options: CutoffFormatOptions = {}
  ): CutoffFormatConstructor {
    const localeKey = Array.isArray(locales)
      ? locales.map(String).join(',')
      : String(locales);
    const optionsKey = JSON.stringify(options, Object.keys(options).sort());
    const key = `${localeKey}:${optionsKey}`;
    let formatter = this.cache.get(key);
    if (!formatter) {
      formatter = new CutoffFormatConstructor(locales, options);
      this.cache.set(key, formatter);
    }
    return formatter;
  }
}

export const cutoffFormatCache = new CutoffFormatCache();
