import { describe, expect, it } from 'vitest';
import { createWithGTStaticPropsClientError } from '../client';
import {
  createNextI18nConfigMismatchWarning,
  withGTStaticPropsRscError,
} from '../createErrors';
import { withGTStaticPropsLocaleRoutingError } from '../ssg';

describe('withGTStaticProps errors', () => {
  it('provides an actionable browser diagnostic', () => {
    expect(createWithGTStaticPropsClientError()).toBe(
      'gt-next Error: withGTStaticProps() cannot run in the browser because static props are generated on the server by the Pages Router. Export withGTStaticProps() from a Pages Router page module.'
    );
  });

  it('provides an actionable Pages Router locale-routing diagnostic', () => {
    expect(withGTStaticPropsLocaleRoutingError).toBe(
      'gt-next Error: withGTStaticProps() could not determine the statically generated locale because without Pages Router locale routing, Next.js generates only one version of this page. Add i18n locales and defaultLocale to your Next.js configuration.'
    );
  });

  it('provides an actionable React Server Component diagnostic', () => {
    expect(withGTStaticPropsRscError).toBe(
      'gt-next Error: withGTStaticProps() is not available for React Server Components because this helper supports the Pages Router, not the App Router. Use gt-next build-time translation helpers in the App Router, or export withGTStaticProps() from a Pages Router page module.'
    );
  });
});

describe('createNextI18nConfigMismatchWarning', () => {
  it('preserves the Next.js name in the reason clause', () => {
    expect(
      createNextI18nConfigMismatchWarning([
        'defaultLocale: GT has "en"; Next.js has "en-US"',
      ])
    ).toBe(
      'gt-next (plugin) Warning: Next.js internationalized routing does not match the GT config file because Next.js may select a locale that GT is not configured to translate. Use the same defaultLocale and locales values in both configurations. Details: defaultLocale: GT has "en"; Next.js has "en-US".'
    );
  });
});
