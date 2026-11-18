import { readFileSync } from 'node:fs';
import { hashStringMessage } from 'gt-i18n/internal/string';
import { compile } from 'svelte/compiler';
import { parseAst } from 'vite';
import { describe, expect, it } from 'vitest';
import type { AnyNode } from '../lib/vite/ast';
import { prepareSvelteComponent } from '../lib/vite/component';
import { compileModule } from '../lib/vite/module';

const wireFormat = JSON.parse(
  readFileSync(
    new URL(
      '../../../../test-fixtures/rich-content-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
) as { id: string; source: unknown; hash: string }[];

const runtime = new Set(['gt-svelte']);

function compileComponent(code: string) {
  return prepareSvelteComponent(
    code,
    '/app/src/C.svelte',
    'src/C.svelte'
  ).compile(runtime);
}

function fixture(id: string) {
  return wireFormat.find((entry) => entry.id === id)!;
}

describe('<T> serialization', () => {
  it('matches the shared wire format and hash for nested elements', () => {
    const result =
      compileComponent(`<script>import { T } from 'gt-svelte';</script>
<T>
  Hello <strong>wonderful <em>world</em></strong>.
</T>`);
    const expected = fixture('nested-element');
    expect(result!.entries).toEqual([
      {
        dataFormat: 'JSX',
        source: expected.source,
        metadata: { hash: expected.hash, filePaths: ['src/C.svelte'] },
      },
    ]);
  });

  it('matches the shared wire format and hash for typed variables', () => {
    const result = compileComponent(`<script>
  import { Num, T as Translate, Var } from 'gt-svelte';
  let { name, count } = $props();
</script>
<Translate>Hello <Var>{name}</Var>, you have <Num value={count} /> messages.</Translate>`);
    const expected = fixture('typed-variables');
    expect(result!.entries[0]!.source).toEqual(expected.source);
    expect(result!.entries[0]!.metadata.hash).toBe(expected.hash);
  });

  it('keeps element attributes and handlers in snippets that T renders', () => {
    const result = compileComponent(`<script>
  import { T, gt } from 'gt-svelte';
  let clicks = $state(0);
</script>
<T context="cta">Click <button class="primary" title={gt('Press')} onclick={() => clicks++}>here</button>.</T>`);
    expect(result!.code).toContain(
      '{#snippet __gt_1(__gt_r, __gt_c)}<button class="primary" title={__gt_rt.string('
    );
    expect(result!.code).toContain(
      '{@render __gt_r(__gt_c)}</button>{/snippet}'
    );
    expect(result!.entries.map((entry) => entry.metadata.context)).toEqual([
      undefined,
      'cta',
    ]);
    expect(compile(result!.code, { generate: 'client' }).js.code).toBeTruthy();
    expect(compile(result!.code, { generate: 'server' }).js.code).toBeTruthy();
  });
});

describe('gt() calls', () => {
  it('replaces aliased calls with precomputed STRING lookups', () => {
    const result = compileComponent(`<script lang="ts">
  import { gt as tr } from 'gt-svelte';
  const heading: string = tr('Welcome', { $context: 'page heading' });
</script>
<h1 title={tr('Title')}>{heading}</h1>
{#each ['a'] as tr}<span>{tr}</span>{/each}`);
    const welcome = hashStringMessage('Welcome', { $context: 'page heading' });
    expect(result!.code).toContain(`__gt_rt.string("${welcome}", "Welcome")`);
    expect(result!.code).toContain('const __gt_rt = __gt_getGT();');
    expect(result!.code).toContain('<span>{tr}</span>');
    expect(result!.entries.map((entry) => entry.metadata.hash)).toEqual([
      welcome,
      hashStringMessage('Title'),
    ]);
  });

  it('uses the module lookup in a module script', () => {
    const result = compileComponent(`<script module>
  import { gt } from 'gt-svelte';
  export const label = gt('Module label');
</script>
<p>{label}</p>`);
    expect(result!.code).toContain(
      `export const label = __gt_lookup("${hashStringMessage('Module label')}", "Module label");`
    );
    expect(result!.code).not.toContain('__gt_getGT');
  });

  it('ignores components that do not import the runtime', () => {
    expect(
      compileComponent(`<script>function gt(value) { return value; }</script>
<p>{gt('Not translated')}</p>`)
    ).toBeNull();
  });

  it('compiles calls in JavaScript modules', () => {
    const code = `import { gt } from 'gt-svelte';
export const navigation = [gt('Docs', { $context: 'nav' })];`;
    const result = compileModule(
      code,
      parseAst(code) as unknown as AnyNode,
      '/app/src/nav.ts',
      'src/nav.ts',
      runtime
    );
    expect(result!.code).toContain(
      `[__gt_lookup("${hashStringMessage('Docs', { $context: 'nav' })}", "Docs")]`
    );
    expect(
      result!.code.startsWith('import { lookupString as __gt_lookup }')
    ).toBe(true);
  });
});

describe('build errors', () => {
  it.each([
    [
      'non-constant gt() text',
      `<script>import { gt } from 'gt-svelte'; let name = 'x';</script>{gt(name)}`,
      /not a constant string/,
    ],
    [
      'gt used as a value',
      `<script>import { gt } from 'gt-svelte'; const f = gt;</script>`,
      /used as a value/,
    ],
    [
      'an expression inside <T>',
      `<script>import { T } from 'gt-svelte'; let name = 'x';</script><T>Hi {name}</T>`,
      /Dynamic content inside <T>/,
    ],
    [
      'a block inside <T>',
      `<script>import { T } from 'gt-svelte'; let ok = true;</script><T>{#if ok}Hi{/if}</T>`,
      /Dynamic content inside <T>/,
    ],
    [
      'a nested <T>',
      `<script>import { T } from 'gt-svelte';</script><T>Hi <T>there</T></T>`,
      /nested directly inside/,
    ],
    [
      'a namespace import',
      `<script>import * as G from 'gt-svelte';</script>`,
      /imported as a namespace/,
    ],
    [
      'a reserved name',
      `<script>import { gt } from 'gt-svelte'; const __gt_x = 1;</script>`,
      /reserved __gt_ prefix/,
    ],
  ])('reports %s with its location', (_name, code, message) => {
    expect(() => compileComponent(code)).toThrow(message);
    expect(() => compileComponent(code)).toThrow(/src\/C\.svelte:1:\d+/);
  });
});
