import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  Content,
  JsxChild,
  JsxElement,
} from '@generaltranslation/format/types';
import BranchElements from './fixtures/BranchElements.svelte';
import Harness from './fixtures/Harness.svelte';
import { hashesOf, setupGT } from './helpers';

const [elementsHash] = hashesOf('BranchElements.svelte');

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
});

function mountHarness(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Harness, { target, props: props as never });
  cleanup = () => unmount(component);
  flushSync();
  return target;
}

describe('elements with the same id in sibling branches', () => {
  // `<i>`/`<b>` share id 3 and `<s>`/`<u>` share id 4, in the `on` and
  // `off` branch scopes.
  const branches = (on: JsxChild[], off: JsxChild[]): Content => ({
    t: 'Branch',
    i: 1,
    d: {
      t: 'b',
      b: {
        on: { t: 'C2', i: 2, c: on },
        off: { t: 'C2', i: 2, c: off },
      },
    },
  });
  const three = { t: 'x', i: 3, c: 'trois' } satisfies JsxElement;
  const four = { t: 'x', i: 4, c: 'quatre' } satisfies JsxElement;

  it('keeps each DOM node with its source element', () => {
    setupGT();
    const props = $state<Record<string, unknown>>({
      component: BranchElements,
      props: { status: 'on' },
      locale: 'fr',
      translations: {
        [elementsHash]: branches([three, ' ', four], [three, ' ', four]),
      },
    });
    const target = mountHarness(props);
    const tags = () =>
      [...target.querySelectorAll('*')].map((node) => node.tagName);
    expect(tags()).toEqual(['I', 'S']);
    const [i, s] = target.querySelectorAll('*');

    props.translations = {
      [elementsHash]: branches([four, ' ', three], [four, ' ', three]),
    };
    flushSync();
    expect(target.textContent).toBe('quatre trois');
    expect([...target.querySelectorAll('*')]).toEqual([s, i]);

    props.props = { status: 'off' };
    flushSync();
    expect(tags()).toEqual(['U', 'B']);
    const [u, b] = target.querySelectorAll('*');

    props.translations = {
      [elementsHash]: branches([three, ' ', four], [three, ' ', four]),
    };
    flushSync();
    expect(target.textContent).toBe('trois quatre');
    expect([...target.querySelectorAll('*')]).toEqual([b, u]);

    props.props = { status: 'on' };
    flushSync();
    expect(tags()).toEqual(['I', 'S']);
  });
});
