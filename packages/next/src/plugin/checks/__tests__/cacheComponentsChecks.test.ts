import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextConfig } from 'next';
import { cacheComponentsChecks } from '../cacheComponentsChecks';
import {
  createCacheComponentsMissingRequestFunctionsWarning,
  experimentalLocaleResolutionDeprecatedWarning,
} from '../../../errors/cacheComponents';
import type { withGTConfigProps } from '../../../config-dir/props/withGTConfigProps';
import type { RequestFunctionPaths } from '../../../config-dir/utils/resolveRequestFunctionPaths';

function runCacheComponentsChecks({
  mergedConfig = {},
  nextConfig = {},
  requestFunctionPaths = {},
}: {
  mergedConfig?: withGTConfigProps;
  nextConfig?: NextConfig;
  requestFunctionPaths?: RequestFunctionPaths;
} = {}) {
  cacheComponentsChecks({
    mergedConfig,
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

  it('warns that experimentalLocaleResolution is deprecated when enabled', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runCacheComponentsChecks({
      mergedConfig: { experimentalLocaleResolution: true },
      nextConfig: { cacheComponents: true },
      requestFunctionPaths: {
        getLocale: './getLocale.ts',
        getRegion: './getRegion.ts',
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      experimentalLocaleResolutionDeprecatedWarning
    );
  });
});
