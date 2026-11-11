import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { createCollector } from '../../lib/compiler/collector/create.js';
import { OutdirProjects } from '../../lib/compiler/collector/outdir-projects.js';
import { MetadataFiles } from '../../lib/compiler/collector/metadata-files.js';
import type { CollectContextOptions } from '../../lib/compiler/context.js';
import { nodeResolver } from '../../lib/compiler/resolver/node-resolver.js';
import {
  collect as collectProject,
  compileMessages,
  filesIn,
  readMetadata,
  readSnippets,
  writeProject,
} from '../helpers/fixture.js';

const settings = (pathPattern: string | string[], baseLocale = 'en') =>
  JSON.stringify({
    baseLocale,
    'plugin.inlang.messageFormat': { pathPattern },
  });

const use = (from: string, ...ids: string[]) =>
  [
    `import { m } from "${from}";`,
    ...ids.map((id) => `export const ${id} = m.${id}();`),
    '',
  ].join('\n');

/** Analyzes the project. Returns the warnings. */
async function collect(
  root: string,
  options: CollectContextOptions = {}
): Promise<string[]> {
  return (await collectProject(root, options)).warnings;
}

test('the latest analysis of each source file wins; writes are serialized', async () => {
  const root = await writeProject('metadata-unit', {});
  const files = new MetadataFiles(root, 0);

  const usages = (file: string, line: string) => ({
    file,
    code: line,
    usages: [
      {
        target: 'message',
        name: 'greeting',
        kind: 'call' as const,
        expression: 'm.greeting()',
        start: 0,
        end: 5,
        line: 1,
        column: 1,
        endLine: 1,
        resolution: ['src/paraglide/messages.js'],
        inlangProject: 'project.inlang',
      },
    ],
  });
  files.addProject(path.join(root, 'project.inlang'));
  files.set('/a.ts', usages('a.ts', 'first'));
  files.set('/b.ts', usages('b.ts', 'other'));
  files.set('/a.ts', usages('a.ts', 'second'));
  files.set('/b.ts', undefined);
  // Concurrent writes are serialized, and never leave a temporary file.
  await Promise.all([files.write(), files.write(), files.write()]);
  expect(await readSnippets(root)).toEqual(['a.ts: second']);
  expect((await fs.readdir(path.join(root, 'messages'))).sort()).toEqual([
    'en.json',
    'en.metadata.json',
  ]);
});

test('several inlang projects and message files: each file gets the usages of its own messages', async () => {
  const root = await writeProject('metadata-projects', {
    // Compiled from project.inlang, whose messages are in two files.
    ...filesIn('src/paraglide', await compileMessages(['greeting', 'login'])),
    'project.inlang/settings.json': settings([
      './messages/{locale}/common.json',
      './messages/{locale}/auth.json',
    ]),
    'messages/en/common.json': JSON.stringify({ greeting: 'Hi' }),
    'messages/en/auth.json': JSON.stringify({ login: 'Log in' }),
    // Compiled from admin.inlang, which also has a `greeting`.
    ...filesIn(
      'src/admin/paraglide',
      await compileMessages(['greeting', 'save', 'remove'])
    ),
    'admin.inlang/settings.json': settings('./admin/{locale}.json', 'fr'),
    'admin/fr.json': JSON.stringify({
      greeting: 'Salut',
      save: 'Enregistrer',
      remove: 'Supprimer',
    }),
    'src/app.ts': use('./paraglide/messages.js', 'greeting', 'login'),
    'src/admin/panel.ts': use('./paraglide/messages.js', 'greeting', 'save'),
  });

  expect(await collect(root)).toEqual([]);

  const files = (metadata: Awaited<ReturnType<typeof readMetadata>>) =>
    Object.fromEntries(
      Object.entries(metadata).map(([id, entry]) => [
        id,
        Object.keys(entry.sourceCode ?? {}),
      ])
    );
  expect(
    files(await readMetadata(root, 'messages/en/common.metadata.json'))
  ).toEqual({ greeting: ['src/app.ts'] });
  expect(
    files(await readMetadata(root, 'messages/en/auth.metadata.json'))
  ).toEqual({ login: ['src/app.ts'] });
  expect(files(await readMetadata(root, 'admin/fr.metadata.json'))).toEqual({
    greeting: ['src/admin/panel.ts'],
    save: ['src/admin/panel.ts'],
  });
  // The first project's default file name is not used.
  expect(await readMetadata(root)).toEqual({});
});

