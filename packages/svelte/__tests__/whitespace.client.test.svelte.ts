import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import { flushSync, hydrate, mount, unmount } from 'svelte';
import { parse } from 'svelte/compiler';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { Content } from '@generaltranslation/format/types';
import Harness from './fixtures/Harness.svelte';
import Whitespace from './fixtures/Whitespace.svelte';
import { setupGT, withoutComments } from './helpers';
import { createServerRenderer, type ServerRenderer } from './ssr';

/** A catalog whose translations are each `<T>`'s own serialized source. */
function identityCatalog(): Record<string, Content> {
  const path = join(process.cwd(), '__tests__/fixtures/Whitespace.svelte');
  const { translations } = analyzeSvelteSource(readFileSync(path, 'utf8'), {
    parse,
  });
  return Object.fromEntries(
    translations.map(({ hash, source }) => [hash, source as Content])
  );
}

let server: ServerRenderer;
const renderOnServer = (
  props: Record<string, unknown>,
  fixture = 'Whitespace.svelte'
) => server.render(fixture, props);
beforeAll(async () => {
  server = await createServerRenderer();
});
afterAll(() => server?.close());

/**
 * Parses HTML as the browser does, which turns carriage returns into line
 * feeds and drops a line feed that opens a `<pre>`.
 */
function parseHtml(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element;
}

/** The text of each case's `<div>`. */
function caseTexts(root: HTMLElement): (string | null)[] {
  return [...root.querySelectorAll(':scope > div')].map(
    (element) => element.textContent
  );
}

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe.each([
  ['the source', () => ({ locale: 'en' })],
  [
    'an unchanged translation',
    () => ({ locale: 'fr', translations: identityCatalog() }),
  ],
])('<T> whitespace in the browser: %s', (_label, props) => {
  it('mounts with the same HTML as the server render', async () => {
    setupGT();
    const html = withoutComments(await renderOnServer(props()));
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(Harness, {
      target,
      props: { component: Whitespace, ...props() } as never,
    });
    cleanup = () => unmount(component);
    flushSync();
    expect(withoutComments(target.innerHTML)).toBe(
      withoutComments(parseHtml(html).innerHTML)
    );
  });

  it('hydrates the server render without a mismatch', async () => {
    setupGT();
    const html = await renderOnServer(props());
    const warn = vi.spyOn(console, 'warn');
    const target = document.createElement('div');
    target.innerHTML = html;
    document.body.appendChild(target);
    const component = hydrate(Harness, {
      target,
      props: { component: Whitespace, ...props() } as never,
    });
    cleanup = () => unmount(component);
    flushSync();
    expect(warn).not.toHaveBeenCalled();
    expect(withoutComments(target.innerHTML)).toBe(
      withoutComments(parseHtml(html).innerHTML)
    );
  });
});

describe('<T> whitespace with the preserveWhitespace compiler option', () => {
  let preserving: ServerRenderer;
  beforeAll(async () => {
    preserving = await createServerRenderer({ preserveWhitespace: true });
  });
  afterAll(() => preserving?.close());

  it('renders an unchanged translation like the source', async () => {
    setupGT();
    const source = caseTexts(
      parseHtml(await preserving.render('Whitespace.svelte', { locale: 'en' }))
    );
    expect(source).toHaveLength(28);
    const translated = caseTexts(
      parseHtml(
        await preserving.render('Whitespace.svelte', {
          locale: 'fr',
          translations: identityCatalog(),
        })
      )
    );
    expect(translated).toEqual(source);
  });
});

describe('<T> whitespace in the DOM', () => {
  it('gives the source and an unchanged translation the text of the same markup outside <T>', async () => {
    setupGT();
    const expected = caseTexts(
      parseHtml(
        await renderOnServer({ locale: 'en' }, 'WhitespacePlain.svelte')
      )
    );
    expect(expected).toHaveLength(28);
    for (const props of [
      { locale: 'en' },
      { locale: 'fr', translations: identityCatalog() },
    ]) {
      expect(caseTexts(parseHtml(await renderOnServer(props)))).toEqual(
        expected
      );
      const target = document.createElement('div');
      document.body.appendChild(target);
      const component = mount(Harness, {
        target,
        props: { component: Whitespace, ...props } as never,
      });
      flushSync();
      expect(caseTexts(target)).toEqual(expected);
      unmount(component);
      target.remove();
    }
  });
});
