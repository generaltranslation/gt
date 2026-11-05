import { describe, expect, it } from 'vitest';
import {
  noLocalesCouldBeDeterminedWarning,
  withGTStaticPropsLocaleRoutingError,
} from '../ssg';

describe('SSG errors', () => {
  it('links the App Router SSG guide when no locale could be determined', () => {
    expect(noLocalesCouldBeDeterminedWarning).toBe(
      'gt-next: No locale could be determined for this request. If you use SSG, configure locale resolution, or gt-next will fall back to the default locale. Learn more: https://generaltranslation.com/en-US/docs/react/nextjs/app-router-static-site-generation#no-locale-could-be-determined'
    );
  });

  it('provides an actionable Pages Router locale-routing diagnostic', () => {
    expect(withGTStaticPropsLocaleRoutingError).toBe(
      'gt-next Error: withGTStaticProps() could not determine the statically generated locale because without Pages Router locale routing, Next.js generates only one version of this page. Add i18n locales and defaultLocale to your Next.js configuration.'
    );
  });
});
