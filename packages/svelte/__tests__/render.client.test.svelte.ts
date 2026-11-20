import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { getI18nCache } from 'gt-i18n/internal';
import type {
  Content,
  JsxChild,
  JsxElement,
  Variable,
} from '@generaltranslation/format';
import Greeting from './fixtures/Greeting.svelte';
import Harness from './fixtures/Harness.svelte';
import LocaleOverride from './fixtures/LocaleOverride.svelte';
import LocaleSwitcher from './fixtures/LocaleSwitcher.svelte';
import Strings from './fixtures/Strings.svelte';
import { initializeGT } from '../src/runtime/config';
import { hashesOf, setupGT, setupRuntimeTranslation } from './helpers';

const [greetingHash] = hashesOf('Greeting.svelte');

const bold = (children: JsxChild[]): JsxElement => ({
  t: 'b',
  i: 1,
  d: { ti: 'Gras' },
  c: children,
});
const name: Variable = { i: 2, v: 'v' };

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function mountHarness(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Harness, { target, props: props as never });
  cleanup = () => unmount(component);
  flushSync();
  return target;
}

describe('<T> in the browser', () => {
  it('moves existing DOM nodes when a translation reorders content', () => {
    setupGT();
    const props = $state<Record<string, unknown>>({
      component: Greeting,
      props: { name: 'Ada' },
      locale: 'fr',
      translations: {
        [greetingHash]: ['Bonjour ', bold(['cher ', name]), ' !'],
      } satisfies Record<string, Content>,
    });
    const target = mountHarness(props);
    expect(target.textContent).toBe('Bonjour cher Ada !');
    const element = target.querySelector('b');

    props.translations = {
      [greetingHash]: [bold([name, ' chère']), ', bonjour !'],
    };
    flushSync();

    expect(target.textContent).toBe('Ada chère, bonjour !');
    expect(target.querySelector('b')).toBe(element);
    expect(element?.getAttribute('title')).toBe('Gras');
  });

  it('keeps the current render until the next locale has loaded', async () => {
    let release!: () => void;
    const loaded = new Promise<void>((resolve) => (release = resolve));
    setupGT({}, async (locale) => {
      if (locale !== 'fr') return {};
      await loaded;
      return { [greetingHash]: ['Salut ', bold([name])] };
    });

    const target = mountHarness({ component: LocaleSwitcher, locale: 'en' });
    expect(target.textContent).toContain('Hello dear Ada!');

    target.querySelector('button')!.click();
    flushSync();
    expect(target.textContent).toContain('Hello dear Ada!');

    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    expect(target.textContent).toContain('Salut Ada');
  });
});

describe('translations passed to <GTProvider>', () => {
  const stringHash = hashSource({ source: 'Saved', dataFormat: 'ICU' });

  // Client-side navigation does not rerun the layout load function, so the
  // provider's translations are never passed again.
  it('still translate content mounted more than 60 seconds later', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    setupGT();
    const props = $state<Record<string, unknown>>({
      component: Greeting,
      props: { name: 'Ada' },
      locale: 'fr',
      translations: {
        [greetingHash]: ['Bonjour ', bold([name])],
        [stringHash]: 'Enregistré',
      } satisfies Record<string, Content>,
    });
    const target = mountHarness(props);
    expect(target.textContent).toBe('Bonjour Ada');

    vi.advanceTimersByTime(61_000);
    props.component = Strings;
    flushSync();
    expect(target.querySelector('.msg')?.textContent).toBe('Enregistré');
    expect(target.querySelector('.locale')?.textContent).toBe('fr');
    props.component = Greeting;
    flushSync();
    expect(target.textContent).toBe('Bonjour Ada');
  });

  it('expire after an explicit cacheExpiryTime', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    delete (globalThis as { __generaltranslation?: unknown })
      .__generaltranslation;
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      cacheExpiryTime: 1000,
    });
    getI18nCache().updateTranslations({ fr: { [stringHash]: 'Enregistré' } });
    const lookup = () =>
      getI18nCache().lookupTranslation('fr', 'Saved', {
        $format: 'ICU',
        $_hash: stringHash,
      } as never);
    expect(lookup()).toBe('Enregistré');
    vi.advanceTimersByTime(2000);
    expect(lookup()).toBeUndefined();
  });

  it('still translate after an explicit cacheExpiryTime', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    delete (globalThis as { __generaltranslation?: unknown })
      .__generaltranslation;
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      cacheExpiryTime: 1000,
    });
    const props = $state<Record<string, unknown>>({
      component: Greeting,
      props: { name: 'Ada' },
      locale: 'fr',
      translations: {
        [greetingHash]: ['Bonjour ', bold([name])],
        [stringHash]: 'Enregistré',
      } satisfies Record<string, Content>,
    });
    const target = mountHarness(props);

    vi.advanceTimersByTime(2000);
    props.component = Strings;
    flushSync();
    expect(target.querySelector('.msg')?.textContent).toBe('Enregistré');
    props.component = Greeting;
    flushSync();
    expect(target.textContent).toBe('Bonjour Ada');
  });
});

describe('nested <GTProvider>s', () => {
  it('read the translations an outer provider was given after they change', () => {
    setupGT();
    const savedHash = hashSource({ source: 'Saved', dataFormat: 'ICU' });
    const inner = $state<Record<string, unknown>>({
      component: LocaleOverride,
      locale: 'de',
      translations: {},
    });
    const outer = $state<Record<string, unknown>>({
      component: Harness,
      props: inner,
      locale: 'fr',
      translations: { [savedHash]: 'Enregistré' },
    });
    const target = mountHarness(outer);
    expect(target.querySelector('.override')?.textContent).toBe('Enregistré');

    outer.translations = { [savedHash]: 'Sauvegardé' };
    inner.component = Greeting;
    flushSync();
    inner.component = LocaleOverride;
    flushSync();

    expect(target.querySelector('.override')?.textContent).toBe('Sauvegardé');
  });
});

describe('translations loaded by setLocale()', () => {
  it('still translate when the cache cannot keep them', async () => {
    delete (globalThis as { __generaltranslation?: unknown })
      .__generaltranslation;
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      cacheExpiryTime: 0,
      loadTranslations: async () => ({
        [greetingHash]: ['Salut ', bold([name])],
      }),
    });
    const target = mountHarness({ component: LocaleSwitcher, locale: 'en' });

    target.querySelector('button')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    expect(target.textContent).toContain('Salut Ada');
  });
});

describe('dev hot reload in the browser', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    // Node's Request rejects jsdom's AbortSignal, which the API client passes.
    vi.stubGlobal(
      'Request',
      class extends Request {
        constructor(input: RequestInfo, init?: RequestInit) {
          super(input, { ...init, signal: undefined });
        }
      }
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('re-renders strings when a missing translation arrives', async () => {
    setupRuntimeTranslation((source) => `[fr] ${source}`);

    const target = mountHarness({
      component: Strings,
      locale: 'fr',
      translations: {},
    });
    expect(target.querySelector('.gt')?.textContent).toBe('Hello, Ada!');

    await vi.waitFor(() => {
      flushSync();
      expect(target.querySelector('.gt')?.textContent).toBe('[fr] Hello, Ada!');
      expect(target.querySelector('.msg')?.textContent).toBe('[fr] Saved');
    });
  });

  it('requests a translation once when the cache cannot keep it', async () => {
    const requests = setupRuntimeTranslation((source) => `[fr] ${source}`, {
      cacheExpiryTime: 0,
    });

    mountHarness({ component: Strings, locale: 'fr', translations: {} });
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      flushSync();
    }

    expect(requests).toHaveLength(2);
  });
});
