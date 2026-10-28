import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Content } from '@generaltranslation/format';
import Harness from './fixtures/Harness.svelte';
import LocalSnippets from './fixtures/LocalSnippets.svelte';
import { hashesOf, setupGT, withoutComments } from './helpers';

const [componentHash, variableHash] = hashesOf('LocalSnippets.svelte');

/** Rendered body with Svelte's hydration comments removed. */
function html(props: Record<string, unknown>): string {
  return withoutComments(
    render(Harness, { props: props as never }).body
  ).trim();
}

// Translations that move the element so its children render from the
// snippets the preprocessor generates.
const translations: Record<string, Content> = {
  [componentHash]: [{ t: 'b', i: 1, c: { t: 'Widget', i: 2 } }, ' : Astuce'],
  [variableHash]: [
    { t: 'b', i: 1, c: { i: 2, k: '_gt_value_2', v: 'v' } },
    ', bonjour',
  ],
};

describe('snippets declared inside elements of <T>', () => {
  beforeEach(() => setupGT());

  it('render in the source locale', () => {
    expect(html({ component: LocalSnippets, locale: 'en' })).toBe(
      '<p class="component">Tip: <b><span class="widget">Hint</span></b></p> <p class="variable">Hello <b>Ada</b></p>'
    );
  });

  it('stay in scope for the translated content that uses them', () => {
    expect(html({ component: LocalSnippets, locale: 'fr', translations })).toBe(
      '<p class="component"><b><span class="widget">Hint</span></b> : Astuce</p> <p class="variable"><b>Ada</b>, bonjour</p>'
    );
  });
});
