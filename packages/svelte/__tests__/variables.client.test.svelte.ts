import { flushSync, hydrate, mount, unmount } from 'svelte';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { Variable } from '@generaltranslation/format';
import Harness from './fixtures/Harness.svelte';
import VariableKeys from './fixtures/VariableKeys.svelte';
import { hashesOf, setupGT } from './helpers';
import { createServerRenderer, type ServerRenderer } from './ssr';

const [suffixHash, emptyHash, swapHash] = hashesOf('VariableKeys.svelte');

let server: ServerRenderer;
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

function mountHarness(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Harness, { target, props: props as never });
  cleanup = () => unmount(component);
  flushSync();
  return target;
}

// Names are any string, so rendered nodes are keyed by source id: a
// repeated `a` must not collide with a variable named `a#1`.
describe.each([
  ['a', 'a#1', 0, suffixHash],
  ['', '#1', 1, emptyHash],
])('variables named "%s" and "%s"', (first, second, index, hash) => {
  const a: Variable = { i: 1, k: first, v: 'v' };
  const b: Variable = { i: 2, k: second, v: 'v' };
  const props = () => ({
    locale: 'fr',
    translations: { [hash]: [a, ' / ', a, ' / ', b] },
  });
  const textOf = (target: HTMLElement) =>
    target.querySelectorAll('p')[index].textContent;

  it('mounts a translation that repeats the first', () => {
    setupGT();
    const target = mountHarness({ component: VariableKeys, ...props() });
    expect(textOf(target)).toBe('A / A / B');
  });

  it('hydrates the server render of a translation that repeats the first', async () => {
    setupGT();
    const html = await server.render('VariableKeys.svelte', props());
    const warn = vi.spyOn(console, 'warn');
    const target = document.createElement('div');
    target.innerHTML = html;
    document.body.appendChild(target);
    const component = hydrate(Harness, {
      target,
      props: { component: VariableKeys, ...props() } as never,
    });
    cleanup = () => unmount(component);
    flushSync();
    expect(warn).not.toHaveBeenCalled();
    expect(textOf(target)).toBe('A / A / B');
  });
});

describe('variables in a reordering translation', () => {
  it('moves existing DOM nodes instead of recreating them', () => {
    setupGT();
    const first = { i: 1, k: 'first', v: 'v' } satisfies Variable;
    const second = { i: 2, k: 'second', v: 'v' } satisfies Variable;
    const props = $state<Record<string, unknown>>({
      component: VariableKeys,
      locale: 'fr',
      translations: { [swapHash]: [first, ' et ', second] },
    });
    const target = mountHarness(props);
    const paragraph = target.querySelectorAll('p')[2];
    expect(paragraph.textContent).toBe('A et B');
    const em = paragraph.querySelector('em');
    const strong = paragraph.querySelector('strong');

    props.translations = { [swapHash]: [second, ' puis ', first] };
    flushSync();

    expect(paragraph.textContent).toBe('B puis A');
    expect(paragraph.querySelector('em')).toBe(em);
    expect(paragraph.querySelector('strong')).toBe(strong);
  });
});
