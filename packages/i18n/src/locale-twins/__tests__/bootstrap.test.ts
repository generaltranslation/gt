import { LocaleConfig } from 'generaltranslation';
import { describe, expect, it } from 'vitest';
import { LOCALE_TWIN_BOOTSTRAP_SCRIPT } from '../bootstrap';
import {
  LOCALE_TWIN_DOCUMENT_DATA_ID,
  type LocaleTwinDocumentData,
} from '../document';

type FakeElement = {
  tagName: string;
  attributes: Record<string, string>;
  setAttribute(name: string, value: string): void;
};

/**
 * A minimal DOM: just what the bootstrap touches. The script is run exactly
 * as it is inlined into the built document.
 */
function runBootstrap({
  data,
  cookie = '',
  languages = [],
  readyState = 'loading',
}: {
  data: LocaleTwinDocumentData | undefined;
  cookie?: string;
  languages?: readonly string[] | undefined;
  readyState?: 'loading' | 'interactive' | 'complete';
}) {
  const head: FakeElement[] = [];
  const listeners: Record<string, Array<() => void>> = {};
  const documentElement = { lang: 'en' };
  const document = {
    cookie,
    readyState,
    documentElement,
    head: {
      appendChild(element: FakeElement) {
        head.push(element);
        return element;
      },
    },
    getElementById(id: string) {
      if (id !== LOCALE_TWIN_DOCUMENT_DATA_ID || !data) return null;
      return { textContent: JSON.stringify(data) };
    },
    createElement(tagName: string): FakeElement {
      const attributes: Record<string, string> = {};
      return {
        tagName,
        attributes,
        setAttribute(name, value) {
          attributes[name] = String(value);
        },
      };
    },
    addEventListener(type: string, listener: () => void) {
      (listeners[type] ??= []).push(listener);
    },
  };
  const navigator = { languages };
  new Function('document', 'navigator', LOCALE_TWIN_BOOTSTRAP_SCRIPT)(
    document,
    navigator
  );
  const describeHead = () =>
    head.map((element) => ({
      tag: element.tagName,
      ...element.attributes,
    }));
  return {
    lang: () => documentElement.lang,
    head: describeHead,
    domContentLoaded() {
      for (const listener of listeners.DOMContentLoaded ?? []) listener();
    },
  };
}

const DATA: LocaleTwinDocumentData = {
  version: 1,
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es', 'zh-TW'],
  localeCookieName: 'generaltranslation.locale',
  tags: [
    {
      tag: 'script',
      attributes: { type: 'module', crossorigin: '' },
      urls: {
        en: '/assets/index-A.en-11111111.js',
        fr: '/assets/index-A.fr-22222222.js',
        es: '/assets/index-A.es-33333333.js',
        'zh-TW': '/assets/index-A.zh-TW-44444444.js',
      },
    },
    {
      tag: 'link',
      attributes: { rel: 'modulepreload', crossorigin: '' },
      urls: {
        en: '/assets/page-B.en-11111111.js',
        fr: '/assets/page-B.fr-22222222.js',
        es: '/assets/page-B.es-33333333.js',
        'zh-TW': '/assets/page-B.zh-TW-44444444.js',
      },
    },
  ],
};

describe('locale twin SPA bootstrap', () => {
  it("loads the cookie locale's entry twin once the document is parsed", () => {
    const page = runBootstrap({
      data: DATA,
      cookie: 'theme=dark; generaltranslation.locale=es',
      languages: ['fr-FR', 'fr'],
    });

    expect(page.lang()).toBe('es');
    // The fetches start right away
    expect(page.head()).toEqual([
      {
        tag: 'link',
        rel: 'modulepreload',
        crossorigin: '',
        href: '/assets/index-A.es-33333333.js',
      },
      {
        tag: 'link',
        rel: 'modulepreload',
        crossorigin: '',
        href: '/assets/page-B.es-33333333.js',
      },
    ]);
    // The entry runs after parsing, like the deferred module script it replaces
    page.domContentLoaded();
    expect(page.head()).toContainEqual({
      tag: 'script',
      type: 'module',
      crossorigin: '',
      src: '/assets/index-A.es-33333333.js',
    });
  });

  it('falls back to navigator.languages, then the default locale', () => {
    expect(
      runBootstrap({ data: DATA, languages: ['de-DE', 'fr-CA'] }).lang()
    ).toBe('fr');
    expect(runBootstrap({ data: DATA, languages: ['de-DE'] }).lang()).toBe(
      'en'
    );
    expect(runBootstrap({ data: DATA, languages: undefined }).lang()).toBe(
      'en'
    );
    // A cookie for a locale without twins is skipped
    expect(
      runBootstrap({
        data: DATA,
        cookie: 'generaltranslation.locale=de',
        languages: ['es-MX'],
      }).lang()
    ).toBe('es');
  });

  it('reads the configured cookie name and decodes its value', () => {
    const page = runBootstrap({
      data: { ...DATA, localeCookieName: 'my-locale' },
      cookie: 'generaltranslation.locale=fr; my-locale=zh%2DTW',
    });
    expect(page.lang()).toBe('zh-TW');
  });

  // The browser runtime resolves cookie + navigator.languages with
  // LocaleConfig.determineLocale; the bootstrap must pick the same locale or
  // the condition store and the loaded twin disagree.
  it.each([
    [['fr'], ['en', 'fr']],
    [['FR-fr'], ['en', 'fr']],
    [['fr-CA'], ['en', 'fr', 'fr-CA']],
    [['fr-CA'], ['en', 'fr-FR']],
    [['fr'], ['en', 'fr-FR', 'fr-CA']],
    [['zh'], ['en', 'zh-CN', 'zh-TW']],
    [['zh-HK'], ['en', 'zh-CN', 'zh-TW']],
    [['zh-Hant'], ['en', 'zh-CN', 'zh-TW']],
    [['zh-Hant-HK'], ['en', 'zh-Hans', 'zh-Hant']],
    [['zh-TW'], ['en', 'zh']],
    [['pt-BR'], ['en', 'pt-PT', 'pt-BR']],
    [['pt'], ['en', 'pt-PT', 'pt-BR']],
    [
      ['en-GB', 'fr'],
      ['en', 'fr'],
    ],
    [
      ['en-GB', 'fr'],
      ['en-US', 'fr'],
    ],
    [['sr-Latn-RS'], ['en', 'sr']],
    [
      ['not a locale', 'es'],
      ['en', 'es'],
    ],
    [
      ['de', 'ja-JP'],
      ['en', 'ja'],
    ],
    [['de'], ['en', 'ja']],
    [[], ['en', 'ja']],
  ])('picks what the runtime picks for %j in %j', (languages, locales) => {
    const defaultLocale = locales[0];
    const expected =
      new LocaleConfig({ defaultLocale, locales }).determineLocale(languages) ??
      defaultLocale;
    const page = runBootstrap({
      data: { ...DATA, defaultLocale, locales, tags: [] },
      languages,
    });
    expect(page.lang()).toBe(expected);
  });

  it('adds the entry script at once when the document is already parsed', () => {
    const page = runBootstrap({ data: DATA, readyState: 'interactive' });
    expect(page.head().map((element) => element.tag)).toEqual([
      'link',
      'link',
      'script',
    ]);
  });

  it('does nothing without the data block', () => {
    const page = runBootstrap({ data: undefined, languages: ['fr'] });
    expect(page.lang()).toBe('en');
    expect(page.head()).toEqual([]);
  });
});
