import { describe, expect, it } from 'vitest';
import { withGTStaticPropsLocaleRoutingError } from '../ssg';

describe('SSG errors', () => {
  it('provides an actionable Pages Router locale-routing diagnostic', () => {
    expect(withGTStaticPropsLocaleRoutingError).toBe(
      'gt-next Error: withGTStaticProps() could not determine the statically generated locale because without Pages Router locale routing, Next.js generates only one version of this page. Add i18n locales and defaultLocale to your Next.js configuration.'
    );
  });
});
