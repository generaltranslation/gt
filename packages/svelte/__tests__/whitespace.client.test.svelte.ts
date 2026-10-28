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
const renderOnServer = (props: Record<string, unknown>) =>
  server.render('Whitespace.svelte', props);
beforeAll(async () => {
  server = await createServerRenderer();
});
afterAll(() => server?.close());

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
    expect(withoutComments(target.innerHTML)).toBe(html);
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
    expect(withoutComments(target.innerHTML)).toBe(withoutComments(html));
  });
});
