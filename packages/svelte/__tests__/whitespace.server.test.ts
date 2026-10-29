import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import Harness from './fixtures/Harness.svelte';
import Whitespace from './fixtures/Whitespace.svelte';
import WhitespacePlain from './fixtures/WhitespacePlain.svelte';
import { setupGT, withoutComments } from './helpers';

const FIXTURES = join(process.cwd(), '__tests__/fixtures');

/** The rendered `<div>` contents, with hydration comments removed. */
function cases(
  component: Component<never>,
  props: Record<string, unknown>
): string[] {
  const body = withoutComments(
    render(Harness, { props: { component, ...props } as never }).body
  );
  return [...body.matchAll(/<div>([\s\S]*?)<\/div>/g)].map((match) => match[1]);
}

// What Svelte renders for the same markup in a component that only renders
// its children: whitespace at the edges of a fragment is removed, whitespace
// between text and an element or component becomes one space, and
// whitespace within text or next to an expression is kept as written.
const expected = [
  'Price:free',
  'Read the docs<a href="/docs">here</a>',
  'Hello',
  '[]',
  'Click<a href="/x">here</a>to continue',
  'Hello <b>world</b>again',
  'x<b></b>y',
  'Run <code>npm  i</code> now',
  '1item',
  'Status:<i>active</i>',
  'Helloworld',
  'Hello',
  'a <b>b</b>',
  'foo\tbar \n  baz',
  '<b>x</b> <i>y</i>',
  '<b>x</b> <i>y</i>',
  'Hello\n    world',
  'a b',
  'Hello ',
  'Tom &amp; Jerry &lt;3',
  'You can make 7 of 50 recipes',
  'Read the <a href="/docs">docs</a> today',
  '<pre>  a  <b> b </b>\n  c  </pre>',
  '<pre>\nfirst\nsecond</pre>',
  '<span>a\nb</span>',
  '<svg><text>a</text><text>b</text></svg>',
];

describe('<T> whitespace', () => {
  beforeEach(() => setupGT());

  it('compares <T> with the same markup outside <T>', () => {
    const read = (fixture: string) =>
      readFileSync(join(FIXTURES, fixture), 'utf8').split('</script>')[1];
    expect(read('WhitespacePlain.svelte').replaceAll('Passthrough', 'T')).toBe(
      read('Whitespace.svelte')
    );
    expect(cases(WhitespacePlain, { locale: 'en' })).toEqual(expected);
  });

  it('renders source text with the whitespace Svelte renders', () => {
    expect(cases(Whitespace, { locale: 'en' })).toEqual(expected);
  });
});
