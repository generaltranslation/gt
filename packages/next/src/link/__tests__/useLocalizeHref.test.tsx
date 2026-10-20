import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkLocale } from '../localize-utils';

const { mockUseLocale } = vi.hoisted(() => ({ mockUseLocale: vi.fn() }));

vi.mock('gt-react', () => ({
  useLocale: mockUseLocale,
  useDefaultLocale: () => 'en',
}));

async function localize(href: string, locale?: LinkLocale) {
  vi.resetModules();
  const { useLocalizeHref } = await import('../useLocalizeHref');
  let result: string | undefined;
  function Probe() {
    result = useLocalizeHref()(href, locale);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return result;
}

describe('useLocalizeHref', () => {
  beforeEach(() => {
    vi.stubEnv('_GENERALTRANSLATION_MIDDLEWARE_CONFIG', '{}');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('prefixes paths the middleware would redirect', async () => {
    mockUseLocale.mockReturnValue('fr');

    expect(await localize('/checkout?step=1#top')).toBe(
      '/fr/checkout?step=1#top'
    );
    expect(await localize('https://example.com')).toBe('https://example.com');
  });

  it('matches Link for default-locale, explicit, and unlocalized hrefs', async () => {
    mockUseLocale.mockReturnValue('en');

    expect(await localize('/checkout')).toBe('/checkout');
    expect(await localize('/checkout', 'en')).toBe('/en/checkout');
    expect(await localize('/checkout', 'fr')).toBe('/fr/checkout');
    expect(await localize('/checkout', false)).toBe('/checkout');
  });
});
