import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import {
  composeLocationRewrites,
  createLocaleRewrite,
  getRouterLocaleRewrite,
} from '../localeRewrite';
import type { GTLocationRewrite, GTLocationRewriteFunction } from '../types';

const origin = 'https://example.com';

function run(rewrite: GTLocationRewriteFunction | undefined, href: string) {
  const url = new URL(`${origin}${href}`);
  const result = rewrite?.({ url });
  if (!result) return url.href.replace(origin, '');
  return (typeof result === 'string' ? new URL(result) : result).href.replace(
    origin,
    ''
  );
}

describe.sequential('createLocaleRewrite', () => {
  let locale = 'en';
  const rewrite = createLocaleRewrite(() => locale);
  const input = (href: string) => run(rewrite.input, href);
  const output = (href: string) => run(rewrite.output, href);

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr', 'zh'] });
    locale = 'en';
  });

  it('strips one supported locale segment on input', () => {
    expect(input('/fr/about')).toBe('/about');
    expect(input('/zh/docs/intro')).toBe('/docs/intro');
    expect(input('/en/about')).toBe('/about');
  });

  it('leaves unsupported, absent, and partial segments alone on input', () => {
    expect(input('/about')).toBe('/about');
    expect(input('/de/about')).toBe('/de/about');
    expect(input('/france/about')).toBe('/france/about');
    expect(input('/')).toBe('/');
    expect(input('//fr/about')).toBe('//fr/about');
  });

  it('keeps an empty first segment after the locale on the current origin', () => {
    expect(input('/fr//evil.example')).toBe('//evil.example');
  });

  it('maps the bare locale and its trailing slash to the root', () => {
    expect(input('/fr')).toBe('/');
    expect(input('/fr/')).toBe('/');
    expect(input('/fr/about/')).toBe('/about/');
  });

  it('decodes the locale segment once and ignores malformed encoding', () => {
    expect(input('/%66%72/about')).toBe('/about');
    expect(input('/%2566r/about')).toBe('/%2566r/about');
    expect(input('/%E0%A4%A/about')).toBe('/%E0%A4%A/about');
  });

  it('keeps the rest of the pathname encoded, the query, and the hash', () => {
    expect(input('/fr/caf%C3%A9?q=a%20b#top')).toBe('/caf%C3%A9?q=a%20b#top');
    expect(output('/caf%C3%A9?q=a%20b#top')).toBe('/caf%C3%A9?q=a%20b#top');
    locale = 'fr';
    expect(output('/caf%C3%A9?q=a%20b#top')).toBe('/fr/caf%C3%A9?q=a%20b#top');
  });

  it('leaves the default locale unprefixed on output', () => {
    expect(output('/about')).toBe('/about');
    expect(output('/')).toBe('/');
  });

  it('prefixes a non-default locale on output, read on every call', () => {
    locale = 'fr';
    expect(output('/about')).toBe('/fr/about');
    expect(output('/')).toBe('/fr');
    locale = 'zh';
    expect(output('/about')).toBe('/zh/about');
  });

  it('round-trips internal paths that start with a locale-shaped segment', () => {
    locale = 'fr';
    expect(input('/fr/fr/about')).toBe('/fr/about');
    expect(output('/fr/about')).toBe('/fr/fr/about');
    locale = 'en';
    expect(input('/fr/about')).toBe('/about');
    expect(output('/fr/about')).toBe('/fr/about');
  });

  it('does not mutate the URL it receives', () => {
    locale = 'fr';
    const url = new URL('/about', origin);
    rewrite.output?.({ url });
    expect(url.pathname).toBe('/about');
    const inputUrl = new URL('/fr/about', origin);
    rewrite.input?.({ url: inputUrl });
    expect(inputUrl.pathname).toBe('/fr/about');
  });

  it('uses configured aliases and their canonical spelling', () => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({
      defaultLocale: 'en-us',
      locales: ['en-us', 'brand-french'],
      customMapping: {
        'en-us': { code: 'en-US' },
        'brand-french': { code: 'fr', name: 'Brand French' },
      },
    });

    expect(input('/brand-french/about')).toBe('/about');
    expect(input('/fr/about')).toBe('/about');
    expect(input('/en-US/about')).toBe('/about');
    locale = 'fr';
    expect(output('/about')).toBe('/brand-french/about');
    locale = 'en-US';
    expect(output('/about')).toBe('/about');
  });

  it('encodes the locale prefix on output', () => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr ca'],
      customMapping: { 'fr ca': { code: 'fr-CA' } },
    });
    locale = 'fr ca';
    expect(output('/about')).toBe('/fr%20ca/about');
    expect(input('/fr%20ca/about')).toBe('/about');
  });
});

describe('composeLocationRewrites', () => {
  function tag(name: string, calls: string[]): GTLocationRewrite {
    return {
      input: ({ url }) => {
        calls.push(`${name}.input:${url.pathname}`);
        return `${origin}${url.pathname}/${name}`;
      },
      output: ({ url }) => {
        calls.push(`${name}.output:${url.pathname}`);
        const next = new URL(url.href);
        next.pathname = `${url.pathname}/${name}`;
        return next;
      },
    };
  }

  it('runs inputs in order and outputs in reverse', () => {
    const calls: string[] = [];
    const rewrite = composeLocationRewrites([
      tag('gt', calls),
      tag('app', calls),
    ]);

    expect(run(rewrite.input, '/x')).toBe('/x/gt/app');
    expect(run(rewrite.output, '/y')).toBe('/y/app/gt');
    expect(calls).toEqual([
      'gt.input:/x',
      'app.input:/x/gt',
      'app.output:/y',
      'gt.output:/y/app',
    ]);
  });

  it('keeps the current URL for empty results and missing callbacks', () => {
    const mutate: GTLocationRewrite = {
      input: ({ url }) => {
        url.pathname = '/mutated';
        return undefined;
      },
    };
    const rewrite = composeLocationRewrites([mutate, {}]);

    expect(run(rewrite.input, '/x')).toBe('/mutated');
    expect(run(rewrite.output, '/y')).toBe('/y');
  });
});

describe.sequential('getRouterLocaleRewrite', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
  });

  it('runs the locale rewrite outside the app rewrite', () => {
    const appRewrite: GTLocationRewrite = {
      input: vi.fn(({ url }) =>
        url.pathname === '/legacy' ? `${origin}/about` : undefined
      ),
      output: vi.fn(({ url }) =>
        url.pathname === '/about' ? `${origin}/legacy` : undefined
      ),
    };
    const rewrite = getRouterLocaleRewrite(
      { options: { rewrite: appRewrite }, update: vi.fn() },
      () => 'fr'
    );

    expect(run(rewrite.input, '/fr/legacy')).toBe('/about');
    expect(appRewrite.input).toHaveBeenCalledWith({
      url: new URL('/legacy', origin),
    });
    expect(run(rewrite.output, '/about')).toBe('/fr/legacy');
  });

  it('is the locale rewrite alone without an app rewrite', () => {
    const rewrite = getRouterLocaleRewrite(
      { options: {}, update: vi.fn() },
      () => 'fr'
    );

    expect(run(rewrite.input, '/fr/about')).toBe('/about');
    expect(run(rewrite.output, '/about')).toBe('/fr/about');
  });
});
