import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { LOCK_FILE } from '../../src/compiler/collector/usage-cache.js';
import { collect, readMetadata, writeProject } from '../helpers/fixture.js';

const LOCK = `${JSON.stringify({ version: 2, branchId: '', entries: [] }, null, 2)}\n`;

/** Values flow between modules: into a helper's parameter, through a barrel. */
const PROJECT: Record<string, string> = {
  'src/label.ts': `export function label(message: () => string) { return message(); }`,
  'src/index.ts': `export * from "./label";`,
  'src/page.tsx': [
    `import { m } from "./paraglide/messages.js";`,
    `import { label } from "./label";`,
    `export const Page = () => <h1>{m.greeting()}{label(m.greeting)}</h1>;`,
  ].join('\n'),
  'src/other.tsx': [
    `import { m } from "./paraglide/messages.js";`,
    `import { label } from "./index";`,
    `export const Other = () => <p>{label(m.greeting)}</p>;`,
  ].join('\n'),
  'src/plain.ts': `export const answer = 42;`,
};

type Change = Record<string, string | null>;

/** Each edits the project the last one left. */
const CHANGES: Array<[string, Change]> = [
  ['nothing', {}],
  [
    'a call in a page',
    {
      'src/page.tsx': PROJECT['src/page.tsx']!.replace(
        '{m.greeting()}',
        '{m.greeting()}{m.greeting()}'
      ),
    },
  ],
  [
    'a new caller of the helper',
    {
      'src/new.tsx': [
        `import { m } from "./paraglide/messages.js";`,
        `import { label } from "./index";`,
        `export const New = () => label(m.greeting);`,
      ].join('\n'),
    },
  ],
  ['a removed caller', { 'src/other.tsx': null }],
  [
    'the helper',
    {
      'src/label.ts': `export function label(message: () => string) { return message() + message(); }`,
    },
  ],
  [
    'the barrel',
    { 'src/index.ts': `export { label as label } from "./label";` },
  ],
  ['an unrelated file', { 'src/plain.ts': `export const answer = 43;` }],
];

async function apply(root: string, change: Change): Promise<void> {
  for (const [file, content] of Object.entries(change)) {
    const target = path.join(root, file);
    if (content === null) await fs.rm(target);
    else await fs.writeFile(target, content);
  }
}

test('a run that reuses the last one finds what a cold run finds, change after change', async () => {
  const warm = await writeProject('analysis-cache-warm', {
    ...PROJECT,
    [LOCK_FILE]: LOCK,
  });
  await collect(warm);

  const project = { ...PROJECT };
  for (const [name, change] of CHANGES) {
    for (const [file, content] of Object.entries(change)) {
      if (content === null) delete project[file];
      else project[file] = content;
    }

    await apply(warm, change);
    const reused = await collect(warm);

    // The same project, from scratch.
    const cold = await writeProject('analysis-cache-cold', project);
    const fresh = await collect(cold);

    expect(await readMetadata(warm), name).toEqual(await readMetadata(cold));
    expect(reused.usages, name).toEqual(fresh.usages);
    expect(reused.warnings, name).toEqual(fresh.warnings);
  }
});

test('an unchanged project is not analyzed again', async () => {
  const root = await writeProject('analysis-cache-reused', {
    ...PROJECT,
    [LOCK_FILE]: LOCK,
  });
  await collect(root);

  const { info } = await collect(root);
  expect(info.join('\n')).toMatch(/5 file\(s\) analyzed as in the last run/);
});

test('changing a file the helper does not see leaves the helper reused', async () => {
  const root = await writeProject('analysis-cache-partial', {
    ...PROJECT,
    [LOCK_FILE]: LOCK,
  });
  await collect(root);

  await apply(root, { 'src/plain.ts': `export const answer = 43;` });
  const { info } = await collect(root);
  // All but plain.ts.
  expect(info.join('\n')).toMatch(/4 file\(s\) analyzed as in the last run/);
});

test('a component a language generates a module for is generated only if a file is analyzed', async () => {
  const files = {
    'src/Card.svelte': `<script>\n  import { m } from "./paraglide/messages.js";\n  import { label } from "./label";\n</script>\n<p title={label(m.greeting)}></p>\n`,
    'src/label.ts': PROJECT['src/label.ts']!,
    'src/plain.ts': PROJECT['src/plain.ts']!,
  };
  const root = await writeProject('analysis-cache-svelte', {
    ...files,
    [LOCK_FILE]: LOCK,
  });
  const first = await collect(root);

  // Only messages changed: nothing is analyzed, and the component is not generated.
  await apply(root, {
    'messages/en.json': JSON.stringify({ greeting: 'Hello' }),
  });
  const reused = await collect(root);
  expect(reused.info.join('\n')).toMatch(
    /3 file\(s\) indexed as in the last run/
  );
  expect(reused.info.join('\n')).toMatch(
    /3 file\(s\) analyzed as in the last run/
  );
  expect(reused.usages).toEqual(first.usages);

  // A changed file is analyzed: the component's module is generated, as the analysis may load it.
  const change = {
    'src/label.ts': `export function label(message: () => string) { return message() + message(); }`,
  };
  await apply(root, change);
  const warm = await collect(root);
  const cold = await writeProject('analysis-cache-svelte-cold', {
    ...files,
    ...change,
  });
  const fresh = await collect(cold);

  expect(await readMetadata(root)).toEqual(await readMetadata(cold));
  expect(warm.usages).toEqual(fresh.usages);
  expect(warm.warnings).toEqual(fresh.warnings);
});
