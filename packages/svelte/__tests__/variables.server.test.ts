import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Content } from '@generaltranslation/format/types';
import DuplicateVariableNames from './fixtures/DuplicateVariableNames.svelte';
import Harness from './fixtures/Harness.svelte';
import VariableChildren from './fixtures/VariableChildren.svelte';
import VariableKeys from './fixtures/VariableKeys.svelte';
import { hashesOf, setupGT, withoutComments } from './helpers';

const [duplicateHash] = hashesOf('DuplicateVariableNames.svelte');
const [childrenHash] = hashesOf('VariableChildren.svelte');
const [suffixHash, emptyHash] = hashesOf('VariableKeys.svelte');

/** Rendered body with Svelte's hydration comments removed. */
function html(props: Record<string, unknown>): string {
  return withoutComments(
    render(Harness, { props: props as never }).body
  ).trim();
}

const renderFr = (translation: Content) =>
  html({
    component: DuplicateVariableNames,
    locale: 'fr',
    translations: { [duplicateHash]: translation },
  });

describe('variables with the same name', () => {
  // gt-react resolves a variable among the source children of its parent,
  // so each `who` keeps its own value.
  it('renders each variable in its own position', () => {
    setupGT();
    expect(
      renderFr([
        { t: 'b', i: 1, c: { i: 2, k: 'who', v: 'v' } },
        ' et ',
        { i: 3, k: 'who', v: 'v' },
      ])
    ).toBe('<b>Ada</b> et Grace');
    expect(
      renderFr([
        { i: 3, k: 'who', v: 'v' },
        ' et ',
        { t: 'b', i: 1, c: { i: 2, k: 'who', v: 'v' } },
      ])
    ).toBe('Grace et <b>Ada</b>');
  });

  it('renders the source with both values', () => {
    setupGT();
    expect(html({ component: DuplicateVariableNames, locale: 'en' })).toBe(
      '<b>Ada</b> and Grace'
    );
  });
});

describe('variables whose value is their only child', () => {
  it('renders the value in the source', () => {
    setupGT();
    expect(
      html({ component: VariableChildren, props: { count: 3 }, locale: 'en' })
    ).toBe(
      '<p>You have 3 items and 3 more</p> <p>You have 5 items</p> <p>€3.00</p>'
    );
  });

  it('renders the value in a translation', () => {
    setupGT();
    expect(
      html({
        component: VariableChildren,
        props: { count: 1234 },
        locale: 'fr',
        translations: {
          [childrenHash]: [
            { i: 1, k: '_gt_n_1', v: 'n' },
            ' articles, ',
            { i: 2, k: '_gt_value_2', v: 'v' },
          ],
        },
      })
    ).toContain('<p>1\u202f234 articles, 1234</p>');
  });
});

describe('variables whose names look like repeat keys', () => {
  // Names are any string, so rendered nodes are keyed by source id: a
  // repeated `a` must not collide with a variable named `a#1`.
  it.each([
    ['a', 'a#1', suffixHash],
    ['', '#1', emptyHash],
  ])('renders "%s" repeated next to "%s"', (first, second, hash) => {
    setupGT();
    const a = { i: 1, k: first, v: 'v' } as const;
    const b = { i: 2, k: second, v: 'v' } as const;
    expect(
      html({
        component: VariableKeys,
        locale: 'fr',
        translations: { [hash]: [a, ' / ', a, ' / ', b] },
      })
    ).toContain(`<p>A / A / B</p>`);
  });
});
