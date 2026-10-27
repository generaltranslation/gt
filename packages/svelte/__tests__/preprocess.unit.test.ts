import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import {
  compile,
  preprocess as svelteCompilerPreprocess,
  type PreprocessorGroup,
} from 'svelte/compiler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gtPreprocess } from '../src/preprocess';

const BOM = '﻿';

const SOURCE = `<script>
  import { T, Var } from 'gt-svelte';
  let name = 'Ada';
</script>

<T>
  Hello <b>dear</b> <Var>{name}</Var>!
</T>
`;

function preprocess(content: string) {
  const result = gtPreprocess().markup!({
    content,
    filename: 'Fixture.svelte',
  });
  return (result as { code: string }).code;
}

describe('gtPreprocess with a UTF-8 byte order mark', () => {
  it('edits the same positions as without the byte order mark', () => {
    const code = preprocess(BOM + SOURCE);
    expect(code).toBe(BOM + preprocess(SOURCE));
    expect(code).toContain('<T _hash=');
    expect(() => compile(code, { generate: 'server' })).not.toThrow();
  });

  it('reports the same error location as without the byte order mark', () => {
    const invalid = SOURCE.replace('<b>dear</b>', '{name}');
    expect(() => preprocess(invalid)).toThrow('Fixture.svelte:7:9');
    expect(() => preprocess(BOM + invalid)).toThrow('Fixture.svelte:7:9');
  });
});

describe('gtPreprocess with variable children', () => {
  it('reports children that cannot become the value', () => {
    const invalid = `<script>
  import { Num } from 'gt-svelte';
  let count = 3;
</script>

<p><Num>{count} items</Num></p>
`;
    expect(() => preprocess(invalid)).toThrow(
      /must be a single \{expression\}.*Fixture\.svelte:6:9/
    );
  });
});

describe('gtPreprocess before a style preprocessor', () => {
  it('leaves styles Svelte cannot parse for the later preprocessor', () => {
    const style = `<style lang="scss">
  // Sass comment
  $accent: red;
  b { color: $accent; }
</style>`;
    const code = preprocess(`${SOURCE}\n${style}\n`);
    expect(code).toContain('<T _hash=');
    expect(code).toContain(style);
  });
});

describe('gtPreprocess error locations after other preprocessors', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gt-svelte-preprocess-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  /** Preprocesses a file on disk, returning the error it throws. */
  async function preprocessError(
    source: string,
    preprocessors: PreprocessorGroup[]
  ) {
    const filename = join(dir, 'Page.svelte');
    writeFileSync(filename, source);
    const error = await svelteCompilerPreprocess(source, preprocessors, {
      filename,
    }).then(
      () => undefined,
      (error: unknown) => error
    );
    expect(error).toBeInstanceOf(Error);
    return { error: error as Error & Record<string, unknown>, filename };
  }

  function locationOf(source: string, text: string) {
    const lines = source.split('\n');
    const index = lines.findIndex((line) => line.includes(text));
    return { line: index + 1, column: lines[index].indexOf(text) };
  }

  it('reports the original line when TypeScript is stripped first', async () => {
    const source = `<script lang="ts">
  import { T } from 'gt-svelte';
  interface Props {
    name: string;
    count: number;
  }
  type Mode =
    | 'a'
    | 'b';
  let { name }: Props = $props();
</script>

<p><T>Hello {name}</T></p>
`;
    const { error, filename } = await preprocessError(source, [
      vitePreprocess({ script: true }),
      gtPreprocess(),
    ]);
    const { line, column } = locationOf(source, '{name}</T>');
    expect(error.message).toContain(`${filename}:${line}:${column + 1}`);
    expect(error).toMatchObject({
      filename,
      start: { line, column },
      end: { line, column },
    });
    expect(error.frame).toBe(
      [
        `11: </script>`,
        `12: `,
        `13: <p><T>Hello {name}</T></p>`,
        `${' '.repeat(4 + column)}^`,
        `14: `,
      ].join('\n')
    );
  });

  it('reports the original line when a style preprocessor adds lines', async () => {
    const source = `<style>
  @import './extra.css';
  p { margin: 0; }
</style>

<script lang="ts">
  import { T } from 'gt-svelte';
  let x = 1;
</script>

<p>line 11</p>
<T>broken {x}</T>
`;
    const inlineCssImports: PreprocessorGroup = {
      name: 'inline-css-imports',
      style: ({ content }) => ({
        code: content.replace(
          "@import './extra.css';",
          'a { color: red; }\nb { color: blue; }\nc { color: green; }'
        ),
      }),
    };
    const { error, filename } = await preprocessError(source, [
      inlineCssImports,
      gtPreprocess(),
    ]);
    expect(error.message).toContain(`${filename}:12:11`);
    expect(error.start).toMatchObject({ line: 12, column: 10 });
  });

  it('reports locations in the received markup when a markup preprocessor changed it', async () => {
    const source = `<script>
  import { T } from 'gt-svelte';
  let x = 1;
</script>
<!-- removed -->
<T>{x}</T>
`;
    const removeComments: PreprocessorGroup = {
      name: 'remove-comments',
      markup: ({ content }) => ({
        code: content.replace('<!-- removed -->\n', ''),
      }),
    };
    const { error, filename } = await preprocessError(source, [
      removeComments,
      gtPreprocess(),
    ]);
    expect(error.message).toContain(`${filename}:5:4`);
  });
});
