import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextConfig } from 'next';
import { cacheComponentsChecks } from '../cacheComponentsChecks';
import { createCacheComponentsMissingRequestFunctionsWarning } from '../../../errors/cacheComponents';
import type { RequestFunctionPaths } from '../../../config-dir/utils/resolveRequestFunctionPaths';

function runCacheComponentsChecks({
  nextConfig = {},
  requestFunctionPaths = {},
}: {
  nextConfig?: NextConfig;
  requestFunctionPaths?: RequestFunctionPaths;
} = {}) {
  cacheComponentsChecks({
    nextConfig,
    requestFunctionPaths,
    localTranslationsEnabled: true,
    localDictionaryEnabled: false,
  });
}

describe('cacheComponentsChecks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when cacheComponents is enabled without custom getLocale and getRegion functions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runCacheComponentsChecks({
      nextConfig: { cacheComponents: true },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      createCacheComponentsMissingRequestFunctionsWarning([
        'getLocale',
        'getRegion',
      ])
    );
  });

  it('formats the missing request functions warning as a readable diagnostic', () => {
    expect(
      createCacheComponentsMissingRequestFunctionsWarning([
        'getLocale',
        'getRegion',
      ])
    ).toBe(
      'gt-next Warning: cacheComponents is enabled, but custom getLocale() and getRegion() are not configured because the default request functions read headers and cookies, which Next.js does not allow while prerendering. Add getLocale.ts and getRegion.ts files, or configure getLocalePath and getRegionPath. Learn more: https://generaltranslation.com/docs/react/nextjs/cache-components'
    );
  });

  it('only warns about the missing request function when one is configured', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runCacheComponentsChecks({
      nextConfig: { cacheComponents: true },
      requestFunctionPaths: {
        getLocale: './getLocale.ts',
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      createCacheComponentsMissingRequestFunctionsWarning(['getRegion'])
    );
  });

  it('does not warn about request functions when cacheComponents has custom getLocale and getRegion functions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runCacheComponentsChecks({
      nextConfig: { cacheComponents: true },
      requestFunctionPaths: {
        getLocale: './getLocale.ts',
        getRegion: './getRegion.ts',
      },
    });

    expect(warnSpy).not.toHaveBeenCalledWith(
      createCacheComponentsMissingRequestFunctionsWarning([
        'getLocale',
        'getRegion',
      ])
    );
  });
});
