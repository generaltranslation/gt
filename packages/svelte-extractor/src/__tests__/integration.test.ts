import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSync } from '@babel/core';
import { hashSource } from 'generaltranslation/id';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractFromSvelteModule,
  extractFromSvelteProject,
  planSvelteExtraction,
} from '../../integration.js';

let root: string | undefined;
afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function createProject(files: Record<string, string>): string {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-svelte-extract-'));
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(root, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return root;
}

const GREETING = `<script>
  import { T, Var, useGT } from 'gt-svelte';
  const t = useGT();
  let { name } = $props();
</script>
<T context="greeting">Hello <Var>{name}</Var></T>
<p>{t('Bye', { $context: 'farewell' })}</p>`;

describe('planSvelteExtraction', () => {
  it('ignores projects that do not select gt-svelte', () => {
    expect(
      planSvelteExtraction({ library: 'gt-react', projectRoot: '.' }).handled
    ).toBe(false);
  });

  it('extracts .svelte files and merges them with the primary extractor', async () => {
    const projectRoot = createProject({
      'src/routes/+page.svelte': GREETING,
      'src/lib/Other.svelte': GREETING,
      'src/lib/Broken.svelte': `<script>import { T } from 'gt-svelte'; let x;</script><T>{x}</T>`,
      'node_modules/pkg/Ignored.svelte': GREETING,
    });
    const plan = planSvelteExtraction({ library: 'gt-svelte', projectRoot });
    expect(plan.handled).toBe(true);
    if (!plan.handled) return;

    const primaryPatterns: (string[] | undefined)[] = [];
    const output = await plan.run({
      extractPrimary: async (patterns) => {
        primaryPatterns.push(patterns);
        return {
          updates: [
            {
              dataFormat: 'ICU',
              source: 'From TypeScript',
              metadata: { hash: 'primary', filePaths: ['src/lib/a.ts'] },
            },
          ],
          errors: [],
          warnings: ['primary warning'],
        };
      },
    });

    expect(primaryPatterns).toEqual([undefined]);
    expect(output.warnings).toEqual(['primary warning']);
    expect(output.errors).toEqual([
      'src/lib/Broken.svelte (1:58): Dynamic content inside <T> must be wrapped in a variable component. Wrap it in <Var>, <Num>, <Currency>, <DateTime>, or <RelativeTime>.',
    ]);
    expect(
      output.updates.map(({ dataFormat, source, metadata }) => ({
        dataFormat,
        source,
        context: metadata.context,
        filePaths: metadata.filePaths,
      }))
    ).toEqual([
      {
        dataFormat: 'ICU',
        source: 'From TypeScript',
        context: undefined,
        filePaths: ['src/lib/a.ts'],
      },
      {
        dataFormat: 'JSX',
        source: ['Hello ', { i: 1, v: 'v' }],
        context: 'greeting',
        filePaths: ['src/lib/Other.svelte', 'src/routes/+page.svelte'],
      },
      {
        dataFormat: 'ICU',
        source: 'Bye',
        context: 'farewell',
        filePaths: ['src/lib/Other.svelte', 'src/routes/+page.svelte'],
      },
    ]);
  });

  it('keeps .svelte files out of explicit primary patterns', async () => {
    const projectRoot = createProject({ 'app/Page.svelte': GREETING });
    const plan = planSvelteExtraction({
      library: 'gt-svelte',
      projectRoot,
      filePatterns: ['app/**/*'],
    });
    if (!plan.handled) throw new Error('expected a plan');
    const primaryPatterns: (string[] | undefined)[] = [];
    const output = await plan.run({
      extractPrimary: async (patterns) => {
        primaryPatterns.push(patterns);
        return { updates: [], errors: [], warnings: [] };
      },
    });
    expect(primaryPatterns).toEqual([['app/**/*', '!**/*.svelte']]);
    expect(output.updates).toHaveLength(2);
  });

  it.each([
    ['a line comment', '// Sass comment\n  .accent { color: red; }'],
    ['a top-level variable', '$accent: red;\n  .accent { color: $accent; }'],
    ['interpolation', '.accent { #{$prop}: 1px; }'],
  ])(
    'extracts components whose <style lang="scss"> has %s',
    async (_label, scss) => {
      const projectRoot = createProject({
        'src/routes/+page.svelte': `<script>
  import { T } from 'gt-svelte';
</script>

<p><T>Styled <b class="accent">text</b></T></p>

<style lang="scss">
  ${scss}
</style>
`,
      });
      const plan = planSvelteExtraction({ library: 'gt-svelte', projectRoot });
      if (!plan.handled) throw new Error('expected a plan');
      const output = await plan.run();
      expect(output.errors).toEqual([]);
      expect(output.updates.map((update) => update.source)).toEqual([
        ['Styled ', { t: 'b', i: 1, c: 'text' }],
      ]);
    }
  );

  it('reports invalid ICU messages as warnings and leaves them out', async () => {
    const projectRoot = createProject({
      'src/A.svelte': `<script>
  import { useGT } from 'gt-svelte';
  const t = useGT();
</script>
<p>{t('Hello {name', { name: 'x' })}</p>`,
    });
    const plan = planSvelteExtraction({ library: 'gt-svelte', projectRoot });
    if (!plan.handled) throw new Error('expected a plan');
    const output = await plan.run();
    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([
      expect.stringMatching(
        /^src\/A\.svelte \(5:7\): Found invalid ICU string "Hello \{name"/
      ),
    ]);
    expect(output.updates).toEqual([]);
  });

  it('reports the $format of each string as its data format', async () => {
    const projectRoot = createProject({
      'src/A.svelte': `<script>
  import { useGT } from 'gt-svelte';
  const t = useGT();
</script>
<p>{t('Literal {braces}', { $format: 'STRING' })}</p>
<p>{t('Hello')}</p>`,
    });
    const plan = planSvelteExtraction({ library: 'gt-svelte', projectRoot });
    if (!plan.handled) throw new Error('expected a plan');
    const output = await plan.run();
    expect(output.errors).toEqual([]);
    expect(
      output.updates.map(({ source, dataFormat }) => ({ source, dataFormat }))
    ).toEqual([
      { source: 'Literal {braces}', dataFormat: 'STRING' },
      { source: 'Hello', dataFormat: 'ICU' },
    ]);
  });

  it('includes source code context when asked', async () => {
    const page = `<script>
  import { T } from 'gt-svelte';
</script>
<T>Hello</T>
`;
    const projectRoot = createProject({
      'src/A.svelte': page,
      'src/B.svelte': page,
    });
    for (const includeSourceCodeContext of [false, true]) {
      const plan = planSvelteExtraction({
        library: 'gt-svelte',
        projectRoot,
        includeSourceCodeContext,
      });
      if (!plan.handled) throw new Error('expected a plan');
      const [update] = (await plan.run()).updates;
      const entry = {
        before: "<script>\n  import { T } from 'gt-svelte';\n</script>",
        target: '<T>Hello</T>',
        after: '',
      };
      expect(update.metadata.sourceCode).toEqual(
        includeSourceCodeContext
          ? { 'src/A.svelte': [entry], 'src/B.svelte': [entry] }
          : undefined
      );
    }
  });

  it('extracts files in dist directories and explicitly listed files', async () => {
    const page = (text: string) => `<script>
  import { T } from 'gt-svelte';
</script>
<T>${text}</T>`;
    const projectRoot = createProject({
      'src/routes/dist/+page.svelte': page('Distributors'),
      'src/node_modules/pkg/Dependency.svelte': page('Dependency'),
      'node_modules/pkg/Listed.svelte': page('Listed'),
    });
    const sourcesFor = async (filePatterns?: string[]) =>
      (await extractFromSvelteProject(projectRoot, filePatterns)).updates.map(
        (update) => update.source
      );

    expect(await sourcesFor()).toEqual(['Distributors']);
    expect(await sourcesFor(['src/routes/dist/+page.svelte'])).toEqual([
      'Distributors',
    ]);
    expect(
      await sourcesFor(['**/*.svelte', 'node_modules/pkg/Listed.svelte'])
    ).toEqual(['Listed', 'Distributors']);
    expect(
      await sourcesFor(['node_modules/pkg/Listed.svelte', '!**/Listed.svelte'])
    ).toEqual([]);
  });
});

describe('extractFromSvelteModule', () => {
  // The ESTree output the host CLI passes for JavaScript and TypeScript.
  const parse = (source: string) =>
    parseSync(source, {
      configFile: false,
      babelrc: false,
      sourceType: 'module',
      parserOpts: { plugins: ['estree', 'typescript'] },
    })!.program;
  const relativePath = 'src/lib/messages.ts';

  it('extracts the string calls a component script supports', () => {
    const output = extractFromSvelteModule(
      `import * as GT from 'gt-svelte';
import { msg as register, type GTFunctionType } from 'gt-svelte';
export const labels = register(['Save', 'Close' as string], { $id: 'labels' });
export function greet(name: string): string {
  const t: GTFunctionType = GT.useGT();
  return t('Hello, ' + '{name}!', { name, $context: 'greeting', $maxChars: 20 });
}
export const raw = register('{braces}', { $format: 'STRING' });
`,
      { relativePath, parse }
    );

    expect(output.warnings).toEqual([]);
    expect(output.errors).toEqual([
      'src/lib/messages.ts (3:41): Translated strings must be string literals. Pass a string literal and supply dynamic values as ICU variables in the options.',
    ]);
    expect(output.updates).toEqual([
      {
        dataFormat: 'ICU',
        source: 'Save',
        metadata: {
          id: 'labels.0',
          hash: hashSource({ source: 'Save', dataFormat: 'ICU' }),
          filePaths: [relativePath],
        },
      },
      {
        dataFormat: 'ICU',
        source: 'Hello, {name}!',
        metadata: {
          context: 'greeting',
          maxChars: 20,
          hash: hashSource({
            source: 'Hello, {name}!',
            context: 'greeting',
            maxChars: 20,
            dataFormat: 'ICU',
          }),
          filePaths: [relativePath],
        },
      },
      {
        dataFormat: 'STRING',
        source: '{braces}',
        metadata: {
          hash: hashSource({ source: '{braces}', dataFormat: 'STRING' }),
          filePaths: [relativePath],
        },
      },
    ]);
  });

  it('includes source code context when asked', () => {
    const source = `import { msg } from 'gt-svelte';

export const save = msg('Save');
`;
    const [update] = extractFromSvelteModule(source, {
      relativePath,
      parse,
      includeSourceCodeContext: true,
    }).updates;
    expect(update.metadata.sourceCode).toEqual({
      [relativePath]: [
        {
          before: "import { msg } from 'gt-svelte';\n",
          target: "export const save = msg('Save');",
          after: '',
        },
      ],
    });
  });

  it('skips modules that do not import gt-svelte', () => {
    const parseModule = vi.fn(parse);
    const empty = { updates: [], errors: [], warnings: [] };
    expect(
      extractFromSvelteModule(`export const save = msg('Save');`, {
        relativePath,
        parse: parseModule,
      })
    ).toEqual(empty);
    expect(parseModule).not.toHaveBeenCalled();
    expect(
      extractFromSvelteModule(
        `import { msg } from 'gt-react'; // not gt-svelte\nmsg('Save');`,
        { relativePath, parse }
      )
    ).toEqual(empty);
  });
});
