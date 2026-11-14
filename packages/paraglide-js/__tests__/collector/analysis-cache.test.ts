import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  readFile,
  trackReads,
  tracked,
} from '../../src/compiler/analysis/reads.js';
import {
  LOCK_FILE,
  SECTION,
} from '../../src/compiler/collector/usage-cache.js';
import { collect, readMetadata, writeProject } from '../helpers/fixture.js';

const LOCK = `${JSON.stringify({ version: 2, branchId: '', entries: [] }, null, 2)}\n`;
const CACHED = { cache: true };

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
  await collect(warm, CACHED);

  const project = { ...PROJECT };
  for (const [name, change] of CHANGES) {
    for (const [file, content] of Object.entries(change)) {
      if (content === null) delete project[file];
      else project[file] = content;
    }

    await apply(warm, change);
    const reused = await collect(warm, CACHED);

    // The same project, from scratch.
    const cold = await writeProject('analysis-cache-cold', project);
    const fresh = await collect(cold);

    expect(await readMetadata(warm), name).toEqual(await readMetadata(cold));
    expect(reused.usages, name).toEqual(fresh.usages);
    expect(reused.warnings, name).toEqual(fresh.warnings);
  }
});

test('reads are recorded only while a run that keeps a cache goes on', () => {
  const read = () => tracked(() => readFile('/app/src/a.ts')).reads.files;

  expect(read()).toEqual(new Set());
  const stopFirst = trackReads();
  const stopSecond = trackReads();
  stopSecond();
  stopSecond();
  expect(read()).toEqual(new Set(['/app/src/a.ts']));
  stopFirst();
  expect(read()).toEqual(new Set());
});

test('an unchanged project is not analyzed again', async () => {
  const root = await writeProject('analysis-cache-reused', {
    ...PROJECT,
    [LOCK_FILE]: LOCK,
  });
  await collect(root, CACHED);

  const { info } = await collect(root, CACHED);
  expect(info.join('\n')).toMatch(/5 file\(s\) analyzed as in the last run/);
});

test('changing a file the helper does not see leaves the helper reused', async () => {
  const root = await writeProject('analysis-cache-partial', {
    ...PROJECT,
    [LOCK_FILE]: LOCK,
  });
  await collect(root, CACHED);

  await apply(root, { 'src/plain.ts': `export const answer = 43;` });
  const { info } = await collect(root, CACHED);
  // All but plain.ts.
  expect(info.join('\n')).toMatch(/4 file\(s\) analyzed as in the last run/);
});

test('an auto-imported module is seen to change', async () => {
  const files = {
    // A usage that stays: a run that finds none leaves the metadata file as it was.
    'src/main.ts': `import { m } from "./paraglide/messages.js";\nexport const main = m.greeting();\n`,
    'src/other.ts': 'export const text = t.greeting();\n',
    'src/i18n.ts': `export { m as t } from "./paraglide/messages.js";\n`,
    'auto-imports.d.ts': [
      'export {}',
      'declare global {',
      "  const t: typeof import('./src/i18n')['t']",
      '}',
    ].join('\n'),
  };
  const root = await writeProject('analysis-cache-auto-import', {
    ...files,
    [LOCK_FILE]: LOCK,
  });
  expect((await collect(root, CACHED)).usages).toHaveLength(2);

  // `t` no longer holds the messages: src/other.ts uses none.
  const change = {
    'src/i18n.ts': `export const t = { greeting: () => "Hi" };\n`,
  };
  await apply(root, change);
  const cold = await writeProject('analysis-cache-auto-import-cold', {
    ...files,
    ...change,
  });

  expect((await collect(root, CACHED)).usages).toEqual(
    (await collect(cold)).usages
  );
  expect(await readMetadata(root)).toEqual(await readMetadata(cold));
});

test('a file whose imports resolve to other files is analyzed again, though no file it read changed', async () => {
  const tsconfig = (first: string, second: string) =>
    JSON.stringify({
      compilerOptions: { paths: { '@first': [first], '@second': [second] } },
    });
  const files = {
    'src/calls.ts': `export function pick(message: () => string) { return message(); }`,
    'src/ignores.ts': `export function pick(message: () => string) { return "none"; }`,
    'src/page.ts': [
      `import { m } from "./paraglide/messages.js";`,
      `import { pick } from "@first";`,
      `import "@second";`,
      `export const texts = [m.greeting(), pick(m.greeting)];`,
    ].join('\n'),
  };
  const root = await writeProject('analysis-cache-alias', {
    ...files,
    'tsconfig.json': tsconfig('./src/calls.ts', './src/ignores.ts'),
    [LOCK_FILE]: LOCK,
  });
  await collect(root, CACHED);

  // The same files, swapped.
  const change = {
    'tsconfig.json': tsconfig('./src/ignores.ts', './src/calls.ts'),
  };
  await apply(root, change);
  const cold = await writeProject('analysis-cache-alias-cold', {
    ...files,
    ...change,
  });

  expect((await collect(root, CACHED)).usages).toEqual(
    (await collect(cold)).usages
  );
  expect(await readMetadata(root)).toEqual(await readMetadata(cold));
});

