import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import { parse } from 'svelte/compiler';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Content } from '@generaltranslation/format/types';
import Harness from './fixtures/Harness.svelte';
import Whitespace from './fixtures/Whitespace.svelte';
import { setupGT, withoutComments } from './helpers';

/** A catalog whose translations are each `<T>`'s own serialized source. */
function identityCatalog(fixture: string): Record<string, Content> {
  const path = join(process.cwd(), '__tests__/fixtures', fixture);
  const { translations } = analyzeSvelteSource(readFileSync(path, 'utf8'), {
    parse,
  });
  return Object.fromEntries(
    translations.map(({ hash, source }) => [hash, source as Content])
  );
}

/** The rendered `<p>` contents, with hydration comments removed. */
function paragraphs(props: Record<string, unknown>): string[] {
  const body = withoutComments(
    render(Harness, {
      props: { component: Whitespace, ...props } as never,
    }).body
  );
  return [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]);
}

// What gt-react renders for the same JSX: whitespace at the edges of text
// is kept, and whitespace containing a line break is removed, including
// whitespace encoded as entities.
const expected = [
  'Price: free',
  'Read the docs <a href="/docs">here</a>',
  ' Hello ',
  '[   ]',
  'Click<a href="/x"> here </a>to continue',
  'Hello <b>world </b>again',
  'x<b> </b>y',
  'Run <code>  npm  i  </code> now',
  '1 item',
  'Status: <i>active</i>',
  'Hello world',
  ' Hello ',
  'a<b>b</b>',
  'foo bar baz',
  '<b>x</b><i>y</i>',
  '<b>x</b><i>y</i>',
  'Hello world',
  'a  b',
  'Hello ',
  'Tom &amp; Jerry &lt;3',
];

describe('<T> whitespace', () => {
  beforeEach(() => setupGT());

  it('renders source text with the whitespace of its serialized JSX', () => {
    expect(paragraphs({ locale: 'en' })).toEqual(expected);
  });

  it('renders an unchanged translation exactly like the source', () => {
    const translations = identityCatalog('Whitespace.svelte');
    expect(paragraphs({ locale: 'fr', translations })).toEqual(expected);
  });
});
