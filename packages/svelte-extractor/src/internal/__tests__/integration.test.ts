import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
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
  const gt = useGT();
  let { name } = $props();
</script>
<T context="greeting">Hello <Var>{name}</Var></T>
<p>{gt('Bye', { $context: 'farewell' })}</p>`;

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
        source: ['Hello ', { i: 1, k: '_gt_value_1', v: 'v' }],
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
  const gt = useGT();
</script>
<p>{gt('Hello {name', { name: 'x' })}</p>`,
    });
    const plan = planSvelteExtraction({ library: 'gt-svelte', projectRoot });
    if (!plan.handled) throw new Error('expected a plan');
    const output = await plan.run();
    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([
      expect.stringMatching(
        /^src\/A\.svelte \(5:8\): Found invalid ICU string "Hello \{name"/
      ),
    ]);
    expect(output.updates).toEqual([]);
  });

  it('reports the $format of each string as its data format', async () => {
    const projectRoot = createProject({
      'src/A.svelte': `<script>
  import { useGT } from 'gt-svelte';
  const gt = useGT();
</script>
<p>{gt('Literal {braces}', { $format: 'STRING' })}</p>
<p>{gt('Hello')}</p>`,
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
