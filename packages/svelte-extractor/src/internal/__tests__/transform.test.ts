import { compile, parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { analyzeSvelteSource, transformSvelteSource } from '../../index.js';

function transform(source: string, dev = false) {
  return transformSvelteSource(source, {
    parse,
    filename: 'Fixture.svelte',
    dev,
  });
}

const BASIC = `<script>
  import { T as Translate, Var } from 'gt-svelte';
  let name = $state('Ada');
</script>

<Translate context="greeting">
  Hello <b class="x" title="Bold">dear <Var>{name}</Var></b>!
</Translate>
`;

describe('transformSvelteSource', () => {
  it('returns null for components without gt-svelte', () => {
    expect(transform('<p>hello</p>')).toBeNull();
    expect(
      transform(`<script>import { T } from 'other';</script><T>hi</T>`)
    ).toBeNull();
  });

  it('rewrites <T> into hash, metadata, and element/variable snippets', () => {
    const result = transform(BASIC);
    expect(result?.errors).toEqual([]);
    expect(result?.code).toMatchInlineSnapshot(`
      "<script>
        import { T as Translate, Var } from 'gt-svelte';
        let name = $state('Ada');
      </script>

      <Translate _hash="8eab79643759a9cf" _gtm={{"v":{"":{"_gt_value_2":2}}}} context="greeting">Hello <b class="x" title="Bold">dear <Var>{name}</Var></b>!{#snippet __gt_v_2()}<Var>{name}</Var>{/snippet}{#snippet __gt_e_1(__gt_kids, __gt_d)}<b class="x" title={__gt_d?.ti ?? "Bold"}>{@render __gt_kids()}</b>{/snippet}</Translate>
      "
    `);
    expect(() =>
      compile(result!.code, { filename: 'Fixture.svelte' })
    ).not.toThrow();
  });

  it('emits _source only in development', () => {
    expect(transform(BASIC, false)?.code).not.toContain('_source=');
    expect(transform(BASIC, true)?.code).toContain(
      `_source={["Hello ",{"t":"b","i":1,"c":["dear ",{"i":2,"k":"_gt_value_2","v":"v"}],"d":{"ti":"Bold"}},"!"]}`
    );
  });

  it('keeps snippets declared inside child components', () => {
    const result = transform(`<script>
  import { T } from 'gt-svelte';
  import Tooltip from './Tooltip.svelte';
</script>
<T>See <Tooltip>{#snippet tip()}<em>hint</em>{/snippet}details</Tooltip></T>`);
    expect(result?.errors).toEqual([]);
    expect(result?.code).toContain(
      '{#snippet __gt_e_1(__gt_kids, __gt_d)}<Tooltip>{#snippet tip()}<em>hint</em>{/snippet}{@render __gt_kids()}</Tooltip>{/snippet}'
    );
  });

  it('emits branch-scoped snippets and a selector snippet for Plural', () => {
    const result = transform(`<script>
  import { T, Plural, Num } from 'gt-svelte';
  let count = $state(1);
</script>
<T><Plural n={count}>{#snippet one()}<b>One</b>{/snippet}{#snippet other()}<Num value={count} /> items{/snippet}</Plural></T>`);
    expect(result?.errors).toEqual([]);
    const code = result!.code;
    expect(code).toContain(
      '_gtm={{"v":{"b1$other$":{"_gt_n_3":3}},"b":{"1":{"t":"p","b":["one","other"]}}}}'
    );
    expect(code).toContain(
      '{#snippet __gt_e_b1$one$2(__gt_kids)}{@render __gt_kids()}{/snippet}'
    );
    expect(code).toContain(
      '{#snippet __gt_e_b1$one$3(__gt_kids, __gt_d)}<b>{@render __gt_kids()}</b>{/snippet}'
    );
    expect(code).toContain(
      '{#snippet __gt_v_b1$other$3()}<Num value={count} />{/snippet}'
    );
    expect(code).toContain(
      '{#snippet __gt_e_1(__gt_pick)}{@render __gt_pick((count))}{/snippet}'
    );
    expect(() => compile(code, { filename: 'Fixture.svelte' })).not.toThrow();
  });

  it('normalizes children whitespace to JSX semantics for source rendering', () => {
    const result = transform(`<script>import { T } from 'gt-svelte';</script>
<T>
  <b>a</b>
  <i>b</i> c
</T>`);
    expect(result?.code).toContain('<T _hash=');
    expect(result?.code).toMatch(/<b>a<\/b><i>b<\/i> c\{#snippet/);
  });

  it('transforms <T> inside blocks and namespace imports', () => {
    const result = transform(`<script>import * as GT from 'gt-svelte';
let items = [1];</script>
{#each items as item}<GT.T>Item <GT.Num value={item} /></GT.T>{/each}`);
    expect(result?.errors).toEqual([]);
    expect(result?.code).toContain(
      '{#snippet __gt_v_1()}<GT.Num value={item} />{/snippet}'
    );
    expect(() =>
      compile(result!.code, { filename: 'Fixture.svelte' })
    ).not.toThrow();
  });

  it('produces a sourcemap', () => {
    const result = transform(BASIC);
    expect(result?.map.mappings).toBeTruthy();
    expect(result?.map.sources).toEqual(['Fixture.svelte']);
  });
});

describe('errors', () => {
  const errorsFor = (markup: string, script = '') =>
    analyzeSvelteSource(
      `<script>import { T, Var, Plural, Branch } from 'gt-svelte';${script}</script>${markup}`,
      { parse }
    ).errors.map((error) => error.whatHappened);

  it('rejects unwrapped dynamic content', () => {
    expect(errorsFor('<T>Hi {name}</T>', 'let name;')).toEqual([
      'Dynamic content inside <T> must be wrapped in a variable component',
    ]);
  });

  it('rejects control-flow blocks', () => {
    expect(errorsFor('<T>{#if ok}a{/if}</T>', 'let ok;')).toEqual([
      '{#if} is not supported inside <T>',
    ]);
    expect(errorsFor('<T>{@html x}</T>', 'let x;')).toEqual([
      '{@html} is not supported inside <T>',
    ]);
  });

  it('allows blocks wrapped in <Var>', () => {
    expect(errorsFor('<T>a <Var>{#if ok}b{/if}</Var></T>', 'let ok;')).toEqual(
      []
    );
  });

  it('rejects nested <T>', () => {
    expect(errorsFor('<T>a <b><T>b</T></b></T>')).toEqual([
      '<T> cannot be nested inside another <T>',
    ]);
    expect(errorsFor('<T>a <Var><T>b</T></Var></T>')).toEqual([
      '<T> cannot be nested inside another <T>',
    ]);
  });

  it('rejects dynamic metadata and reserved props', () => {
    expect(errorsFor('<T context={c}>a</T>', 'let c;')).toEqual([
      'The "context" prop on <T> must be a static string',
    ]);
    expect(errorsFor('<T {...props}>a</T>', 'let props;')).toEqual([
      'Spread props are not supported on <T> because its metadata must be known at build time',
    ]);
    expect(errorsFor('<T _hash="x">a</T>')).toEqual([
      'The "_hash" prop on <T> is reserved for the gt-svelte preprocessor',
    ]);
  });

  it('rejects snippets declared directly inside <T>', () => {
    expect(errorsFor('<T>{#snippet s()}a{/snippet}b</T>')).toEqual([
      '{#snippet} cannot be declared directly inside <T> because Svelte would pass it to <T> as a prop',
    ]);
  });

  it('rejects dynamic variable names and branch values', () => {
    expect(errorsFor('<T><Var name={n}>a</Var></T>', 'let n;')).toEqual([
      'The "name" prop on <Var> must be a static string inside <T>',
    ]);
    expect(errorsFor('<T><Plural n={1} one={x} /></T>', 'let x;')).toEqual([
      'The "one" branch of <Plural> must be a static string or a {#snippet one()}',
    ]);
    expect(
      errorsFor('<T><Plural n={1}>{#snippet lots()}a{/snippet}</Plural></T>')
    ).toEqual(['{#snippet lots()} is not a plural form']);
  });

  it('rejects reserved identifiers', () => {
    expect(errorsFor('<T>a</T>', 'let __gt_x;')).toEqual([
      'Identifiers starting with "__gt_" are reserved for the gt-svelte preprocessor',
    ]);
  });

  it('reports locations', () => {
    const { errors } = analyzeSvelteSource(
      `<script>import { T } from 'gt-svelte';</script>\n<T>\n  {x}</T>`,
      { parse }
    );
    expect(errors[0].location).toMatchObject({ line: 3, column: 2 });
  });
});

describe('string extraction', () => {
  it('extracts useGT and msg calls with $-prefixed metadata', () => {
    const { strings, errors } = analyzeSvelteSource(
      `<script>
  import { useGT, msg as m } from 'gt-svelte';
  const gt = useGT();
  const label = m('Saved', { $context: 'toast' });
</script>
<p title={gt('Hello, {name}!', { name: 'Ada', $maxChars: 20 })}>{gt('Bye')}</p>`,
      { parse }
    );
    expect(errors).toEqual([]);
    expect(
      strings.map(({ source, metadata }) => ({ source, metadata }))
    ).toEqual([
      { source: 'Saved', metadata: { context: 'toast' } },
      { source: 'Hello, {name}!', metadata: { maxChars: 20 } },
      { source: 'Bye', metadata: {} },
    ]);
  });

  it('reports non-literal messages', () => {
    const { errors } = analyzeSvelteSource(
      `<script>import { useGT } from 'gt-svelte'; const gt = useGT(); let x = '';</script>{gt(x)}`,
      { parse }
    );
    expect(errors.map((error) => error.whatHappened)).toEqual([
      'Translated strings must be string literals',
    ]);
  });
});
