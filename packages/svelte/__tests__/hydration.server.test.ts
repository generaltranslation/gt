import { getI18nCache } from 'gt-i18n/internal';
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Content } from '@generaltranslation/format/types';
import { loadTranslations } from '../src/runtime/config';
import Greeting from './fixtures/Greeting.svelte';
import Harness from './fixtures/Harness.svelte';
import { hashesOf, setupGT, withoutComments } from './helpers';

const [greetingHash] = hashesOf('Greeting.svelte');

const greeting = (hello: string): Content => [
  `${hello} `,
  { t: 'b', i: 1, c: { i: 2, k: '_gt_value_2', v: 'v' } },
];

/** A catalog shaped like a real app's: mostly small JSX entries. */
function catalog(size: number): Record<string, Content> {
  const entries: Record<string, Content> = {};
  for (let i = 0; i < size; i++) {
    entries[`h${i.toString(16).padStart(15, '0')}`] = [
      `Paragraphe ${i} avec `,
      { t: 'b', i: 1, c: { i: 2, k: '_gt_value_2', v: 'v' } },
      ' et un ',
      { t: 'a', i: 3, c: 'lien', d: { ti: `Lien ${i}` } },
    ];
  }
  entries[greetingHash] = greeting('Bonjour');
  return entries;
}

/** Rendered body with Svelte's hydration comments removed. */
function html(gt: { locale: string; translations?: Record<string, Content> }) {
  return withoutComments(
    render(Harness, {
      props: { component: Greeting, props: { name: 'Ada' }, ...gt } as never,
    }).body
  );
}

/** Median wall time of `runs` executions, in ms. */
function median(runs: number, fn: () => unknown): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

afterEach(() => vi.restoreAllMocks());

describe('<GTProvider> translations on the server', () => {
  it('does not copy translations loaded from the cache back into it', async () => {
    setupGT({ fr: catalog(100) });
    const update = vi.spyOn(getI18nCache(), 'updateTranslations');
    for (let i = 0; i < 3; i++) {
      expect(html(await loadTranslations('fr'))).toBe(
        'Bonjour <b class="x" title="Bold">Ada</b>'
      );
    }
    expect(update).not.toHaveBeenCalled();
  });

  it('adds the same translations object to the cache once', () => {
    setupGT();
    const update = vi.spyOn(getI18nCache(), 'updateTranslations');
    const gt = { locale: 'fr', translations: catalog(100) };
    for (let i = 0; i < 3; i++) {
      expect(html(gt)).toBe('Bonjour <b class="x" title="Bold">Ada</b>');
    }
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('adds translations again after the cache expired them', () => {
    setupGT();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const gt = { locale: 'fr', translations: catalog(100) };
    expect(html(gt)).toBe('Bonjour <b class="x" title="Bold">Ada</b>');
    clock.mockReturnValue(now + 10 * 60_000);
    expect(html(gt)).toBe('Bonjour <b class="x" title="Bold">Ada</b>');
  });

  it('loads new translations after the cache expired them', async () => {
    const translations = { fr: catalog(100) };
    setupGT({}, async (locale) => translations[locale as 'fr']);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(html(await loadTranslations('fr'))).toBe(
      'Bonjour <b class="x" title="Bold">Ada</b>'
    );
    // A long-running server picks up a deployment's new translations.
    translations.fr = { ...catalog(100), [greetingHash]: greeting('Salut') };
    clock.mockReturnValue(now + 10 * 60_000);
    expect(html(await loadTranslations('fr'))).toBe(
      'Salut <b class="x" title="Bold">Ada</b>'
    );
  });

  it('renders translations it was given after the cache reloaded them', async () => {
    // The first entry is a string that the reload does not change.
    const translations = { fr: { a: 'Texte', ...catalog(100) } };
    setupGT({}, async (locale) => translations[locale as 'fr']);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const first = await loadTranslations('fr');
    // Another request reloads the locale after it expired.
    translations.fr = {
      a: 'Texte',
      ...catalog(100),
      [greetingHash]: greeting('Salut'),
    };
    clock.mockReturnValue(now + 10 * 60_000);
    expect(html(await loadTranslations('fr'))).toBe(
      'Salut <b class="x" title="Bold">Ada</b>'
    );
    // The first request renders, and sends the browser, what it loaded.
    expect(html(first)).toBe('Bonjour <b class="x" title="Bold">Ada</b>');
  });

  it('adds translations again after other translations replaced them', () => {
    setupGT();
    const first = {
      locale: 'fr',
      translations: { a: 'Texte', ...catalog(100) },
    };
    const second = {
      locale: 'fr',
      translations: {
        ...first.translations,
        [greetingHash]: greeting('Salut'),
      },
    };
    expect(html(first)).toBe('Bonjour <b class="x" title="Bold">Ada</b>');
    expect(html(second)).toBe('Salut <b class="x" title="Bold">Ada</b>');
    expect(html(first)).toBe('Bonjour <b class="x" title="Bold">Ada</b>');
  });

  // Benchmark-style check of gt-svelte's own per-request cost. The time
  // loadTranslations() spends copying the catalog is gt-i18n's and is not
  // measured here.
  it('renders loaded translations in time independent of the catalog size', async () => {
    const results: Record<number, number> = {};
    for (const size of [100, 20_000]) {
      setupGT({ fr: catalog(size) });
      const gt = await loadTranslations('fr');
      expect(html(gt)).toBe('Bonjour <b class="x" title="Bold">Ada</b>');
      results[size] = median(15, () => html(gt));
    }
    expect(results[20_000]).toBeLessThan(Math.max(results[100] * 20, 5));
  });
});

describe('<GTProvider locale> without translations on the server', () => {
  it('renders the default locale whatever other requests loaded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setupGT({ fr: { [greetingHash]: greeting('Bonjour') } });
    const first = html({ locale: 'fr' });
    // Another request, such as another user's layout load, loads French
    // into the process-wide cache.
    await loadTranslations('fr');
    expect(html({ locale: 'fr' })).toBe(first);
    expect(first).toBe('Hello <b class="x" title="Bold">dear Ada</b>!');
  });

  it('warns in development that translations should be passed', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      setupGT();
      html({ locale: 'de' });
      html({ locale: 'de' });
    } finally {
      vi.unstubAllEnvs();
    }
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<GTProvider locale="de"> rendered the default')
    );
  });
});
