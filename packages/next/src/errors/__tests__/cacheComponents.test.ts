import { describe, expect, it } from 'vitest';
import {
  cacheComponentsMissingLoadTranslationsError,
  createCacheComponentsMissingRequestFunctionsWarning,
} from '../cacheComponents';

describe('Cache Components diagnostics', () => {
  it('says that next build fails without custom getLocale() and getRegion()', () => {
    expect(
      createCacheComponentsMissingRequestFunctionsWarning([
        'getLocale',
        'getRegion',
      ])
    ).toBe(
      'gt-next Warning: cacheComponents is enabled, but custom getLocale() and getRegion() are not configured, so next build will fail with "uncached or runtime data during prerendering" because the default functions read request headers or cookies. Add getLocale.ts and getRegion.ts, or configure getLocalePath and getRegionPath. Learn more: https://generaltranslation.com/en-US/docs/react/nextjs/cache-components#request-values'
    );
  });

  it('names only the missing request function', () => {
    expect(
      createCacheComponentsMissingRequestFunctionsWarning(['getRegion'])
    ).toBe(
      'gt-next Warning: cacheComponents is enabled, but custom getRegion() is not configured, so next build will fail with "uncached or runtime data during prerendering" because the default function reads request headers or cookies. Add getRegion.ts, or configure getRegionPath. Learn more: https://generaltranslation.com/en-US/docs/react/nextjs/cache-components#request-values'
    );
  });

  it('gives the reason for the missing loadTranslations() error after "because"', () => {
    expect(cacheComponentsMissingLoadTranslationsError).toBe(
      'gt-next Error: cacheComponents is enabled, but custom loadTranslations() is not configured because gt-next cannot safely use the default remote translation loader with Cache Components. Add a loadTranslations.ts file, or configure loadTranslationsPath, and mark any dynamic loading with "use cache". Learn more: https://generaltranslation.com/en-US/docs/react/nextjs/cache-components#local-translations'
    );
  });

  it('does not join a reason onto the fix with ", or"', () => {
    const messages = [
      createCacheComponentsMissingRequestFunctionsWarning([
        'getLocale',
        'getRegion',
      ]),
      createCacheComponentsMissingRequestFunctionsWarning(['getLocale']),
      cacheComponentsMissingLoadTranslationsError,
    ];

    for (const message of messages) {
      expect(message).not.toMatch(/, or (the default|gt-next|cacheComponents)/);
    }
  });
});
