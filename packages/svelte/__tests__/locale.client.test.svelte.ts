import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Content } from '@generaltranslation/format/types';
import Harness from './fixtures/Harness.svelte';
import LocaleButtons from './fixtures/LocaleButtons.svelte';
import { hashesOf, setupGT } from './helpers';

const [greetingHash] = hashesOf('Greeting.svelte');

const greeting = (hello: string, dear: string): Content => [
  `${hello} `,
  { t: 'b', i: 1, c: [`${dear} `, { i: 2, k: '_gt_value_2', v: 'v' }] },
];
const catalog: Record<string, Record<string, Content>> = {
  fr: { [greetingHash]: greeting('Bonjour', 'cher') },
  de: { [greetingHash]: greeting('Hallo', 'lieber') },
};

/** A loader whose locales resolve only when released. */
function gatedLoader(gated: string[]) {
  const releases: Record<string, () => void> = {};
  const gates = Object.fromEntries(
    gated.map((locale) => [
      locale,
      new Promise<void>((resolve) => (releases[locale] = resolve)),
    ])
  );
  const load = async (locale: string) => {
    await gates[locale];
    return catalog[locale] ?? {};
  };
  return { load, release: (locale: string) => releases[locale]() };
}

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mountHarness(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Harness, { target, props: props as never });
  cleanup = () => unmount(component);
  flushSync();
  return target;
}

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  flushSync();
};

const shown = (target: HTMLElement) => ({
  locale: target.querySelector('.locale')?.textContent,
  text: target.querySelector('.greeting')?.textContent,
});

const click = (target: HTMLElement, locale: string) =>
  target.querySelector<HTMLButtonElement>(`[data-locale="${locale}"]`)!.click();

describe('<GTProvider locale> without translations', () => {
  it('renders the default locale, then loads the locale on mount', async () => {
    const loader = gatedLoader(['fr']);
    setupGT({}, loader.load);
    const target = mountHarness({ component: LocaleButtons, locale: 'fr' });
    // Matches the server render, so hydration does not mismatch.
    expect(shown(target)).toEqual({ locale: 'en', text: 'Hello dear Ada!' });

    loader.release('fr');
    await settle();
    expect(shown(target)).toEqual({ locale: 'fr', text: 'Bonjour cher Ada' });
  });

  it('lets a later locale change win over the load on mount', async () => {
    const loader = gatedLoader(['fr']);
    setupGT({}, loader.load);
    const target = mountHarness({ component: LocaleButtons, locale: 'fr' });

    click(target, 'de');
    await settle();
    loader.release('fr');
    await settle();
    expect(shown(target)).toEqual({ locale: 'de', text: 'Hallo lieber Ada' });
  });

  it('renders the default locale without loading it', () => {
    const load = vi.fn(async () => ({}));
    setupGT({}, load);
    const target = mountHarness({ component: LocaleButtons, locale: 'en' });
    expect(shown(target)).toEqual({ locale: 'en', text: 'Hello dear Ada!' });
    expect(load).not.toHaveBeenCalled();
  });
});

describe('overlapping locale changes', () => {
  it('setLocale: the last requested locale wins when an earlier load finishes later', async () => {
    const loader = gatedLoader(['fr']);
    setupGT({}, loader.load);
    const target = mountHarness({ component: LocaleButtons, locale: 'en' });

    click(target, 'fr');
    click(target, 'de');
    await settle();
    expect(shown(target)).toEqual({ locale: 'de', text: 'Hallo lieber Ada' });

    loader.release('fr');
    await settle();
    expect(shown(target)).toEqual({ locale: 'de', text: 'Hallo lieber Ada' });
  });

  it('setLocale: the last requested locale wins when it finishes later', async () => {
    const loader = gatedLoader(['de']);
    setupGT({}, loader.load);
    const target = mountHarness({ component: LocaleButtons, locale: 'en' });

    click(target, 'fr');
    click(target, 'de');
    await settle();
    expect(shown(target)).toEqual({ locale: 'en', text: 'Hello dear Ada!' });

    loader.release('de');
    await settle();
    expect(shown(target)).toEqual({ locale: 'de', text: 'Hallo lieber Ada' });
  });

  it('setLocale: switching back to the current locale cancels a pending switch', async () => {
    const loader = gatedLoader(['fr']);
    setupGT({}, loader.load);
    const target = mountHarness({ component: LocaleButtons, locale: 'en' });

    click(target, 'fr');
    click(target, 'en');
    await settle();
    loader.release('fr');
    await settle();
    expect(shown(target)).toEqual({ locale: 'en', text: 'Hello dear Ada!' });
  });

  it('follows the latest <GTProvider locale> when the provider loads translations', async () => {
    const loader = gatedLoader(['fr']);
    setupGT({}, loader.load);
    const props = $state<Record<string, unknown>>({
      component: LocaleButtons,
      locale: 'en',
    });
    const target = mountHarness(props);

    props.locale = 'fr';
    flushSync();
    props.locale = 'de';
    flushSync();
    await settle();
    loader.release('fr');
    await settle();
    expect(shown(target)).toEqual({ locale: 'de', text: 'Hallo lieber Ada' });
  });

  it('returns to the source when <GTProvider locale> changes back during a load', async () => {
    const loader = gatedLoader(['fr']);
    setupGT({}, loader.load);
    const props = $state<Record<string, unknown>>({
      component: LocaleButtons,
      locale: 'en',
    });
    const target = mountHarness(props);

    // A URL-routed provider: /p/fr, then back to /p/en before fr loads.
    props.locale = 'fr';
    flushSync();
    props.locale = 'en';
    flushSync();
    await settle();
    loader.release('fr');
    await settle();
    expect(shown(target)).toEqual({ locale: 'en', text: 'Hello dear Ada!' });
  });

  it('preloaded <GTProvider> translations cancel a pending setLocale', async () => {
    const loader = gatedLoader(['fr']);
    setupGT({}, loader.load);
    const props = $state<Record<string, unknown>>({
      component: LocaleButtons,
      locale: 'en',
    });
    const target = mountHarness(props);

    click(target, 'fr');
    props.locale = 'de';
    props.translations = catalog.de;
    flushSync();
    loader.release('fr');
    await settle();
    expect(shown(target)).toEqual({ locale: 'de', text: 'Hallo lieber Ada' });
  });
});

describe('locale loading failures', () => {
  it('warns instead of leaking an unhandled rejection when <GTProvider locale> fails to load', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      setupGT({}, async (locale) => {
        if (locale === 'fr') throw new Error('404: no fr translations');
        return catalog[locale] ?? {};
      });
      const props = $state<Record<string, unknown>>({
        component: LocaleButtons,
        locale: 'en',
      });
      const target = mountHarness(props);
      props.locale = 'fr';
      flushSync();
      await settle();
      await settle();
      expect(shown(target)).toEqual({ locale: 'en', text: 'Hello dear Ada!' });
    } finally {
      process.off('unhandledRejection', onRejection);
      vi.unstubAllEnvs();
    }
    expect(rejections).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not load translations for "fr"')
    );
  });
});
