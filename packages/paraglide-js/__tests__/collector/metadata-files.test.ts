import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { native } from '../../src/compiler/analysis/native.js';
import { createCollector } from '../../src/compiler/collector/create.js';
import { OutdirProjects } from '../../src/compiler/collector/outdir-projects.js';
import type { CollectContextOptions } from '../../src/compiler/context.js';
import type { MetadataInput } from '../../src/compiler/output/metadata.js';
import { nodeResolver } from '../../src/compiler/resolver/node-resolver.js';
import {
  collect as collectProject,
  compileMessages,
  filesIn,
  readMetadata,
  readSnippets,
  useGreeting,
  writeProject,
} from '../helpers/fixture.js';

// The writes that fail part way, a rename that fails and a partly written
// temporary file, are tested in the crate that writes the files
// (`native/src/metadata/tests.rs`): there the file system can be made to fail.

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

/** Permissions do not hold for root, nor on Windows. */
const canLockFiles = process.platform !== 'win32' && process.getuid?.() !== 0;

/** What was made unreadable or unwritable, made accessible again for the next run. */
const locked: Array<{ file: string; mode: number }> = [];

async function lock(file: string, mode: number): Promise<void> {
  const { mode: previous } = await fs.stat(file);
  locked.push({ file, mode: previous });
  await fs.chmod(file, mode);
}

afterEach(async () => {
  for (const { file, mode } of locked.splice(0)) {
    await fs.chmod(file, mode).catch(() => undefined);
  }
});

const messagesOf = (root: string) => fs.readdir(path.join(root, 'messages'));
const metadataFile = (root: string) =>
  path.join(root, 'messages/en.metadata.json');

test('writes the usages of every source file, and no temporary file', async () => {
  const root = await writeProject('metadata-unit', {
    'src/b.ts': useGreeting('./paraglide/messages.js'),
    'src/a.ts': useGreeting('./paraglide/messages.js'),
  });

  expect(await collect(root)).toEqual([]);
  expect(await readSnippets(root)).toEqual([
    'src/a.ts: export const text = m.greeting();',
    'src/b.ts: export const text = m.greeting();',
  ]);
  expect((await messagesOf(root)).sort()).toEqual([
    'en.json',
    'en.metadata.json',
  ]);
});

test('a metadata file whose content did not change is not written again', async () => {
  const root = await writeProject('metadata-unchanged', {
    'src/a.ts': useGreeting('./paraglide/messages.js'),
  });

  await collect(root);
  const written = await fs.stat(metadataFile(root));

  await collect(root);
  // A write would be a new file, renamed onto it.
  expect((await fs.stat(metadataFile(root))).ino).toBe(written.ino);

  // A new usage changes it.
  await fs.writeFile(
    path.join(root, 'src/b.ts'),
    useGreeting('./paraglide/messages.js')
  );
  await collect(root);
  expect((await fs.stat(metadataFile(root))).ino).not.toBe(written.ino);
  expect(await readSnippets(root)).toHaveLength(2);
});

test('a metadata file is compared as JavaScript reads it: bytes that are not UTF-8 read as U+FFFD', async () => {
  const root = await writeProject('metadata-not-utf8', {
    'src/a.ts': useGreeting('./paraglide/messages.js'),
  });
  await collect(root);

  // The content it has, with a hand-written field whose byte is not UTF-8.
  const content = await fs.readFile(metadataFile(root), 'utf8');
  const notUtf8 = Buffer.from(
    content.replace(
      '{\n    "sourceCode"',
      '{\n    "context": "\u00ff",\n    "sourceCode"'
    ),
    'latin1'
  );
  await fs.writeFile(metadataFile(root), notUtf8);
  const before = await fs.stat(metadataFile(root));

  // Read as JavaScript reads it, the field is "\uFFFD", which is what would be
  // written: the content did not change, and the file is left as it is.
  await collect(root);
  expect((await fs.stat(metadataFile(root))).ino).toBe(before.ino);
  expect(await fs.readFile(metadataFile(root))).toEqual(notUtf8);
  expect((await readMetadata(root)).greeting).toMatchObject({
    context: '\uFFFD',
  });

  // A change rewrites it, as UTF-8.
  await fs.writeFile(
    path.join(root, 'src/b.ts'),
    useGreeting('./paraglide/messages.js')
  );
  await collect(root);
  const rewritten = await fs.readFile(metadataFile(root));
  expect(rewritten.includes(0xff)).toBe(false);
  expect(rewritten.toString('utf8')).toContain('"context": "\uFFFD"');
});

