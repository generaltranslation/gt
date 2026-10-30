import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Content } from '@generaltranslation/format';
import Harness from './fixtures/Harness.svelte';
import PrototypeNames from './fixtures/PrototypeNames.svelte';
import { hashesOf, setupGT, withoutComments } from './helpers';

const [varHash, branchHash] = hashesOf('PrototypeNames.svelte');

/** Rendered body with Svelte's hydration comments removed. */
function html(props: Record<string, unknown>): string {
  return withoutComments(
    render(Harness, { props: props as never }).body
  ).trim();
}

// JSON.parse, like a loaded translation file, so "__proto__" is a real key.
const translations = JSON.parse(
  JSON.stringify({
    [varHash]: [
      { i: 2, k: 'b', v: 'v' },
      ' et ',
      { i: 1, k: '__proto__', v: 'v' },
    ],
    [branchHash]: {
      t: 'Branch',
      i: 1,
      d: { t: 'b', b: { constructor: { t: 'C2', i: 2, c: 'Constructeur' } } },
      c: 'Autre',
    },
  })
) as Record<string, Content>;

describe('names that Object.prototype also has', () => {
  beforeEach(() => setupGT());

  it('render in the source locale', () => {
    expect(html({ component: PrototypeNames, locale: 'en' })).toBe(
      '<p class="var">Hello A and B</p> <p class="branch">Builder</p>'
    );
  });

  it('render their translations', () => {
    expect(
      html({ component: PrototypeNames, locale: 'fr', translations })
    ).toBe('<p class="var">B et A</p> <p class="branch">Constructeur</p>');
  });
});
