import { hashSource } from 'generaltranslation/id';
import { compile, parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import type { JsxElement } from '@generaltranslation/format/types';
import { analyzeSvelteSource, transformSvelteSource } from '../../index.js';

function transform(source: string) {
  return transformSvelteSource(source, { parse, filename: 'Fixture.svelte' });
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

  it('redeclares enclosing snippets in the snippets generated for nested content', () => {
    const result = transform(`<script>
  import { T, Branch } from 'gt-svelte';
  import W from './W.svelte';
  let s;
</script>
<T><div>{#snippet a()}outer{/snippet}<span>{#snippet a()}inner{/snippet}<W content={a} /></span></div><Branch branch={s}>{#snippet on()}{#snippet tip()}Hint{/snippet}<W content={tip} />{/snippet}Off</Branch></T>`);
    expect(result?.errors).toEqual([]);
    const code = result!.code;
    // The inner declaration shadows the outer one, as in the source.
    expect(code).toContain(
      '{#snippet __gt_e_3(__gt_kids, __gt_d)}{#snippet a()}inner{/snippet}<W content={a} />{/snippet}'
    );
    // Snippets declared in a branch body stay in scope for its content.
    expect(code).toContain(
      '{#snippet tip()}Hint{/snippet}<W content={tip} />{/snippet}'
    );
    expect(() =>
      compile(code, { filename: 'Fixture.svelte', generate: 'server' })
    ).not.toThrow();
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
      '_gtm={{"v":{"b1_1$":{"_gt_n_3":3}},"b":{"1":{"t":"p","b":["one","other"]}}}}'
    );
    expect(code).toContain(
      '{#snippet __gt_e_b1_0$2(__gt_kids)}{@render __gt_kids()}{/snippet}'
    );
    expect(code).toContain(
      '{#snippet __gt_e_b1_0$3(__gt_kids, __gt_d)}<b>{@render __gt_kids()}</b>{/snippet}'
    );
    expect(code).toContain(
      '{#snippet __gt_v_b1_1$3()}<Num value={count} />{/snippet}'
    );
    expect(code).toContain(
      '{#snippet __gt_e_1(__gt_pick)}{@render __gt_pick((count))}{/snippet}'
    );
    expect(() => compile(code, { filename: 'Fixture.svelte' })).not.toThrow();
  });

  it('maps repeated variable names to the variables of each parent', () => {
    const result = transform(`<script>
  import { T, Var } from 'gt-svelte';
  let { first, second } = $props();
</script>
<T><b><Var name="who">{first}</Var></b> and <Var name="who">{second}</Var> <Var>{first}</Var></T>`);
    expect(result?.errors).toEqual([]);
    expect(result?.code).toContain(
      '_gtm={{"v":{"":{"who":3,"_gt_value_4":4}},"s":{"1":{"who":2},"":{"who":3}}}}'
    );
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

  it('renders edge whitespace that Svelte would trim as string expressions', () => {
    // The rewritten children, before the generated snippets.
    const body = (markup: string) =>
      transform(
        `<script>import { T } from 'gt-svelte';</script><T>${markup}</T>`
      )!.code.match(/<T _hash="\w+">([\s\S]*?)(?:\{#snippet|<\/T>)/)![1];
    expect(body(' free')).toBe('{" free"}');
    expect(body('Hello <b>world </b>again')).toBe(
      'Hello <b>{"world "}</b>again'
    );
    expect(body('<code>  npm  i  </code>')).toBe('<code>{"  npm  i  "}</code>');
    // Whitespace JSX removes is removed, including encoded whitespace.
    expect(body('\n  Hello\n    world\n')).toBe('Hello world');
    expect(body('a&#13;<b>b</b>')).toBe('a<b>b</b>');
    expect(body('foo&#9;bar')).toBe('foo bar');
    // Text Svelte renders as is keeps its raw form.
    expect(body('Tom &amp; Jerry <b>x</b>')).toBe('Tom &amp; Jerry <b>x</b>');
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

  it('passes a variable whose only child is an expression as its value', () => {
    const result = transform(`<script>
  import { T, Num, Currency, Var } from 'gt-svelte';
  let count = 3;
</script>
<p><Num>{count}</Num> and <Currency
  currency="EUR"
> {count * 2} </Currency></p>
<T>You have <b><Num name="n">{count}</Num></b> items<Var><Num>{count}</Num></Var></T>`);
    expect(result?.errors).toEqual([]);
    const code = result!.code;
    expect(code).toContain(
      '<p><Num value={count}></Num> and <Currency\n  currency="EUR"\n value={count * 2}></Currency></p>'
    );
    expect(code).toContain(
      'You have <b><Num name="n" value={count}></Num></b> items<Var><Num value={count}></Num></Var>'
    );
    expect(code).toContain(
      '{#snippet __gt_v_2()}<Num name="n" value={count}></Num>{/snippet}'
    );
    expect(code).toContain(
      '{#snippet __gt_v_3()}<Var><Num value={count}></Num></Var>{/snippet}'
    );
    expect(() =>
      compile(result!.code, { filename: 'Fixture.svelte' })
    ).not.toThrow();
  });

  it('gives branches whose names contain $ distinct snippet names', () => {
    const result = transform(`<script>
  import { T, Branch } from 'gt-svelte';
  let s, t;
</script>
<T><Branch branch={s}>{#snippet a()}<Branch branch={t}>{#snippet e()}Nested{/snippet}</Branch>{/snippet}{#snippet a$b3$e()}<u>First</u><i>Second</i>{/snippet}</Branch></T>`);
    expect(result?.errors).toEqual([]);
    expect(() =>
      compile(result!.code, { filename: 'Fixture.svelte', generate: 'server' })
    ).not.toThrow();
  });

  it('passes variable children as the value in branch snippets', () => {
    const result = transform(`<script>
  import { T, Num, Plural } from 'gt-svelte';
  let count = 3;
</script>
<T><Plural n={count}>{#snippet other()}<Num>{count}</Num> items{/snippet}</Plural></T>`);
    expect(result?.errors).toEqual([]);
    expect(result?.code).toContain(
      '{#snippet other()}<Num value={count}></Num> items{/snippet}'
    );
    expect(result?.code).toContain(
      '{#snippet __gt_v_b1_0$3()}<Num value={count}></Num>{/snippet}'
    );
  });

  it('produces a sourcemap', () => {
    const result = transform(BASIC);
    expect(result?.map.mappings).toBeTruthy();
    expect(result?.map.sources).toEqual(['Fixture.svelte']);
  });
});

describe('components with preprocessed styles', () => {
  const SCSS = `<style lang="scss">
  // Sass comment
  $accent: red;
  .x { #{$prop}: $accent; }
</style>`;

  it('ignores <style> inside a script string', () => {
    const source = `<script>
  import { T } from 'gt-svelte';
  const open = '<style>';
</script>
<T>Hello <b>x</b></T>
${SCSS}`;
    const result = transform(source);
    expect(result?.errors).toEqual([]);
    expect(result?.code).toContain("const open = '<style>';");
    expect(result?.code).toContain('<T _hash=');
  });

  it('transforms <T> without parsing the style', () => {
    const source = `<script>
  import { T } from 'gt-svelte';
</script>
<T>Hello <b>x</b></T>
${SCSS}
<T>{x}</T>`;
    const result = transform(source);
    expect(result?.errors).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ line: 10, column: 3 }),
      }),
    ]);
    expect(result?.code).toContain(SCSS);
    expect(result?.code).toContain('<T _hash=');
  });

  it('keeps <style> elements inside markup as written', () => {
    const markup = '<T>Hi <style>.a { color: red; }</style></T>';
    const withScss = analyzeSvelteSource(
      `<script>import { T } from 'gt-svelte';</script>${markup}${SCSS}`,
      { parse }
    );
    const plain = analyzeSvelteSource(
      `<script>import { T } from 'gt-svelte';</script>${markup}`,
      { parse }
    );
    expect(withScss.errors).toEqual([]);
    expect(withScss.translations[0].source).toEqual([
      'Hi ',
      { t: 'style', i: 1, c: '.a { color: red; }' },
    ]);
    expect(withScss.translations[0].hash).toBe(plain.translations[0].hash);
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

  it('rejects <T> nested in a snippet passed to a component inside <T>', () => {
    const source = `<script>
  import { T } from 'gt-svelte';
  import Link from './Link.svelte';
</script>
<T>Read <Link>{#snippet icon()}<T>Nested</T>{/snippet}docs</Link></T>`;
    const expected = [
      {
        whatHappened: '<T> cannot be nested inside another <T>',
        location: expect.objectContaining({ line: 5, column: 31 }),
      },
    ];
    expect(analyzeSvelteSource(source, { parse }).errors).toEqual(expected);
    expect(transform(source)?.errors).toEqual(expected);
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

  it('rejects spread props on Plural and Branch', () => {
    expect(
      errorsFor('<T><Plural n={1} {...forms} /></T>', 'let forms;')
    ).toEqual([
      'Spread props are not supported on <Plural> because its branches must be known at build time',
    ]);
    expect(
      errorsFor(
        '<T><Branch branch={s} {...branches}>Fallback</Branch></T>',
        'let s, branches;'
      )
    ).toEqual([
      'Spread props are not supported on <Branch> because its branches must be known at build time',
    ]);
    expect(
      analyzeSvelteSource(
        `<script>import { T, Branch as Choice } from 'gt-svelte'; let s, b;</script>
<T><Choice branch={s} {...b}>x</Choice></T>`,
        { parse }
      ).errors.map((error) => error.whatHappened)
    ).toEqual([
      'Spread props are not supported on <Choice> because its branches must be known at build time',
    ]);
  });

  it('rejects let: directives', () => {
    expect(
      errorsFor(
        '<T><List let:item>Item <Var>{item}</Var></List></T>',
        "import List from './List.svelte';"
      )
    ).toEqual(['let: directives are not supported inside <T>']);
  });

  it('accepts names that Object.prototype also has', () => {
    const { translations, errors } = analyzeSvelteSource(
      `<script>import { T, Branch } from 'gt-svelte'; let s;</script>
<T><Branch branch={s}>{#snippet constructor()}C{/snippet}{#snippet toString()}S{/snippet}Other</Branch></T>`,
      { parse }
    );
    expect(errors).toEqual([]);
    expect(Object.keys((translations[0].source as JsxElement).d!.b!)).toEqual([
      'constructor',
      'toString',
    ]);
  });

  it('rejects branches named __proto__', () => {
    const problem = '"__proto__" cannot be used as a branch name';
    expect(
      errorsFor('<T><Branch branch={s} __proto__="P">x</Branch></T>', 'let s;')
    ).toEqual([problem]);
    expect(
      errorsFor(
        '<T><Branch branch={s}>{#snippet __proto__()}P{/snippet}x</Branch></T>',
        'let s;'
      )
    ).toEqual([problem]);
  });

  it('keeps a variable named __proto__ in the runtime metadata', () => {
    const result = transformSvelteSource(
      `<script>import { T, Var } from 'gt-svelte'; let a;</script>
<T>Hi <Var name="__proto__">{a}</Var></T>`,
      { parse, filename: 'Fixture.svelte' }
    );
    const literal = result!.code.match(
      /_gtm=\{JSON\.parse\(("(?:[^"\\]|\\.)*")\)\}/
    )![1];
    const meta = JSON.parse(JSON.parse(literal)) as {
      v: Record<string, Record<string, number>>;
    };
    expect(Object.hasOwn(meta.v[''], '__proto__')).toBe(true);
    expect(meta.v[''].__proto__).toBe(1);
  });

  it('rejects reserved identifiers', () => {
    const reserved =
      'Identifiers starting with "__gt_" are reserved for the gt-svelte preprocessor';
    expect(errorsFor('<T>a</T>', 'let __gt_x;')).toEqual([reserved]);
    expect(errorsFor('<T>a {__gt_x}</T>')).toEqual([reserved]);
    expect(errorsFor('{#snippet __gt_s()}x{/snippet}<T>a</T>')).toEqual([
      reserved,
    ]);
    expect(
      errorsFor('<T>a</T>', 'let o = { __gt_key: 1 }; o.__gt_key;')
    ).toEqual([]);
  });

  it('allows the reserved prefix in text, strings, and comments', () => {
    expect(
      errorsFor(
        `<T>Rename __gt_old</T><!-- __gt_note --><p title="__gt_">x</p>`,
        "const label = '__gt_label'; // __gt_comment"
      )
    ).toEqual([]);
  });

  it('rejects variable children that cannot become the value', () => {
    const errorsFor = (markup: string) =>
      analyzeSvelteSource(
        `<script>import { Num, DateTime, Var } from 'gt-svelte';let x;</script>${markup}`,
        { parse }
      ).errors.map(({ whatHappened, fix }) => ({ whatHappened, fix }));
    expect(errorsFor('<p><Num>{x} items</Num></p>')).toEqual([
      {
        whatHappened:
          'The children of <Num> must be a single {expression}, which becomes its value',
        fix: 'Write <Num>{value}</Num> or <Num value={value} />',
      },
    ]);
    expect(errorsFor('<DateTime><b>{x}</b></DateTime>')).toEqual([
      expect.objectContaining({
        whatHappened:
          'The children of <DateTime> must be a single {expression}, which becomes its value',
      }),
    ]);
    expect(errorsFor('<Num value={x}>ignored</Num>')).toEqual([
      {
        whatHappened:
          '<Num> has both a "value" prop and children, so the children would be ignored',
        fix: 'Remove the "value" prop or the children',
      },
    ]);
  });

  it('reports variable children errors in the preprocessor output', () => {
    const result = transform(
      `<script>import { Num } from 'gt-svelte';let x;</script>\n<Num>\n  {x}{x}</Num>`
    );
    expect(result?.errors).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ line: 3, column: 2 }),
      }),
    ]);
  });

  it.each([
    ['\\n', '\n'],
    ['\\r\\n', '\r\n'],
    ['\\r', '\r'],
  ])('reports locations in files with %s line endings', (_label, eol) => {
    const source = `<script>
  import { T } from 'gt-svelte';
  let x = 1;
</script>

<T>
  Hello
  {x}
</T>
<p>{gt}</p>`.replace(/\n/g, eol);
    const { errors, translations } = analyzeSvelteSource(source, {
      parse,
      surroundingLineCount: 1,
    });
    expect(errors[0].location).toMatchObject({ line: 8, column: 2 });
    expect(translations).toEqual([]);
    const fixed = analyzeSvelteSource(
      source
        .replace('{ T }', '{ T, msg }')
        .replace('{x}', '<b>x</b>')
        .replace('{gt}', "{msg('Hi')}"),
      { parse, surroundingLineCount: 1 }
    );
    expect(fixed.strings[0].location).toMatchObject({ line: 10, column: 4 });
    expect(fixed.translations[0].sourceCode).toEqual({
      before: '',
      target: '<T>\n  Hello\n  <b>x</b>\n</T>',
      after: "<p>{msg('Hi')}</p>",
    });
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

  const analyzeStrings = (script: string, markup = '') =>
    analyzeSvelteSource(
      `<script>
  import { T, useGT, msg } from 'gt-svelte';
  const gt = useGT();
  ${script}
</script>
${markup}`,
      { parse }
    );

  it('extracts each message of a msg() array with an indexed id', () => {
    const { strings, errors } = analyzeStrings(
      `const items = msg(['First item', 'Second item'], { $id: 'list', $context: 'menu' });`
    );
    expect(errors).toEqual([]);
    expect(
      strings.map(({ source, metadata, hash }) => ({ source, metadata, hash }))
    ).toEqual(
      ['First item', 'Second item'].map((source, index) => ({
        source,
        metadata: { id: `list.${index}`, context: 'menu' },
        hash: hashSource({ source, context: 'menu', dataFormat: 'ICU' }),
      }))
    );
  });

  it('extracts concatenated string literals', () => {
    const { strings, errors } = analyzeStrings(
      "const a = gt('Hello ' + 'world');\n  const b = gt(`Item ` + 2 + 1);"
    );
    expect(errors).toEqual([]);
    expect(strings.map(({ source, hash }) => ({ source, hash }))).toEqual(
      ['Hello world', 'Item 21'].map((source) => ({
        source,
        hash: hashSource({ source, dataFormat: 'ICU' }),
      }))
    );
  });

  it('rejects concatenations with dynamic parts or that are not strings', () => {
    const { strings, errors } = analyzeStrings(
      "let x = '';\n  gt('Hello ' + x);\n  gt(1 + 2);"
    );
    expect(strings).toEqual([]);
    expect(errors.map((error) => error.whatHappened)).toEqual([
      'Translated strings must be string literals',
      'Translated strings must be string literals',
    ]);
  });

  it('leaves out invalid ICU messages with a warning', () => {
    const { strings, errors, warnings } = analyzeStrings(
      `gt('Hello {name', { name: 'x' });
  msg(['Fine', '{n, plural, one {# x}}']);
  gt('Literal {braces', { $format: 'STRING' });`
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      expect.objectContaining({
        whatHappened: expect.stringContaining(
          'Found invalid ICU string "Hello {name"'
        ),
        location: expect.objectContaining({ line: 4, column: 5 }),
      }),
      expect.objectContaining({
        whatHappened: expect.stringContaining(
          'Found invalid ICU string "{n, plural, one {# x}}"'
        ),
        location: expect.objectContaining({ line: 5, column: 15 }),
      }),
    ]);
    expect(strings.map(({ source }) => source)).toEqual([
      'Fine',
      'Literal {braces',
    ]);
  });

  it('ignores the sign of maxChars without changing the hash', () => {
    const { translations, strings, errors } = analyzeStrings(
      '',
      `<T maxChars={-40}>Hello</T>
<p>{gt('Short', { $maxChars: -12 })}</p>`
    );
    expect(errors).toEqual([]);
    expect(translations[0].metadata).toEqual({ maxChars: 40 });
    expect(translations[0].hash).toBe(
      hashSource({ source: 'Hello', maxChars: 40, dataFormat: 'JSX' })
    );
    expect(strings[0].metadata).toEqual({ maxChars: 12 });
    expect(strings[0].hash).toBe(
      hashSource({ source: 'Short', maxChars: 12, dataFormat: 'ICU' })
    );
  });

  it('hashes strings with the $format they select', () => {
    const { strings, errors } = analyzeStrings(
      `const a = gt('Literal {braces}', { $format: 'STRING' });
  const b = msg('Hi {{name}}', { $format: 'I18NEXT', $context: 'greeting' });
  const c = gt('Hello {name}', { name: 'Ada', $format: 'ICU' });
  const d = gt('Bye');`
    );
    expect(errors).toEqual([]);
    expect(
      strings.map(({ source, dataFormat, hash }) => ({
        source,
        dataFormat,
        hash,
      }))
    ).toEqual([
      {
        source: 'Literal {braces}',
        dataFormat: 'STRING',
        hash: hashSource({ source: 'Literal {braces}', dataFormat: 'STRING' }),
      },
      {
        source: 'Hi {{name}}',
        dataFormat: 'I18NEXT',
        hash: hashSource({
          source: 'Hi {{name}}',
          context: 'greeting',
          dataFormat: 'I18NEXT',
        }),
      },
      {
        source: 'Hello {name}',
        dataFormat: 'ICU',
        hash: hashSource({ source: 'Hello {name}', dataFormat: 'ICU' }),
      },
      {
        source: 'Bye',
        dataFormat: 'ICU',
        hash: hashSource({ source: 'Bye', dataFormat: 'ICU' }),
      },
    ]);
  });

  it('rejects a $format that is not a static, supported format', () => {
    const { strings, errors } = analyzeStrings(
      `let format = 'STRING';
  gt('A', { $format: format });
  gt('B', { $format: 'JSX' });`
    );
    expect(strings).toEqual([]);
    expect(errors.map((error) => error.whatHappened)).toEqual([
      'The "$format" option must be one of "ICU", "I18NEXT", "STRING"',
      'The "$format" option must be one of "ICU", "I18NEXT", "STRING"',
    ]);
  });

  it('rejects maxChars that is not an integer', () => {
    const { translations, strings, errors } = analyzeStrings(
      '',
      `<T maxChars={1.5}>Hello</T>
<p>{gt('Short', { $maxChars: 1.5 })}</p>`
    );
    expect(translations).toEqual([]);
    expect(strings).toEqual([]);
    expect(errors.map((error) => error.whatHappened)).toEqual([
      'The "maxChars" prop on <T> must be a static integer',
      'The "$maxChars" option must be a static integer',
    ]);
  });

  it('includes source code context when asked', () => {
    const source = `<script>
  import { T, useGT } from 'gt-svelte';
  const gt = useGT();
</script>
<p>before</p>
<T>
  Hello
</T>
<p>{gt('Bye')}</p>
<p>after</p>`;
    const { translations, strings } = analyzeSvelteSource(source, {
      parse,
      surroundingLineCount: 1,
    });
    expect(translations[0].sourceCode).toEqual({
      before: '<p>before</p>',
      target: '<T>\n  Hello\n</T>',
      after: "<p>{gt('Bye')}</p>",
    });
    expect(strings[0].sourceCode).toEqual({
      before: '</T>',
      target: "<p>{gt('Bye')}</p>",
      after: '<p>after</p>',
    });
    expect(
      analyzeSvelteSource(source, { parse }).translations[0]
    ).not.toHaveProperty('sourceCode');
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

describe('files saved with a UTF-8 byte order mark', () => {
  // svelte/compiler's parse() strips a leading byte order mark, but
  // `vite dev` passes it to preprocessors.
  const BOM = '﻿';
  const SOURCE = `<script>
  import { T, Var } from 'gt-svelte';
  let name = 'Ada';
</script>

<T>
  Hello <b>dear</b> <Var>{name}</Var>!
</T>
`;

  it('transforms like the same file without a byte order mark', () => {
    const withBom = transform(BOM + SOURCE, true);
    expect(withBom?.errors).toEqual([]);
    expect(withBom?.code).toBe(BOM + transform(SOURCE, true)?.code);
    expect(withBom?.code).toContain('<T _hash=');
    expect(() => compile(withBom!.code, { generate: 'server' })).not.toThrow();
  });

  it('reports the same hash and location as without a byte order mark', () => {
    const [withBom] = analyzeSvelteSource(BOM + SOURCE, { parse }).translations;
    const [without] = analyzeSvelteSource(SOURCE, { parse }).translations;
    expect(withBom.hash).toBe(without.hash);
    expect(withBom.location).toEqual({
      line: 6,
      column: 0,
      offset: without.location.offset + 1,
    });
  });

  it('reports the same error location as without a byte order mark', () => {
    const invalid = SOURCE.replace('<b>dear</b>', '{name}');
    const [withBom] = analyzeSvelteSource(BOM + invalid, { parse }).errors;
    const [without] = analyzeSvelteSource(invalid, { parse }).errors;
    expect(without.location).toMatchObject({ line: 7, column: 8 });
    expect(withBom.location).toMatchObject({ line: 7, column: 8 });
  });
});