test('a metadata file that cannot be read is left alone, with a warning', async () => {
  const root = await writeProject('metadata-unreadable', {
    'src/a.ts': useGreeting('./paraglide/messages.js'),
  });
  // A directory where the file would be.
  await fs.mkdir(metadataFile(root));

  expect(await collect(root)).toEqual([
    '[paraglide-context] messages/en.metadata.json was not updated: it could not be read (EISDIR)',
  ]);
  expect(await messagesOf(root)).toEqual(['en.json', 'en.metadata.json']);
});

test.runIf(canLockFiles)(
  'a metadata file without permission to read it is left alone, with a warning',
  async () => {
    const root = await writeProject('metadata-locked', {
      'src/a.ts': useGreeting('./paraglide/messages.js'),
    });
    const handWritten = JSON.stringify({
      greeting: { context: 'On the home page' },
    });
    await fs.writeFile(metadataFile(root), handWritten);
    await lock(metadataFile(root), 0o000);

    expect(await collect(root)).toEqual([
      '[paraglide-context] messages/en.metadata.json was not updated: it could not be read (EACCES)',
    ]);

    await fs.chmod(metadataFile(root), 0o644);
    expect(await fs.readFile(metadataFile(root), 'utf8')).toBe(handWritten);
  }
);

test.runIf(canLockFiles)(
  'a write that fails rejects as `node:fs` would, and leaves no temporary file',
  async () => {
    const root = await writeProject('metadata-failed-write', {
      'src/a.ts': useGreeting('./paraglide/messages.js'),
    });
    const directory = path.join(root, 'messages');
    await lock(directory, 0o555);

    const failure = collect(root);
    await expect(failure).rejects.toMatchObject({
      code: 'EACCES',
      syscall: 'open',
      errno: expect.any(Number),
      path: expect.stringMatching(
        new RegExp(
          `^${metadataFile(root)}\\.${process.pid}\\.[0-9a-f-]{36}\\.tmp$`
        )
      ),
    });
    await expect(failure).rejects.toThrow(/^EACCES: permission denied, open '/);
    expect(await messagesOf(root)).toEqual(['en.json']);

    // A later write is not affected.
    await fs.chmod(directory, 0o755);
    expect(await collect(root)).toEqual([]);
    expect(await readSnippets(root)).toEqual([
      'src/a.ts: export const text = m.greeting();',
    ]);
    expect((await messagesOf(root)).sort()).toEqual([
      'en.json',
      'en.metadata.json',
    ]);
  }
);

test('a hand-written field nested too deep for JSON.stringify fails the write as it did', async () => {
  const root = await writeProject('metadata-too-deep', {
    'src/a.ts': useGreeting('./paraglide/messages.js'),
  });
  const deep = (depth: number) => '['.repeat(depth) + ']'.repeat(depth);
  const existing = `{"greeting": {"context": ${deep(20_000)}}}`;
  await fs.writeFile(metadataFile(root), existing);

  try {
    await expect(collect(root)).rejects.toThrow(RangeError);
    expect(await fs.readFile(metadataFile(root), 'utf8')).toBe(existing);
  } finally {
    // Too deep for the formatter as well, which reads the tests' directory.
    await fs.rm(metadataFile(root), { force: true });
  }
});

test('without a scan, nothing is written', async () => {
  const root = await writeProject('metadata-no-scan', {
    'src/a.ts': useGreeting('./paraglide/messages.js'),
  });
  const collector = createCollector(
    {},
    { root, logger: { warn() {}, info() {} }, resolver: nodeResolver() }
  );

  await collector.write();
  expect(await messagesOf(root)).toEqual(['en.json']);
});

test('a file analyzed again without usages has no snippets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-reanalyzed-'));
  const messages = '/app/src/paraglide/messages.js';
  const used = `import { m } from "./paraglide/messages.js";\nexport const text = m.greeting();\n`;
  const graph = new native.NativeGraph({
    targets: [{ name: 'message', kind: 'messages' }],
    outdirs: ['/app/src/paraglide'],
    sourceExtensions: [],
    detect: [],
  });
  const analyze = async (files: Record<string, string>) => {
    Object.entries(files).forEach(([file, code], order) =>
      graph.queueScript(file, order, code)
    );
    await graph.load([], []);
    const { specifiers } = graph.pendingSpecifiers();
    graph.setResolved(specifiers.map(() => messages));

    return (await graph.analyze(Object.keys(files))).files;
  };

  expect(
    await analyze({ '/app/src/a.ts': used, '/app/src/b.ts': used })
  ).toEqual(['/app/src/a.ts', '/app/src/b.ts']);
  graph.release();
  expect(
    await analyze({
      '/app/src/a.ts': 'export const text = "";\n',
      '/app/src/b.ts': used,
    })
  ).toEqual(['/app/src/b.ts']);

  const metadata = path.join(root, 'en.metadata.json');
  const input: MetadataInput = {
    // Both, as before.
    files: ['/app/src/a.ts', '/app/src/b.ts'],
    names: ['src/a.ts', 'src/b.ts'],
    targets: [messages],
    targetProjects: ['project.inlang'],
    projects: [
      {
        inlangProject: 'project.inlang',
        messageFiles: [{ metadata, keys: [['greeting', ['greeting']]] }],
      },
    ],
  };
  await graph.writeMetadata(JSON.stringify(input), 3);

  const written = JSON.parse(await fs.readFile(metadata, 'utf8'));
  expect(Object.keys(written.greeting.sourceCode)).toEqual(['src/b.ts']);
  await fs.rm(root, { recursive: true });
});