test('hand-written fields survive a rewrite; snippets of removed usages do not', async () => {
  const root = await writeProject('metadata-rewrite', {
    'src/a.ts': use('./paraglide/messages.js', 'greeting'),
    'messages/en.json': JSON.stringify({ greeting: 'Hi', later: 'Later' }),
    'messages/en.metadata.json': JSON.stringify({
      greeting: { context: 'Shown on the home page', maxChars: 20 },
      later: { context: 'Not used yet' },
      gone: { context: 'Removed from en.json' },
    }),
  });

  await collect(root);
  expect(await readMetadata(root)).toEqual({
    greeting: {
      context: 'Shown on the home page',
      maxChars: 20,
      sourceCode: {
        'src/a.ts': [
          {
            before: 'import { m } from "./paraglide/messages.js";',
            target: 'export const greeting = m.greeting();',
            after: '',
          },
        ],
      },
    },
    later: { context: 'Not used yet' },
  });

  // Still imported, so that the outdir and its project are known.
  await fs.writeFile(
    path.join(root, 'src/a.ts'),
    use('./paraglide/messages.js')
  );
  await collect(root);
  expect(await readMetadata(root)).toEqual({
    greeting: { context: 'Shown on the home page', maxChars: 20 },
    later: { context: 'Not used yet' },
  });
});

test('a collector that scans again drops the usages of files that are gone', async () => {
  const root = await writeProject('metadata-rescan', {
    'src/a.ts': use('./paraglide/messages.js', 'greeting'),
    'src/b.ts': use('./paraglide/messages.js', 'greeting'),
  });
  const collector = createCollector(
    {},
    { root, logger: { warn() {}, info() {} }, resolver: nodeResolver() }
  );
  const scan = async () => {
    await collector.scanAll();
    await collector.write();
    return Object.keys((await readMetadata(root)).greeting?.sourceCode ?? {});
  };

  expect(await scan()).toEqual(['src/a.ts', 'src/b.ts']);
  await fs.rm(path.join(root, 'src/b.ts'));
  expect(await scan()).toEqual(['src/a.ts']);
});

test('a metadata file that is not a JSON object is left alone, with a warning', async () => {
  const root = await writeProject('metadata-invalid', {
    'src/a.ts': use('./paraglide/messages.js', 'greeting'),
    'messages/en.metadata.json': '{ "greeting": { "context": "mid-edit" ',
  });

  expect(await collect(root)).toEqual([
    '[paraglide-context] messages/en.metadata.json was not updated: it is not a JSON object; fix or delete it',
  ]);
  expect(
    await fs.readFile(path.join(root, 'messages/en.metadata.json'), 'utf8')
  ).toBe('{ "greeting": { "context": "mid-edit" ');
});

test('no metadata file is created for messages that are not used', async () => {
  const root = await writeProject('metadata-unused', {
    'src/a.ts': 'export {};\n',
    // Loaded, so that the outdir is known.
    'src/b.ts': `import { m } from "./paraglide/messages.js";\nexport { m };\n`,
  });

  expect(await collect(root)).toEqual([]);
  expect(await fs.readdir(path.join(root, 'messages'))).toEqual(['en.json']);
});

test('an outdir without an inlang project is reported', async () => {
  const root = await writeProject('metadata-no-project', {
    'src/a.ts': use('./paraglide/messages.js', 'greeting'),
  });
  await fs.rm(path.join(root, 'project.inlang'), { recursive: true });

  expect(await collect(root)).toEqual([
    '[paraglide-context] no inlang project found for src/paraglide; its messages get no metadata file. ' +
      'List its project in the `inlangProjects` option.',
  ]);
});

test("an outdir's README names its project; configured projects replace it", async () => {
  const root = await writeProject('metadata-readme', {
    'i18n/shared.inlang/settings.json': settings('./{locale}.json'),
    'i18n/en.json': JSON.stringify({ other: 'Other' }),
  });
  const outdir = path.join(root, 'src/paraglide');
  const shared = path.join(root, 'i18n/shared.inlang');
  const detected = path.join(root, 'project.inlang');
  const catalog = new Set(['greeting']);
  await fs.writeFile(
    path.join(outdir, 'README.md'),
    `# Paraglide JS Compiled Output\n\nCompiled from: \`${shared}\`\n\n## What is this folder?\n`
  );

  const searching = new OutdirProjects({
    configured: undefined,
    searchDirectories: [root],
  });
  expect(await searching.pair(outdir, catalog)).toMatchObject({
    directory: shared,
  });
  expect(searching.of(outdir)).toBe(shared);

  const configured = new OutdirProjects({
    configured: [detected],
    searchDirectories: [],
  });
  expect(await configured.pair(outdir, catalog)).toMatchObject({
    directory: detected,
  });

  // A README that names a project that is gone, e.g. a committed outdir.
  await fs.rm(shared, { recursive: true });
  searching.clear();
  expect(await searching.pair(outdir, catalog)).toMatchObject({
    directory: detected,
  });
});

test('a project in another message format is reported', async () => {
  const root = await writeProject('metadata-other-format', {
    'src/a.ts': use('./paraglide/messages.js', 'greeting'),
    'project.inlang/settings.json': JSON.stringify({
      baseLocale: 'en',
      'plugin.inlang.i18next': { pathPattern: './messages/{locale}.json' },
    }),
  });

  expect(await collect(root)).toEqual([
    '[paraglide-context] project.inlang has no base-locale message files in the inlang message format ' +
      '(`plugin.inlang.messageFormat`); its messages get no metadata file',
  ]);
  expect(await readMetadata(root)).toEqual({});
});
