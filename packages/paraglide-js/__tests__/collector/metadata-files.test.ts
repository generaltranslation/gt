import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

import { OutdirProjects } from '../../src/compiler/collector/outdir-projects.js';
import { MetadataFiles } from '../../src/compiler/collector/metadata-files.js';
import type { CollectContextOptions } from '../../src/compiler/context.js';
import { readInlangProject } from '../../src/compiler/inlang/project.js';

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

afterEach(() => {
  vi.restoreAllMocks();
});

/** A source file whose only line uses `greeting`. */
const usages = (file: string, line: string) => ({
  file,
  code: line,
  usages: [
    {
      target: 'message',
      name: 'greeting',
      kind: 'call' as const,
      start: 0,
      end: 5,
      line: 1,
      column: 1,
      endLine: 1,
      targetFile: '/app/src/paraglide/messages.js',
      inlangProject: 'project.inlang',
    },
  ],
});

/** The metadata files of a new project's `project.inlang`, with one usage to write. */
async function metadataFiles(
  name: string,
  projectFiles: Record<string, string> = {},
  maxParsedBytes?: number
) {
  const root = await writeProject(name, projectFiles);
  const files = new MetadataFiles(root, 0, maxParsedBytes);
  files.addProject(
    (await readInlangProject(path.join(root, 'project.inlang')))!
  );
  files.add(usages('a.ts', 'first'));

  const written = () => fs.readdir(path.join(root, 'messages'));

  return { root, files, written };
}

const failure = (code: string) => Object.assign(new Error(code), { code });

/** The snippet `metadataFiles` writes for `greeting`. */
const firstSourceCode = {
  'a.ts': [{ before: '', target: 'first', after: '' }],
};

test('writes the usages of every source file, and no temporary file', async () => {
  const { root, files, written } = await metadataFiles('metadata-unit');
  files.add(usages('b.ts', 'other'));

  expect(await files.write()).toEqual([]);
  expect(await readSnippets(root)).toEqual(['a.ts: first', 'b.ts: other']);
  expect((await written()).sort()).toEqual(['en.json', 'en.metadata.json']);
});

test('a write that fails leaves no temporary file', async () => {
  const { root, files, written } = await metadataFiles('metadata-failed-write');
  vi.spyOn(fs, 'rename').mockRejectedValueOnce(failure('EXDEV'));

  await expect(files.write()).rejects.toMatchObject({ code: 'EXDEV' });
  expect(await written()).toEqual(['en.json']);

  // A later write is not affected.
  expect(await files.write()).toEqual([]);
  expect(await readSnippets(root)).toEqual(['a.ts: first']);
});

test('a temporary file that was only partly written is removed', async () => {
  const { root, files, written } = await metadataFiles(
    'metadata-partial-write'
  );
  const open = fs.open.bind(fs);
  let isFirstWrite = true;
  vi.spyOn(fs, 'open').mockImplementation(async (file, flags) => {
    const handle = await open(file, flags);
    if (flags !== 'w' || !isFirstWrite) return handle;

    isFirstWrite = false;
    const write = handle.write.bind(handle);
    handle.write = (async () => {
      await write('{ "greeting": ');
      throw failure('ENOSPC');
    }) as typeof handle.write;

    return handle;
  });

  await expect(files.write()).rejects.toMatchObject({ code: 'ENOSPC' });
  expect(await written()).toEqual(['en.json']);

  // A later write is not affected.
  expect(await files.write()).toEqual([]);
  expect((await written()).sort()).toEqual(['en.json', 'en.metadata.json']);
  expect(await readSnippets(root)).toEqual(['a.ts: first']);
});

test('a write that stops short is continued', async () => {
  const { root, files } = await metadataFiles('metadata-short-write');
  const open = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (file, flags) => {
    const handle = await open(file, flags);
    if (flags !== 'w') return handle;

    // As at a file size limit, each write takes 3 bytes at most.
    const write = handle.write.bind(handle);
    handle.write = ((buffer: Buffer, offset = 0) =>
      write(
        buffer,
        offset,
        Math.min(3, buffer.length - offset)
      )) as typeof handle.write;

    return handle;
  });

  expect(await files.write()).toEqual([]);
  expect(
    await fs.readFile(path.join(root, 'messages/en.metadata.json'), 'utf8')
  ).toBe(
    `${JSON.stringify({ greeting: { sourceCode: firstSourceCode } }, null, 2)}\n`
  );
});

test('a metadata file that cannot be read is left alone, with a warning', async () => {
  const { root, files } = await metadataFiles('metadata-unreadable');
  const file = path.join(root, 'messages/en.metadata.json');
  const handWritten = JSON.stringify({
    greeting: { context: 'On the home page' },
  });
  await fs.writeFile(file, handWritten);

  const open = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation((path, flags) =>
    path === file && flags === 'r'
      ? Promise.reject(failure('EACCES'))
      : open(path, flags)
  );
  expect(await files.write()).toEqual([
    { file, reason: 'it could not be read (EACCES)' },
  ]);
  vi.restoreAllMocks();

  expect(await fs.readFile(file, 'utf8')).toBe(handWritten);
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

// The file is parsed member by member, as one too long to parse at once is.
test.each([
  [
    'a message',
    { sourceCode: 'Source code' },
    { sourceCode: { context: 'A heading' } },
  ],
  [
    'a group',
    { sourceCode: { title: 'Title' } },
    { sourceCode: { title: { context: 'A heading' } } },
  ],
  [
    'a message in a group',
    { nav: { sourceCode: 'Source code' } },
    { nav: { sourceCode: { context: 'A link' } } },
  ],
])(
  '%s named sourceCode keeps its hand-written fields in a long metadata file',
  async (_, messages, handWritten) => {
    const { root, files } = await metadataFiles(
      'metadata-named-source-code',
      {
        'messages/en.json': JSON.stringify({ greeting: 'Hi', ...messages }),
        'messages/en.metadata.json': JSON.stringify(handWritten),
      },
      1
    );

    expect(await files.write()).toEqual([]);
    expect(await readMetadata(root)).toEqual({
      greeting: { sourceCode: firstSourceCode },
      ...handWritten,
    });
  }
);

test('a long metadata file with invalid JSON in the sourceCode it rewrites is left alone, with a warning', async () => {
  const invalid =
    '{ "greeting": { "context": "Hi", "sourceCode": { "a.ts": tru } } }';
  const { root, files } = await metadataFiles(
    'metadata-invalid-source-code',
    { 'messages/en.metadata.json': invalid },
    1
  );
  const file = path.join(root, 'messages/en.metadata.json');

  expect(await files.write()).toEqual([
    { file, reason: 'it is not a JSON object; fix or delete it' },
  ]);
  expect(await fs.readFile(file, 'utf8')).toBe(invalid);
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
  const afterRemoval = new OutdirProjects({
    configured: undefined,
    searchDirectories: [root],
  });
  expect(await afterRemoval.pair(outdir, catalog)).toMatchObject({
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
