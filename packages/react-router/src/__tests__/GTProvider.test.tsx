import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTProvider, initializeGT } from '../index';

type Reload = (state: { locale: string }) => void;

function getReload() {
  const element = GTProvider({
    locale: 'en',
    translations: {},
    children: null,
  }) as ReactElement<{ _reload?: Reload }>;
  return element.props._reload;
}

describe('GTProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('with locale routing', () => {
    beforeEach(() => {
      initializeGT({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'de'],
        localeRouting: true,
      });
    });

    it('opens the page at the URL for the new locale', () => {
      const assign = vi.fn();
      vi.stubGlobal('window', {
        location: {
          href: 'https://example.com/fr/about?view=full#bio',
          assign,
        },
      });

      getReload()?.({ locale: 'de' });
      expect(assign).toHaveBeenCalledWith(
        'https://example.com/de/about?view=full#bio'
      );
    });
  });

  it('leaves the reload to gt-react without locale routing', () => {
    initializeGT({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(getReload()).toBeUndefined();
  });
});