test('usages of a message in no inlang project count for none', async () => {
  const root = await writeProject('metadata-custom-target', {
    'src/a.ts': [
      useGreeting('./paraglide/messages.js'),
      'import { getLocale } from "./paraglide/runtime.js";',
      'export const locale = getLocale();',
      '',
    ].join('\n'),
  });

  expect(await collect(root)).toEqual([]);
  // Only the message's usage, not the runtime's.
  expect(Object.keys(await readMetadata(root))).toEqual(['greeting']);
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

test('a resolver of the caller is asked for each import, and finds the same usages', async () => {
  const root = await writeProject('metadata-custom-resolver', {
    'src/a.ts': use('~/paraglide/messages.js', 'greeting'),
    'src/b.ts': `import "node:fs";\n${use('./paraglide/messages.js', 'greeting')}`,
  });
  const resolve = nodeResolver({ alias: { '~': path.join(root, 'src') } });
  const asked: string[] = [];
  const collector = createCollector(
    {},
    {
      root,
      logger: { warn() {}, info() {} },
      // Not the resolver `nodeResolver` made: the analysis cannot resolve like it by itself.
      resolver: (specifier, importer) => {
        asked.push(specifier);
        return resolve(specifier, importer);
      },
    }
  );

  await collector.scanAll();
  await collector.write();

  expect(
    Object.keys((await readMetadata(root)).greeting?.sourceCode ?? {})
  ).toEqual(['src/a.ts', 'src/b.ts']);
  // Builtins are never asked about.
  expect(asked.sort()).toEqual([
    './paraglide/messages.js',
    '~/paraglide/messages.js',
  ]);
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
