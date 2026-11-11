import { expect, test } from 'vitest';
import { renderMetadataFile } from '../../lib/compiler/output/metadata.js';
import type {
  FileUsages,
  ParaglideUsage,
} from '../../lib/compiler/analysis/types.js';
import { analyzeProject } from '../helpers/project.js';

const PROJECT = 'project.inlang';
const CODE = ['one', 'two', 'three', 'four'].join('\n');

const key = (id: string, path = [id]) => ({ id, path });

/** A usage of `name` on `line` of a file. */
function usage(
  name: string,
  line: number,
  fields: Partial<ParaglideUsage> = {}
): ParaglideUsage {
  return {
    target: 'message',
    name,
    kind: 'call',
    expression: `m.${name}()`,
    start: line * 100,
    end: line * 100 + 5,
    line,
    column: 1,
    endLine: line,
    resolution: ['src/paraglide/messages.js'],
    inlangProject: PROJECT,
    ...fields,
  };
}

const source = (file: string, usages: ParaglideUsage[]): FileUsages => ({
  file,
  code: CODE,
  usages,
});

const render = (
  keys: ReturnType<typeof key>[],
  sourceFiles: FileUsages[],
  existing: Record<string, unknown> = {}
) =>
  renderMetadataFile({
    keys,
    sourceFiles,
    inlangProject: PROJECT,
    radius: 1,
    existing,
  });

test('each used message gets the lines around its usages, by source file', () => {
  const metadata = render(
    [key('save'), key('unused'), key('cancel')],
    [
      source('src/b.ts', [usage('save', 4)]),
      source('src/a.ts', [usage('cancel', 1), usage('save', 2)]),
    ]
  );
  expect(metadata).toEqual({
    save: {
      sourceCode: {
        'src/a.ts': [{ before: 'one', target: 'two', after: 'three' }],
        'src/b.ts': [{ before: 'three', target: 'four', after: '' }],
      },
    },
    cancel: {
      sourceCode: {
        'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
      },
    },
  });
  // In the message file's order; source files sorted.
  expect(Object.keys(metadata)).toEqual(['save', 'cancel']);
  expect(
    Object.keys((metadata.save as { sourceCode: object }).sourceCode)
  ).toEqual(['src/a.ts', 'src/b.ts']);
});

test('the metadata is nested like the message file', () => {
  const keys = [key('nav.home', ['nav', 'home']), key('a.b', ['a.b'])];
  const files = [source('src/a.ts', [usage('nav.home', 1), usage('a.b', 1)])];
  const sourceCode = {
    'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
  };
  expect(render(keys, files)).toEqual({
    nav: { home: { sourceCode } },
    'a.b': { sourceCode },
  });
});

test("messages the file does not define, and other projects' usages, are left out", () => {
  const files = [
    source('src/a.ts', [
      usage('elsewhere', 1),
      usage('save', 2, { inlangProject: 'admin.inlang' }),
      usage('save', 3, { inlangProject: undefined }),
    ]),
  ];
  expect(render([key('save')], files)).toEqual({});
});

test('hand-written fields are kept; sourceCode and removed messages are not', () => {
  const existing = {
    save: {
      context: 'A button',
      maxChars: 10,
      sourceCode: { 'src/old.ts': [] },
    },
    unused: { context: 'Not used yet', sourceCode: { 'src/old.ts': [] } },
    removed: { context: 'No longer a message' },
    nav: { home: { maxChars: 20 } },
  };
  const keys = [key('save'), key('unused'), key('nav.home', ['nav', 'home'])];
  const files = [source('src/a.ts', [usage('save', 1)])];
  expect(render(keys, files, existing)).toEqual({
    save: {
      context: 'A button',
      maxChars: 10,
      sourceCode: {
        'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
      },
    },
    unused: { context: 'Not used yet' },
    nav: { home: { maxChars: 20 } },
  });
});

test('a dynamic name goes to every message it matches; `*` alone to none', () => {
  const keys = [key('error_404'), key('error_500'), key('save')];
  const files = [
    source('src/a.ts', [
      usage('error_*', 1, { dynamic: true }),
      usage('*', 2, { dynamic: true }),
    ]),
  ];
  const sourceCode = {
    'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
  };
  expect(render(keys, files)).toEqual({
    error_404: { sourceCode },
    error_500: { sourceCode },
  });
});

test('usages on the same lines give one snippet', () => {
  const files = [
    source('src/a.ts', [
      usage('save', 2),
      usage('save', 2, { start: 250, end: 255 }),
      usage('save', 3),
    ]),
  ];
  expect(render([key('save')], files)).toEqual({
    save: {
      sourceCode: {
        'src/a.ts': [
          { before: 'one', target: 'two', after: 'three' },
          { before: 'two', target: 'three', after: 'four' },
        ],
      },
    },
  });
});

// Finding D1 of the paraglide-tests apps (FINDINGS.md): the output does not
// depend on the order the analysis found usages in.
test('usages at one spot (one prop, several values) render in a fixed order', async () => {
  const code = `<script>let { message } = $props();</script><em>{message()}</em>`;
  const usages = await analyzeProject(
    {
      '/app/src/Label.svelte': code,
      '/app/src/A.svelte': `<script>import { m } from "./paraglide/messages.js"; import Label from "./Label.svelte";</script><Label message={m.zeta} />`,
      '/app/src/B.svelte': `<script>import { m } from "./paraglide/messages.js"; import Label from "./Label.svelte";</script><Label message={m.alpha} />`,
    },
    { entry: '/app/src/Label.svelte', loadAll: true }
  );
  expect(usages).toHaveLength(2);
  const tagged = usages.map((found) => ({ ...found, inlangProject: PROJECT }));
  const renderOrdered = (ordered: ParaglideUsage[]) =>
    JSON.stringify(
      render(
        [key('alpha'), key('zeta')],
        [
          { file: 'src/Label.svelte', code, usages: ordered },
          source('src/a.ts', [usage('zeta', 1), usage('alpha', 1)]),
        ]
      )
    );
  const forward = renderOrdered(tagged);
  expect(renderOrdered([...tagged].reverse())).toBe(forward);
  expect(forward).toContain('src/Label.svelte');
});
