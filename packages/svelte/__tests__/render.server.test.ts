import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTranslations } from '../src/runtime/config';
import ByteOrderMark from './fixtures/ByteOrderMark.svelte';
import ExtractedStrings from './fixtures/ExtractedStrings.svelte';
import Formats from './fixtures/Formats.svelte';
import Greeting from './fixtures/Greeting.svelte';
import Harness from './fixtures/Harness.svelte';
import Inbox from './fixtures/Inbox.svelte';
import Strings from './fixtures/Strings.svelte';
import { hashesOf, setupGT, stringsOf, withoutComments } from './helpers';

/** Rendered body with Svelte's hydration comments removed. */
function html(props: Record<string, unknown>): string {
  return withoutComments(
    render(Harness, { props: props as never }).body
  ).trim();
}

const [greetingHash] = hashesOf('Greeting.svelte');
const [pluralHash, branchHash] = hashesOf('Inbox.svelte');

describe('<T> server rendering', () => {
  beforeEach(() => setupGT());

  it('renders source content in the default locale', () => {
    expect(
      html({ component: Greeting, props: { name: 'Ada' }, locale: 'en' })
    ).toBe('Hello <b class="x" title="Bold">dear Ada</b>!');
  });

  it('renders source content without a provider', () => {
    const body = withoutComments(
      render(Greeting, { props: { name: 'Ada' } }).body
    );
    expect(body).toBe('Hello <b class="x" title="Bold">dear Ada</b>!');
  });

  it('renders a reordered translation with translated attributes', async () => {
    setupGT({
      fr: {
        [greetingHash]: [
          'Bonjour ',
          {
            t: 'b',
            i: 1,
            d: { ti: 'Gras' },
            c: [{ i: 2, k: '_gt_value_2', v: 'v' }, ' chère'],
          },
          ' !',
        ],
      },
    });
    const gt = await loadTranslations('fr');
    expect(html({ component: Greeting, props: { name: 'Ada' }, ...gt })).toBe(
      'Bonjour <b class="x" title="Gras">Ada chère</b> !'
    );
  });

  it('renders a variable referenced twice', async () => {
    setupGT({
      fr: {
        [greetingHash]: [
          { i: 2, k: '_gt_value_2', v: 'v' },
          ', ',
          { i: 2, k: '_gt_value_2', v: 'v' },
        ],
      },
    });
    const gt = await loadTranslations('fr');
    expect(html({ component: Greeting, props: { name: 'Ada' }, ...gt })).toBe(
      'Ada, Ada'
    );
  });

  it('falls back to the source for a translation with unknown elements', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setupGT({
      fr: { [greetingHash]: ['Bonjour ', { t: 'b', i: 9, c: 'x' }] },
    });
    const gt = await loadTranslations('fr');
    expect(html({ component: Greeting, props: { name: 'Ada' }, ...gt })).toBe(
      'Hello <b class="x" title="Bold">dear Ada</b>!'
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renders a component saved with a UTF-8 byte order mark', async () => {
    const [hash] = hashesOf('ByteOrderMark.svelte');
    expect(html({ component: ByteOrderMark, locale: 'en' })).toBe(
      'Hello <b>dear</b> Ada!'
    );
    setupGT({
      fr: {
        [hash]: [
          'Bonjour ',
          { i: 2, k: '_gt_value_2', v: 'v' },
          ' ',
          { t: 'b', i: 1, c: 'chère' },
        ],
      },
    });
    const gt = await loadTranslations('fr');
    expect(html({ component: ByteOrderMark, ...gt })).toBe(
      'Bonjour Ada <b>chère</b>'
    );
  });

  it('renders source plural and branch selections', () => {
    const one = html({
      component: Inbox,
      props: { count: 1, status: 'online', name: 'Ada' },
    });
    expect(one).toContain('<p class="plural"><b>One</b> message</p>');
    expect(one).toContain('<p class="branch"><i>Online</i> as Ada</p>');

    const many = html({
      component: Inbox,
      props: { count: 1234, status: 'away', name: 'Ada' },
    });
    expect(many).toContain('<p class="plural">1,234 messages</p>');
    expect(many).toContain('<p class="branch">Away</p>');

    const fallback = html({
      component: Inbox,
      props: { count: 2, status: 'busy', name: 'Ada' },
    });
    expect(fallback).toContain('<p class="branch">Unknown</p>');
  });

  it('renders translated plural and branch selections', async () => {
    setupGT({
      fr: {
        [pluralHash]: {
          t: 'Plural',
          i: 1,
          d: {
            t: 'p',
            b: {
              one: {
                t: 'C2',
                i: 2,
                c: [{ t: 'b', i: 3, c: 'Un' }, ' message'],
              },
              other: {
                t: 'C2',
                i: 2,
                c: [{ i: 3, k: '_gt_n_3', v: 'n' }, ' messages'],
              },
            },
          },
        },
        [branchHash]: {
          t: 'Branch',
          i: 1,
          d: {
            t: 'b',
            b: {
              away: 'Absent',
              online: {
                t: 'C2',
                i: 2,
                c: [
                  { t: 'i', i: 3, c: 'En ligne' },
                  ' en tant que ',
                  { i: 4, k: '_gt_value_4', v: 'v' },
                ],
              },
            },
          },
          c: 'Inconnu',
        },
      },
    });
    const gt = await loadTranslations('fr');

    const one = html({
      component: Inbox,
      props: { count: 1, status: 'online', name: 'Ada' },
      ...gt,
    });
    expect(one).toContain('<p class="plural"><b>Un</b> message</p>');
    expect(one).toContain(
      '<p class="branch"><i>En ligne</i> en tant que Ada</p>'
    );

    const many = html({
      component: Inbox,
      props: { count: 1234, status: 'away', name: 'Ada' },
      ...gt,
    });
    expect(many).toMatch(/<p class="plural">1\s234 messages<\/p>/);
    expect(many).toContain('<p class="branch">Absent</p>');

    const fallback = html({
      component: Inbox,
      props: { count: 2, status: 'busy', name: 'Ada' },
      ...gt,
    });
    expect(fallback).toContain('<p class="branch">Inconnu</p>');
  });
});

