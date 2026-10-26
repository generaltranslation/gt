import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { planSvelteExtraction } from '../../integration.js';

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
});
