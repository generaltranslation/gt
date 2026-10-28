import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { analyzeSvelteSource } from '../../index.js';
import { serializeReactT } from './reactParity.js';

const IMPORTS = `<script>
  import { T, Var, Num, Currency, DateTime, RelativeTime, Branch, Plural } from 'gt-svelte';
  import Link from './Link.svelte';
  let name = 'Ada';
  let count = 2;
  let price = 12;
  let date = new Date(0);
  let status = 'active';
</script>
`;

function analyzeSvelte(markup: string) {
  const analysis = analyzeSvelteSource(IMPORTS + markup, {
    parse,
    filename: 'Fixture.svelte',
  });
  expect(analysis.errors).toEqual([]);
  expect(analysis.translations).toHaveLength(1);
  return analysis.translations[0];
}

/**
 * Each case pairs a Svelte `<T>` with the React `<T>` a developer would write
 * for the same content. Both must serialize identically and share a hash.
 */
const cases: { name: string; svelte: string; tsx: string }[] = [
  {
    name: 'single text child',
    svelte: `<T>Hello world</T>`,
    tsx: `<T>Hello world</T>`,
  },
  {
    name: 'multi-line text and indentation',
    svelte: `<T>
      Hello there,
         friend.
    </T>`,
    tsx: `<T>
      Hello there,
         friend.
    </T>`,
  },
  {
    name: 'runs of spaces within a line and tabs',
    svelte: `<T>a   b\tc
      d</T>`,
    tsx: `<T>a   b\tc
      d</T>`,
  },
  {
    name: 'nested elements and translatable attributes',
    svelte: `<T>
      Click <a href="/x" class="link" title="Go &amp; see">here <b>now</b></a>
      <img alt="A cat" src="/cat.png" />
      <input placeholder="Your name" aria-label="Name" />
    </T>`,
    tsx: `<T>
      Click <a href="/x" className="link" title="Go &amp; see">here <b>now</b></a>
      <img alt="A cat" src="/cat.png" />
      <input placeholder="Your name" aria-label="Name" />
    </T>`,
  },
  {
    name: 'space between elements on one line, dropped between lines',
    svelte: `<T><b>a</b> <i>b</i>
      <u>c</u></T>`,
    tsx: `<T><b>a</b> <i>b</i>
      <u>c</u></T>`,
  },
  {
    name: 'entities and non-breaking spaces',
    svelte: `<T>Fish &amp; chips&nbsp;&lt;3
      &nbsp;</T>`,
    tsx: `<T>Fish &amp; chips&nbsp;&lt;3
      &nbsp;</T>`,
  },
  {
    name: 'static expressions keep exact whitespace',
    svelte: `<T>Total:{'  spaced  '}{5}{-1}{\`tpl\`} items</T>`,
    tsx: `<T>Total:{'  spaced  '}{5}{-1}{\`tpl\`} items</T>`,
  },
  {
    name: 'comments split text like empty JSX expressions',
    svelte: `<T>before<!-- note -->after</T>`,
    tsx: `<T>before{/* note */}after</T>`,
  },
  {
    name: 'variables with default and explicit keys',
    svelte: `<T>
      Hi <Var>{name}</Var>, <Var name="user">{name}</Var>
      you owe <Currency value={price} currency="EUR" /> for
      <Num value={count} /> items since <DateTime value={date} />
      (<RelativeTime value={date} />).
    </T>`,
    tsx: `<T>
      Hi <Var>{name}</Var>, <Var name="user">{name}</Var>
      you owe <Currency currency="EUR">{price}</Currency> for
      <Num>{count}</Num> items since <DateTime>{date}</DateTime>
      (<RelativeTime>{date}</RelativeTime>).
    </T>`,
  },
  {
    name: 'variables whose value is their only child',
    svelte: `<T>
      You owe <Currency currency="EUR">{price}</Currency> for
      <Num name="items">{count}</Num> items since <DateTime>{date}</DateTime>
      (<RelativeTime>{date}</RelativeTime>), <Num> {5} </Num> today.
    </T>`,
    tsx: `<T>
      You owe <Currency currency="EUR">{price}</Currency> for
      <Num name="items">{count}</Num> items since <DateTime>{date}</DateTime>
      (<RelativeTime>{date}</RelativeTime>), <Num> {5} </Num> today.
    </T>`,
  },
  {
    name: 'component elements',
    svelte: `<T>Read the <Link href="/docs" title="Docs">documentation</Link>.</T>`,
    tsx: `<T>Read the <Link href="/docs" title="Docs">documentation</Link>.</T>`,
  },
  {
    name: 'svelte:element with a static tag',
    svelte: `<T><svelte:element this="em">emphasis</svelte:element> text</T>`,
    tsx: `<T><em>emphasis</em> text</T>`,
  },
  {
    name: 'empty and void elements',
    svelte: `<T>line<br />break<span></span></T>`,
    tsx: `<T>line<br />break<span></span></T>`,
  },
  {
    name: 'plural with snippet branches and fallback',
    svelte: `<T>
      <Plural n={count}>
        {#snippet one()}<b>One</b> item for <Var>{name}</Var>{/snippet}
        {#snippet other()}
          <Num value={count} /> items for <Var>{name}</Var>
        {/snippet}
        No items
      </Plural>
      <span>after</span>
    </T>`,
    tsx: `<T>
      <Plural
        n={count}
        one={<><b>One</b> item for <Var>{name}</Var></>}
        other={<>
          <Num>{count}</Num> items for <Var>{name}</Var>
        </>}
      >
        No items
      </Plural>
      <span>after</span>
    </T>`,
  },
  {
    name: 'plural with string branches',
    svelte: `<T><Plural n={count} one="One item" other="Many items" /></T>`,
    tsx: `<T><Plural n={count} one="One item" other="Many items" /></T>`,
  },
  {
    name: 'branch with string, snippet, and nested plural',
    svelte: `<T>
      <Branch branch={status} inactive="Inactive">
        {#snippet active()}
          <i>Active</i> with <Plural n={count} one="one task" other="many tasks" />
        {/snippet}
        Unknown
      </Branch>
    </T>`,
    tsx: `<T>
      <Branch
        branch={status}
        inactive="Inactive"
        active={<>
          <i>Active</i> with <Plural n={count} one="one task" other="many tasks" />
        </>}
      >
        Unknown
      </Branch>
    </T>`,
  },
  {
    name: 'context, maxChars, and requiresReview metadata',
    svelte: `<T context="Greeting" maxChars={-40} requiresReview>Hello</T>`,
    tsx: `<T context="Greeting" maxChars={-40} requiresReview>Hello</T>`,
  },
  {
    name: 'requiresReview false does not change the hash',
    svelte: `<T context={'Greeting'} requiresReview={false}>Hello</T>`,
    tsx: `<T context="Greeting">Hello</T>`,
  },
];

describe('React <T> parity', () => {
  it.each(cases)('$name', ({ svelte, tsx }) => {
    const svelteSite = analyzeSvelte(svelte);
    const react = serializeReactT(tsx);
    expect(svelteSite.source).toEqual(react.source);
    expect(svelteSite.hash).toBe(react.hash);
  });
});