describe('strings and formatting', () => {
  it('translates strings and messages', async () => {
    const { hashSource } = await import('generaltranslation/id');
    const hash = (source: string) => hashSource({ source, dataFormat: 'ICU' });
    setupGT({
      fr: {
        [hash('Hello, {name}!')]: 'Bonjour, {name} !',
        [hash('Saved')]: 'Enregistré',
      },
    });
    const gt = await loadTranslations('fr');
    const body = html({ component: Strings, ...gt });
    expect(body).toContain('<p class="gt">Bonjour, Ada !</p>');
    expect(body).toContain('<p class="msg">Enregistré</p>');
    expect(body).toContain('<p class="locale">fr</p>');

    const source = html({ component: Strings, locale: 'en' });
    expect(source).toContain('<p class="gt">Hello, Ada!</p>');
    expect(source).toContain('<p class="msg">Saved</p>');
  });

  it('translates every string with the hash the extractor computes', async () => {
    const strings = stringsOf('ExtractedStrings.svelte');
    expect(strings.map(({ source }) => source)).toEqual([
      'First item',
      'Second item',
      'Hello world',
      'Short',
    ]);
    setupGT({
      fr: Object.fromEntries(
        strings.map(({ source, hash }) => [hash, `«${source}»`])
      ),
    });
    const gt = await loadTranslations('fr');
    expect(html({ component: ExtractedStrings, ...gt })).toBe(
      '<p class="concat">«Hello world»</p> <p class="max">«Short»</p> <p class="item">«First item»</p><p class="item">«Second item»</p>'
    );
  });

  it('formats variables for the active locale', async () => {
    setupGT();
    expect(html({ component: Formats, locale: 'en' })).toContain(
      '<span class="num">1,234.5</span>'
    );
    const gt = await loadTranslations('fr');
    expect(html({ component: Formats, ...gt })).toMatch(
      /<span class="num">1\s234,5<\/span>/
    );
  });
});
