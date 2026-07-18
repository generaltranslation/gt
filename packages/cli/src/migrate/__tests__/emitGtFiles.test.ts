import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emitGtFiles } from '../emitGtFiles.js';
import type { MessageCatalogs, MigrationContext } from '../types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

const tmpDirs: string[] = [];

function makeProject(
  files: Record<string, string>,
  skipped: string[] = []
): MigrationContext {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-emit-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: path.join(cwd, 'messages'),
  };
  return {
    cwd,
    catalogs,
    routing: {
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: path.join(cwd, 'src/i18n/routing.ts'),
      requestFile: path.join(cwd, 'src/i18n/request.ts'),
    },
    edits: [],
    todos: [],
    skippedFiles: new Map(skipped.map((file) => [file, ['reason']])),
    stats: {},
    adapter: nextIntlAdapter,
  };
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

const basePackageJson = JSON.stringify(
  {
    name: 'app',
    dependencies: { next: '15.0.0', 'next-intl': '^4.0.0', react: '19.0.0' },
  },
  null,
  2
);

describe('emitGtFiles', () => {
  it('emits gt.config.json, loadDictionary.ts, package.json edit, and deletions', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/i18n/routing.ts': '// routing',
      'src/i18n/request.ts': '// request',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));

    const config = JSON.parse(
      byPath.get(path.join(ctx.cwd, 'gt.config.json'))!.content!
    );
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['en', 'es']);
    expect(config.files.gt.output).toBe('public/_gt/[locale].json');

    const loader = byPath.get(path.join(ctx.cwd, 'src/loadDictionary.ts'))!;
    expect(loader.content).toContain('../messages/${locale}.json');
    expect(loader.content).toContain('export { loadDictionary }');

    const pkg = JSON.parse(
      byPath.get(path.join(ctx.cwd, 'package.json'))!.content!
    );
    expect(pkg.dependencies['next-intl']).toBeUndefined();
    expect(pkg.dependencies.next).toBe('15.0.0');

    expect(byPath.get(ctx.routing.routingFile!)!.kind).toBe('delete');
    expect(byPath.get(ctx.routing.requestFile!)!.kind).toBe('delete');
  });

  it('keeps next-intl and the i18n config files while skips remain', () => {
    const ctx = makeProject(
      {
        'package.json': basePackageJson,
        'src/i18n/routing.ts': '// routing',
        'src/i18n/request.ts': '// request',
        'messages/en.json': '{}',
      },
      ['src/components/Price.tsx']
    );
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));

    expect(byPath.has(ctx.routing.routingFile!)).toBe(false);
    expect(byPath.has(ctx.routing.requestFile!)).toBe(false);
    const pkgEdit = byPath.get(path.join(ctx.cwd, 'package.json'));
    if (pkgEdit) {
      const pkg = JSON.parse(pkgEdit.content!);
      expect(pkg.dependencies['next-intl']).toBeDefined();
    }
  });

  it('removes next-intl from peerDependencies too', () => {
    const ctx = makeProject({
      'package.json': JSON.stringify(
        {
          name: 'app',
          dependencies: { next: '15.0.0' },
          peerDependencies: { 'next-intl': '^4.0.0' },
        },
        null,
        2
      ),
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const pkgEdit = edits.find((edit) => edit.path.endsWith('package.json'))!;
    const pkg = JSON.parse(pkgEdit.content!);
    expect(pkg.peerDependencies['next-intl']).toBeUndefined();
  });

  it('survives a malformed package.json with a todo instead of crashing', () => {
    const ctx = makeProject({
      'package.json': '{ not json',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('package.json'))).toBe(
      false
    );
    expect(
      ctx.todos.some(
        (todo) =>
          todo.file.endsWith('package.json') && todo.reason.includes('by hand')
      )
    ).toBe(true);
  });

  it('threads the adapter displayName through teardown todos (not a hardcoded next-intl)', () => {
    // emitGtFiles is a shared file: its user-facing prose must name the source
    // library via adapter.displayName so a future adapter reads correctly.
    const fakeAdapter = { ...nextIntlAdapter, displayName: 'fake-i18n' };

    // package.json-unparseable teardown todo (emitGtFiles.ts ~128)
    const parseCtx = makeProject({
      'package.json': '{ not json',
      'messages/en.json': '{}',
    });
    parseCtx.adapter = fakeAdapter;
    emitGtFiles(parseCtx);
    expect(
      parseCtx.todos.some((todo) =>
        todo.reason.includes('remove the fake-i18n dependency by hand')
      )
    ).toBe(true);

    // kept-importer teardown todo (emitGtFiles.ts ~165)
    const importerCtx = makeProject({
      'package.json': basePackageJson,
      'src/i18n/routing.ts': '// routing',
      'src/i18n/request.ts': '// request',
      'src/lib/paths.ts': "import { routing } from '@/i18n/routing';",
      'messages/en.json': '{}',
    });
    importerCtx.adapter = fakeAdapter;
    importerCtx.sourceFiles = [path.join(importerCtx.cwd, 'src/lib/paths.ts')];
    emitGtFiles(importerCtx);
    expect(
      importerCtx.todos.some((todo) =>
        todo.reason.includes('migrate that reference off fake-i18n')
      )
    ).toBe(true);
  });

  it('keeps a routing file that a source file still imports', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/i18n/routing.ts': '// routing',
      'src/i18n/request.ts': '// request',
      'src/lib/paths.ts': "import { routing } from '@/i18n/routing';",
      'messages/en.json': '{}',
    });
    ctx.sourceFiles = [path.join(ctx.cwd, 'src/lib/paths.ts')];
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));

    // the still-imported routing file is kept and reported…
    expect(byPath.has(ctx.routing.routingFile!)).toBe(false);
    expect(
      ctx.todos.some(
        (todo) =>
          todo.file === ctx.routing.routingFile &&
          todo.reason.includes('paths.ts')
      )
    ).toBe(true);
    // …while the unreferenced request file is still deleted
    expect(byPath.get(ctx.routing.requestFile!)!.kind).toBe('delete');
  });

  it('resolves relative import specifiers when checking importers', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/i18n/routing.ts': '// routing',
      'src/i18n/request.ts': '// request',
      'src/i18n/helpers.ts': "import { routing } from './routing';",
      'messages/en.json': '{}',
    });
    ctx.sourceFiles = [path.join(ctx.cwd, 'src/i18n/helpers.ts')];
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));
    expect(byPath.has(ctx.routing.routingFile!)).toBe(false);
  });

  it('places loadDictionary inside src/ when the app uses a src dir', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/page.tsx': 'export {}',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const loader = edits.find((edit) => edit.path.includes('loadDictionary'))!;
    expect(loader.path).toBe(path.join(ctx.cwd, 'src/loadDictionary.ts'));
    expect(loader.content).toContain('../messages/${locale}.json');
  });

  it('merges into an existing gt.config.json', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'gt.config.json': JSON.stringify({ projectId: 'abc123' }),
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const configEdit = edits.find((edit) =>
      edit.path.endsWith('gt.config.json')
    )!;
    const config = JSON.parse(configEdit.content!);
    expect(config.projectId).toBe('abc123');
    expect(config.defaultLocale).toBe('en');
  });

  it('does not clobber an existing loadDictionary file', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'loadDictionary.ts': 'export default async function loadDictionary() {}',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('loadDictionary.ts'))).toBe(
      false
    );
    expect(
      ctx.todos.some((todo) => todo.reason.includes('loadDictionary'))
    ).toBe(true);
  });
});