test("a lock file holding lines of two branches, as git's text merge leaves it, finds what a cold run finds", async () => {
  const base = {
    // A usage that stays: a run that finds none leaves the metadata file as it was.
    'src/main.ts': `import { m } from "./paraglide/messages.js";\nexport const main = m.greeting();\n`,
    'src/label.ts': `export const label = () => "none";`,
    'src/page.ts': [
      `import { label } from "./label";`,
      `export const page = label();`,
    ].join('\n'),
  };
  // Each branch changes one file: the page, or the label it calls.
  const ours = {
    'src/page.ts': `${base['src/page.ts']}\nexport const more = 1;`,
  };
  const theirs = {
    'src/label.ts': `import { m } from "./paraglide/messages.js";\nexport const label = m.greeting;`,
  };

  const sectionOf = async (name: string, files: Record<string, string>) => {
    const root = await writeProject(name, { ...files, [LOCK_FILE]: LOCK });
    await collect(root, CACHED);
    const lock = JSON.parse(
      await fs.readFile(path.join(root, LOCK_FILE), 'utf8')
    );

    return lock[SECTION] as { files: Record<string, string> };
  };
  const ourSection = await sectionOf('analysis-cache-ours', {
    ...base,
    ...ours,
  });
  const theirSection = await sectionOf('analysis-cache-theirs', {
    ...base,
    ...theirs,
  });

  // Each file's line from the branch that changed it.
  const merged = {
    ...ourSection,
    files: {
      ...ourSection.files,
      'src/label.ts': theirSection.files['src/label.ts']!,
    },
  };
  const files = { ...base, ...ours, ...theirs };
  const root = await writeProject('analysis-cache-merged', {
    ...files,
    [LOCK_FILE]: `${JSON.stringify({ ...JSON.parse(LOCK), [SECTION]: merged }, null, 2)}\n`,
  });
  const cold = await writeProject('analysis-cache-merged-cold', files);

  expect((await collect(root, CACHED)).usages).toEqual(
    (await collect(cold)).usages
  );
  expect(await readMetadata(root)).toEqual(await readMetadata(cold));
});

test('an outdir found in an import, then rejected, leaves no analysis reused', async () => {
  const root = await writeProject('analysis-cache-outdir', {
    // Not among the files the run lists: found where a file imports it.
    '.gitignore': 'src/paraglide\n',
    'src/page.ts': `import { m } from "./paraglide/messages.js";\nexport const page = m.greeting();\n`,
    [LOCK_FILE]: LOCK,
  });
  expect((await collect(root, CACHED)).info.join('\n')).toMatch(
    /outdirs: src\/paraglide/
  );

  // No file the analysis read changed: it found its usage in the outdir.
  await fs.rm(path.join(root, 'src/paraglide/registry.js'));
  const { info } = await collect(root, CACHED);

  expect(info.join('\n')).not.toMatch(/outdirs: src\/paraglide/);
  expect(info.join('\n')).not.toMatch(/analyzed as in the last run/);
});

test("a template whose scope an earlier file's analysis built sees its component change", async () => {
  const files = {
    // A usage that stays: a run that finds none leaves the metadata file as it was.
    'src/main.ts': `import { m } from "./paraglide/messages.js";\nexport const main = m.greeting();\n`,
    // Analyzed before the template: reading its export builds its scope.
    'src/app/a.ts': `import widget from "./widget.html";\nwidget();\n`,
    'src/app/widget.html': `<p>{{ m.greeting() }}</p>`,
    'src/app/widget.ts': [
      `import { Component } from "@angular/core";`,
      `import { m } from "../paraglide/messages.js";`,
      `@Component({ selector: "app-widget", templateUrl: "./widget.html" })`,
      `export class Widget { readonly m = m; }`,
    ].join('\n'),
  };
  const root = await writeProject('analysis-cache-template', {
    ...files,
    [LOCK_FILE]: LOCK,
  });
  expect((await collect(root, CACHED)).usages).toHaveLength(2);

  // The field no longer holds the messages: the template uses none.
  const change = {
    'src/app/widget.ts': files['src/app/widget.ts'].replace(
      'readonly m = m;',
      'readonly m = { greeting: () => "Hi" };'
    ),
  };
  await apply(root, change);
  const cold = await writeProject('analysis-cache-template-cold', {
    ...files,
    ...change,
  });

  const { usages } = await collect(root, CACHED);
  expect(usages).toEqual((await collect(cold)).usages);
  expect(usages).toHaveLength(1);
  expect(await readMetadata(root)).toEqual(await readMetadata(cold));
});

test.each([
  ['', {}],
  [
    ", whose list of names an earlier file's analysis made",
    { 'src/early.ts': `import { early } from "./a";\nearly();\n` },
  ],
])(
  'a module two `export *` deep is seen to change%s',
  async (_, earlier: Record<string, string>) => {
    const files = {
      ...earlier,
      // A usage that stays: a run that finds none leaves the metadata file as it was.
      'src/main.ts': `import { m } from "./paraglide/messages.js";\nexport const main = m.greeting();\n`,
      'src/page.ts': `import { text } from "./a";\nexport const page = text();\n`,
      'src/a.ts': `export * from "./b";\nexport * from "./x";\n`,
      'src/b.ts': `export * from "./c";\n`,
      // Read only for its names: `text` is not among them.
      'src/c.ts': `export const other = 1;\n`,
      'src/x.ts': `export const text = () => "plain";\n`,
    };
    const root = await writeProject('analysis-cache-barrels', {
      ...files,
      [LOCK_FILE]: LOCK,
    });
    expect((await collect(root, CACHED)).usages).toHaveLength(1);

    // `text` is now found through b, before x: the page uses a message.
    const change = {
      'src/c.ts': `import { m } from "./paraglide/messages.js";\nexport const text = m.greeting;\n`,
    };
    await apply(root, change);
    const cold = await writeProject('analysis-cache-barrels-cold', {
      ...files,
      ...change,
    });

    const { usages } = await collect(root, CACHED);
    expect(usages).toEqual((await collect(cold)).usages);
    expect(usages).toHaveLength(2);
    expect(await readMetadata(root)).toEqual(await readMetadata(cold));
  }
);
